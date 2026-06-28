-- Agrega columna de foto a estudiantes
ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS foto_url TEXT;
