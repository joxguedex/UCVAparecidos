'use strict';
/**
 * config/database.js
 * Cliente Supabase — singleton exportado a models/ y controllers/.
 * Para cambiar de base de datos en el futuro, solo editar este archivo.
 */
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws'); // requerido en Node.js < 22

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!process.env.SUPABASE_URL || !supabaseKey) {
  throw new Error(
    'Faltan variables de entorno. Copia .env.example a .env y completa SUPABASE_URL y SUPABASE_KEY'
  );
}

const supabase = createClient(process.env.SUPABASE_URL, supabaseKey, {
  realtime: { transport: ws },
});

module.exports = { supabase };
