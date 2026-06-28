'use strict';
require('dotenv').config();
const { supabase } = require('../config/database');

async function main() {
  console.log('\n  Caso Johannys Maita');
  console.log('  ───────────────────');
  console.log('  Conservar id=20 (aparecido), eliminar id=35 (desaparecido duplicado)\n');

  const { error } = await supabase.from('estudiantes').delete().eq('id', 35);
  if (error) console.error(`  ✗ Eliminar id=35: ${error.message}`);
  else        console.log('  ✓ id=35 eliminado');

  console.log('\n  Listo.\n');
}

main().catch(console.error);
