'use strict';
/**
 * controllers/facultadController.js
 * Expone el catálogo de facultades y carreras de la UCV.
 */
const Facultad = require('../models/Facultad');

exports.getAll = (_req, res) => {
  res.json(Facultad.getAll());
};
