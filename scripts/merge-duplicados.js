'use strict';
require('dotenv').config();
const { supabase } = require('../config/database');

async function main() {
  // ── Búsqueda por nombre ────────────────────────────────────────
  const names = [
    'Felix Gabriel Urbano Uribe',
    'Felix Urbano',
    'Williany del valle López Mata',
    'Williany López',
  ];

  const { data, error } = await supabase
    .from('estudiantes')
    .select('id, nombre, cedula, semestre, ultima_ubicacion, estado')
    .or(names.map(n => `nombre.ilike.${n}`).join(','));

  if (error) { console.error(error.message); process.exit(1); }

  console.log('\nRegistros encontrados:');
  for (const r of data) {
    console.log(`  [${r.id}] ${r.nombre} | CI: ${r.cedula ?? '—'} | Sem: ${r.semestre ?? '—'} | Ubic: ${r.ultima_ubicacion ?? '—'}`);
  }

  const felix = data.filter(r => /felix/i.test(r.nombre));
  const willy = data.filter(r => /williany/i.test(r.nombre));

  if (felix.length !== 2) { console.error('\nNo se encontraron exactamente 2 Félix, revisa manualmente'); process.exit(1); }
  if (willy.length  !== 2) { console.error('\nNo se encontraron exactamente 2 Williany, revisa manualmente'); process.exit(1); }

  // ── Félix: conservar el de nombre completo, añadir cédula del otro ──
  const felixKeep = felix.find(r => /gabriel/i.test(r.nombre));
  const felixDrop = felix.find(r => !/gabriel/i.test(r.nombre));

  // ── Williany: conservar la de nombre completo, añadir semestre del otro ──
  const willyKeep = willy.find(r => /valle/i.test(r.nombre));
  const willyDrop = willy.find(r => !/valle/i.test(r.nombre));

  console.log('\n── Plan ──────────────────────────────────────────────────────');
  console.log(`Félix CONSERVAR [${felixKeep.id}]: ${felixKeep.nombre}`);
  console.log(`  → agregar cédula ${felixDrop.cedula} de [${felixDrop.id}] ${felixDrop.nombre}`);
  console.log(`Félix ELIMINAR  [${felixDrop.id}]`);
  console.log('');
  console.log(`Williany CONSERVAR [${willyKeep.id}]: ${willyKeep.nombre}`);
  console.log(`  → agregar semestre "${willyDrop.semestre}" de [${willyDrop.id}] ${willyDrop.nombre}`);
  console.log(`Williany ELIMINAR  [${willyDrop.id}]`);

  if (process.argv.includes('--dry-run')) {
    console.log('\n[DRY RUN] Sin cambios en la BD.');
    return;
  }

  // Limpiar FKs en contacto antes de eliminar (no tiene CASCADE)
  for (const id of [felixDrop.id, willyDrop.id]) {
    const { error } = await supabase.from('contacto').delete().eq('estudiante', id);
    if (error) { console.error(`Error limpiando contacto de [${id}]:`, error.message); process.exit(1); }
  }

  // Eliminar duplicados (ubicacion tiene ON DELETE CASCADE, se borra sola)
  const { error: e3 } = await supabase.from('estudiantes').delete().eq('id', felixDrop.id);
  if (e3) { console.error('Error eliminando Félix duplicado:', e3.message); process.exit(1); }

  const { error: e4 } = await supabase.from('estudiantes').delete().eq('id', willyDrop.id);
  if (e4) { console.error('Error eliminando Williany duplicado:', e4.message); process.exit(1); }

  // Ahora actualizar sin conflicto
  const { error: e1 } = await supabase
    .from('estudiantes')
    .update({ cedula: felixDrop.cedula })
    .eq('id', felixKeep.id);
  if (e1) { console.error('Error actualizando Félix:', e1.message); process.exit(1); }

  const { error: e2 } = await supabase
    .from('estudiantes')
    .update({ semestre: willyDrop.semestre })
    .eq('id', willyKeep.id);
  if (e2) { console.error('Error actualizando Williany:', e2.message); process.exit(1); }

  console.log('\n✓ Merge completado correctamente.');
}

main();
