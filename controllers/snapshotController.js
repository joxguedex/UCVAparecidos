'use strict';
const Snapshot = require('../models/Snapshot');

exports.getAll = async (req, res) => {
  try {
    await Snapshot.autoCapture();
    const snapshots = await Snapshot.findAll();
    res.json(snapshots);
  } catch (err) {
    console.error('[snapshotController.getAll]', err.message);
    res.status(500).json({ error: 'Error interno del servidor. Intenta de nuevo.' });
  }
};

exports.create = async (req, res) => {
  try {
    const snap = await Snapshot.create();
    res.status(201).json(snap);
  } catch (err) {
    console.error('[snapshotController.create]', err.message);
    res.status(500).json({ error: 'Error interno del servidor. Intenta de nuevo.' });
  }
};
