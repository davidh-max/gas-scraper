-- Migración: añade columna `name` a `public.jobs`.
--
-- Motivo: permitir poner un nombre descriptivo al job. Si es null, la interfaz
-- muestra un fallback compuesto por fecha y cliente.
-- schema_v2.sql debería actualizarse para reflejar esta columna en instalaciones
-- nuevas.

alter table public.jobs add column if not exists name text;
