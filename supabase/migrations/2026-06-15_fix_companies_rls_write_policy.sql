-- Migración: permite escritura en `companies` a usuarios autenticados.
--
-- Motivo: el front inserta filas directamente en `public.companies` al crear un job
-- (web/src/lib/data/supabaseSource.ts), pero schema_v2.sql solo definía una policy
-- `for select`. Esto provocaba el error:
--   "new row violates row-level security policy for table 'companies'"
-- al pulsar "Lanzar lote".
--
-- schema_v2.sql debería actualizarse para reflejar esta política en instalaciones
-- nuevas (se sustituye la policy de solo lectura por una de lectura/escritura,
-- coherente con `jobs` y `contacts`).

drop policy if exists "auth read companies" on public.companies;
drop policy if exists "auth rw companies" on public.companies;

create policy "auth rw companies"
  on public.companies
  for all
  to authenticated
  using (true)
  with check (true);
