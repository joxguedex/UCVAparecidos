'use strict';
const { Router } = require('express');
const multer = require('multer');
const { importExcel, downloadTemplate } = require('../controllers/importController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname);
    cb(ok ? null : new Error('Solo se aceptan archivos .xlsx o .xls'), ok);
  },
});

const router = Router();
router.post('/',          upload.single('archivo'), importExcel);
router.get('/plantilla',  downloadTemplate);
module.exports = router;
