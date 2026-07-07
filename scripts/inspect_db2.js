require('dotenv').config();
const { supabase } = require('../config/database');

async function test() {
  const { count } = await supabase.from('estudiantes').select('*', { count: 'exact', head: true });
  console.log('Total estudiantes:', count);
}

test();
