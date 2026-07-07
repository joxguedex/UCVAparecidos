require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase } = require('../config/database');

async function testUpload() {
  console.log('--- INICIANDO PRUEBA DE INSERCIÓN DE CONTACTO ---');
  try {
    // 1. Crear un estudiante dummy de prueba temporalmente usando el cliente Supabase
    // Esto probará directamente si la tabla 'contacto' permite inserciones ahora.
    
    // Asumiremos que el estado 1 es "desaparecido" o similar
    const estudianteMock = {
      nombre: 'Test Estudiante',
      cedula: 99999999,
      carrera: 67, // "no especificada"
      estado: 1
    };

    console.log('1. Insertando estudiante de prueba...');
    const { data: est, error: estErr } = await supabase.from('estudiantes').insert(estudianteMock).select('id');
    if (estErr) throw new Error('Error al insertar estudiante: ' + estErr.message);
    
    const estudianteId = est[0].id;
    console.log('✅ Estudiante insertado con ID:', estudianteId);

    console.log('2. Insertando contacto para este estudiante...');
    const contactoMock = {
      nombre: 'Familiar de Prueba',
      telefonos: '0412-0000000',
      estudiante: estudianteId
    };
    
    const { data: cont, error: contErr } = await supabase.from('contacto').insert(contactoMock).select('id');
    
    if (contErr) {
      console.error('❌ FALLÓ LA INSERCIÓN DE CONTACTO:', contErr.message);
    } else {
      console.log('✅ Contacto insertado con éxito! ID:', cont[0].id);
      console.log('🚀 El problema RLS se ha solucionado y el service_role funciona correctamente.');
    }
    
    // Limpieza
    console.log('3. Limpiando datos de prueba...');
    await supabase.from('estudiantes').delete().eq('id', estudianteId);
    console.log('✅ Datos limpios.');

  } catch (e) {
    console.error('ERROR GLOBAL:', e.message);
  }
}
testUpload();
