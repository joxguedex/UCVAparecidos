'use strict';
const { supabase } = require('../config/database');

// Columnas para selects completos — resuelve FKs con embedded joins
const SELECT_FULL = [
  'id', 'nombre', 'cedula', 'semestre', 'ultima_ubicacion', 'descripcion',
  'fecha_registro', 'registrado_por', 'fecha_aparecio',
  'tipo_confirmacion', 'detalles_confirmacion',
  'reportado_aparicion_por', 'contacto_reportador', 'tipo',
  'estado(nombre)',
  'carrera(nombre, facultad(nombre))',
  'contacto(nombre, telefonos, relacion)',
].join(', ');

// Select liviano para chequeo de duplicados
const SELECT_BRIEF = [
  'id', 'nombre', 'cedula',
  'estado(nombre)',
  'carrera(nombre, facultad(nombre))',
].join(', ');

// Cache en memoria de IDs de estado: { desaparecido: 1, aparecido: 2, fallecido: 3 }
let _estadoCache = null;
async function estadoIds() {
  if (_estadoCache) return _estadoCache;
  const { data, error } = await supabase.from('estado').select('id, nombre');
  if (error) throw new Error(error.message);
  _estadoCache = {};
  for (const e of data) _estadoCache[e.nombre] = e.id;
  return _estadoCache;
}

// Transforma un raw Supabase (con JOINs anidados) al shape plano que espera el frontend
function normalize(raw) {
  const c = Array.isArray(raw.contacto) ? (raw.contacto[0] ?? {}) : {};
  return {
    id:                      raw.id,
    nombre:                  raw.nombre,
    cedula:                  raw.cedula,
    semestre:                raw.semestre,
    ultima_ubicacion:        raw.ultima_ubicacion,
    descripcion:             raw.descripcion,
    fecha_registro:          raw.fecha_registro,
    registrado_por:          raw.registrado_por,
    fecha_aparecio:          raw.fecha_aparecio,
    tipo_confirmacion:       raw.tipo_confirmacion,
    detalles_confirmacion:   raw.detalles_confirmacion,
    reportado_aparicion_por: raw.reportado_aparicion_por,
    contacto_reportador:     raw.contacto_reportador,
    tipo:                    raw.tipo ?? 'Pregrado',
    // FKs resueltos como texto:
    estado:                  raw.estado?.nombre    ?? 'desaparecido',
    carrera:                 raw.carrera?.nombre   ?? '',
    facultad:                raw.carrera?.facultad?.nombre ?? '',
    // Contacto (primer registro de la tabla contacto para este estudiante):
    nombre_contacto:         c.nombre    ?? null,
    relacion_contacto:       c.relacion  ?? null,
    telefono_contacto:       c.telefonos ?? null,
  };
}

function normalizeBrief(raw) {
  return {
    id:       raw.id,
    nombre:   raw.nombre,
    cedula:   raw.cedula,
    estado:   raw.estado?.nombre            ?? 'desaparecido',
    carrera:  raw.carrera?.nombre           ?? '',
    facultad: raw.carrera?.facultad?.nombre ?? '',
  };
}

const Student = {

  async findAll() {
    const { data, error } = await supabase
      .from('estudiantes')
      .select(SELECT_FULL)
      .order('fecha_registro', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(normalize);
  },

  async findByCedula(cedula) {
    const { data, error } = await supabase
      .from('estudiantes')
      .select(SELECT_BRIEF)
      .eq('cedula', cedula)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? normalizeBrief(data) : null;
  },

  async findByNombreExacto(nombre) {
    const { data, error } = await supabase
      .from('estudiantes')
      .select(SELECT_BRIEF)
      .ilike('nombre', nombre);
    if (error) throw new Error(error.message);
    return (data ?? []).map(normalizeBrief);
  },

  async findById(id) {
    const { data, error } = await supabase
      .from('estudiantes')
      .select(SELECT_FULL)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? normalize(data) : null;
  },

  async create(fields) {
    const {
      nombre, carrera: carreraNombre, cedula,
      semestre, ultima_ubicacion, descripcion, registrado_por,
      nombre_contacto, relacion_contacto, telefono_contacto,
    } = fields;

    // Resolver carrera FK por nombre
    const { data: carreraRow, error: carreraErr } = await supabase
      .from('carrera')
      .select('id')
      .eq('nombre', carreraNombre)
      .maybeSingle();
    if (carreraErr) throw new Error(carreraErr.message);
    if (!carreraRow) throw new Error(`Carrera no encontrada: ${carreraNombre}`);

    // Resolver estado FK para 'desaparecido'
    const ids = await estadoIds();
    const estadoId = ids['desaparecido'];
    if (!estadoId) throw new Error('Estado "desaparecido" no encontrado en la BD');

    const { data, error } = await supabase
      .from('estudiantes')
      .insert({
        nombre,
        cedula:           cedula != null ? Number(cedula) : null,
        carrera:          carreraRow.id,
        estado:           estadoId,
        semestre:         semestre         || null,
        ultima_ubicacion: ultima_ubicacion || null,
        descripcion:      descripcion      || null,
        registrado_por:   registrado_por   || null,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    // Insertar registro de contacto si se proporcionó información
    if (nombre_contacto || telefono_contacto) {
      const { error: cErr } = await supabase.from('contacto').insert({
        nombre:     nombre_contacto   || null,
        telefonos:  telefono_contacto || null,
        relacion:   relacion_contacto || null,
        estudiante: data.id,
      });
      if (cErr) console.error('[Student.create] contacto insert error:', cErr.message);
    }

    return this.findById(data.id);
  },

  async markFound(id, fields) {
    const {
      tipo_confirmacion,
      detalles_confirmacion,
      reportado_aparicion_por,
      contacto_reportador,
    } = fields;

    const ids = await estadoIds();
    const { error } = await supabase
      .from('estudiantes')
      .update({
        estado:                  ids['aparecido'],
        fecha_aparecio:          new Date().toISOString(),
        tipo_confirmacion,
        detalles_confirmacion:   detalles_confirmacion   || null,
        reportado_aparicion_por: reportado_aparicion_por || null,
        contacto_reportador:     contacto_reportador     || null,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return this.findById(id);
  },

  async markDeceased(id, fields) {
    const {
      tipo_confirmacion_deceso,
      detalles_confirmacion,
      reportado_aparicion_por,
      contacto_reportador,
    } = fields;

    const ids = await estadoIds();
    const { error } = await supabase
      .from('estudiantes')
      .update({
        estado:                  ids['fallecido'],
        fecha_aparecio:          new Date().toISOString(),
        tipo_confirmacion:       tipo_confirmacion_deceso || 'otro',
        detalles_confirmacion:   detalles_confirmacion   || null,
        reportado_aparicion_por: reportado_aparicion_por || null,
        contacto_reportador:     contacto_reportador     || null,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return this.findById(id);
  },
};

module.exports = Student;
