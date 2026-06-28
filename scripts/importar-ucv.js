'use strict';
/**
 * scripts/importar-ucv.js
 * Importación masiva desde "Personas desaparecidas - UCV.xlsx"
 *
 * Uso: node scripts/importar-ucv.js
 *
 * Lee el Excel, normaliza los datos y los sube a Supabase.
 * Diseñado para ejecutarse UNA sola vez. Si se ejecuta de nuevo,
 * insertará duplicados — verificar antes.
 */
require('dotenv').config();
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

// ──────────────────────────────────────────────
//  Supabase
// ──────────────────────────────────────────────
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('ERROR: Faltan SUPABASE_URL y/o SUPABASE_KEY en .env');
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  realtime: { transport: ws },
});

// ──────────────────────────────────────────────
//  Normalización de facultad (abreviaturas → nombre completo)
// ──────────────────────────────────────────────
const FAC_MAP = {
  'faces':  'Ciencias Económicas y Sociales',
  'facces': 'Ciencias Económicas y Sociales',
  'fau':    'Arquitectura y Urbanismo',
  'fhye':   'Humanidades y Educación',
  'fm':     'Medicina',
  'fc':     'Ciencias',
  'fcjp':   'Ciencias Jurídicas y Políticas',
  'ff':     'Farmacia',
  'fi':     'Ingeniería',
  'fo':     'Odontología',
  'fagro':  'Agronomía',
  'ucv':    'Administración UCV',
  'dicori': 'Administración UCV',
  'dtic':   'Administración UCV',
  'deu':    'Administración UCV',
  'cdch':   'Administración UCV',
};

// Escuelas que permiten inferir facultad cuando la columna Facultad está vacía
const ESCUELA_FAC = {
  'administración y contaduría': 'Ciencias Económicas y Sociales',
  'administracion y contaduria': 'Ciencias Económicas y Sociales',
  'economia':                    'Ciencias Económicas y Sociales',
  'economía':                    'Ciencias Económicas y Sociales',
  'ciencias juridicas y politicas': 'Derecho',
  'ciecias juridicas y politicas':  'Derecho',  // typo en el Excel
};

function normalizeFacultad(rawFac, rawEscuela) {
  const fac = String(rawFac || '').trim();
  if (fac) {
    const key = fac
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quitar tildes
      .replace(/\s+/g, '');
    return FAC_MAP[key] || fac;  // si no está mapeada, usar como viene
  }

  // Intentar inferir desde Escuela
  const esc = String(rawEscuela || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [keyword, fName] of Object.entries(ESCUELA_FAC)) {
    if (esc.includes(keyword)) return fName;
  }

  // Default para personal administrativo/trabajadores sin facultad
  return 'Administración UCV';
}

// ──────────────────────────────────────────────
//  Mapeo de estado del Excel → estado de la BD
// ──────────────────────────────────────────────
function mapEstado(row) {
  const estadoRaw  = String(row['Estado en el que se encuentra:'] || '').trim().toLowerCase();
  const localizRaw = String(row['¿Fue localizado?'] || '').trim().toLowerCase();

  if (estadoRaw === 'fallecido')   return 'fallecido';
  if (estadoRaw === 'desaparecido') return 'desaparecido';
  if (estadoRaw === 'localizado')   return 'aparecido';
  if (estadoRaw === 'herido')       return 'aparecido';
  if (estadoRaw === 'damnificado')  return 'aparecido';
  if (estadoRaw === 'tapiado')      return 'desaparecido';

  // Estado vacío → usar columna ¿Fue localizado?
  if (localizRaw === 'si' || localizRaw === 'sí') return 'aparecido';
  return 'desaparecido';
}

// Nota descriptiva extra según el estado original del Excel
function notaEstado(row) {
  const e = String(row['Estado en el que se encuentra:'] || '').trim();
  if (e === 'Herido')     return 'Herido';
  if (e === 'Tapiado')    return 'Tapiado';
  if (e === 'Damnificado') return 'Damnificado';
  return '';
}

// ──────────────────────────────────────────────
//  Limpieza de campos
// ──────────────────────────────────────────────
function str(val) {
  const s = String(val ?? '').trim();
  return s || null;
}

function strCedula(val) {
  // La cédula puede venir como número o string con espacios
  const s = String(val ?? '').trim();
  if (!s || s === ' ') return null;
  // Si es solo dígitos, agregar prefijo V-
  if (/^\d+$/.test(s)) return `V-${s}`;
  return s;
}

