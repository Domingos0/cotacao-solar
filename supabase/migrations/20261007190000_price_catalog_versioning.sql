-- ============================================================
-- Fase 1: versionamento da tabela de preços + correção do cache
-- ============================================================
-- Contexto: o catálogo de produtos/preços vivia só em app_settings
-- (jsonb solto) + localStorage, sem nenhum identificador de versão.
-- A única checagem de "cache desatualizado" era "localStorage está
-- vazio?" — um navegador com cache antigo nunca resincronizava
-- sozinho. Esta migração cria tabelas relacionais com um modelo
-- rascunho → publicado, para que o cliente possa comparar uma
-- versão publicada com a que tem em cache e saber quando buscar
-- dado novo.

-- ── 1. Tabelas ──────────────────────────────────────────────────────────────
create table if not exists public.price_catalog_versions (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,
  vigencia_mes    text,
  versao          text,
  observacao      text,
  condicoes       text,
  validity_days   int not null default 7,
  is_published    boolean not null default false,
  published_at    timestamptz,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

-- só uma versão publicada por vez
create unique index if not exists one_published_catalog
  on public.price_catalog_versions (is_published)
  where is_published;

create table if not exists public.price_catalog_products (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.price_catalog_versions(id) on delete cascade,
  codigo      text not null,
  preco       numeric(12,2),
  preco_frete numeric(12,2),
  ipi         numeric(6,4),
  data        jsonb not null,
  unique (version_id, codigo)
);

create table if not exists public.price_catalog_active_codes (
  version_id uuid not null references public.price_catalog_versions(id) on delete cascade,
  codigo     text not null,
  primary key (version_id, codigo)
);

create table if not exists public.freight_options (
  id         uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.price_catalog_versions(id) on delete cascade,
  nome       text not null,
  acrescimo  numeric(6,4) not null
);

create table if not exists public.discount_defaults (
  version_id uuid primary key references public.price_catalog_versions(id) on delete cascade,
  desconto   numeric(5,2) not null default 0
);

-- ── 2. RLS ──────────────────────────────────────────────────────────────────
alter table public.price_catalog_versions      enable row level security;
alter table public.price_catalog_products      enable row level security;
alter table public.price_catalog_active_codes  enable row level security;
alter table public.freight_options             enable row level security;
alter table public.discount_defaults           enable row level security;

-- versões: qualquer autenticado vê a publicada; rascunho só admin
drop policy if exists "catalog_versions_select" on public.price_catalog_versions;
create policy "catalog_versions_select" on public.price_catalog_versions
  for select using (is_published or public.is_admin());

drop policy if exists "catalog_versions_write" on public.price_catalog_versions;
create policy "catalog_versions_write" on public.price_catalog_versions
  for all using (public.is_admin()) with check (public.is_admin());

-- tabelas filhas: seguem a visibilidade da versão (publicada OU rascunho+admin); escrita só admin
drop policy if exists "catalog_products_select" on public.price_catalog_products;
create policy "catalog_products_select" on public.price_catalog_products
  for select using (
    exists (
      select 1 from public.price_catalog_versions v
      where v.id = version_id and (v.is_published or public.is_admin())
    )
  );
drop policy if exists "catalog_products_write" on public.price_catalog_products;
create policy "catalog_products_write" on public.price_catalog_products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "catalog_active_codes_select" on public.price_catalog_active_codes;
create policy "catalog_active_codes_select" on public.price_catalog_active_codes
  for select using (
    exists (
      select 1 from public.price_catalog_versions v
      where v.id = version_id and (v.is_published or public.is_admin())
    )
  );
drop policy if exists "catalog_active_codes_write" on public.price_catalog_active_codes;
create policy "catalog_active_codes_write" on public.price_catalog_active_codes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "freight_options_select" on public.freight_options;
create policy "freight_options_select" on public.freight_options
  for select using (
    exists (
      select 1 from public.price_catalog_versions v
      where v.id = version_id and (v.is_published or public.is_admin())
    )
  );
drop policy if exists "freight_options_write" on public.freight_options;
create policy "freight_options_write" on public.freight_options
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "discount_defaults_select" on public.discount_defaults;
create policy "discount_defaults_select" on public.discount_defaults
  for select using (
    exists (
      select 1 from public.price_catalog_versions v
      where v.id = version_id and (v.is_published or public.is_admin())
    )
  );
drop policy if exists "discount_defaults_write" on public.discount_defaults;
create policy "discount_defaults_write" on public.discount_defaults
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 3. current_catalog_version() — o "hash" barato que o cliente compara ────
create or replace function public.current_catalog_version()
returns uuid
language sql
stable
as $$
  select id from public.price_catalog_versions where is_published limit 1;
$$;

revoke all on function public.current_catalog_version() from public;
grant execute on function public.current_catalog_version() to authenticated;

-- ── 4. get_or_create_draft_catalog_version() ────────────────────────────────
-- Retorna o rascunho em edição; se não existir, clona a versão publicada
-- (ou cria do zero, se nunca houve publicação) para virar o novo rascunho.
create or replace function public.get_or_create_draft_catalog_version()
returns uuid
language plpgsql
security definer
as $$
declare
  v_draft_id     uuid;
  v_published_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select id into v_draft_id
  from public.price_catalog_versions
  where not is_published
  order by created_at desc
  limit 1;

  if v_draft_id is not null then
    return v_draft_id;
  end if;

  select id into v_published_id
  from public.price_catalog_versions
  where is_published
  limit 1;

  if v_published_id is not null then
    insert into public.price_catalog_versions
      (label, vigencia_mes, versao, observacao, condicoes, validity_days, is_published, created_by)
    select label, vigencia_mes, versao, observacao, condicoes, validity_days, false, auth.uid()
    from public.price_catalog_versions where id = v_published_id
    returning id into v_draft_id;

    insert into public.price_catalog_products (version_id, codigo, preco, preco_frete, ipi, data)
    select v_draft_id, codigo, preco, preco_frete, ipi, data
    from public.price_catalog_products where version_id = v_published_id;

    insert into public.price_catalog_active_codes (version_id, codigo)
    select v_draft_id, codigo from public.price_catalog_active_codes where version_id = v_published_id;

    insert into public.freight_options (version_id, nome, acrescimo)
    select v_draft_id, nome, acrescimo from public.freight_options where version_id = v_published_id;

    insert into public.discount_defaults (version_id, desconto)
    select v_draft_id, desconto from public.discount_defaults where version_id = v_published_id;
  else
    insert into public.price_catalog_versions (label, is_published, created_by)
    values ('Nova lista', false, auth.uid())
    returning id into v_draft_id;

    insert into public.discount_defaults (version_id, desconto) values (v_draft_id, 0);
  end if;

  return v_draft_id;
end;
$$;

revoke all on function public.get_or_create_draft_catalog_version() from public;
grant execute on function public.get_or_create_draft_catalog_version() to authenticated;

-- ── 5. publish_price_catalog(p_version_id) ──────────────────────────────────
create or replace function public.publish_price_catalog(p_version_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.price_catalog_versions set is_published = false where is_published;
  update public.price_catalog_versions
  set is_published = true, published_at = now()
  where id = p_version_id;
end;
$$;

revoke all on function public.publish_price_catalog(uuid) from public;
grant execute on function public.publish_price_catalog(uuid) to authenticated;
-- Nota: a Fase 6 (auditoria) fará um `create or replace` nesta função para
-- chamar public.log_activity(...) ao final, sem precisar de outra migração.

-- ── 6. replace_catalog_products(p_version_id, p_products) ──────────────────
-- Substitui por completo os produtos de uma versão (rascunho) — equivalente
-- ao antigo saveProducts(newProducts) do front-end, mas gravando no servidor.
create or replace function public.replace_catalog_products(p_version_id uuid, p_products jsonb)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if exists (select 1 from public.price_catalog_versions where id = p_version_id and is_published) then
    raise exception 'cannot edit a published catalog version directly';
  end if;

  delete from public.price_catalog_products where version_id = p_version_id;

  insert into public.price_catalog_products (version_id, codigo, preco, preco_frete, ipi, data)
  select
    p_version_id,
    elem->>'codigo',
    nullif(elem->>'preco', '')::numeric,
    nullif(elem->>'precoFrete', '')::numeric,
    nullif(elem->>'ipi', '')::numeric,
    elem
  from jsonb_array_elements(p_products) elem
  where elem->>'codigo' is not null;
end;
$$;

revoke all on function public.replace_catalog_products(uuid, jsonb) from public;
grant execute on function public.replace_catalog_products(uuid, jsonb) to authenticated;
