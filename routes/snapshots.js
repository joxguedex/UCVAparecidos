'use strict';
const { Router }  = require('express');
const ctrl        = require('../controllers/snapshotController');
const adminAuth   = require('../middleware/adminAuth');

const router = Router();

router.get  ('/',       ctrl.getAll);
router.post ('/tomar',  adminAuth, ctrl.create);

module.exports = router;
