-- Item 40: mostrar o status da sincronização com o CRM no Admin.
-- A sync-crm sempre foi fire-and-forget — nada ficava gravado sobre se a
-- última sincronização de uma cotação deu certo. Esta tabela registra cada
-- tentativa (sucesso, pulada ou erro), só gravada pela Edge Function
-- (service_role), no mesmo molde do notification_log (item 28).

create table if not exists public.crm_sync_log (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  quote_id        uuid references public.quotes(id) on delete set null,
  numero_cotacao  text,
  cliente_nome    text,
  status          text not null check (status in ('ok', 'skipped', 'error')),
  reason          text,
  crm_status_code int
);

create index if not exists crm_sync_log_created_at_idx on public.crm_sync_log (created_at desc);
create index if not exists crm_sync_log_quote_id_idx on public.crm_sync_log (quote_id);

alter table public.crm_sync_log enable row level security;

-- Só admin lê o histórico. Escrita só acontece via service_role (Edge
-- Function), que ignora RLS — não precisa de policy de insert pra ninguém.
drop policy if exists "crm_sync_log_select_admin" on public.crm_sync_log;
create policy "crm_sync_log_select_admin" on public.crm_sync_log
  for select using (public.is_admin());
