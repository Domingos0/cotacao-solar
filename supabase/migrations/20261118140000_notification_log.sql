-- ============================================================
-- Log de notificações enviadas (WhatsApp/Email)
-- ============================================================
-- Contexto: o envio de notificações (send-notification Edge Function)
-- sempre foi fire-and-forget — nada ficava gravado sobre quem recebeu o
-- quê, nem se o envio deu certo. O admin pediu um acompanhamento de quais
-- clientes estão recebendo notificação. Esta tabela registra cada
-- tentativa de envio (sucesso ou falha), só gravada pela Edge Function
-- (service_role), nunca pelo navegador.

create table if not exists public.notification_log (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  event          text not null,
  recipient_type text not null check (recipient_type in ('admin', 'cliente')),
  channel        text not null check (channel in ('whatsapp', 'email')),
  destino        text,
  user_id        uuid references public.profiles(id) on delete set null,
  cliente_nome   text,
  quote_id       uuid references public.quotes(id) on delete set null,
  success        boolean not null,
  error          text
);

create index if not exists notification_log_created_at_idx on public.notification_log (created_at desc);
create index if not exists notification_log_user_id_idx on public.notification_log (user_id);

alter table public.notification_log enable row level security;

-- Só admin lê o histórico. Escrita só acontece via service_role (Edge
-- Function), que ignora RLS — não precisa de policy de insert pra ninguém.
drop policy if exists "notification_log_select_admin" on public.notification_log;
create policy "notification_log_select_admin" on public.notification_log
  for select using (public.is_admin());
