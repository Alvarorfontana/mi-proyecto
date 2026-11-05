-- Taller editorial — preparación de la base (Supabase)
-- Pegalo entero en Supabase → SQL Editor → New query → Run. Se corre una sola vez.
-- Crea el depósito privado «libros» y las reglas para que cada usuario
-- vea y modifique SOLO su carpeta (<su id>/…). Nadie ve los libros de otro.

insert into storage.buckets (id, name, public, file_size_limit)
values ('libros', 'libros', false, 52428800)          -- 50 MB por archivo
on conflict (id) do update set public = false;

drop policy if exists "libros: ver lo propio"       on storage.objects;
drop policy if exists "libros: subir lo propio"     on storage.objects;
drop policy if exists "libros: cambiar lo propio"   on storage.objects;
drop policy if exists "libros: borrar lo propio"    on storage.objects;

create policy "libros: ver lo propio" on storage.objects for select to authenticated
  using (bucket_id = 'libros' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "libros: subir lo propio" on storage.objects for insert to authenticated
  with check (bucket_id = 'libros' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "libros: cambiar lo propio" on storage.objects for update to authenticated
  using (bucket_id = 'libros' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'libros' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "libros: borrar lo propio" on storage.objects for delete to authenticated
  using (bucket_id = 'libros' and (storage.foldername(name))[1] = auth.uid()::text);
