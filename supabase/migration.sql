-- ══════════════════════════════════════════════════════
--  UCV APARECIDOS — Migración inicial
--  Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.estudiantes (
  id                      BIGSERIAL PRIMARY KEY,
  nombre                  TEXT        NOT NULL,
  cedula                  TEXT,
  facultad                TEXT        NOT NULL,
  carrera                 TEXT        NOT NULL,
  semestre                TEXT,
  telefono_contacto       TEXT,
  nombre_contacto         TEXT,
  relacion_contacto       TEXT,
  ultima_ubicacion        TEXT,
  descripcion             TEXT,
  estado                  TEXT        NOT NULL DEFAULT 'desaparecido',
  fecha_registro          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registrado_por          TEXT,
  -- Campos de aparición (NULL mientras esté desaparecido)
  fecha_aparecio          TIMESTAMPTZ,
  tipo_confirmacion       TEXT,
  detalles_confirmacion   TEXT,
  reportado_aparicion_por TEXT,
  contacto_reportador     TEXT
);

-- Permitir acceso público (ajustar con políticas RLS más adelante si se requiere)
ALTER TABLE public.estudiantes DISABLE ROW LEVEL SECURITY;
