-- Item 36 (nova lista de features): Kits da Promoção.
-- Kits específicos pré-montados (módulo + inversor + itens já definidos),
-- com janela de validade e desconto sobre o preço homologado. O preço final
-- mostrado ao cliente soma esse preço (já com desconto) + o frete da
-- promoção da região dele (public.promo_regioes).
--
-- data_fim_original é gravada uma vez na criação e nunca muda — comparar
-- data_fim (editável, o admin pode estender) com data_fim_original é como a
-- UI detecta sozinha o aviso "Prorrogada", sem precisar de uma flag manual
-- que o admin esqueceria de marcar.

create table if not exists public.promo_kits (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  kwp                numeric not null,
  modulo             jsonb not null,              -- snapshot {nome, codigo_sap, potencia, qty}
  inversor           jsonb not null,               -- snapshot {nome, codigo_sap, qty}
  itens_extra        jsonb not null default '[]'::jsonb, -- demais itens do kit (cabos, proteção etc.), mesmo formato achatado de quote_items
  preco_homologado   numeric not null,
  desconto_pct       numeric not null default 5,
  data_inicio        date not null,
  data_fim           date not null,
  data_fim_original  date not null,
  fob_folder_url     text,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.promo_kits enable row level security;

create policy "promo_kits_select_all" on public.promo_kits
  for select to authenticated
  using (true);

create policy "promo_kits_admin_write" on public.promo_kits
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Frete da promoção por região (mesmas 5 regiões já usadas em src/lib/regiao.js
-- pro frete normal) + o "folder regional" (PDF de marketing) daquela região,
-- pro admin conferir se o preço calculado bate com o que foi divulgado.
create table if not exists public.promo_regioes (
  regiao       text primary key check (regiao in ('norte', 'nordeste', 'centro_oeste', 'sudeste', 'sul')),
  frete_valor  numeric not null default 0,
  folder_url   text,
  updated_at   timestamptz not null default now()
);

alter table public.promo_regioes enable row level security;

create policy "promo_regioes_select_all" on public.promo_regioes
  for select to authenticated
  using (true);

create policy "promo_regioes_admin_write" on public.promo_regioes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
