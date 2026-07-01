-- ══════════════════════════════════════════════════════
--  MIGRACIÓN: Corrección de RLS para tabla contacto
--  Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ══════════════════════════════════════════════════════

-- Opción A (Recomendada y más simple): Deshabilitar RLS para la tabla contacto, 
-- igual a como está configurada la tabla de estudiantes.
ALTER TABLE public.contacto DISABLE ROW LEVEL SECURITY;

-- Opción B (Alternativa si se prefiere mantener RLS activo):
-- ALTER TABLE public.contacto ENABLE ROW LEVEL SECURITY;
-- DO $$ BEGIN
--   CREATE POLICY "anon_insert" ON public.contacto FOR INSERT TO anon WITH CHECK (true);
-- EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- DO $$ BEGIN
--   CREATE POLICY "anon_read" ON public.contacto FOR SELECT TO anon USING (true);
-- EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- GRANT SELECT, INSERT ON public.contacto TO anon;
