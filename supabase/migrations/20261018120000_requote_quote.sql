-- ============================================================
-- Atualização rápida de cotação vencida: preço vigente ou só validade
-- ============================================================
-- Contexto: quando uma cotação vence (ou a lista de preços muda), o único
-- jeito de reprecificar/renovar validade era o admin reabrir o kit inteiro
-- e salvar de novo. Essa RPC dá um atalho de um clique a partir da lista de
-- cotações: ou reprecifica pela lista publicada agora + renova a validade,
-- ou só renova a validade mantendo o preço atual (sem reprecificar).

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

revoke all on function public.requote_quote(uuid, boolean) from public;
grant execute on function public.requote_quote(uuid, boolean) to authenticated;
