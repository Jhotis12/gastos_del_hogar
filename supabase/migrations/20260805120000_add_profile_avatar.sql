-- =============================================================
-- Foto de perfil
-- 1) profiles.avatar_path: ruta del archivo en el bucket 'avatars'.
-- 2) Bucket público 'avatars' (los avatares no son datos sensibles y las
--    URLs públicas se cachean bien, incluso offline con el SW).
--    Nombres aleatorios {userId}/uuid.jpg; RLS permite a cada usuario
--    subir/actualizar/borrar solo sus propios archivos.
-- =============================================================

alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: ver"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

create policy "avatars: subir el propio"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: actualizar el propio"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: eliminar el propio"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
