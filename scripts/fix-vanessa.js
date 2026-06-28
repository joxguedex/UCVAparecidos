'use strict';
require('dotenv').config();
const { supabase } = require('../config/database');

async function main() {
  console.log('\n  Caso Vanessa Castañeda');
  console.log('  ──────────────────────');
  console.log('  Conservar id=257 (aparecido, Excel) con datos de contacto del id=44 (manual)');
  console.log('  Eliminar id=44\n');

  // Migrar semestre y contacto familiar del registro manual al del Excel
  const { error: errUpdate } = await supabase
    .from('estudiantes')
    .update({
      semestre:          '6to Semestre',
      nombre_contacto:   'Valentina Prada',
      telefono_contacto: '0414-1390327',
    })
    .eq('id', 257);

  if (errUpdate) {
    console.error(`  ✗ Actualizar id=257: ${errUpdate.message}`);
    process.exit(1);
  }
  console.log('  ✓ id=257 actualizado — semestre, contacto familiar migrados');

  // Eliminar el registro manual duplicado
  const { error: errDel } = await supabase.from('estudiantes').delete().eq('id', 44);
  if (errDel) console.error(`  ✗ Eliminar id=44: ${errDel.message}`);
  else        console.log('  ✓ id=44 eliminado (duplicado manual)');

  console.log('\n  Listo.\n');
}

main().catch(console.error);
