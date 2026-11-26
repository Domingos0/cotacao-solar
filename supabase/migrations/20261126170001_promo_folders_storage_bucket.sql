-- Item 36: bucket público pra hospedar os PDFs de marketing (folder FOB de
-- cada kit da promoção + folder regional de cada região) que o admin sobe.

insert into storage.buckets (id, name, public)
values ('promo-folders', 'promo-folders', true)
on conflict (id) do nothing;

create policy "promo_folders_public_read" on storage.objects
  for select
  using (bucket_id = 'promo-folders');

create policy "promo_folders_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'promo-folders' and public.is_admin());

create policy "promo_folders_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'promo-folders' and public.is_admin())
  with check (bucket_id = 'promo-folders' and public.is_admin());

create policy "promo_folders_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'promo-folders' and public.is_admin());
