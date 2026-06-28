'use strict';
require('dotenv').config();
const { supabase } = require('../config/database');

async function main() {
  console.log('\n  Caso Telleria — hermanas, ambas aparecidas');
  console.log('  ─────────────────────────────────────────');
  console.log('  Correctos: id=118 (Alexandra) y id=119 (Daniela), Arquitectura, aparecido');
  console.log('  Duplicados: id=325 y id=326 — cédulas cruzadas, Ingeniería, desaparecido\n');

  // Añadir apellido Tirado a los registros correctos
  const updates = [
    { id: 118, nombre: 'Alexandra Telleria Tirado' },
    { id: 119, nombre: 'Daniela Telleria Tirado' },
  ];

  for (const u of updates) {
    const { error } = await supabase.from('estudiantes').update({ nombre: u.nombre }).eq('id', u.id);
    if (error) console.error(`  ✗ Actualizar id=${u.id}: ${error.message}`);
    else        console.log(`  ✓ id=${u.id} → "${u.nombre}"`);
  }

  // Eliminar los duplicados cruzados
  for (const id of [325, 326]) {
    const { error } = await supabase.from('estudiantes').delete().eq('id', id);
    if (error) console.error(`  ✗ Eliminar id=${id}: ${error.message}`);
    else        console.log(`  ✓ id=${id} eliminado (duplicado cruzado)`);
  }

  console.log('\n  Listo.\n');
}

main().catch(console.error);
