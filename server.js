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

// Arrancar servidor HTTP solo cuando se ejecuta directamente (no en Vercel)
if (require.main === module) {
  // El seed solo corre en local. En serverless se ejecutaba en cada cold start,
  // gastando una consulta a Supabase por arranque sin insertar nada.
  // Para sembrar manualmente: `npm run seed`
  require('./data/seed')().catch(err => console.warn('  ⚠  Seed:', err.message));

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
