-- Migración: permite a usuarios autenticados leer la lista de perfiles.
--
-- Motivo: la página de Ajustes muestra quién tiene cuenta creada. La policy
-- anterior "self profile" solo dejaba leer el propio perfil.
-- Se mantiene "self profile" para escritura.

do $$ begin
  create policy "auth read profiles"
    on public.profiles
    for select
    to authenticated
    using (true);
exception when duplicate_object then null; end $$;
