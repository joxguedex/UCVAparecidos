require('dotenv').config();
const { supabase } = require('../config/database');

async function test() {
  const { data: estados } = await supabase.from('estado').select('*');
  console.log('Estados:', estados);

  const { data: estudiantes } = await supabase.from('estudiantes').select('id, nombre, estado, estado(nombre)');
  console.log('Estudiantes:', estudiantes);
}

test();
