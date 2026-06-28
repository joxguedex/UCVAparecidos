'use strict';
const { Router }    = require('express');
const students      = require('./students');
const stats         = require('./stats');
const facultades    = require('./facultades');
const snapshots     = require('./snapshots');

const router = Router();

router.use('/estudiantes', students);
router.use('/stats',       stats);
router.use('/facultades',  facultades);
router.use('/snapshots',   snapshots);

// Proxy para Nominatim (evita CSP connect-src en el cliente)
router.get('/geocode', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json([]);
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=es`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'UCVAparecidos/1.0 (jox.ucv15@gmail.com)' },
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error('[geocode]', err.message);
    res.json([]);
  }
});

module.exports = router;
