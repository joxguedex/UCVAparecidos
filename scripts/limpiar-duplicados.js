'use strict';
/**
 * Elimina duplicados confirmados de la BD.
 * Estrategia: cuando hay dos registros de la misma persona,
 * se conserva el que tiene más datos / estado más actualizado.
 *
 * Pasar --dry-run para solo ver qué se eliminaría sin borrar nada.
 */
require('dotenv').config();
const { supabase } = require('../config/database');

const DRY_RUN = process.argv.includes('--dry-run');

// IDs a ELIMINAR (uno de cada par, conservamos el mejor)
// Criterio: conservar el que tiene nombre completo / estado más positivo
const IDS_A_ELIMINAR = [
  // Alednay Palencia Paredes V-19461907 — idénticos, eliminar el mayor
  531,

  // Elsa Pestana V-31291819 — id=181 tiene nombre completo, id=16 manual y id=170 corto
  170, 16,

  // Horacio Pinto V-30887536 — id=320 es aparecido (más actualizado), eliminar id=324 desaparecido
  324,

  // Josfrank Marín V-31740563 — id=295 es aparecido (más actualizado), eliminar id=291 desaparecido
  291,

  // Gisela Alvarez V-13126556 — id=164 aparecido (más actualizado), eliminar id=504 desaparecido
  504,

  // Mayvelis Amair García — id=45 manual, id=418 excel, mismo estado; eliminar el del excel
  418,
];

// Casos que requieren revisión manual (no se tocan aquí)
const REVISAR_MANUAL = [
  { motivo: 'Vanessa Castañeda V-: estados DISTINTOS (257=aparecido, 44=desaparecido)', ids: [257, 44] },
  { motivo: 'V-11005785 Amelia Estévez vs Lolimar González — nombres muy distintos, posible error de cédula', ids: [355, 404] },
  { motivo: 'V-15737690 Katiuska Serrano(†) vs Leída Vega Cala — nombres distintos, posible error', ids: [107, 65] },
  { motivo: 'V-31331770 Luis Werner vs Saori Blanco — nombres distintos, posible error de cédula', ids: [443, 293] },
  { motivo: 'V-3138026x Telleria (cedulas 269/268 posiblemente cruzadas entre hermanas)', ids: [325, 119, 118, 326] },
];

async function main() {
  console.log('\n' + (DRY_RUN ? '=== DRY RUN — nada será eliminado ===' : '=== ELIMINANDO DUPLICADOS ===') + '\n');

  // Mostrar qué se va a eliminar
  console.log(`IDs a eliminar (${IDS_A_ELIMINAR.length}): ${IDS_A_ELIMINAR.join(', ')}\n`);

  if (!DRY_RUN) {
    for (const id of IDS_A_ELIMINAR) {
      const { error } = await supabase.from('estudiantes').delete().eq('id', id);
      if (error) {
        console.error(`  ✗ Error eliminando id=${id}: ${error.message}`);
      } else {
        console.log(`  ✓ Eliminado id=${id}`);
      }
    }
  }

  // Casos de revisión manual
  console.log('\n=== CASOS QUE REQUIEREN REVISIÓN MANUAL (NO se tocaron) ===\n');
  for (const c of REVISAR_MANUAL) {
    console.log(`  ⚠ ${c.motivo}`);
    console.log(`    IDs: ${c.ids.join(', ')}\n`);
  }

  if (!DRY_RUN) {
    // Verificar total final
    const { count } = await supabase.from('estudiantes').select('*', { count: 'exact', head: true });
    console.log(`\nTotal en BD tras limpieza: ${count} estudiantes`);
  }
}

main().catch(console.error);
