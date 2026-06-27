'use strict';
/**
 * controllers/studentController.js
 * Maneja las peticiones HTTP de estudiantes.
 * Valida la entrada, delega al modelo y responde con JSON.
 */
const Student = require('../models/Student');

exports.getAll = async (req, res) => {
  try {
    res.json(await Student.findAll(req.query));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const { nombre, facultad, carrera } = req.body;

  if (!nombre?.trim())   return res.status(400).json({ error: 'El nombre es requerido' });
  if (!facultad?.trim()) return res.status(400).json({ error: 'La facultad es requerida' });
  if (!carrera?.trim())  return res.status(400).json({ error: 'La carrera es requerida' });

  try {
    res.status(201).json(await Student.create(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markFound = async (req, res) => {
  const { tipo_confirmacion } = req.body;

  if (!tipo_confirmacion?.trim()) {
    return res.status(400).json({ error: 'El tipo de confirmación es requerido' });
  }

  try {
    const existing = await Student.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Estudiante no encontrado' });
    if (existing.estado !== 'desaparecido') {
      return res.status(409).json({ error: 'Solo se pueden marcar como aparecidos estudiantes desaparecidos' });
    }

    res.json(await Student.markFound(req.params.id, req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markDeceased = async (req, res) => {
  const { tipo_confirmacion_deceso } = req.body;

  if (!tipo_confirmacion_deceso?.trim()) {
    return res.status(400).json({ error: 'El tipo de confirmación es requerido' });
  }

  try {
    const existing = await Student.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Estudiante no encontrado' });
    if (existing.estado !== 'desaparecido') {
      return res.status(409).json({ error: 'Solo se pueden registrar como fallecidos estudiantes desaparecidos' });
    }

    res.json(await Student.markDeceased(req.params.id, req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
