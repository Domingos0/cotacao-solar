-- ============================================================
-- Corrige "column reference "total_final" is ambiguous"
-- ============================================================
-- Mesma causa da migração anterior (quote_id ambíguo): a função
-- approve_quote_discount tem `returns table (quote_id uuid,
-- total_final numeric)`, então o Postgres cria uma variável de saída
-- implícita chamada "total_final". O SELECT que lê a cotação
-- referenciava a coluna quotes.total_final sem qualificar a tabela,
-- e o Postgres não sabia se era a coluna ou a variável de retorno.
-- Esta migração só qualifica essa referência (mesma lógica, sem
-- nenhuma mudança de comportamento).

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

  select q.frete_pct, q.total_final, q.data into v_frete_pct, v_total_original, v_data
  from public.quotes q where q.id = p_quote_id;

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
