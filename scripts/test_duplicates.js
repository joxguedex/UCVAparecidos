require('dotenv').config();
const fs = require('fs');
const path = require('path');
const importController = require('../controllers/importController');

async function testDupe() {
  const filePath = path.join(__dirname, '../Personas desaparecidas - UCV.xlsx');
  const buffer = fs.readFileSync(filePath);
  
  const req = {
    file: { buffer, originalname: 'Personas desaparecidas - UCV.xlsx' }
  };
  
  const res = {
    status: (code) => ({
      json: (data) => console.log('Error status:', code, data)
    }),
    json: (data) => {
      console.log('--- RESULTADO ---');
      console.log(`Nuevos a insertar: ${data.insertar.length}`);
      console.log(`Modificaciones: ${data.actualizar.length}`);
      console.log(`Sin cambios: ${data.noCambiosCount}`);
      console.log(`Omitidos: ${data.omitidos.length}`);
      
      // Chequear si en insertar hay duplicados internamente
      const cedulasInsertar = new Set();
      for (const item of data.insertar) {
        if (item.cedula) {
          if (cedulasInsertar.has(item.cedula)) {
            console.log('ALERTA: Duplicado interno en payload de insertar:', item.cedula);
          }
          cedulasInsertar.add(item.cedula);
        }
      }
      
      // Extraer todas las cedulas de la base de datos para ver si se cruzan con 'insertar'
      require('../config/database').supabase
        .from('estudiantes')
        .select('cedula')
        .then(({ data: dbRecords }) => {
          const dbCedulas = new Set(dbRecords.map(r => Number(r.cedula)).filter(c => c));
          let fallos = 0;
          for (const item of data.insertar) {
            if (item.cedula && dbCedulas.has(Number(item.cedula))) {
              console.log('ALERTA: Se intenta INSERTAR a alguien que YA ESTÁ EN DB:', item.cedula, item.nombre);
              fallos++;
            }
          }
          console.log('Fallos de cruce con DB:', fallos);
        });
    }
  };

  await importController.analizarExcel(req, res);
}
testDupe();
