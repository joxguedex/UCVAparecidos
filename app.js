'use strict';
/**
 * app.js
 * Configuración de Express: middleware global y montaje de rutas.
 * server.js se encarga de arrancar el servidor HTTP.
 */
const express = require('express');
const path    = require('path');
const routes  = require('./routes/index');

const app = express();

// ── Middleware ──────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API routes ──────────────────────────────
app.use('/api', routes);

// ── Fallback: cualquier ruta desconocida sirve el SPA ──
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
