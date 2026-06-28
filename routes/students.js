'use strict';
const { Router }      = require('express');
const multer          = require('multer');
const ctrl            = require('../controllers/studentController');
const { writeLimiter } = require('../middleware/limiters');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 100 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

const router = Router();

router.get ('/',               ctrl.getAll);
router.get ('/:id/foto',       ctrl.getFoto);
router.get ('/:id',            ctrl.getOne);
router.post('/',               writeLimiter, upload.single('foto'), ctrl.create);
router.put ('/:id',            writeLimiter, ctrl.update);
router.put ('/:id/aparecio',   writeLimiter, ctrl.markFound);
router.put ('/:id/fallecio',   writeLimiter, ctrl.markDeceased);

module.exports = router;
