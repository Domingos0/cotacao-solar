-- ============================================================
-- Corrige join ambíguo por SAP em save_quote_with_items/requote_quote
-- ============================================================
-- Contexto: a migração 20261118130000 removeu a trava de unicidade de
-- price_catalog_products (version_id, codigo) porque produtos legítimos
-- compartilham o mesmo SAP (ex: as 24 variantes de estrutura Solo, uma por
-- região/módulo, todas com o código 15288210). Mas save_quote_with_items()
-- e requote_quote() ainda casam o preço publicado só por
-- "pcp.codigo = item.codigo_sap" — com várias linhas por SAP na tabela,
-- esse join vira ambíguo: o Postgres pode pegar QUALQUER uma das linhas com
-- aquele SAP (ex: o preço da "Região 4 e 5" numa cotação que originalmente
-- usou "Região 1"), de forma não-determinística. Isso acontece exatamente
-- ao reprecificar "pela lista vigente" (requote de cotação vencida, ou
-- qualquer save depois de uma importação nova) — a cotação podia voltar com
-- o preço de um item completamente diferente, mesmo SAP, nome errado.
--
-- Fix: casa também pelo nome do produto (pcp.data->>'nome' = item.produto),
-- igual à convenção já usada no resto do app pra desambiguar SAP duplicado
-- ("match por SAP+nome", ver comentários em AdminPage.jsx). Sem match exato
-- de nome, cai no preço já salvo no item em vez de arriscar pegar o de
-- outra variante.

create or replace function public.save_quote_with_items(
  p_quote_id       uuid,
  p_nome_projeto   text,
  p_kit_type       text,
  p_kwp            numeric,
  p_desconto_pct   numeric,
  p_frete_nome     text,
  p_frete_pct      numeric,
  p_status         text,
  p_kit_data       jsonb,
  p_items          jsonb,
  p_target_user_id uuid default null
)
returns table (quote_id uuid, subtotal numeric, total_final numeric)
language plpgsql
security definer
as $$
declare
  v_quote_id         uuid := p_quote_id;
  v_owner            uuid;
  v_owner_for_insert uuid;
  v_nome_projeto     text;
  v_kit_type         text;
  v_kwp              numeric;
  v_desconto_pct     numeric;
  v_frete_nome       text;
  v_frete_pct        numeric;
  v_status           text;
  v_kit_data         jsonb;
  v_price_locked     boolean := false;
  v_current_version  uuid;
  v_catalog_version  uuid;
  v_validity_days    int;
  v_subtotal         numeric(12,2);
  v_total_final      numeric(12,2);
  v_items            jsonb := coalesce(p_items, '[]'::jsonb);
  v_revisao          int;
  v_version_id       uuid;
