'use strict';
const { Router } = require('express');
const multer  = require('multer');
const { importExcel, downloadTemplate } = require('../controllers/importController');
const { uploadLimiter } = require('../middleware/limiters');

const EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // algunos navegadores envían este tipo genérico
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okExt  = /\.(xlsx|xls)$/i.test(file.originalname);
    const okMime = EXCEL_MIMES.has(file.mimetype);
    const ok = okExt && okMime;
    cb(ok ? null : new Error('Solo se aceptan archivos .xlsx o .xls'), ok);
  },
});

const router = Router();
router.post('/',         uploadLimiter, upload.single('archivo'), importExcel);
router.get('/plantilla', downloadTemplate);
module.exports = router;
