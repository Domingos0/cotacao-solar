-- ============================================================
-- Fase 4: snapshot relacional de versões de proposta
-- Fase 5: política de validade / reprecificação
-- Fase 6: auditoria (activity_logs)
-- ============================================================
-- Contexto: o histórico de revisões vivia só dentro de
-- quotes.data.revisoes[] (jsonb dentro de jsonb) e quote_items era
-- apagado/reinserido a cada save — sem como reconstruir
-- relacionalmente "o que foi cobrado" numa versão passada. Não havia
-- nenhuma noção real de validade/vencimento. E activity_logs existia
-- sem nenhuma política de insert e sem nada no código gravando nela.

-- ── 1. Tabelas de versão/snapshot ────────────────────────────────────────────
create table if not exists public.quote_versions (
  id                  uuid primary key default gen_random_uuid(),
  quote_id            uuid not null references public.quotes(id) on delete cascade,
  revisao             int not null,
  catalog_version_id  uuid references public.price_catalog_versions(id),
  subtotal            numeric(12,2) not null,
  desconto_pct        numeric(5,2) not null default 0,
  frete_nome          text,
  frete_pct           numeric(6,4) default 1,
  total_final         numeric(12,2) not null,
  kit_data            jsonb,
  valid_until         date,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  unique (quote_id, revisao)
);

create table if not exists public.quote_item_snapshots (
  id                uuid primary key default gen_random_uuid(),
  quote_version_id  uuid not null references public.quote_versions(id) on delete cascade,
  label             text,
  produto           text,
  codigo_sap        text,
  qty               numeric(10,3),
  unit              text,
  preco_unit        numeric(12,2),
  total             numeric(12,2)
);

alter table public.quotes add column if not exists current_version_id uuid references public.quote_versions(id);
alter table public.quotes add column if not exists valid_until         date;
alter table public.quotes add column if not exists price_locked        boolean not null default false;

-- ── RLS: só leitura para dono/admin; escrita só via função SECURITY DEFINER ──
alter table public.quote_versions       enable row level security;
alter table public.quote_item_snapshots enable row level security;

drop policy if exists "quote_versions_select" on public.quote_versions;
create policy "quote_versions_select" on public.quote_versions
  for select using (
    exists (select 1 from public.quotes q where q.id = quote_id and (q.user_id = auth.uid() or public.is_admin()))
  );

drop policy if exists "quote_item_snapshots_select" on public.quote_item_snapshots;
create policy "quote_item_snapshots_select" on public.quote_item_snapshots
  for select using (
    exists (
      select 1 from public.quote_versions v
      join public.quotes q on q.id = v.quote_id
      where v.id = quote_version_id and (q.user_id = auth.uid() or public.is_admin())
    )
  );

-- ── 2. log_activity — único caminho de escrita em activity_logs ────────────
create or replace function public.log_activity(p_acao text, p_detalhes jsonb default null)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.activity_logs (user_id, acao, detalhes)
  values (auth.uid(), p_acao, p_detalhes);
end;
$$;

revoke all on function public.log_activity(text, jsonb) from public;
grant execute on function public.log_activity(text, jsonb) to authenticated;

-- ── 3. save_quote_with_items — agora também grava versão + snapshot,  ──────
-- e usa o catálogo travado (price_locked) em vez do publicado quando a
-- cotação foi explicitamente marcada para honrar o preço antigo.
create or replace function public.save_quote_with_items(
  p_quote_id     uuid,
  p_nome_projeto text,
  p_kit_type     text,
  p_kwp          numeric,
  p_desconto_pct numeric,
  p_frete_nome   text,
  p_frete_pct    numeric,
  p_status       text,
  p_kit_data     jsonb,
  p_items        jsonb
)
returns table (quote_id uuid, subtotal numeric, total_final numeric)
language plpgsql
security definer
as $$
declare
  v_quote_id         uuid := p_quote_id;
  v_owner            uuid;
  v_nome_projeto     text;
  v_kit_type         text;
  v_kwp              numeric;
  v_desconto_pct     numeric;
  v_frete_nome       text;
  v_frete_pct        numeric;
  v_status           text;
  v_kit_data         jsonb;
  v_price_locked     boolean := false;
  v_current_version  uuid;
  v_catalog_version  uuid;
  v_validity_days    int;
  v_subtotal         numeric(12,2);
  v_total_final      numeric(12,2);
  v_items            jsonb := coalesce(p_items, '[]'::jsonb);
  v_revisao          int;
  v_version_id       uuid;
