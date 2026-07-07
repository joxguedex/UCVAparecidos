'use strict';
const { Router } = require('express');
const multer  = require('multer');
const { analizarExcel, confirmarImportacion, downloadTemplate } = require('../controllers/importController');
const { writeLimiter } = require('../middleware/limiters');
const adminAuth   = require('../middleware/adminAuth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Validamos solo por extensión: los navegadores y sistemas operativos
    // envían mimetypes inconsistentes (o vacíos) para archivos Excel, sobre
    // todo si el archivo viene de correo, WhatsApp o Drive. El contenido real
    // se valida después con xlsx.read() en el controlador.
    const okExt = /\.(xlsx|xls)$/i.test(file.originalname);
    cb(okExt ? null : new Error('Solo se aceptan archivos .xlsx o .xls'), okExt);
  },
});

// Envuelve multer para devolver errores como JSON (y no una página HTML 500),
// de modo que el cliente pueda mostrar un mensaje claro.
function uploadArchivo(req, res, next) {
  upload.single('archivo')(req, res, (err) => {
    if (!err) return next();
    let msg = err.message || 'No se pudo procesar el archivo.';
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      msg = 'El archivo supera el límite de 10 MB.';
    }
    res.status(400).json({ error: msg });
  });
}

const router = Router();
router.post('/analizar',  adminAuth, writeLimiter, uploadArchivo, analizarExcel);
router.post('/confirmar', adminAuth, writeLimiter, confirmarImportacion);
router.get('/plantilla',  downloadTemplate);
module.exports = router;
