'use strict';
/**
 * scripts/watch_excel.js
 * Script local para sincronización automática en tiempo real.
 * Vigila el archivo Excel y lo sube al servidor cada vez que se guarda (Ctrl+S).
 *
 * Uso:
 *   node scripts/watch_excel.js
 */
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno del proyecto
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require(path.join(__dirname, '..', 'node_modules', 'dotenv')).config({ path: envPath });
}

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const EXCEL_FILE = 'Personas desaparecidas - UCV.xlsx';
const EXCEL_PATH = path.join(__dirname, '..', EXCEL_FILE);

const uploadUrl = `http://localhost:${PORT}/api/import`;

console.log('\n  ================================================');
console.log('   UCV APARECIDOS — Sincronizador de Excel');
console.log(`   Vigilando: ${EXCEL_FILE}`);
console.log(`   Destino:   ${uploadUrl}`);
console.log('  ================================================\n');

if (!fs.existsSync(EXCEL_PATH)) {
  console.error(`❌ Error: No se encontró el archivo Excel en: ${EXCEL_PATH}`);
  console.log('Por favor, asegúrate de colocar el archivo Excel en la raíz del proyecto.');
  process.exit(1);
}

let timeoutId = null;

// fs.watch puede disparar múltiples eventos en una sola acción de guardado, por lo que usamos un descanso/debounce.
fs.watch(EXCEL_PATH, (eventType) => {
  if (eventType === 'change') {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(uploadExcel, 600); // 600ms de debounce
  }
});

console.log('👁  Vigilancia activa... Realiza cambios en Excel y presiona Guardar (Ctrl+S) para sincronizar.');

async function uploadExcel() {
  console.log(`\n⚡ Cambio detectado en '${EXCEL_FILE}'. Sincronizando...`);
  
  try {
    // Leer el archivo en memoria
    const fileBuffer = fs.readFileSync(EXCEL_PATH);
    const stats = fs.statSync(EXCEL_PATH);
    
    // Crear un FormData compatible con Node.js sin dependencias externas
    const boundary = `----NodeFormBoundary${Math.random().toString(16).substring(2)}`;
    
    const header = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="archivo"; filename="${EXCEL_FILE}"`,
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
      '',
      ''
    ].join('\r\n');
    
    const fieldHeader = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="actualizarExistentes"`,
      '',
      'true', // Siempre sincronizar/actualizar los cambios del Excel
      ''
    ].join('\r\n');
    
    const footer = `\r\n--${boundary}--\r\n`;
    
    const bodyBuffer = Buffer.concat([
      Buffer.from(header, 'utf-8'),
      fileBuffer,
      Buffer.from(fieldHeader, 'utf-8'),
      Buffer.from(footer, 'utf-8')
    ]);
    
    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': bodyBuffer.length,
    };
    
    if (ADMIN_TOKEN) {
      headers['x-admin-token'] = ADMIN_TOKEN;
    }
    
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: bodyBuffer
    });
    
    if (res.status === 401) {
      console.error('❌ Error de autorización: El token de administrador es incorrecto o no se ha proporcionado.');
      return;
    }
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ Fallo en la sincronización (HTTP ${res.status}): ${errText}`);
      return;
    }
    
    const data = await res.json();
    console.log('✅ Sincronización exitosa:');
    console.log(`   - Nuevos insertados: ${data.importados}`);
    console.log(`   - Actualizados:      ${data.actualizados}`);
    console.log(`   - Omitidos:          ${data.omitidos}`);
    if (data.omitidos > 0 && data.errores.length > 0) {
      console.log('   - Detalles de omisiones:');
      data.errores.forEach(err => console.log(`     • Fila ${err.fila}: ${err.motivo}`));
    }
    if (data.warnings && data.warnings.length > 0) {
      console.log('   - Advertencias de carreras no encontradas (guardadas como no especificada):');
      data.warnings.forEach(warn => console.log(`     • Fila ${warn.fila} (${warn.nombre}): ${warn.msg}`));
    }
  } catch (err) {
    console.error('❌ Error de conexión al sincronizar:', err.message);
  }
}
