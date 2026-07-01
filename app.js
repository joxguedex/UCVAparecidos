'use strict';
/**
 * app.js
 * Configuración de Express: middleware global y montaje de rutas.
 * server.js se encarga de arrancar el servidor HTTP.
 */
const express    = require('express');
const path       = require('path');
const helmet     = require('helmet');
const routes     = require('./routes/index');
const { apiLimiter } = require('./middleware/limiters');

const app = express();

// ── Seguridad: cabeceras HTTP ───────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'https://gfmfttdfsqdzoagpduad.supabase.co'],
      connectSrc:  ["'self'", 'https://nominatim.openstreetmap.org', 'https://gfmfttdfsqdzoagpduad.supabase.co'],
      frameSrc:    ['https://www.openstreetmap.org'],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
      formAction:  ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── Middleware ──────────────────────────────
app.use(express.json({ limit: '10mb' }));

// ── Modo mantenimiento ──────────────────────
if (process.env.MAINTENANCE === 'true') {
  app.use((req, res) => {
    if (req.path.startsWith('/api/') || req.path === '/api') {
      return res.status(503).json({ error: 'Sistema en mantenimiento. Vuelve en unos minutos.' });
    }
    res.status(503).sendFile(path.join(__dirname, 'public', 'mantenimiento.html'));
  });
}

app.use(express.static(path.join(__dirname, 'public')));

// ── API routes (rate limit global) ─────────
app.use('/api', apiLimiter, routes);

// ── Página de seguimiento interno (URL no enlazada desde el sitio público) ──
app.get('/seguimiento-interno', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'seguimiento.html'));
});

// ── Catch-all /api/*: rutas de API desconocidas → 404 JSON (antes del SPA) ──
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta de API no encontrada.' });
});

// ── Fallback: cualquier ruta desconocida sirve el SPA ──
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
