-- Item 32 (nova lista de features): "Avise-me quando chegar" pra produto
-- esgotado — depende do item 1 (effectiveEstoque, já corrigido antes).
--
-- Fluxo: cliente pede aviso num produto esgotado (insert aqui). Toda vez
-- que o admin PUBLICA o catálogo (publishCatalog, já existente), o app
-- chama check_stock_notifications(), que varre os pedidos pendentes e
-- dispara notificação pra quem pediu aviso de um produto que virou
-- Disponível (ou cuja Previsão já passou — mesma regra de
-- src/data/products.js:effectiveEstoque, replicada aqui em SQL).

create table if not exists public.stock_notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  codigo_sap   text not null,
  produto_nome text,
  created_at   timestamptz not null default now(),
  notified_at  timestamptz
);

-- Só um pedido PENDENTE por usuário+produto de cada vez — depois de
-- notificado, o mesmo usuário pode pedir de novo se o produto esgotar outra vez.
create unique index if not exists stock_notifications_pending_uq
  on public.stock_notifications (user_id, codigo_sap)
  where notified_at is null;

alter table public.stock_notifications enable row level security;

create policy "stock_notifications_insert_own" on public.stock_notifications
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "stock_notifications_select_own" on public.stock_notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "stock_notifications_delete_own" on public.stock_notifications
  for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.check_stock_notifications()
returns void
language plpgsql
security definer
as $$
declare
  r record;
  v_catalog_version uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  v_catalog_version := public.current_catalog_version();

  for r in
    select sn.id, sn.user_id, sn.codigo_sap, sn.produto_nome
    from public.stock_notifications sn
    where sn.notified_at is null
      and exists (
        select 1 from public.price_catalog_products pcp
        where pcp.version_id = v_catalog_version
          and pcp.codigo = sn.codigo_sap
          and (
            coalesce(pcp.data->>'estoque', 'Disponível') = 'Disponível'
            or (
              coalesce(pcp.data->>'estoque', '') = 'Previsão'
              and (pcp.data->>'estoque_previsao') is not null
              and (pcp.data->>'estoque_previsao') <> ''
              and (pcp.data->>'estoque_previsao')::date < current_date
            )
          )
      )
  loop
    perform net.http_post(
      url := 'https://cfnnvnqnpsdtbokglwwv.supabase.co/functions/v1/send-notification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('event', 'produtoDisponivel', 'payload', jsonb_build_object('stockNotificationId', r.id))
    );
    update public.stock_notifications set notified_at = now() where id = r.id;
  end loop;
end;
$$;

revoke all on function public.check_stock_notifications() from public;
grant execute on function public.check_stock_notifications() to authenticated;
