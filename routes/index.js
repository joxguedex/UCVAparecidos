'use strict';
/**
 * routes/index.js
 * Punto único de montaje de todas las rutas de la API.
 * Para agregar un nuevo recurso: importar su router y añadirlo aquí.
 */
const { Router }    = require('express');
const students      = require('./students');
const stats         = require('./stats');
const facultades    = require('./facultades');

const router = Router();

router.use('/estudiantes', students);
router.use('/stats',       stats);
router.use('/facultades',  facultades);

module.exports = router;