begin
  if v_quote_id is not null then
    select user_id, nome_projeto, kit_type, kwp, desconto_pct, frete_nome, frete_pct, status, data,
           price_locked, current_version_id
      into v_owner, v_nome_projeto, v_kit_type, v_kwp, v_desconto_pct, v_frete_nome, v_frete_pct, v_status, v_kit_data,
           v_price_locked, v_current_version
    from public.quotes where id = v_quote_id;

    if v_owner is null then
      raise exception 'quote not found';
    end if;
    if v_owner <> auth.uid() and not public.is_admin() then
      raise exception 'not authorized';
    end if;
  end if;

  v_nome_projeto := coalesce(p_nome_projeto, v_nome_projeto);
  v_kit_type     := coalesce(p_kit_type, v_kit_type);
  v_kwp          := coalesce(p_kwp, v_kwp);
  v_desconto_pct := coalesce(p_desconto_pct, v_desconto_pct, 0);
  v_frete_nome   := coalesce(p_frete_nome, v_frete_nome);
  v_frete_pct    := coalesce(p_frete_pct, v_frete_pct, 1);
  v_status       := coalesce(p_status, v_status, 'rascunho');
  v_kit_data     := coalesce(p_kit_data, v_kit_data);

  -- catálogo a usar: se a cotação está travada (admin honrou preço antigo),
  -- usa o catálogo da versão atual; senão, sempre o publicado agora
  -- (reprecifica automaticamente por padrão a cada save, inclusive após
  -- a cotação vencer).
  if v_price_locked and v_current_version is not null then
    select catalog_version_id into v_catalog_version from public.quote_versions where id = v_current_version;
  else
    v_catalog_version := public.current_catalog_version();
  end if;

  select coalesce(validity_days, 7) into v_validity_days
  from public.price_catalog_versions where id = v_catalog_version;
  v_validity_days := coalesce(v_validity_days, 7);

  select coalesce(sum(
    coalesce((elem->>'qty')::numeric, 0) *
    coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0)
  ), 0)
  into v_subtotal
  from jsonb_array_elements(v_items) elem
  left join public.price_catalog_products pcp
    on pcp.version_id = v_catalog_version and pcp.codigo = elem->>'codigo_sap';

  v_total_final := public.compute_total_final(v_subtotal, v_desconto_pct, v_frete_pct);

  if v_quote_id is null then
    insert into public.quotes (
      user_id, nome_projeto, kit_type, kwp, subtotal, desconto_pct,
      frete_nome, frete_pct, total_final, status, data, valid_until
    ) values (
      auth.uid(), v_nome_projeto, v_kit_type, v_kwp, v_subtotal, v_desconto_pct,
      v_frete_nome, v_frete_pct, v_total_final, v_status, v_kit_data, (current_date + v_validity_days)
    )
    returning id into v_quote_id;
  else
    update public.quotes set
      nome_projeto = v_nome_projeto,
      kit_type     = v_kit_type,
      kwp          = v_kwp,
      subtotal     = v_subtotal,
      desconto_pct = v_desconto_pct,
      frete_nome   = v_frete_nome,
      frete_pct    = v_frete_pct,
      total_final  = v_total_final,
      status       = v_status,
      data         = v_kit_data,
      valid_until  = (current_date + v_validity_days)
    where id = v_quote_id;
  end if;

  delete from public.quote_items where quote_id = v_quote_id;

  insert into public.quote_items (quote_id, label, produto, codigo_sap, qty, unit, preco_unit, total)
  select
    v_quote_id,
    elem->>'label', elem->>'produto', elem->>'codigo_sap',
    coalesce((elem->>'qty')::numeric, 0), elem->>'unit',
    coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0),
    round(coalesce((elem->>'qty')::numeric, 0) * coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0), 2)
  from jsonb_array_elements(v_items) elem
  left join public.price_catalog_products pcp
    on pcp.version_id = v_catalog_version and pcp.codigo = elem->>'codigo_sap';

  -- ── snapshot imutável da versão (Fase 4) ──
  select coalesce(max(revisao), -1) + 1 into v_revisao
  from public.quote_versions where quote_id = v_quote_id;

  insert into public.quote_versions (
    quote_id, revisao, catalog_version_id, subtotal, desconto_pct,
    frete_nome, frete_pct, total_final, kit_data, valid_until, created_by
  ) values (
    v_quote_id, v_revisao, v_catalog_version, v_subtotal, v_desconto_pct,
    v_frete_nome, v_frete_pct, v_total_final, v_kit_data, (current_date + v_validity_days), auth.uid()
  )
  returning id into v_version_id;

  update public.quotes set current_version_id = v_version_id where id = v_quote_id;

  insert into public.quote_item_snapshots (quote_version_id, label, produto, codigo_sap, qty, unit, preco_unit, total)
  select
    v_version_id,
    elem->>'label', elem->>'produto', elem->>'codigo_sap',
    coalesce((elem->>'qty')::numeric, 0), elem->>'unit',
    coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0),
    round(coalesce((elem->>'qty')::numeric, 0) * coalesce(pcp.preco, nullif(elem->>'preco_unit', '')::numeric, 0), 2)
  from jsonb_array_elements(v_items) elem
  left join public.price_catalog_products pcp
    on pcp.version_id = v_catalog_version and pcp.codigo = elem->>'codigo_sap';

  return query select v_quote_id, v_subtotal, v_total_final;
