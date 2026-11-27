-- Item 45: bucket público pra hospedar cópias dos datasheets (baixados do
-- SharePoint interno da WEG, que exige login e pede discrição na
-- distribuição — não dá pra linkar direto pro cliente final).
--
-- Idempotente: pode rodar de novo sem erro "policy already exists" — cada
-- policy é apagada (se existir) e recriada.

insert into storage.buckets (id, name, public)
values ('datasheets', 'datasheets', true)
on conflict (id) do update set public = true;

-- Leitura pública (o bucket já é public=true, mas Storage ainda checa RLS
-- em storage.objects pra listagem/signed url em alguns fluxos).
drop policy if exists "datasheets_public_read" on storage.objects;
create policy "datasheets_public_read" on storage.objects
  for select
  using (bucket_id = 'datasheets');

-- Só admin sobe/apaga arquivo.
drop policy if exists "datasheets_admin_write" on storage.objects;
create policy "datasheets_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'datasheets' and public.is_admin());

drop policy if exists "datasheets_admin_update" on storage.objects;
create policy "datasheets_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'datasheets' and public.is_admin())
  with check (bucket_id = 'datasheets' and public.is_admin());

drop policy if exists "datasheets_admin_delete" on storage.objects;
create policy "datasheets_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'datasheets' and public.is_admin());
