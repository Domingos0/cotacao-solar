-- Item 41: kits favoritos e modelos prontos.
-- "Modelo pronto" é o snapshot de uma cotação já montada (do admin ou de um
-- cliente), sanitizado (sem nome/UF/cidade do cliente original, sem número
-- de orçamento/revisões) pra servir de ponto de partida pra QUALQUER nova
-- cotação. Modelo criado por admin fica visível pra todo mundo (global);
-- criado por um cliente fica só pra ele mesmo (atalho pessoal).

create table if not exists public.kit_templates (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  kwp         numeric,
  kit_data    jsonb not null,
  created_by  uuid references public.profiles(id) on delete set null,
  global      boolean not null default false,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists kit_templates_created_by_idx on public.kit_templates (created_by);

alter table public.kit_templates enable row level security;

-- Todo mundo vê os modelos globais (do admin); cada um só vê os próprios
-- modelos privados além desses.
drop policy if exists "kit_templates_select" on public.kit_templates;
create policy "kit_templates_select" on public.kit_templates
  for select to authenticated
  using (global = true or created_by = auth.uid());

-- Qualquer usuário autenticado pode criar um modelo a partir da própria
-- cotação (vira global automaticamente só se for admin — decidido no app,
-- não aqui, pra manter a policy simples; mas trava created_by = si mesmo).
drop policy if exists "kit_templates_insert" on public.kit_templates;
create policy "kit_templates_insert" on public.kit_templates
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "kit_templates_update" on public.kit_templates;
create policy "kit_templates_update" on public.kit_templates
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "kit_templates_delete" on public.kit_templates;
create policy "kit_templates_delete" on public.kit_templates
  for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- Favoritos: atalho pessoal por usuário sobre os modelos (próprios ou
-- globais) — puramente pra ordenar/destacar na lista, não afeta quem pode
-- ver ou usar o modelo.
create table if not exists public.kit_template_favoritos (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  template_id uuid not null references public.kit_templates(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, template_id)
);

alter table public.kit_template_favoritos enable row level security;

drop policy if exists "kit_template_favoritos_all_own" on public.kit_template_favoritos;
create policy "kit_template_favoritos_all_own" on public.kit_template_favoritos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
