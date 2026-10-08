-- ============================================================
-- Fase 3: ciclo de vida da cotação (state machine) + ativação de
-- 'recusada' + Fase 7: limpeza do drift de schema
-- ============================================================
-- Contexto: o CHECK de quotes.status só permitia 5 valores, mas o
-- código usa 10 (fechado, faturado, em_transporte, implantado,
-- perdida também). 'recusada' existia em labels/cores/constraint
-- mas nunca era gravada de fato — handleReject mandava de volta
-- para 'rascunho'. As regras de transição estavam hardcoded dentro
-- do trigger guard_quotes_self_update, duplicadas conceitualmente
-- em vários pontos do front-end. E app_settings/profiles.desconto_comercial
-- existiam no banco real sem nunca terem sido criadas em SQL versionado.

-- ── 1. Corrige o CHECK de quotes.status (acha o nome real do constraint) ───
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.quotes'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  if v_conname is not null then
    execute format('alter table public.quotes drop constraint %I', v_conname);
  end if;
end;
$$;

alter table public.quotes add constraint quotes_status_check check (
  status in (
    'rascunho', 'enviada', 'aguardando_desconto', 'aprovada', 'recusada',
    'fechado', 'faturado', 'em_transporte', 'implantado', 'perdida'
  )
);

-- ── 2. Tabela de transições válidas (substitui a lista hardcoded no trigger) ─
-- from_status = '*' significa "qualquer status atual". requires_admin=false
-- reproduz exatamente o que o trigger já permitia a um não-admin hoje:
-- mover a cotação para um desses 5 estados de autosserviço a partir de
-- qualquer status atual. Qualquer outro alvo passa a exigir admin —
-- incluindo agora 'recusada', que antes nunca era de fato gravada.
create table if not exists public.quote_status_transitions (
  from_status    text not null,
  to_status      text not null,
  requires_admin boolean not null default true,
  primary key (from_status, to_status)
);

insert into public.quote_status_transitions (from_status, to_status, requires_admin) values
  ('*', 'rascunho',            false),
  ('*', 'enviada',             false),
  ('*', 'aguardando_desconto', false),
  ('*', 'fechado',             false),
  ('*', 'perdida',             false),
  ('*', 'aprovada',            true),
  ('*', 'recusada',            true),
  ('*', 'faturado',            true),
  ('*', 'em_transporte',       true),
  ('*', 'implantado',          true)
on conflict (from_status, to_status) do update set requires_admin = excluded.requires_admin;

alter table public.quote_status_transitions enable row level security;
drop policy if exists "quote_status_transitions_select" on public.quote_status_transitions;
create policy "quote_status_transitions_select" on public.quote_status_transitions
  for select using (true);
drop policy if exists "quote_status_transitions_write" on public.quote_status_transitions;
create policy "quote_status_transitions_write" on public.quote_status_transitions
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 3. guard_quotes_self_update agora consulta a tabela acima ───────────────
create or replace function public.guard_quotes_self_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status then
    if not exists (
      select 1 from public.quote_status_transitions t
      where t.to_status = new.status
        and (t.from_status = '*' or t.from_status = old.status)
        and not t.requires_admin
    ) then
      new.status := old.status;
    end if;
  end if;

  if coalesce(new.desconto_pct, 0) > coalesce(old.desconto_pct, 0) then
    new.desconto_pct := old.desconto_pct;
  end if;

  new.desconto_resposta := old.desconto_resposta;
  return new;
end;
$$;

-- ── 4. Fase 7: limpeza do drift de schema ───────────────────────────────────
-- profiles.desconto_comercial é referenciada por guard_profiles_self_update
-- desde a migração 20260831202205, mas nunca foi criada em SQL versionado
-- (só existe no banco ao vivo via alteração manual).
alter table public.profiles add column if not exists desconto_comercial numeric(5,2);

-- app_settings é referenciada pelas políticas da migração 20260831202205 e
-- usada pelo front-end (ProductsContext/notify.js), mas nunca teve um
-- CREATE TABLE em nenhum arquivo versionado — só existia no banco ao vivo.
-- Nota: numa instalação 100% do zero, as políticas da migração anterior
-- precisam ser recriadas depois deste CREATE TABLE (ordem histórica);
-- em qualquer banco já em produção isto é um no-op seguro.
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;
