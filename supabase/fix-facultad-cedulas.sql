-- ══════════════════════════════════════════════════════
--  MIGRACIÓN: Correcciones de facultad y cédulas
--  Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ══════════════════════════════════════════════════════

-- 1. Normalizar nombre de facultad (el script de importación guardó 'Derecho'
--    como facultad en vez de como carrera — se corrige al nombre oficial)
UPDATE public.estudiantes
SET facultad = 'Ciencias Jurídicas y Políticas'
WHERE facultad = 'Derecho';

-- 2. Limpiar cédulas ficticias (texto literal del Excel) → NULL
--    Estas no son cédulas reales; impiden la deduplicación por cédula
UPDATE public.estudiantes
SET cedula = NULL
WHERE cedula IN (
  'No aparece en lista',
  'no aparece en lista',
  '-',
  'Desconocida',
  'Desconocido',
  'REPETIDA'
);

-- Verificación post-migración
SELECT facultad, COUNT(*) AS total
FROM public.estudiantes
WHERE facultad IN ('Derecho', 'Ciencias Jurídicas y Políticas')
GROUP BY facultad;

SELECT COUNT(*) AS cedulas_ficticias_restantes
FROM public.estudiantes
WHERE cedula IN ('No aparece en lista','no aparece en lista','-','Desconocida','Desconocido','REPETIDA');
