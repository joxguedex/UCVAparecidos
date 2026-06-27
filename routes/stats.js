'use strict';
/**
 * routes/stats.js
 * GET /api/stats → estadísticas del dashboard
 */
const { Router } = require('express');
const ctrl       = require('../controllers/statsController');

const router = Router();

router.get('/', ctrl.getStats);

module.exports = router;
