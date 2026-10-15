-- ============================================================
-- Reatribuição de dono também funciona ao atualizar (não só criar)
-- ============================================================
-- Contexto: save_quote_with_items só aplicava p_target_user_id no INSERT
-- (primeiro save da cotação). Se o admin montasse o kit, salvasse uma vez
-- (gerando o rascunho/numero_orcamento) e só DEPOIS escolhesse o cliente
-- cadastrado em "Personalizar proposta", o próximo save (update) nunca
-- reatribuía o dono — a cotação ficava presa na conta do admin pra sempre,
-- mesmo o painel mostrando o cliente certo no kit_data.

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
    on pcp.version_id = v_catalog_version and pcp.codigo = elem->>'codigo_sap';

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
    on pcp.version_id = v_catalog_version and pcp.codigo = elem->>'codigo_sap';

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
    on pcp.version_id = v_catalog_version and pcp.codigo = elem->>'codigo_sap';

  return query select v_quote_id, v_subtotal, v_total_final;
end;
$$;
