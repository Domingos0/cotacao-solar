-- ============================================================
-- Fase 2: validação de preço no servidor
-- ============================================================
-- Contexto: subtotal/total_final/preco_unit eram 100% calculados no
-- navegador (fatores F1..F4 hardcoded no KitBuilder.jsx) e gravados
-- direto via insert/update em quotes/quote_items — nada no banco
-- recalculava ou validava isso. A aprovação de desconto também só
-- "revertia" matematicamente o total_final já enviado pelo cliente,
-- herdando qualquer erro/manipulação. E o guard_quotes_self_update
-- vira no-op para is_admin(), então um JWT de admin forjado podia
-- gravar qualquer preço.
--
-- Esta migração move o cálculo para dentro do banco: o preço de cada
-- item vem de price_catalog_products (versão publicada) sempre que o
-- codigo_sap bate com um produto do catálogo — o preco_unit enviado
-- pelo cliente só é usado como fallback para itens avulsos (sem
-- correspondência no catálogo, ex: itens digitados manualmente pelo
-- vendedor), que continuam com preço livre como já funcionava.

-- ── 1. compute_total_final — fatores de precificação centralizados ─────────
create or replace function public.compute_total_final(p_subtotal numeric, p_desconto_pct numeric, p_frete_pct numeric)
returns numeric
language sql
immutable
as $$
  select round(
    p_subtotal * 0.63 * 0.92 * 0.95 * 0.93 * (1 - coalesce(p_desconto_pct, 0) / 100) * coalesce(p_frete_pct, 1),
    2
  );
$$;

-- ── 2. save_quote_with_items — salva cotação + itens com preço server-side ──
-- p_quote_id = null → cria uma cotação nova; caso contrário, atualiza.
-- Qualquer parâmetro (exceto p_items) pode ser null para "manter o valor atual".
-- p_items: array jsonb de {label, produto, codigo_sap, qty, unit, preco_unit}.
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
  v_quote_id        uuid := p_quote_id;
  v_owner           uuid;
  v_nome_projeto    text;
  v_kit_type        text;
  v_kwp             numeric;
  v_desconto_pct    numeric;
  v_frete_nome      text;
  v_frete_pct       numeric;
  v_status          text;
  v_kit_data        jsonb;
  v_catalog_version uuid := public.current_catalog_version();
  v_subtotal        numeric(12,2);
  v_total_final     numeric(12,2);
  v_items           jsonb := coalesce(p_items, '[]'::jsonb);
begin
  if v_quote_id is not null then
    select user_id, nome_projeto, kit_type, kwp, desconto_pct, frete_nome, frete_pct, status, data
      into v_owner, v_nome_projeto, v_kit_type, v_kwp, v_desconto_pct, v_frete_nome, v_frete_pct, v_status, v_kit_data
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

  -- preço autoritativo: catálogo publicado por codigo_sap; fallback = preço
  -- enviado pelo cliente, só usado quando não há produto correspondente
  -- no catálogo (itens avulsos/digitados manualmente)
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
      frete_nome, frete_pct, total_final, status, data
    ) values (
      auth.uid(), v_nome_projeto, v_kit_type, v_kwp, v_subtotal, v_desconto_pct,
      v_frete_nome, v_frete_pct, v_total_final, v_status, v_kit_data
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
      data         = v_kit_data
    where id = v_quote_id;
  end if;

  delete from public.quote_items where quote_id = v_quote_id;

  insert into public.quote_items (quote_id, label, produto, codigo_sap, qty, unit, preco_unit, total)
  select
    v_quote_id,
    elem->>'label',
    elem->>'produto',
    elem->>'codigo_sap',
    coalesce((elem->>'qty')::numeric, 0),
    elem->>'unit',
    coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0),
    round(
      coalesce((elem->>'qty')::numeric, 0) * coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0),
      2
    )
  from jsonb_array_elements(v_items) elem
  left join public.price_catalog_products pcp
    on pcp.version_id = v_catalog_version and pcp.codigo = elem->>'codigo_sap';

  return query select v_quote_id, v_subtotal, v_total_final;
end;
$$;

revoke all on function public.save_quote_with_items(uuid, text, text, numeric, numeric, text, numeric, text, jsonb, jsonb) from public;
grant execute on function public.save_quote_with_items(uuid, text, text, numeric, numeric, text, numeric, text, jsonb, jsonb) to authenticated;

-- ── 3. approve_quote_discount — recalcula a partir dos quote_items persistidos ──
-- Substitui a matemática reversa (base = total_final / ((1-oldDesconto%)*fretePct))
-- que herdava qualquer erro do total enviado pelo cliente.
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

  select coalesce(sum(qty * preco_unit), 0) into v_subtotal
  from public.quote_items where quote_id = p_quote_id;

  v_total_final := public.compute_total_final(v_subtotal, p_pct, v_frete_pct);

  update public.quotes set
    status             = 'aprovada',
    desconto_pct        = p_pct,
    total_final         = v_total_final,
    desconto_resposta   = p_resposta,
    data                = coalesce(v_data, '{}'::jsonb) || jsonb_build_object('total_antes_desconto', v_total_original)
  where id = p_quote_id;

  return query select p_quote_id, v_total_final;
end;
$$;

revoke all on function public.approve_quote_discount(uuid, numeric, text) from public;
grant execute on function public.approve_quote_discount(uuid, numeric, text) to authenticated;
