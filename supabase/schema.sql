-- ============================================================
-- Schema: Ernaniff Solar — Cotações e Autenticação
-- Rodar no Supabase > SQL Editor
-- ============================================================

-- 1. Perfis de usuário (extensão do auth.users do Supabase)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  empresa     text,
  cnpj        text,
  telefone    text,
  role        text not null default 'cliente' check (role in ('admin','cliente')),
  status      text not null default 'pendente' check (status in ('pendente','ativo','recusado')),
  created_at  timestamptz default now()
);

-- Trigger: cria profile automaticamente ao criar usuário no auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nome, empresa, cnpj, telefone, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.raw_user_meta_data->>'empresa',
    new.raw_user_meta_data->>'cnpj',
    new.raw_user_meta_data->>'telefone',
    coalesce(new.raw_user_meta_data->>'role', 'cliente'),
    case when coalesce(new.raw_user_meta_data->>'role','cliente') = 'admin' then 'ativo' else 'pendente' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Cotações
create table if not exists public.quotes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  nome_projeto  text,
  kit_type      text,
  kwp           numeric(10,3),
  subtotal      numeric(12,2),
  desconto_pct  numeric(5,2) default 0,
  frete_nome    text,
  frete_pct     numeric(6,4) default 1,
  total_final   numeric(12,2),
  status        text not null default 'rascunho'
                check (status in ('rascunho','enviada','aguardando_desconto','aprovada','recusada')),
  desconto_motivo     text,
  desconto_resposta   text,
  data          jsonb,        -- snapshot completo do estado do kit builder
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 3. Itens da cotação
create table if not exists public.quote_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes(id) on delete cascade,
  label       text,
  produto     text,
  codigo_sap  text,
  qty         numeric(10,3),
  unit        text,
  preco_unit  numeric(12,2),
  total       numeric(12,2)
);

-- 4. Log de atividades
create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  acao        text not null,
  detalhes    jsonb,
  ip          text,
  created_at  timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table public.profiles       enable row level security;
alter table public.quotes         enable row level security;
alter table public.quote_items    enable row level security;
alter table public.activity_logs  enable row level security;

-- profiles: usuário vê só o seu; admin vê todos
create policy "perfil_proprio" on public.profiles
  for select using (auth.uid() = id);

create policy "admin_ver_todos_perfis" on public.profiles
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "perfil_update_proprio" on public.profiles
  for update using (auth.uid() = id);

-- quotes: cliente vê só as suas; admin vê todas
create policy "cliente_proprias_quotes" on public.quotes
  for all using (
    user_id = auth.uid() or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- quote_items: seguem a cotação
create policy "items_via_quote" on public.quote_items
  for all using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and (
        q.user_id = auth.uid() or
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
    )
  );

-- logs: só admin lê; sistema insere via service role
create policy "admin_ver_logs" on public.activity_logs
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================================
-- Helper: atualiza updated_at automaticamente
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists quotes_updated_at on public.quotes;
create trigger quotes_updated_at before update on public.quotes
  for each row execute procedure public.set_updated_at();
