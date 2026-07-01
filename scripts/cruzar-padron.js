'use strict';
require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const pdfParse = require('../node_modules/pdf-parse/lib/pdf-parse.js');
const { supabase } = require('../config/database');

const PDF = path.join(__dirname, '..', 'Registro Electoral UCV 2026 (1).pdf');

function norm(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function tokens(s) {
  return norm(s).split(' ').filter(w => w.length > 2);
}

// El PDF concatena nombres sin espacios — busca cada token del nombre de BD
// dentro del nombre del padrón colapsado (sin espacios)
function score(dbName, padronName) {
  const tdb = tokens(dbName);
  if (!tdb.length) return 0;
  // versión con y sin espacios del padrón
  const padNorm    = norm(padronName);
  const padNoSpace = padNorm.replace(/\s/g, '');
  let found = 0;
  for (const t of tdb) {
    if (padNorm.includes(t) || padNoSpace.includes(t)) found++;
  }
  return found / tdb.length;
}

async function main() {
  // ── 1. Extraer texto del PDF ────────────────────────────────
  console.log('Leyendo PDF…');
  const buffer = fs.readFileSync(PDF);
  const { text, numpages } = await pdfParse(buffer);
  console.log(`  ${numpages} páginas extraídas`);

  // ── 2. Parsear entradas: NNNNN-CEDULA-NOMBRE COMPLETO ───────
  const entries = [];
  const lineRe = /\d{5}-(\d+)-([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]+)/g;
  let m;
  while ((m = lineRe.exec(text)) !== null) {
    entries.push({ cedula: m[1], nombre_padron: m[2].trim() });
  }
  console.log(`  ${entries.length} registros en el padrón`);

  // ── 3. Obtener desaparecidos de la BD ───────────────────────
  const { data: estudiantes, error } = await supabase
    .from('estudiantes')
    .select('id, nombre, cedula, carrera(nombre, facultad(nombre)), estado(nombre)')
    .eq('estado.nombre', 'desaparecido');

  if (error) { console.error(error.message); process.exit(1); }

  const sinCedula   = estudiantes.filter(e => !e.cedula);
  const conCedula   = estudiantes.filter(e =>  e.cedula);
  console.log(`\nDesaparecidos: ${estudiantes.length} total | ${sinCedula.length} sin cédula | ${conCedula.length} con cédula`);

  // ── 4. Buscar cédulas para los que no tienen ────────────────
  console.log('\n=== MATCHES — CÉDULA ENCONTRADA EN PADRÓN ===\n');
  const actualizaciones = [];

  for (const est of sinCedula) {
    let bestScore = 0, bestEntry = null;
    for (const entry of entries) {
      const s = score(est.nombre, entry.nombre_padron);
      if (s > bestScore) { bestScore = s; bestEntry = entry; }
    }
    if (bestScore >= 0.7) {
      console.log(`✓ [${est.id}] ${est.nombre}`);
      console.log(`    Padrón: ${bestEntry.nombre_padron} | CI: ${bestEntry.cedula} | score: ${bestScore.toFixed(2)}`);
      actualizaciones.push({ id: est.id, cedula: parseInt(bestEntry.cedula), nombre_padron: bestEntry.nombre_padron, score: bestScore });
    } else if (bestScore >= 0.5) {
      console.log(`? [${est.id}] ${est.nombre}`);
      console.log(`    Posible: ${bestEntry.nombre_padron} | CI: ${bestEntry.cedula} | score: ${bestScore.toFixed(2)} (requiere revisión)`);
    }
  }

  // ── 5. Verificar cédulas existentes contra padrón ───────────
  console.log('\n=== VALIDACIÓN — CÉDULAS EXISTENTES ===\n');
  const cedulaMap = {};
  for (const e of entries) cedulaMap[e.cedula] = e.nombre_padron;

  for (const est of conCedula) {
    const enPadron = cedulaMap[String(est.cedula)];
    if (!enPadron) {
      console.log(`⚠ [${est.id}] ${est.nombre} | CI ${est.cedula} — NO encontrada en padrón`);
    } else {
      const s = score(est.nombre, enPadron);
      if (s < 0.4) {
        console.log(`⚠ [${est.id}] ${est.nombre} | CI ${est.cedula} — nombre no coincide con padrón: "${enPadron}" (score: ${s.toFixed(2)})`);
      }
    }
  }

  // ── 6. Aplicar actualizaciones con alta confianza (≥0.8) ────
  const altas = actualizaciones.filter(a => a.score >= 0.8);
  console.log(`\n=== ACTUALIZACIONES AUTOMÁTICAS (score ≥ 0.8): ${altas.length} ===\n`);
  for (const a of altas) {
    const { error: e } = await supabase
      .from('estudiantes').update({ cedula: a.cedula }).eq('id', a.id);
    if (e) console.error(`  Error [${a.id}]:`, e.message);
    else   console.log(`  ✓ [${a.id}] CI ${a.cedula} asignada`);
  }

  const medias = actualizaciones.filter(a => a.score >= 0.7 && a.score < 0.8);
  if (medias.length) {
    console.log(`\n=== REQUIEREN REVISIÓN MANUAL (score 0.7-0.79): ${medias.length} ===`);
    medias.forEach(a => console.log(`  [${a.id}] ${a.nombre_padron} → CI ${a.cedula}`));
  }

  console.log('\nListo.');
}

main().catch(console.error);
