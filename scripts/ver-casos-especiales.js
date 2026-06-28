'use strict';
require('dotenv').config();
const { supabase } = require('../config/database');

const CASOS = [
  { titulo: 'Vanessa Castañeda (estados distintos)', ids: [257, 44] },
  { titulo: 'V-11005785 Amelia Estévez vs Lolimar González', ids: [355, 404] },
  { titulo: 'V-15737690 Katiuska Serrano vs Leída Vega Cala', ids: [107, 65] },
  { titulo: 'V-31331770 Luis Werner vs Saori Blanco', ids: [443, 293] },
  { titulo: 'Telleria (cedulas posiblemente cruzadas)', ids: [325, 119, 118, 326] },
];

const FIELDS = 'id, nombre, cedula, facultad, carrera, semestre, estado, telefono_contacto, nombre_contacto, registrado_por, fecha_registro';

async function main() {
  for (const caso of CASOS) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`CASO: ${caso.titulo}`);
    console.log('─'.repeat(60));

    const { data } = await supabase.from('estudiantes').select(FIELDS).in('id', caso.ids);
    for (const s of (data || [])) {
      console.log(`\n  id            : ${s.id}`);
      console.log(`  nombre        : ${s.nombre}`);
      console.log(`  cedula        : ${s.cedula}`);
      console.log(`  facultad      : ${s.facultad}`);
      console.log(`  carrera       : ${s.carrera}`);
      console.log(`  semestre      : ${s.semestre}`);
      console.log(`  estado        : ${s.estado}`);
      console.log(`  tel. contacto : ${s.telefono_contacto}`);
      console.log(`  nombre cont.  : ${s.nombre_contacto}`);
      console.log(`  registrado_por: ${s.registrado_por}`);
    }
  }
  console.log('\n');
}

main().catch(console.error);
