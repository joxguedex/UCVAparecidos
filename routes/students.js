'use strict';
/**
 * routes/students.js
 * Rutas REST para el recurso "estudiantes".
 *
 * GET    /api/estudiantes             → listar con filtros opcionales
 * GET    /api/estudiantes/:id         → detalle de uno
 * POST   /api/estudiantes             → registrar desaparecido
 * PUT    /api/estudiantes/:id/aparecio → confirmar aparición
 */
const { Router } = require('express');
const ctrl            = require('../controllers/studentController');
const { writeLimiter } = require('../middleware/limiters');

const router = Router();

router.get  ('/',               ctrl.getAll);
router.get  ('/:id',            ctrl.getOne);
router.post ('/',               writeLimiter, ctrl.create);
router.put  ('/:id/aparecio',   writeLimiter, ctrl.markFound);
router.put  ('/:id/fallecio',   writeLimiter, ctrl.markDeceased);

module.exports = router;
