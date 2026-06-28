-- Las tablas de referencia (estado, carrera, facultad) necesitan ser legibles
-- por el rol anon para que los embedded JOINs de PostgREST funcionen.
-- Son datos públicos de catálogo, no contienen información sensible.

CREATE POLICY "anon_read" ON estado   FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON carrera  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON facultad FOR SELECT TO anon USING (true);

-- Permiso base de tabla (requerido además del RLS policy)
GRANT SELECT ON public.facultad TO anon;