begin
  if v_quote_id is not null then
    select user_id, nome_projeto, kit_type, kwp, desconto_pct, frete_nome, frete_pct, status, data,
           price_locked, current_version_id
      into v_owner, v_nome_projeto, v_kit_type, v_kwp, v_desconto_pct, v_frete_nome, v_frete_pct, v_status, v_kit_data,
           v_price_locked, v_current_version
    from public.quotes where id = v_quote_id;

    if v_owner is null then
      raise exception 'quote not found';
    end if;
    if v_owner <> auth.uid() and not public.is_admin() then
      raise exception 'not authorized';
    end if;
  end if;

  v_nome_projeto := coalesce(p_nome_projeto, v_nome_projeto);
  v_kit_type     := coalesce(p_kit_type, v_kit_type);
  v_kwp          := coalesce(p_kwp, v_kwp);
  v_desconto_pct := coalesce(p_desconto_pct, v_desconto_pct, 0);
  v_frete_nome   := coalesce(p_frete_nome, v_frete_nome);
  v_frete_pct    := coalesce(p_frete_pct, v_frete_pct, 1);
  v_status       := coalesce(p_status, v_status, 'rascunho');
  v_kit_data     := coalesce(p_kit_data, v_kit_data);

  if v_price_locked and v_current_version is not null then
    select catalog_version_id into v_catalog_version from public.quote_versions where id = v_current_version;
  else
    v_catalog_version := public.current_catalog_version();
  end if;

  select coalesce(validity_days, 7) into v_validity_days
  from public.price_catalog_versions where id = v_catalog_version;
  v_validity_days := coalesce(v_validity_days, 7);

  select coalesce(sum(
    coalesce((elem->>'qty')::numeric, 0) *
    coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0)
  ), 0)
  into v_subtotal
  from jsonb_array_elements(v_items) elem
  left join public.price_catalog_products pcp
    on pcp.version_id = v_catalog_version
    and pcp.codigo = elem->>'codigo_sap'
    and pcp.data->>'nome' = elem->>'produto';

  v_total_final := public.compute_total_final(v_subtotal, v_desconto_pct, v_frete_pct);

  if v_quote_id is null then
    -- p_target_user_id só é respeitado se quem chama é admin; senão a
    -- cotação é sempre do próprio usuário autenticado, como sempre foi.
    if p_target_user_id is not null and public.is_admin() then
      v_owner_for_insert := p_target_user_id;
    else
      v_owner_for_insert := auth.uid();
    end if;

    insert into public.quotes (
      user_id, nome_projeto, kit_type, kwp, subtotal, desconto_pct,
      frete_nome, frete_pct, total_final, status, data, valid_until
    ) values (
      v_owner_for_insert, v_nome_projeto, v_kit_type, v_kwp, v_subtotal, v_desconto_pct,
      v_frete_nome, v_frete_pct, v_total_final, v_status, v_kit_data, (current_date + v_validity_days)
    )
    returning id into v_quote_id;
  else
    update public.quotes set
      nome_projeto = v_nome_projeto,
      kit_type     = v_kit_type,
      kwp          = v_kwp,
      subtotal     = v_subtotal,
      desconto_pct = v_desconto_pct,
      frete_nome   = v_frete_nome,
      frete_pct    = v_frete_pct,
      total_final  = v_total_final,
      status       = v_status,
      data         = v_kit_data,
      valid_until  = (current_date + v_validity_days),
      expired_notified_at = null,
      -- Admin pode reatribuir o dono a qualquer momento (não só na criação),
      -- ex: escolheu o cliente cadastrado só depois do primeiro rascunho.
      user_id      = case when p_target_user_id is not null and public.is_admin() then p_target_user_id else user_id end
    where id = v_quote_id;
  end if;

  delete from public.quote_items qi where qi.quote_id = v_quote_id;

  insert into public.quote_items (quote_id, label, produto, codigo_sap, qty, unit, preco_unit, total, ordem)
  select
    v_quote_id,
    elem->>'label', elem->>'produto', elem->>'codigo_sap',
    coalesce((elem->>'qty')::numeric, 0), elem->>'unit',
    coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0),
    round(coalesce((elem->>'qty')::numeric, 0) * coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0), 2),
    ord - 1
  from jsonb_array_elements(v_items) with ordinality as t(elem, ord)
  left join public.price_catalog_products pcp
    on pcp.version_id = v_catalog_version
    and pcp.codigo = elem->>'codigo_sap'
    and pcp.data->>'nome' = elem->>'produto';

  select coalesce(max(qv.revisao), -1) + 1 into v_revisao
  from public.quote_versions qv where qv.quote_id = v_quote_id;

  insert into public.quote_versions (
    quote_id, revisao, catalog_version_id, subtotal, desconto_pct,
    frete_nome, frete_pct, total_final, kit_data, valid_until, created_by
  ) values (
    v_quote_id, v_revisao, v_catalog_version, v_subtotal, v_desconto_pct,
    v_frete_nome, v_frete_pct, v_total_final, v_kit_data, (current_date + v_validity_days), auth.uid()
  )
  returning id into v_version_id;

  update public.quotes set current_version_id = v_version_id where id = v_quote_id;

  insert into public.quote_item_snapshots (quote_version_id, label, produto, codigo_sap, qty, unit, preco_unit, total, ordem)
  select
    v_version_id,
    elem->>'label', elem->>'produto', elem->>'codigo_sap',
    coalesce((elem->>'qty')::numeric, 0), elem->>'unit',
    coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0),
    round(coalesce((elem->>'qty')::numeric, 0) * coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0), 2),
    ord - 1
  from jsonb_array_elements(v_items) with ordinality as t(elem, ord)
  left join public.price_catalog_products pcp
    on pcp.version_id = v_catalog_version
    and pcp.codigo = elem->>'codigo_sap'
    and pcp.data->>'nome' = elem->>'produto';

  return query select v_quote_id, v_subtotal, v_total_final;
