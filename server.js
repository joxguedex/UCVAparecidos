'use strict';
/**
 * server.js
 * Punto de entrada de la aplicación.
 *
 * — Local:   `node server.js` arranca el servidor HTTP en el puerto definido.
 * — Vercel:  importa este módulo y usa `module.exports = app` directamente.
 *
 * Uso:
 *   node server.js      (producción local)
 *   npm run dev         (desarrollo con nodemon)
 */
require('dotenv').config();

const app  = require('./app');
const seed = require('./data/seed');

// Ejecuta el seed de forma no-bloqueante (solo inserta si la tabla está vacía)
seed().catch(err => console.warn('  ⚠  Seed:', err.message));

// Arrancar servidor HTTP solo cuando se ejecuta directamente (no en Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log('\n  ╔═══════════════════════════════════════╗');
    console.log('  ║   UCV APARECIDOS — Sistema activo     ║');
    console.log(`  ║   http://localhost:${PORT}               ║`);
    console.log('  ║   Base de datos: Supabase             ║');
    console.log('  ╚═══════════════════════════════════════╝\n');
  });
}

// Para Vercel (y cualquier otro host serverless)
module.exports = app;
