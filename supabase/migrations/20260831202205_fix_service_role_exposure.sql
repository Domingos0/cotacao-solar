-- ============================================================
-- FIX: Remove dependência da service_role key no navegador
-- ============================================================
-- Contexto: o app usava um client com a service_role key (que ignora
-- toda RLS) direto no navegador para praticamente tudo. Esta migração
-- reescreve as políticas de RLS para que o client normal (anon key +
-- sessão do usuário) seja suficiente e seguro, fecha um buraco onde
-- qualquer usuário podia se auto-promover a admin / auto-aprovar
-- desconto, e corrige a tabela app_settings que estava com uma
-- política "service_role_all" aplicada a `public` (ou seja, aberta
-- para QUALQUER UM, autenticado ou não — não precisa nem da service
-- key, o erro foi dar essa política pro role errado).

-- ── 1. is_admin() — evita recursão de RLS ao checar admin ─────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── 2. Políticas não-recursivas em profiles/quotes/quote_items/activity_logs ──
drop policy if exists "admin_ver_todos_perfis" on public.profiles;
drop policy if exists "perfil_proprio"          on public.profiles;
drop policy if exists "perfil_update_proprio"   on public.profiles;
drop policy if exists "admin_gerenciar_perfis"  on public.profiles;

create policy "perfil_proprio" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "perfil_update_proprio" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

create policy "admin_gerenciar_perfis" on public.profiles
  for insert with check (public.is_admin());

create policy "admin_excluir_perfis" on public.profiles
  for delete using (public.is_admin());

drop policy if exists "cliente_proprias_quotes" on public.quotes;
create policy "cliente_proprias_quotes" on public.quotes
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "items_via_quote" on public.quote_items;
create policy "items_via_quote" on public.quote_items
  for all using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and (q.user_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and (q.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "admin_ver_logs" on public.activity_logs;
create policy "admin_ver_logs" on public.activity_logs
  for select using (public.is_admin());

-- ── 3. Trava de privilégio: usuário comum não pode se auto-promover ───────
create or replace function public.guard_profiles_self_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  -- não-admin: role/status/desconto/cnpj só mudam via ação de admin
  new.role               := old.role;
  new.status             := old.status;
  new.desconto_comercial := old.desconto_comercial;
  new.cnpj               := old.cnpj;
  return new;
end;
$$;

drop trigger if exists guard_profiles_self_update on public.profiles;
create trigger guard_profiles_self_update
  before update on public.profiles
  for each row execute procedure public.guard_profiles_self_update();

-- ── 4. Trava de privilégio: cliente não pode se auto-aprovar desconto/status ──
create or replace function public.guard_quotes_self_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  -- não-admin só pode manter o status nos estados pré-análise do admin
  if new.status is distinct from old.status
     and new.status not in ('rascunho', 'enviada', 'aguardando_desconto') then
    new.status := old.status;
  end if;
  -- não-admin nunca pode aumentar o próprio desconto
  if coalesce(new.desconto_pct, 0) > coalesce(old.desconto_pct, 0) then
    new.desconto_pct := old.desconto_pct;
  end if;
  -- resposta do desconto é só do admin
  new.desconto_resposta := old.desconto_resposta;
  return new;
end;
$$;

drop trigger if exists guard_quotes_self_update on public.quotes;
create trigger guard_quotes_self_update
  before update on public.quotes
  for each row execute procedure public.guard_quotes_self_update();

-- ── 5. profiles.email — elimina a necessidade da Admin Auth API no cliente ──
alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nome, empresa, cnpj, telefone, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.raw_user_meta_data->>'empresa',
    new.raw_user_meta_data->>'cnpj',
    new.raw_user_meta_data->>'telefone',
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'cliente'),
    case when coalesce(new.raw_user_meta_data->>'role','cliente') = 'admin' then 'ativo' else 'pendente' end
  );
  return new;
end;
$$;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- ── 6. app_settings — corrige a política aberta a `public` e restringe notify_settings ──
drop policy if exists "service_role_all" on public.app_settings;

create policy "app_settings_select" on public.app_settings
  for select using (key <> 'notify_settings' or public.is_admin());

create policy "app_settings_insert" on public.app_settings
  for insert with check (public.is_admin());

create policy "app_settings_update" on public.app_settings
  for update using (public.is_admin()) with check (public.is_admin());

create policy "app_settings_delete" on public.app_settings
  for delete using (public.is_admin());

-- ── 7. Lookup de empresa por CNPJ (pré-login, no cadastro) ────────────────
create or replace function public.lookup_company_by_cnpj(p_cnpj text)
returns table(nome text, empresa text)
language sql
security definer
stable
as $$
  select nome, empresa from public.profiles
  where cnpj = p_cnpj and status = 'ativo';
$$;

revoke all on function public.lookup_company_by_cnpj(text) from public;
grant execute on function public.lookup_company_by_cnpj(text) to anon, authenticated;
