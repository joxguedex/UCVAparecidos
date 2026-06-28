'use strict';
const Snapshot = require('../models/Snapshot');

exports.getAll = async (req, res) => {
  try {
    // Auto-captura si han pasado 12 h desde el último snapshot
    await Snapshot.autoCapture();
    const snapshots = await Snapshot.findAll();
    res.json(snapshots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const snap = await Snapshot.create();
    res.status(201).json(snap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
