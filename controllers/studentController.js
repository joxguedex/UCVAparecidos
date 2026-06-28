'use strict';
const Student             = require('../models/Student');
const { supabase }        = require('../config/database');

const VALID_CONF = new Set([
  'contacto_directo', 'llamada_telefonica', 'mensaje_texto',
  'video', 'presencia_fisica', 'tercero_confiable', 'redes_sociales', 'otro',
]);

const VALID_CONF_DECESO = new Set([
  'hospital', 'familiar', 'rescate', 'documentacion_oficial', 'otro',
]);

function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseCedula(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function internalError(res, err, ctx) {
  console.error(`[${ctx}]`, err.message);
  res.status(500).json({ error: 'Error interno del servidor. Intenta de nuevo.' });
}

exports.getAll = async (_req, res) => {
  try {
    res.json(await Student.findAll());
  } catch (err) {
    internalError(res, err, 'getAll');
  }
};

exports.getOne = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID no válido' });
  try {
    const student = await Student.findById(id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });
    res.json(student);
  } catch (err) {
    internalError(res, err, 'getOne');
  }
};

exports.create = async (req, res) => {
  const { nombre, carrera, forzar } = req.body;
  const cedula = parseCedula(req.body.cedula);

  if (!nombre?.trim())  return res.status(400).json({ error: 'El nombre es requerido' });
  if (!carrera?.trim()) return res.status(400).json({ error: 'La carrera es requerida' });

  try {
    if (cedula !== null) {
      const existente = await Student.findByCedula(cedula);
      if (existente) {
        return res.status(409).json({
          error: `Ya existe un estudiante con la cédula ${cedula}`,
          tipo: 'cedula_duplicada',
          existente,
        });
      }
    }

    if (forzar !== 'true' && forzar !== true) {
      const existentes = await Student.findByNombreExacto(nombre.trim());
      if (existentes.length) {
        return res.status(409).json({
          error: `Ya existe un estudiante con el nombre "${nombre.trim()}"`,
          tipo: 'nombre_duplicado',
          existentes,
        });
      }
    }

    res.status(201).json(await Student.create({ ...req.body, cedula, _file: req.file || null }));
  } catch (err) {
    internalError(res, err, 'create');
  }
};

exports.getFoto = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).end();
  try {
    const { data, error } = await supabase.storage
      .from('estudiantes')
      .createSignedUrl(`fotos/${id}/avatar.webp`, 3600);
    if (error || !data?.signedUrl) return res.status(404).end();
    res.redirect(302, data.signedUrl);
  } catch {
    res.status(500).end();
  }
};

exports.update = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID no válido' });
  try {
    const student = await Student.findById(id);
    if (!student) return res.status(404).json({ error: 'Estudiante no encontrado' });
    res.json(await Student.update(id, req.body));
  } catch (err) {
    internalError(res, err, 'update');
  }
};

exports.markFound = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID no válido' });

  const { tipo_confirmacion } = req.body;
  if (!tipo_confirmacion?.trim())   return res.status(400).json({ error: 'El tipo de confirmación es requerido' });
  if (!VALID_CONF.has(tipo_confirmacion)) return res.status(400).json({ error: 'Tipo de confirmación no reconocido' });

  try {
    const existing = await Student.findById(id);
    if (!existing) return res.status(404).json({ error: 'Estudiante no encontrado' });
    if (existing.estado !== 'desaparecido') {
      return res.status(409).json({ error: 'Solo se pueden marcar como aparecidos estudiantes desaparecidos' });
    }
    res.json(await Student.markFound(id, req.body));
  } catch (err) {
    internalError(res, err, 'markFound');
  }
};

exports.markDeceased = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID no válido' });

  const { tipo_confirmacion_deceso } = req.body;
  if (!tipo_confirmacion_deceso?.trim())        return res.status(400).json({ error: 'El tipo de confirmación es requerido' });
  if (!VALID_CONF_DECESO.has(tipo_confirmacion_deceso)) return res.status(400).json({ error: 'Tipo de confirmación de deceso no reconocido' });

  try {
    const existing = await Student.findById(id);
    if (!existing) return res.status(404).json({ error: 'Estudiante no encontrado' });
    if (existing.estado !== 'desaparecido') {
      return res.status(409).json({ error: 'Solo se pueden registrar como fallecidos estudiantes desaparecidos' });
    }
    res.json(await Student.markDeceased(id, req.body));
  } catch (err) {
    internalError(res, err, 'markDeceased');
  }
};
