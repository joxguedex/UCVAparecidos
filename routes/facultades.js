'use strict';
/**
 * routes/facultades.js
 * GET /api/facultades → catálogo de facultades y carreras UCV
 */
const { Router } = require('express');
const ctrl       = require('../controllers/facultadController');

const router = Router();

router.get('/', ctrl.getAll);

module.exports = router;
