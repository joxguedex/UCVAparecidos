'use strict';
require('dotenv').config();
const { supabase } = require('../config/database');

async function main() {
  // Cédulas que pertenecen a otra persona — se marca "REPETIDA" para identificarlas fácilmente
  const fixes = [
    { id: 107, nombre: 'Katiuska Serrano',          cedula_incorrecta: 'V-15737690' },
    { id: 355, nombre: 'Amelia Estévez De Vidts',   cedula_incorrecta: 'V-11005785' },
    { id: 443, nombre: 'Luis Felipe Werner Torres',  cedula_incorrecta: 'V-31331770' },
  ];

  for (const f of fixes) {
    const { error } = await supabase
      .from('estudiantes')
      .update({ cedula: 'REPETIDA' })
      .eq('id', f.id);

    if (error) console.error(`✗ id=${f.id} ${f.nombre}: ${error.message}`);
    else console.log(`✓ id=${f.id} "${f.nombre}" — cédula ${f.cedula_incorrecta} → REPETIDA`);
  }
}

main().catch(console.error);
