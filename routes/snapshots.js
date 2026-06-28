'use strict';
const { Router } = require('express');
const ctrl = require('../controllers/snapshotController');

const router = Router();

router.get  ('/', ctrl.getAll);
router.post ('/tomar', ctrl.create);

module.exports = router;
