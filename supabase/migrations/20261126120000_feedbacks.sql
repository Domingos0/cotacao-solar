-- Item 28 (nova lista de features): tabela de feedback dos usuarios
-- (sugestao de melhoria / reportar problema) e avaliacao de 1 a 5 apos
-- salvar uma cotacao. Admin ve e resolve pela aba Feedbacks.

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('sugestao', 'problema', 'avaliacao')),
  mensagem text,
  nota smallint check (nota between 1 and 5),
  pagina text,
  screenshot text, -- data URL (base64, jpeg comprimido), opcional
  status text not null default 'pendente' check (status in ('pendente', 'resolvido')),
  resposta_admin text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.feedbacks enable row level security;

-- Cliente insere e ve só os próprios feedbacks
create policy "feedbacks_insert_own" on public.feedbacks
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "feedbacks_select_own" on public.feedbacks
  for select to authenticated
  using (user_id = auth.uid());

-- Admin ve e atualiza (marcar como resolvido) todos
create policy "feedbacks_admin_select" on public.feedbacks
  for select to authenticated
  using (public.is_admin());

create policy "feedbacks_admin_update" on public.feedbacks
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index if not exists feedbacks_status_idx on public.feedbacks (status, created_at desc);
create index if not exists feedbacks_user_idx on public.feedbacks (user_id, created_at desc);
