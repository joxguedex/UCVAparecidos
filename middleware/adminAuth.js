'use strict';

module.exports = (req, res, next) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return next(); // sin token en .env → solo en desarrollo local

  const provided = req.headers['x-admin-token'];
  if (!provided || provided !== token) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  next();
};
