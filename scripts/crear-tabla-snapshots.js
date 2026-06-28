'use strict';
/**
 * Crea la tabla `snapshots` en Supabase.
 * Ejecutar UNA sola vez: node scripts/crear-tabla-snapshots.js
 */
require('dotenv').config();
const { supabase } = require('../config/database');

async function main() {
  // Supabase no expone DDL directo via JS client; usamos rpc o verificamos existencia
  // Insertamos un registro de prueba para ver si la tabla existe
  const { error } = await supabase.from('snapshots').select('id').limit(1);

  if (!error) {
    console.log('✓ La tabla snapshots ya existe.');
    return;
  }

  console.log('La tabla snapshots no existe aún.');
  console.log('\nEjecuta este SQL en el editor de Supabase (SQL Editor):\n');
  console.log(`
CREATE TABLE IF NOT EXISTS snapshots (
  id           BIGSERIAL PRIMARY KEY,
  tomado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  desaparecidos INTEGER NOT NULL,
  aparecidos    INTEGER NOT NULL,
  fallecidos    INTEGER NOT NULL,
  total         INTEGER NOT NULL
);

-- Índice para ordenar por fecha rápidamente
CREATE INDEX IF NOT EXISTS snapshots_tomado_en_idx ON snapshots (tomado_en DESC);
  `);
}

main().catch(console.error);
