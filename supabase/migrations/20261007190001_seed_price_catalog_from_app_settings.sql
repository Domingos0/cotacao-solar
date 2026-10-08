-- ============================================================
-- Fase 1 (seed, rodar uma única vez): migra o catálogo atual de
-- app_settings (chaves catalog_*) para a primeira versão publicada
-- em price_catalog_versions, sem downtime para quem já usa o app.
-- Idempotente: só faz algo se ainda não existir nenhuma versão.
-- ============================================================

do $$
declare
  v_version_id   uuid;
  v_table_info   jsonb;
  v_products     jsonb;
  v_active_codes jsonb;
  v_frete        jsonb;
  v_desconto     jsonb;
  v_condicoes    jsonb;
  f              jsonb;
begin
  if exists (select 1 from public.price_catalog_versions limit 1) then
    raise notice 'price_catalog_versions já tem dados — seed ignorado.';
    return;
  end if;

  select value into v_table_info   from public.app_settings where key = 'catalog_table_info';
  select value into v_products     from public.app_settings where key = 'catalog_products';
  select value into v_active_codes from public.app_settings where key = 'catalog_active_codes';
  select value into v_frete        from public.app_settings where key = 'catalog_frete';
  select value into v_desconto     from public.app_settings where key = 'catalog_desconto';
  select value into v_condicoes    from public.app_settings where key = 'catalog_condicoes';

  insert into public.price_catalog_versions
    (label, vigencia_mes, versao, observacao, condicoes, is_published, published_at)
  values (
    coalesce(v_table_info->>'nome', 'Lista Novembro 2025 R0'),
    coalesce(v_table_info->>'mes', '2025-11'),
    coalesce(v_table_info->>'versao', 'R0'),
    v_table_info->>'observacao',
    coalesce(v_condicoes#>>'{}', 'Preços FOB Itajaí-SC. Sujeitos a alteração sem aviso prévio.'),
    true,
    now()
  )
  returning id into v_version_id;

  if v_products is not null then
    insert into public.price_catalog_products (version_id, codigo, preco, preco_frete, ipi, data)
    select
      v_version_id,
      elem->>'codigo',
      nullif(elem->>'preco', '')::numeric,
      nullif(elem->>'precoFrete', '')::numeric,
      nullif(elem->>'ipi', '')::numeric,
      elem
    from jsonb_array_elements(v_products) elem
    where elem->>'codigo' is not null
    on conflict (version_id, codigo) do nothing;
  end if;

  if v_active_codes is not null then
    insert into public.price_catalog_active_codes (version_id, codigo)
    select v_version_id, (elem #>> '{}')
    from jsonb_array_elements(v_active_codes) elem
    on conflict do nothing;
  end if;

  if v_frete is not null then
    for f in select * from jsonb_array_elements(v_frete)
    loop
      insert into public.freight_options (version_id, nome, acrescimo)
      values (v_version_id, f->>'nome', (f->>'acrescimo')::numeric);
    end loop;
  end if;

  insert into public.discount_defaults (version_id, desconto)
  values (v_version_id, coalesce((v_desconto #>> '{}')::numeric, 0));

  raise notice 'Catálogo migrado para price_catalog_versions.id = %', v_version_id;
end;
$$;