function strTel(val) {
  const s = String(val ?? '').trim();
  if (!s || s === '0') return null;
  return s;
}

// ──────────────────────────────────────────────
//  Main
// ──────────────────────────────────────────────
async function main() {
  const filePath = path.join(__dirname, '..', 'Personas desaparecidas - UCV.xlsx');
  console.log('\n  ╔═══════════════════════════════════════════════╗');
  console.log('  ║   Importación masiva UCV Aparecidos           ║');
  console.log('  ╚═══════════════════════════════════════════════╝\n');
  console.log(`  Leyendo: ${filePath}\n`);

  let wb;
  try {
    wb = xlsx.readFile(filePath);
  } catch (err) {
    console.error('  ERROR: No se pudo leer el Excel:', err.message);
    process.exit(1);
  }

  const ws2   = wb.Sheets[wb.SheetNames[0]];
  const rows  = xlsx.utils.sheet_to_json(ws2, { defval: '' });
  console.log(`  Filas encontradas: ${rows.length}\n`);

  const records = [];
  const omitidos = [];

  for (let i = 0; i < rows.length; i++) {
    const row  = rows[i];
    const fila = i + 2;  // fila Excel (1 = encabezado, datos desde 2)

    const nombreS = String(row['Nombre(s)'] || '').trim();
    const apellS  = String(row['Apellido(s)'] || '').trim();
    const nombre  = [nombreS, apellS].filter(Boolean).join(' ');

    if (!nombre) {
      omitidos.push({ fila, motivo: 'Sin nombre' });
      continue;
    }

    const escuela  = String(row['Escuela'] || '').trim();
    const carrera  = escuela || 'No especificada';
    const facultad = normalizeFacultad(row['Facultad'], row['Escuela']);
    const estado   = mapEstado(row);

    // Descripción compuesta: Grupo + nota de estado si aplica
    const grupo = String(row['Grupo'] || '').trim();
    const nota  = notaEstado(row);
    const partes = [grupo ? `Grupo: ${grupo}` : '', nota].filter(Boolean);
    const descripcion = partes.length ? partes.join(' · ') : null;

    const record = {
      nombre,
      cedula:            strCedula(row['Cédula']),
      facultad,
      carrera,
      ultima_ubicacion:  str(row['Última localización']),
      nombre_contacto:   str(row['Familiar/conocido a contactar']),
      telefono_contacto: strTel(row['Número de contacto']),
      descripcion,
      estado,
      registrado_por:    'Importación UCV — Registro centralizado',
    };

    // Para aparecidos y fallecidos, registrar fecha y tipo
    if (estado === 'aparecido' || estado === 'fallecido') {
      record.fecha_aparecio          = new Date().toISOString();
      record.tipo_confirmacion       = 'otro';
      const donde = str(row['¿Dónde o con quién se encuentra?']);
      record.detalles_confirmacion   = donde || 'Importado desde registro UCV';
    }

    records.push(record);
  }

  console.log(`  Registros válidos: ${records.length}`);
  console.log(`  Omitidos:          ${omitidos.length}`);
  if (omitidos.length) {
    omitidos.forEach(o => console.log(`    Fila ${o.fila}: ${o.motivo}`));
  }
  console.log('');

  // Resumen por estado
  const porEstado = { desaparecido: 0, aparecido: 0, fallecido: 0 };
  records.forEach(r => porEstado[r.estado]++);
  console.log('  Distribución:');
  console.log(`    Desaparecidos: ${porEstado.desaparecido}`);
  console.log(`    Aparecidos:    ${porEstado.aparecido}`);
  console.log(`    Fallecidos:    ${porEstado.fallecido}`);
  console.log('');

  // Insertar en batches de 200
  const BATCH = 200;
  let insertados = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase.from('estudiantes').insert(batch);
    if (error) {
      console.error(`\n  ERROR en batch ${Math.floor(i / BATCH) + 1}:`, error.message);
      process.exit(1);
    }
    insertados += batch.length;
    process.stdout.write(`  Importando... ${insertados}/${records.length}\r`);
  }

  console.log(`\n  ✓ Importación completada: ${insertados} estudiantes subidos a Supabase.\n`);
}

main().catch(err => {
  console.error('\n  ERROR inesperado:', err.message);
  process.exit(1);
});
