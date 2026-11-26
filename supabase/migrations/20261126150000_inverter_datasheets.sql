-- Item 45 (nova lista de features): datasheet de cada inversor.
-- Tabela simples linha -> link do PDF (ex: "SIW300H" -> url). O link
-- por MODELO específico (override, ex: um SAP que usa um datasheet
-- diferente do padrão da linha) fica no próprio jsonb do produto
-- (data->>'datasheetUrl'), sem precisar de tabela nova pra isso.

create table if not exists public.inverter_datasheets (
  linha      text primary key,
  url        text not null,
  updated_at timestamptz not null default now()
);

alter table public.inverter_datasheets enable row level security;

-- Todo usuário autenticado (cliente incluso) precisa ler, pro botão
-- "Datasheet PDF" funcionar no catálogo/Monte seu Kit/detalhe do produto.
create policy "inverter_datasheets_select_all" on public.inverter_datasheets
  for select to authenticated
  using (true);

create policy "inverter_datasheets_admin_write" on public.inverter_datasheets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
