'use strict';
require('dotenv').config();
const { supabase } = require('../config/database');

const DRY_RUN = process.argv.includes('--dry-run');

// [from, to] — estudiantes con carrera 'from' pasan a 'to', luego se borra 'from'
const MERGES = [
  // Ciencias
  { from: 10, to: 11,  label: 'biologia → biología' },
  { from: 15, to: 16,  label: 'computacion → computación' },
  { from: 35, to: 36,  label: 'fisica → física' },
  { from: 42, to: 43,  label: 'geoquimica → geoquímica' },
  { from: 60, to: 61,  label: 'matematicas → matemáticas' },
  { from: 76, to: 77,  label: 'quimica → química' },
  // FACES
  { from: 1,  to: 3,   label: 'administracion y contaduría → administración y contaduría' },
  { from: 2,  to: 3,   label: 'administración y contaduria → administración y contaduría' },
  { from: 23, to: 24,  label: 'economia → economía' },
  // Humanidades
  { from: 38, to: 39,  label: 'geografia → geografía' },
  // Ingeniería — typos al canónico más cercano
  { from: 54, to: 46,  label: 'ingieneria → ingenieria (se renombrará)' },
  { from: 55, to: 27,  label: 'ingieneria electrica → eléctrica' },
  { from: 47, to: 48,  label: 'ingenieria - ciclo básico → ingeniería - ciclo básico' },
  { from: 56, to: 48,  label: 'ingieneria-ciclo basico → ingeniería - ciclo básico' },
  { from: 58, to: 49,  label: 'ingineria civil → ingeniería - civil' },
  { from: 53, to: 52,  label: 'ingeniería del petróleo → ingeniería de petróleo' },
  { from: 73, to: 52,  label: 'petroleo → ingeniería de petróleo' },
  { from: 57, to: 52,  label: 'ingieneria-procesos industriales → ingeniería de petróleo' },
  // Medicina
  { from: 28, to: 29,  label: 'enfermeria → enfermería' },
  { from: 63, to: 65,  label: 'medicina -  vargas (doble espacio) → medicina - vargas' },
  { from: 79, to: 80,  label: 'salud publica → salud pública' },
  // Odontología
  { from: 70, to: 71,  label: 'odontologia → odontología' },
];

// Renombrar entradas que quedan después del merge pero con typo
const RENAMES = [
  { id: 46, nombre: 'ingeniería' },
];

async function main() {
  // Contar estudiantes afectados por cada merge
  console.log('=== PLAN DE MERGE ===\n');
  for (const m of MERGES) {
    const { count } = await supabase
      .from('estudiantes').select('id', { count: 'exact', head: true })
      .eq('carrera', m.from);
    console.log(`  [${m.from}→${m.to}] ${m.label} (${count ?? 0} estudiantes)`);
  }
  for (const r of RENAMES) {
    console.log(`  [RENAME ${r.id}] → "${r.nombre}"`);
  }

  if (DRY_RUN) { console.log('\n[DRY RUN] Sin cambios.'); return; }

  console.log('\n=== EJECUTANDO ===\n');

  let totalMoved = 0;
  for (const m of MERGES) {
    const { data, error } = await supabase
      .from('estudiantes')
      .update({ carrera: m.to })
      .eq('carrera', m.from)
      .select('id');
    if (error) { console.error(`Error en merge ${m.from}→${m.to}:`, error.message); continue; }
    const moved = data?.length ?? 0;
    totalMoved += moved;
    console.log(`  ✓ [${m.from}→${m.to}] ${moved} estudiantes movidos — ${m.label}`);

    // Borrar carrera vacía
    const { error: delErr } = await supabase.from('carrera').delete().eq('id', m.from);
    if (delErr) console.warn(`  ⚠ No se pudo borrar carrera [${m.from}]:`, delErr.message);
    else console.log(`    → carrera [${m.from}] eliminada`);
  }

  for (const r of RENAMES) {
    const { error } = await supabase.from('carrera').update({ nombre: r.nombre }).eq('id', r.id);
    if (error) console.error(`Error renombrando [${r.id}]:`, error.message);
    else console.log(`  ✓ [RENAME ${r.id}] → "${r.nombre}"`);
  }

  console.log(`\n✓ Listo. ${totalMoved} estudiantes reasignados en total.`);
}

main();
