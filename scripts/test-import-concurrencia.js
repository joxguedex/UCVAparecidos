'use strict';
/**
 * Prueba del confirmarImportacion paralelizado.
 *
 * Sustituye supabaseAdmin por un doble que simula latencia y fallos, para
 * comprobar que la version por tandas concurrentes produce exactamente los
 * mismos conteos que la secuencial y que respeta el orden update -> delete
 * -> insert dentro de cada estudiante.
 *
 * Uso: node scripts/test-import-concurrencia.js
 */
const path = require('path');
const Module = require('module');

const LATENCIA = 20; // ms simulados por viaje
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Doble de supabaseAdmin ──────────────────────────────
function crearDoble({ fallanUpdates = new Set(), fallanContactos = new Set() } = {}) {
  const registro = [];   // secuencia de operaciones observadas
  let enVuelo = 0, picoConcurrencia = 0;

  async function viaje(op, id) {
    enVuelo++;
    picoConcurrencia = Math.max(picoConcurrencia, enVuelo);
    await sleep(LATENCIA);
    enVuelo--;
    registro.push(`${op}:${id}`);
  }

  const admin = {
    from(tabla) {
      return {
        update(_datos) {
          return {
            async eq(_col, id) {
              await viaje('update', id);
              return fallanUpdates.has(id)
                ? { error: { message: 'update falló' } }
                : { error: null };
            },
          };
        },
        delete() {
          return {
            async eq(_col, id) {
              await viaje('delete', id);
              return { error: null };
            },
          };
        },
        async insert(fila) {
          const id = Array.isArray(fila) ? 'batch' : fila.estudiante;
          await viaje('insert', id);
          if (tabla === 'contacto' && fallanContactos.has(id)) {
            return { error: { message: 'contacto falló' } };
          }
          return { data: [], error: null };
        },
      };
    },
  };
  return { admin, registro, pico: () => picoConcurrencia };
}

// ── Cargar el controlador con database.js interceptado ──
function cargarControlador(doble) {
  const rutaDb  = path.resolve(__dirname, '../config/database.js');
  const rutaCtl = path.resolve(__dirname, '../controllers/importController.js');
  delete require.cache[rutaCtl];
  delete require.cache[rutaDb];

  const originalLoad = Module._load;
  Module._load = function (pedido, padre, esPrincipal) {
    if (padre && padre.filename === rutaCtl && pedido === '../config/database') {
      return { supabase: doble.admin, supabaseAdmin: doble.admin };
    }
    return originalLoad.call(this, pedido, padre, esPrincipal);
  };
  try {
    return require(rutaCtl);
  } finally {
    Module._load = originalLoad;
  }
}

function resFalso() {
  const r = { code: 200, cuerpo: null };
  r.status = c => { r.code = c; return r; };
  r.json   = b => { r.cuerpo = b; return r; };
  return r;
}

function hacerActualizaciones(n, { conContacto = true } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    student: { nombre: `Estudiante ${i + 1}` },
    contacto: conContacto
      ? { nombre: `Contacto ${i + 1}`, telefonos: '0412-0000000', relacion: 'Madre' }
      : { nombre: null, telefonos: null, relacion: null },
  }));
}

// ── Casos ───────────────────────────────────────────────
const casos = [];
function caso(nombre, fn) { casos.push({ nombre, fn }); }

caso('cuenta todas las actualizaciones correctas', async () => {
  const doble = crearDoble();
  const ctl = cargarControlador(doble);
  const res = resFalso();
  await ctl.confirmarImportacion(
    { body: { insertar: [], actualizar: hacerActualizaciones(25) } }, res
  );
  return { ok: res.cuerpo.actualizados === 25 && !res.cuerpo.advertencia,
           detalle: `actualizados=${res.cuerpo.actualizados} (esperado 25)` };
});

caso('un update fallido no se cuenta y no bloquea al resto', async () => {
  const doble = crearDoble({ fallanUpdates: new Set([7, 13]) });
  const ctl = cargarControlador(doble);
  const res = resFalso();
  await ctl.confirmarImportacion(
    { body: { insertar: [], actualizar: hacerActualizaciones(25) } }, res
  );
  const sinContacto = doble.registro.filter(r => r === 'delete:7' || r === 'insert:7').length;
  return { ok: res.cuerpo.actualizados === 23 && sinContacto === 0,
           detalle: `actualizados=${res.cuerpo.actualizados} (esperado 23), ops de contacto del fallido=${sinContacto} (esperado 0)` };
});

