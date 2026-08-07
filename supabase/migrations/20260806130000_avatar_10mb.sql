-- Foto de perfil: límite del bucket 'avatars' sube a 10 MB
-- (el frontend valida el archivo antes de subir; esto aplica en el servidor)
update storage.buckets
set file_size_limit = 10485760
where id = 'avatars';