end;
$$;

-- ── requote_quote: mesma correção no UPDATE...FROM ──────────────────────────
create or replace function public.requote_quote(p_quote_id uuid, p_reprice boolean default true)
returns table (quote_id uuid, subtotal numeric, total_final numeric, valid_until date)
language plpgsql
security definer
as $$
declare
  v_desconto_pct     numeric(5,2);
  v_frete_pct        numeric(6,4);
  v_kit_data         jsonb;
  v_current_version  uuid;
  v_catalog_version  uuid;
  v_validity_days    int;
  v_subtotal         numeric(12,2);
  v_total_final      numeric(12,2);
  v_revisao          int;
  v_version_id       uuid;
  v_valid_until      date;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select desconto_pct, frete_pct, data, current_version_id
    into v_desconto_pct, v_frete_pct, v_kit_data, v_current_version
  from public.quotes where id = p_quote_id;

  if not found then
    raise exception 'quote not found';
  end if;

  if p_reprice then
    v_catalog_version := public.current_catalog_version();
  elsif v_current_version is not null then
    select catalog_version_id into v_catalog_version from public.quote_versions where id = v_current_version;
  else
    v_catalog_version := public.current_catalog_version();
  end if;

  select coalesce(validity_days, 7) into v_validity_days
  from public.price_catalog_versions where id = v_catalog_version;
  v_validity_days := coalesce(v_validity_days, 7);
  v_valid_until := (current_date + v_validity_days);

  if p_reprice then
    update public.quote_items qi set
      preco_unit = coalesce(pcp.preco, qi.preco_unit),
      total      = round(qi.qty * coalesce(pcp.preco, qi.preco_unit), 2)
    from public.price_catalog_products pcp
    where pcp.version_id = v_catalog_version
      and pcp.codigo = qi.codigo_sap
      and pcp.data->>'nome' = qi.produto
      and qi.quote_id = p_quote_id;

    select coalesce(sum(qty * preco_unit), 0) into v_subtotal
    from public.quote_items where quote_id = p_quote_id;

    v_total_final := public.compute_total_final(v_subtotal, v_desconto_pct, v_frete_pct);

    update public.quotes set
      subtotal     = v_subtotal,
      total_final  = v_total_final,
      price_locked = false,
      valid_until  = v_valid_until,
      expired_notified_at = null
    where id = p_quote_id;

    select coalesce(max(qv.revisao), -1) + 1 into v_revisao
    from public.quote_versions qv where qv.quote_id = p_quote_id;

    insert into public.quote_versions (
      quote_id, revisao, catalog_version_id, subtotal, desconto_pct,
      frete_nome, frete_pct, total_final, kit_data, valid_until, created_by
    )
    select p_quote_id, v_revisao, v_catalog_version, v_subtotal, v_desconto_pct,
           frete_nome, v_frete_pct, v_total_final, v_kit_data, v_valid_until, auth.uid()
    from public.quotes where id = p_quote_id
    returning id into v_version_id;

    update public.quotes set current_version_id = v_version_id where id = p_quote_id;

    insert into public.quote_item_snapshots (quote_version_id, label, produto, codigo_sap, qty, unit, preco_unit, total)
    select v_version_id, label, produto, codigo_sap, qty, unit, preco_unit, total
    from public.quote_items where quote_id = p_quote_id;
  else
    select coalesce(sum(qty * preco_unit), 0) into v_subtotal
    from public.quote_items where quote_id = p_quote_id;

    v_total_final := public.compute_total_final(v_subtotal, v_desconto_pct, v_frete_pct);

    update public.quotes set
      valid_until  = v_valid_until,
      expired_notified_at = null
    where id = p_quote_id;
  end if;

  perform public.log_activity('requote_quote', jsonb_build_object('quote_id', p_quote_id, 'reprice', p_reprice, 'valid_until', v_valid_until));

  return query select p_quote_id, v_subtotal, v_total_final, v_valid_until;
end;
$$;
