'use strict';
require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const XLSX    = require('xlsx');
const pdfParse = require('../node_modules/pdf-parse/lib/pdf-parse.js');
const { supabase } = require('../config/database');

const PDF = path.join(__dirname, '..', 'Registro Electoral UCV 2026 (1).pdf');
const OUT = path.join(__dirname, '..', 'resultado-padron.xlsx');

function norm(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}
function tokens(s) {
  return norm(s).split(' ').filter(w => w.length > 2);
}
function score(dbName, padronName) {
  const tdb = tokens(dbName);
  if (!tdb.length) return 0;
  const padNorm    = norm(padronName);
  const padNoSpace = padNorm.replace(/\s/g, '');
  let found = 0;
  for (const t of tdb) {
    if (padNorm.includes(t) || padNoSpace.includes(t)) found++;
  }
  return found / tdb.length;
}

async function main() {
  console.log('Leyendo PDF…');
  const buffer = fs.readFileSync(PDF);
  const { text } = await pdfParse(buffer);

  const entries = [];
  const lineRe = /\d{5}-(\d+)-([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]+)/g;
  let m;
  while ((m = lineRe.exec(text)) !== null) {
    entries.push({ cedula: m[1], nombre_padron: m[2].trim() });
  }
  console.log(`  ${entries.length} registros en el padrón`);

  const { data: estudiantes, error } = await supabase
    .from('estudiantes')
    .select('id, nombre, cedula, semestre, carrera(nombre, facultad(nombre)), estado(nombre)')
    .eq('estado.nombre', 'desaparecido');

  if (error) { console.error(error.message); process.exit(1); }

  const sinCedula = estudiantes.filter(e => !e.cedula);
  const conCedula = estudiantes.filter(e =>  e.cedula);
  console.log(`Desaparecidos: ${estudiantes.length} | sin cédula: ${sinCedula.length} | con cédula: ${conCedula.length}`);

  const cedulaMap = {};
  for (const e of entries) cedulaMap[e.cedula] = e.nombre_padron;

  // ── Hoja 1: cédulas agregadas ────────────────────────────────────
  const rowsAgregadas = [];
  for (const est of sinCedula) {
    let bestScore = 0, bestEntry = null;
    for (const entry of entries) {
      const s = score(est.nombre, entry.nombre_padron);
      if (s > bestScore) { bestScore = s; bestEntry = entry; }
    }
    if (bestScore >= 0.5) {
      rowsAgregadas.push({
        'ID':              est.id,
        'Nombre BD':       est.nombre,
        'Facultad':        est.carrera?.facultad?.nombre ?? '',
        'Carrera':         est.carrera?.nombre ?? '',
        'Semestre':        est.semestre ?? '',
        'Nombre Padrón':   bestEntry.nombre_padron,
        'Cédula Asignada': parseInt(bestEntry.cedula),
        'Score':           parseFloat(bestScore.toFixed(2)),
        'Estado':          bestScore >= 0.8 ? 'Cédula Agregada' : 'Revisar Manualmente',
      });
    }
  }

  // ── Hoja 2: cédulas con problema ────────────────────────────────
  const rowsProblemas = [];
  for (const est of conCedula) {
    const enPadron = cedulaMap[String(est.cedula)];
    let motivo = '';
    let scoreVal = null;

    if (!enPadron) {
      motivo = 'Cédula no encontrada en padrón UCV 2026';
    } else {
      const s = score(est.nombre, enPadron);
      scoreVal = parseFloat(s.toFixed(2));
      if (s < 0.4) {
        motivo = `Nombre no coincide con padrón (score: ${s.toFixed(2)})`;
      }
    }

    // Detectar cédulas con dígitos de más (>8 dígitos para Venezuela)
    const ciStr = String(est.cedula);
    if (ciStr.length > 8) {
      motivo = motivo
        ? motivo + ' · Posible error tipográfico (dígitos extra)'
        : 'Posible error tipográfico (dígitos extra)';
    }

    if (motivo) {
      rowsProblemas.push({
        'ID':              est.id,
        'Nombre BD':       est.nombre,
        'Facultad':        est.carrera?.facultad?.nombre ?? '',
        'Carrera':         est.carrera?.nombre ?? '',
        'Semestre':        est.semestre ?? '',
        'Cédula Actual':   est.cedula,
        'Nombre Padrón':   enPadron ?? '—',
        'Score':           scoreVal ?? '—',
        'Estado':          'Problema',
        'Motivo':          motivo,
      });
    }
  }

  // ── Crear Excel ──────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(rowsAgregadas);
  // Ancho de columnas
  ws1['!cols'] = [
    {wch:6},{wch:35},{wch:25},{wch:30},{wch:9},{wch:40},{wch:14},{wch:7},{wch:22},
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Cédulas Agregadas');

  const ws2 = XLSX.utils.json_to_sheet(rowsProblemas);
  ws2['!cols'] = [
    {wch:6},{wch:35},{wch:25},{wch:30},{wch:9},{wch:14},{wch:40},{wch:7},{wch:10},{wch:55},
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Problemas');

  XLSX.writeFile(wb, OUT);
  console.log(`\n✓ Excel guardado en: ${OUT}`);
  console.log(`  Hoja "Cédulas Agregadas": ${rowsAgregadas.length} filas`);
  console.log(`  Hoja "Problemas":         ${rowsProblemas.length} filas`);
}

main().catch(console.error);
