-- 1. Auto-increment para id (sin esto el INSERT falla con null constraint)
CREATE SEQUENCE IF NOT EXISTS ubicacion_id_seq;
ALTER TABLE public.ubicacion
  ALTER COLUMN id SET DEFAULT nextval('ubicacion_id_seq'::regclass);

-- 2. RLS: leer ubicaciones (para el JOIN en SELECT_FULL)
ALTER TABLE public.ubicacion ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "anon_read" ON public.ubicacion FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_insert" ON public.ubicacion FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Grants
GRANT SELECT, INSERT ON public.ubicacion TO anon;
GRANT USAGE ON SEQUENCE ubicacion_id_seq TO anon;
