'use strict';
const Facultad = require('../models/Facultad');

exports.getAll = async (_req, res) => {
  try {
    res.json(await Facultad.getAll());
  } catch (err) {
    console.error('[facultadController]', err.message);
    res.status(500).json({ error: 'No se pudo cargar el catálogo de facultades.' });
  }
};
