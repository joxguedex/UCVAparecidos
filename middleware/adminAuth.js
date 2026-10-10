'use strict';

module.exports = (req, res, next) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'ADMIN_TOKEN no configurado en las variables de entorno del servidor.' });
  }

  const provided = req.headers['x-admin-token'];
  if (!provided || provided !== token) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  next();
};
