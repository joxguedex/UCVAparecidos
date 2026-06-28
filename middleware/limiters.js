'use strict';
const rateLimit = require('express-rate-limit');

function make(max, windowMs, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });
}

// Lectura general: 200 req / 15 min por IP
exports.apiLimiter = make(
  200, 15 * 60 * 1000,
  'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.'
);

// Escrituras (registro, confirmación): 30 req / 15 min por IP
exports.writeLimiter = make(
  30, 15 * 60 * 1000,
  'Demasiadas solicitudes de escritura. Intenta de nuevo en 15 minutos.'
);
