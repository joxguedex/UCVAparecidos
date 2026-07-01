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
  'ubicacion(latitud, longitud)',
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
    latitud:                 raw.ubicacion?.[0]?.latitud  != null ? parseFloat(raw.ubicacion[0].latitud)  : null,
    longitud:                raw.ubicacion?.[0]?.longitud != null ? parseFloat(raw.ubicacion[0].longitud) : null,
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

// ── Supabase Storage helpers ──────────────────────────────────────

async function withSignedUrls(students) {
  if (!students.length) return students;
  const paths = students.map(s => `fotos/${s.id}/avatar.webp`);
  const { data: urls } = await supabase.storage.from('estudiantes').createSignedUrls(paths, 3600);
  const urlMap = {};
  if (urls) for (const item of urls) {
    if (item.signedUrl) urlMap[item.path] = item.signedUrl;
  }
  return students.map(s => ({
    ...s,
    foto_signed_url: urlMap[`fotos/${s.id}/avatar.webp`] ?? null,
  }));
}

async function addSignedUrl(student) {
  if (!student) return null;
  const { data } = await supabase.storage
    .from('estudiantes')
    .createSignedUrl(`fotos/${student.id}/avatar.webp`, 3600);
  return { ...student, foto_signed_url: data?.signedUrl ?? null };
}

// ─────────────────────────────────────────────────────────────────

const Student = {

  async findAll() {
    const { data, error } = await supabase
      .from('estudiantes')
      .select(SELECT_FULL)
      .order('fecha_registro', { ascending: false });

    if (error) throw new Error(error.message);
    return withSignedUrls((data ?? []).map(normalize));
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
    return addSignedUrl(data ? normalize(data) : null);
  },

  async uploadFoto(id, buffer, mimetype) {
    const { error } = await supabase.storage
      .from('estudiantes')
      .upload(`fotos/${id}/avatar.webp`, buffer, { contentType: mimetype, upsert: true });
    if (error) console.error('[Student.uploadFoto]', error.message);
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

    const latitud  = fields.latitud  != null && fields.latitud  !== '' ? parseFloat(fields.latitud)  : null;
    const longitud = fields.longitud != null && fields.longitud !== '' ? parseFloat(fields.longitud) : null;

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

    // Guardar coordenadas en tabla ubicacion
    if (latitud != null && longitud != null) {
      const { error: ubErr } = await supabase
        .from('ubicacion')
        .insert({ estudiante: data.id, latitud, longitud });
      if (ubErr) console.error('[Student.create] ubicacion insert error:', ubErr.message);
    }

    // Subir foto si se proporcionó
    if (fields._file) {
      await this.uploadFoto(data.id, fields._file.buffer, fields._file.mimetype);
    }

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

  async update(id, fields) {
    const {
      nombre, cedula, semestre, descripcion,
      ultima_ubicacion, latitud, longitud, estado, tipo_confirmacion, detalles_confirmacion,
      nombre_contacto, telefono_contacto, relacion_contacto
    } = fields;

    const ids     = await estadoIds();
    const payload = {};

    if (nombre !== undefined) payload.nombre = nombre || null;
    if (cedula !== undefined) payload.cedula = (cedula != null && cedula !== '') ? Number(cedula) : null;
    if (semestre !== undefined) payload.semestre = semestre || null;
    if (descripcion !== undefined) payload.descripcion = descripcion || null;

    if (ultima_ubicacion !== undefined) payload.ultima_ubicacion = ultima_ubicacion || null;

    if (estado && ids[estado]) {
      payload.estado = ids[estado];
      if (estado === 'aparecido' || estado === 'fallecido') {
        payload.fecha_aparecio        = new Date().toISOString();
        payload.tipo_confirmacion     = tipo_confirmacion     || null;
        payload.detalles_confirmacion = detalles_confirmacion || null;
      } else if (estado === 'desaparecido') {
        payload.fecha_aparecio        = null;
        payload.tipo_confirmacion     = null;
        payload.detalles_confirmacion = null;
      }
    }

    if (Object.keys(payload).length) {
      const { error } = await supabase.from('estudiantes').update(payload).eq('id', id);
      if (error) throw new Error(error.message);
    }

    const lat = latitud  != null && latitud  !== '' ? parseFloat(latitud)  : null;
    const lng = longitud != null && longitud !== '' ? parseFloat(longitud) : null;
    if (lat != null && lng != null) {
      await supabase.from('ubicacion').delete().eq('estudiante', id);
      const { error: ubErr } = await supabase.from('ubicacion')
        .insert({ estudiante: id, latitud: lat, longitud: lng });
      if (ubErr) console.error('[Student.update] ubicacion:', ubErr.message);
    }

    // Actualizar contacto
    if (nombre_contacto !== undefined || telefono_contacto !== undefined || relacion_contacto !== undefined) {
      const { data: contactRow } = await supabase
        .from('contacto')
        .select('id')
        .eq('estudiante', id)
        .maybeSingle();

      if (contactRow) {
        const cPayload = {};
        if (nombre_contacto !== undefined) cPayload.nombre = nombre_contacto || null;
        if (telefono_contacto !== undefined) cPayload.telefonos = telefono_contacto || null;
        if (relacion_contacto !== undefined) cPayload.relacion = relacion_contacto || null;

        if (Object.keys(cPayload).length) {
          await supabase.from('contacto').update(cPayload).eq('id', contactRow.id);
        }
      } else {
        if (nombre_contacto || telefono_contacto || relacion_contacto) {
          await supabase.from('contacto').insert({
            nombre:     nombre_contacto   || null,
            telefonos:  telefono_contacto || null,
            relacion:   relacion_contacto || null,
            estudiante: id,
          });
        }
      }
    }

    return this.findById(id);
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

  async delete(id) {
    // 1. Eliminar contacto
    const { error: cErr } = await supabase.from('contacto').delete().eq('estudiante', id);
    if (cErr) throw new Error(cErr.message);

    // 2. Eliminar ubicacion
    const { error: uErr } = await supabase.from('ubicacion').delete().eq('estudiante', id);
    if (uErr) throw new Error(uErr.message);

    // 3. Eliminar foto de storage
    const { error: sErr } = await supabase.storage.from('estudiantes').remove([`fotos/${id}/avatar.webp`]);
    if (sErr) console.error('[Student.delete] storage remove error:', sErr.message);

    // 4. Eliminar estudiante
    const { error: eErr } = await supabase.from('estudiantes').delete().eq('id', id);
    if (eErr) throw new Error(eErr.message);

    return true;
  },
};

module.exports = Student;

