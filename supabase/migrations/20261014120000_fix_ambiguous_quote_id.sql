-- ============================================================
-- Corrige "column reference "quote_id" is ambiguous"
-- ============================================================
-- Contexto: save_quote_with_items e approve_quote_discount têm
-- `returns table (quote_id uuid, ...)` — o Postgres cria uma variável
-- de saída implícita chamada "quote_id" dentro da função. Em alguns
-- pontos do corpo, a coluna quote_items.quote_id (ou
-- quote_versions.quote_id) era referenciada sem qualificar a tabela,
-- então o Postgres não sabia se "quote_id" era a coluna ou a variável
-- de retorno — daí o erro ao salvar/aprovar cotação. Esta migração
-- só qualifica essas referências (mesma lógica, sem nenhuma mudança
-- de comportamento).

create or replace function public.save_quote_with_items(
  p_quote_id     uuid,
  p_nome_projeto text,
  p_kit_type     text,
  p_kwp          numeric,
  p_desconto_pct numeric,
  p_frete_nome   text,
  p_frete_pct    numeric,
  p_status       text,
  p_kit_data     jsonb,
  p_items        jsonb
)
returns table (quote_id uuid, subtotal numeric, total_final numeric)
language plpgsql
security definer
as $$
declare
  v_quote_id         uuid := p_quote_id;
  v_owner            uuid;
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
    insert into public.quotes (
      user_id, nome_projeto, kit_type, kwp, subtotal, desconto_pct,
      frete_nome, frete_pct, total_final, status, data, valid_until
    ) values (
      auth.uid(), v_nome_projeto, v_kit_type, v_kwp, v_subtotal, v_desconto_pct,
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
      valid_until  = (current_date + v_validity_days)
    where id = v_quote_id;
  end if;

  delete from public.quote_items qi where qi.quote_id = v_quote_id;

  insert into public.quote_items (quote_id, label, produto, codigo_sap, qty, unit, preco_unit, total)
  select
    v_quote_id,
    elem->>'label', elem->>'produto', elem->>'codigo_sap',
    coalesce((elem->>'qty')::numeric, 0), elem->>'unit',
    coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0),
    round(coalesce((elem->>'qty')::numeric, 0) * coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0), 2)
  from jsonb_array_elements(v_items) elem
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

  insert into public.quote_item_snapshots (quote_version_id, label, produto, codigo_sap, qty, unit, preco_unit, total)
  select
    v_version_id,
    elem->>'label', elem->>'produto', elem->>'codigo_sap',
    coalesce((elem->>'qty')::numeric, 0), elem->>'unit',
    coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0),
    round(coalesce((elem->>'qty')::numeric, 0) * coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0), 2)
  from jsonb_array_elements(v_items) elem
  left join public.price_catalog_products pcp
    on pcp.version_id = v_catalog_version and pcp.codigo = elem->>'codigo_sap';

  return query select v_quote_id, v_subtotal, v_total_final;
end;
$$;

create or replace function public.approve_quote_discount(p_quote_id uuid, p_pct numeric, p_resposta text)
returns table (quote_id uuid, total_final numeric)
language plpgsql
security definer
as $$
declare
  v_subtotal       numeric(12,2);
  v_frete_pct      numeric(6,4);
  v_total_original numeric(12,2);
  v_data           jsonb;
  v_total_final    numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'invalid discount percent';
  end if;

  select frete_pct, total_final, data into v_frete_pct, v_total_original, v_data
  from public.quotes where id = p_quote_id;

  if not found then
    raise exception 'quote not found';
  end if;

  select coalesce(sum(qi.qty * qi.preco_unit), 0) into v_subtotal
  from public.quote_items qi where qi.quote_id = p_quote_id;

  v_total_final := public.compute_total_final(v_subtotal, p_pct, v_frete_pct);

  update public.quotes set
    status             = 'aprovada',
    desconto_pct        = p_pct,
    total_final         = v_total_final,
    desconto_resposta   = p_resposta,
    data                = coalesce(v_data, '{}'::jsonb) || jsonb_build_object('total_antes_desconto', v_total_original)
  where id = p_quote_id;

  perform public.log_activity('approve_quote_discount', jsonb_build_object('quote_id', p_quote_id, 'pct', p_pct));

  return query select p_quote_id, v_total_final;
end;
$$;
