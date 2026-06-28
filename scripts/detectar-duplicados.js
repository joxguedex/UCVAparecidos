'use strict';
require('dotenv').config();
const { supabase } = require('../config/database');

async function main() {
  const { data, error } = await supabase
    .from('estudiantes')
    .select('id, nombre, cedula, facultad, carrera, estado, registrado_por, fecha_registro')
    .order('nombre', { ascending: true });

  if (error) { console.error(error.message); process.exit(1); }

  const total = data.length;
  console.log(`\nTotal en BD: ${total} estudiantes\n`);

  // ── Duplicados por cédula (excluir null/vacíos) ──────────────────────
  const porCedula = {};
  for (const s of data) {
    const ced = s.cedula?.trim();
    if (!ced) continue;
    if (!porCedula[ced]) porCedula[ced] = [];
    porCedula[ced].push(s);
  }
  const dupsCedula = Object.entries(porCedula).filter(([, arr]) => arr.length > 1);

  // ── Duplicados por nombre exacto (normalizado) ───────────────────────
  const porNombre = {};
  for (const s of data) {
    const key = s.nombre?.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) continue;
    if (!porNombre[key]) porNombre[key] = [];
    porNombre[key].push(s);
  }
  const dupsNombre = Object.entries(porNombre).filter(([, arr]) => arr.length > 1);

  // ── Reporte cédula ───────────────────────────────────────────────────
  console.log(`=== DUPLICADOS POR CÉDULA: ${dupsCedula.length} grupos ===\n`);
  for (const [ced, arr] of dupsCedula) {
    console.log(`  Cédula: ${ced}`);
    for (const s of arr) {
      const src = s.registrado_por?.includes('UCV') ? '[EXCEL]' : '[MANUAL]';
      console.log(`    ${src} id=${s.id}  "${s.nombre}"  ${s.estado}  (${s.fecha_registro?.slice(0,10)})`);
    }
    console.log();
  }

  // ── Reporte nombre ───────────────────────────────────────────────────
  // Filtramos los que ya aparecieron en duplicados por cédula para no repetir
  const cedulasDup = new Set(dupsCedula.flatMap(([, arr]) => arr.map(s => s.id)));
  const dupsNombreNuevos = dupsNombre.filter(
    ([, arr]) => !arr.every(s => cedulasDup.has(s.id))
  );

  console.log(`=== DUPLICADOS POR NOMBRE (no capturados por cédula): ${dupsNombreNuevos.length} grupos ===\n`);
  for (const [nombre, arr] of dupsNombreNuevos) {
    console.log(`  Nombre: "${arr[0].nombre}"`);
    for (const s of arr) {
      const src = s.registrado_por?.includes('UCV') ? '[EXCEL]' : '[MANUAL]';
      console.log(`    ${src} id=${s.id}  ${s.facultad}  ${s.estado}  (${s.fecha_registro?.slice(0,10)})`);
    }
    console.log();
  }

  // ── Resumen ───────────────────────────────────────────────────────────
  const totalDupIds = new Set([
    ...dupsCedula.flatMap(([, arr]) => arr.map(s => s.id)),
    ...dupsNombreNuevos.flatMap(([, arr]) => arr.map(s => s.id)),
  ]);
  console.log(`\n=== RESUMEN ===`);
  console.log(`Grupos duplicados por cédula : ${dupsCedula.length}`);
  console.log(`Grupos duplicados por nombre : ${dupsNombreNuevos.length}`);
  console.log(`IDs involucrados en total    : ${totalDupIds.size}`);
  console.log(`IDs a eliminar (uno de cada grupo) : aprox. ${
    dupsCedula.reduce((acc,[,arr]) => acc + arr.length - 1, 0) +
    dupsNombreNuevos.reduce((acc,[,arr]) => acc + arr.length - 1, 0)
  }`);
}

main().catch(console.error);