caso('un contacto fallido cuenta pero el estudiante sí se actualiza', async () => {
  const doble = crearDoble({ fallanContactos: new Set([3, 9, 14]) });
  const ctl = cargarControlador(doble);
  const res = resFalso();
  await ctl.confirmarImportacion(
    { body: { insertar: [], actualizar: hacerActualizaciones(20) } }, res
  );
  return { ok: res.cuerpo.actualizados === 20 && /3 contacto/.test(res.cuerpo.advertencia || ''),
           detalle: `actualizados=${res.cuerpo.actualizados} (esperado 20), advertencia="${res.cuerpo.advertencia ? 'sí' : 'no'}"` };
});

caso('sin datos de contacto no se tocan las tablas de contacto', async () => {
  const doble = crearDoble();
  const ctl = cargarControlador(doble);
  const res = resFalso();
  await ctl.confirmarImportacion(
    { body: { insertar: [], actualizar: hacerActualizaciones(10, { conContacto: false }) } }, res
  );
  const ops = doble.registro.filter(r => r.startsWith('delete') || r.startsWith('insert')).length;
  return { ok: res.cuerpo.actualizados === 10 && ops === 0,
           detalle: `actualizados=${res.cuerpo.actualizados}, ops de contacto=${ops} (esperado 0)` };
});

caso('respeta el orden update -> delete -> insert por estudiante', async () => {
  const doble = crearDoble();
  const ctl = cargarControlador(doble);
  await ctl.confirmarImportacion(
    { body: { insertar: [], actualizar: hacerActualizaciones(16) } }, resFalso()
  );
  let ok = true, malo = null;
  for (let id = 1; id <= 16; id++) {
    const u = doble.registro.indexOf(`update:${id}`);
    const d = doble.registro.indexOf(`delete:${id}`);
    const s = doble.registro.indexOf(`insert:${id}`);
    if (!(u < d && d < s)) { ok = false; malo = id; break; }
  }
  return { ok, detalle: ok ? 'orden correcto en los 16' : `orden roto en el estudiante ${malo}` };
});

caso('payload inválido devuelve 400', async () => {
  const doble = crearDoble();
  const ctl = cargarControlador(doble);
  const res = resFalso();
  await ctl.confirmarImportacion({ body: { insertar: 'no-es-array', actualizar: [] } }, res);
  return { ok: res.code === 400, detalle: `HTTP ${res.code} (esperado 400)` };
});

caso('la concurrencia está acotada y acelera de verdad', async () => {
  const N = 48;
  const doble = crearDoble();
  const ctl = cargarControlador(doble);
  const t0 = Date.now();
  await ctl.confirmarImportacion(
    { body: { insertar: [], actualizar: hacerActualizaciones(N) } }, resFalso()
  );
  const transcurrido = Date.now() - t0;
  const secuencial = N * 3 * LATENCIA;
  const pico = doble.pico();
  const ok = pico <= 8 && transcurrido < secuencial * 0.5;
  return { ok,
           detalle: `pico de concurrencia=${pico} (límite 8), ${transcurrido}ms vs ${secuencial}ms secuencial → ${(secuencial / transcurrido).toFixed(1)}x` };
});

// ── Ejecutar ────────────────────────────────────────────
(async () => {
  let fallos = 0;
  console.log('\nconfirmarImportacion — tandas concurrentes\n');
  for (const c of casos) {
    try {
      const { ok, detalle } = await c.fn();
      if (!ok) fallos++;
      console.log(`  ${ok ? 'PASA' : 'FALLA'}  ${c.nombre}`);
      console.log(`        ${detalle}`);
    } catch (err) {
      fallos++;
      console.log(`  FALLA  ${c.nombre}`);
      console.log(`        excepción: ${err.message}`);
    }
  }
  console.log(`\n  ${casos.length - fallos}/${casos.length} pruebas pasaron\n`);
  process.exit(fallos ? 1 : 0);
})();
