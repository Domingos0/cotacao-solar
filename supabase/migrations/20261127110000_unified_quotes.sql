-- Proposta unificada salva como cotação própria + regra de fechamento.
--
-- save_unified_quote: várias cotações abertas do mesmo cliente (mesmo dono ou
--   mesmo CNPJ) viram UMA cotação nova (número EFF próprio, kit_type
--   'unificada'), com os materiais somados por SAP e o total = soma dos totais
--   das cotações − desconto do pacote (desconto só vale se quem chama é admin).
--   As cotações de origem ficam marcadas com data.unificadaEm = {id, numero}.
--
-- Gatilho de fechamento (vale pra qualquer caminho: botão Fechar, funil do
-- admin, atualização direta):
--   • fechar a UNIFICADA → as cotações de origem viram 'fechado' e registram
--     data.fechamento = {tipo:'unificada', unificadaId, numero, junto:[...]}
--   • fechar uma cotação de origem SOZINHA → registra {tipo:'unitario'} e a
--     unificada é cancelada (status 'perdida', data.cancelada) — pra nunca
--     ficarem duas propostas valendo ao mesmo tempo
--   • cotação comum fechada → registra {tipo:'unitario'}
--
-- Idempotente: pode rodar de novo.

create or replace function public.save_unified_quote(
  p_quote_ids uuid[],
  p_desconto_pacote numeric default 0,
  p_apresentacao jsonb default '{}'::jsonb
)
returns table (quote_id uuid, numero text, total_final numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd          int;
  v_encontradas  int;
  v_donos        int;
  v_cnpjs        int;
  v_sem_cnpj     int;
  v_sem_cadastro int;
  v_fechadas     int;
  v_ja_unificada int;
  v_owner        uuid;
  v_pct          numeric := 0;
  v_bruto        numeric(12,2);
  v_total        numeric(12,2);
  v_subtotal     numeric(12,2);
  v_kwp          numeric;
  v_valid        date;
  v_fretes       text;
  v_numero       text;
  v_id           uuid;
  v_origem       jsonb;
  v_primeira     jsonb;
begin
  v_qtd := coalesce(array_length(p_quote_ids, 1), 0);
  if v_qtd < 2 then
    raise exception 'Selecione 2 ou mais cotações para unificar';
  end if;

  select count(*),
         count(distinct q.user_id),
         count(distinct nullif(regexp_replace(coalesce(p.cnpj, ''), '\D', '', 'g'), '')),
         count(*) filter (where nullif(regexp_replace(coalesce(p.cnpj, ''), '\D', '', 'g'), '') is null),
         count(*) filter (where q.data->>'clienteCadastrado' = 'false'),
         count(*) filter (where q.status in ('fechado','faturado','em_transporte','implantado','perdida')),
         count(*) filter (where q.data ? 'unificadaEm' and exists (
           select 1 from public.quotes u
           where u.id = (q.data->'unificadaEm'->>'id')::uuid
             and u.status <> 'perdida'
         ))
    into v_encontradas, v_donos, v_cnpjs, v_sem_cnpj, v_sem_cadastro, v_fechadas, v_ja_unificada
  from public.quotes q
  left join public.profiles p on p.id = q.user_id
  where q.id = any(p_quote_ids);

  if v_encontradas <> v_qtd then
    raise exception 'Cotação não encontrada';
  end if;
  if not public.is_admin() and exists (
    select 1 from public.quotes q where q.id = any(p_quote_ids) and q.user_id <> auth.uid()
  ) then
    raise exception 'not authorized';
  end if;
  -- mesmo dono, ou mesmo CNPJ (todas com CNPJ e de cliente cadastrado)
  if not (v_donos = 1 or (v_cnpjs = 1 and v_sem_cnpj = 0 and v_sem_cadastro = 0)) then
    raise exception 'Só dá pra unificar cotações do mesmo cliente (mesmo CNPJ)';
  end if;
  if v_fechadas > 0 then
    raise exception 'Há cotação já fechada ou perdida na seleção';
  end if;
  if v_ja_unificada > 0 then
    raise exception 'Há cotação que já faz parte de outra proposta unificada';
  end if;
  if exists (select 1 from public.quotes q where q.id = any(p_quote_ids) and q.data->>'unificada' = 'true') then
    raise exception 'Uma proposta unificada não pode entrar em outra unificação';
  end if;

  if public.is_admin() then
    v_pct := greatest(0, least(100, coalesce(p_desconto_pacote, 0)));
  end if;

  select sum(q.total_final), sum(q.subtotal), sum(coalesce(q.kwp, 0)), min(q.valid_until),
         string_agg(distinct q.frete_nome, ' / ')
    into v_bruto, v_subtotal, v_kwp, v_valid, v_fretes
  from public.quotes q where q.id = any(p_quote_ids);

  v_total := round(v_bruto * (1 - v_pct / 100), 2);

  select q.user_id, q.data into v_owner, v_primeira
  from public.quotes q where q.id = any(p_quote_ids)
  order by q.created_at limit 1;

  select jsonb_agg(jsonb_build_object(
           'id', q.id,
           'numero', coalesce(q.data->>'numero_orcamento', left(q.id::text, 8)),
           'revisao', coalesce((q.data->>'revisao')::int, 0),
           'kwp', q.kwp,
           'total', q.total_final,
           'clienteNome', q.data->>'clienteNome'
         ) order by q.created_at)
    into v_origem
  from public.quotes q where q.id = any(p_quote_ids);

  v_numero := public.next_orcamento_number();

  insert into public.quotes (
    user_id, nome_projeto, kit_type, kwp, subtotal, desconto_pct,
    frete_nome, frete_pct, total_final, status, data, valid_until
  ) values (
    v_owner,
    'Proposta unificada — ' || v_qtd || ' kits',
    'unificada',
    v_kwp,
    v_subtotal,
    0,
    v_fretes,
    1,
    v_total,
    'enviada',
    jsonb_build_object(
      'numero_orcamento', v_numero,
      'revisao', 0,
      'unificada', true,
      'origem', v_origem,
      'descontoPacote', jsonb_build_object('pct', v_pct, 'bruto', v_bruto),
      'clienteNome', v_primeira->>'clienteNome',
      'clienteCidade', v_primeira->>'clienteCidade',
      'clienteUF', v_primeira->>'clienteUF',
      'clienteCadastrado', true,
      'apresentacao', coalesce(p_apresentacao, '{}'::jsonb),
      'criadoPorAdmin', public.is_admin()
    ),
    v_valid
  )
  returning id into v_id;

  -- materiais somados por SAP (itens sem SAP, ou com '—', agrupados pelo produto)
  insert into public.quote_items (quote_id, label, produto, codigo_sap, qty, unit, preco_unit, total, ordem)
  select v_id, min(g.label), min(g.produto), min(g.codigo_sap),
         sum(g.qty), min(g.unit), max(g.preco_unit), sum(g.total),
         row_number() over (order by min(coalesce(g.ordem, 999)), min(g.label))
  from (
    select qi.*,
           case when coalesce(qi.codigo_sap, '') in ('', '—') then 'p:' || coalesce(qi.produto, qi.label, '')
                else 's:' || qi.codigo_sap end as chave
    from public.quote_items qi
    where qi.quote_id = any(p_quote_ids)
  ) g
  group by g.chave;

  update public.quotes q
     set data = coalesce(q.data, '{}'::jsonb) || jsonb_build_object('unificadaEm', jsonb_build_object('id', v_id, 'numero', v_numero))
   where q.id = any(p_quote_ids);

  return query select v_id, v_numero, v_total;
end;
$$;

grant execute on function public.save_unified_quote(uuid[], numeric, jsonb) to authenticated;

-- ── Regra de fechamento ──────────────────────────────────────────────────────
create or replace function public.quotes_fechamento_unificada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero text;
  v_origem_ids uuid[];
  v_unif_id uuid;
begin
  if new.status is distinct from 'fechado' or old.status is not distinct from 'fechado' then
    return new;
  end if;

  if coalesce(new.data->>'unificada', '') = 'true' then
    -- fechou a unificada → fecha as cotações de origem
    v_numero := new.data->>'numero_orcamento';
    select array_agg((o->>'id')::uuid) into v_origem_ids
    from jsonb_array_elements(coalesce(new.data->'origem', '[]'::jsonb)) o;

    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('fechamento',
      jsonb_build_object('tipo', 'unificada_principal', 'em', now()));

    update public.quotes q set
      status = 'fechado',
      data = coalesce(q.data, '{}'::jsonb) || jsonb_build_object('fechamento', jsonb_build_object(
        'tipo', 'unificada',
        'unificadaId', new.id,
        'numero', v_numero,
        'junto', (select coalesce(jsonb_agg(o->>'numero'), '[]'::jsonb)
                  from jsonb_array_elements(coalesce(new.data->'origem', '[]'::jsonb)) o
                  where (o->>'id')::uuid <> q.id),
        'em', now()))
    where q.id = any(coalesce(v_origem_ids, '{}'))
      and q.status not in ('fechado','faturado','em_transporte','implantado','perdida');
    return new;
  end if;

  -- já veio marcada como fechada pela unificada (cascata acima): nada a fazer
  if coalesce(new.data->'fechamento'->>'tipo', '') = 'unificada' then
    return new;
  end if;

  -- fechou sozinha
  new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('fechamento',
    jsonb_build_object('tipo', 'unitario', 'em', now()));

  -- se fazia parte de uma unificada aberta, ela deixa de valer
  if new.data ? 'unificadaEm' then
    v_unif_id := (new.data->'unificadaEm'->>'id')::uuid;
    update public.quotes u set
      status = 'perdida',
      motivo_perda = 'outro',
      data = coalesce(u.data, '{}'::jsonb) || jsonb_build_object('cancelada', jsonb_build_object(
        'motivo', coalesce(new.data->>'numero_orcamento', 'Uma cotação') || ' foi fechada sozinha',
        'em', now()))
    where u.id = v_unif_id
      and u.status not in ('fechado','faturado','em_transporte','implantado','perdida');
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_fechamento_unificada on public.quotes;
create trigger quotes_fechamento_unificada
  before update of status on public.quotes
  for each row execute function public.quotes_fechamento_unificada();