end;
$$;

-- ── 4. override_price_lock — admin honra o preço antigo numa cotação ───────
create or replace function public.override_price_lock(p_quote_id uuid, p_locked boolean default true)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.quotes set price_locked = p_locked where id = p_quote_id;
  perform public.log_activity('override_price_lock', jsonb_build_object('quote_id', p_quote_id, 'locked', p_locked));
end;
$$;

revoke all on function public.override_price_lock(uuid, boolean) from public;
grant execute on function public.override_price_lock(uuid, boolean) to authenticated;

-- ── 5. publish_price_catalog / approve_quote_discount — agora logam ────────
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

  perform public.log_activity('publish_price_catalog', jsonb_build_object('version_id', p_version_id));
end;
$$;

create or replace function public.approve_quote_discount(p_quote_id uuid, p_pct numeric, p_resposta text)
returns table (quote_id uuid, total_final numeric)
language plpgsql
security definer
as $$
declare
  v_subtotal       numeric(12,2);
  v_frete_pct      numeric(6,4);
  v_total_original numeric(12,2);
  v_data           jsonb;
  v_total_final    numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'invalid discount percent';
  end if;

  select frete_pct, total_final, data into v_frete_pct, v_total_original, v_data
  from public.quotes where id = p_quote_id;

  if not found then
    raise exception 'quote not found';
  end if;

  select coalesce(sum(qty * preco_unit), 0) into v_subtotal
  from public.quote_items where quote_id = p_quote_id;

  v_total_final := public.compute_total_final(v_subtotal, p_pct, v_frete_pct);

  update public.quotes set
    status             = 'aprovada',
    desconto_pct        = p_pct,
    total_final         = v_total_final,
    desconto_resposta   = p_resposta,
    data                = coalesce(v_data, '{}'::jsonb) || jsonb_build_object('total_antes_desconto', v_total_original)
  where id = p_quote_id;

  perform public.log_activity('approve_quote_discount', jsonb_build_object('quote_id', p_quote_id, 'pct', p_pct));

  return query select p_quote_id, v_total_final;
end;
$$;

-- ── 6. reject_quote_discount — nova RPC (antes era update direto sem log) ──
create or replace function public.reject_quote_discount(p_quote_id uuid, p_resposta text)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.quotes set
    status = 'recusada',
    desconto_pct = 0,
    desconto_resposta = p_resposta
  where id = p_quote_id;

  perform public.log_activity('reject_quote_discount', jsonb_build_object('quote_id', p_quote_id));
end;
$$;

revoke all on function public.reject_quote_discount(uuid, text) from public;
grant execute on function public.reject_quote_discount(uuid, text) to authenticated;

-- ── 7. guard_profiles_self_update — loga mudanças de role/status por admin ─
create or replace function public.guard_profiles_self_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      perform public.log_activity('admin_update_profile', jsonb_build_object(
        'profile_id', new.id,
        'old_role', old.role, 'new_role', new.role,
        'old_status', old.status, 'new_status', new.status
      ));
    end if;
    return new;
  end if;
  new.role               := old.role;
  new.status              := old.status;
  new.desconto_comercial  := old.desconto_comercial;
  new.cnpj                := old.cnpj;
  return new;
end;
$$;
