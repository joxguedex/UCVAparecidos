'use strict';
/**
 * models/Student.js
 * Toda la lógica de acceso a datos de estudiantes via Supabase.
 * Los controladores nunca tocan la BD directamente — pasan por aquí.
 */
const { supabase } = require('../config/database');

const Student = {

  /**
   * Retorna lista de estudiantes con filtros opcionales.
   * @param {{ facultad?, carrera?, estado?, q? }} filters
   */
  async findAll({ facultad, carrera, estado, q } = {}) {
    let query = supabase.from('estudiantes').select('*');

    if (facultad) query = query.eq('facultad', facultad);
    if (carrera)  query = query.eq('carrera',  carrera);
    if (estado)   query = query.eq('estado',   estado);
    if (q)        query = query.or(`nombre.ilike.%${q}%,cedula.ilike.%${q}%`);

    const { data, error } = await query
      .order('estado',          { ascending: true  })
      .order('fecha_registro',  { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  /** Retorna un estudiante por ID, o null si no existe. */
  async findById(id) {
    const { data, error } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('id', id)
      .maybeSingle(); // null si no existe, no lanza error

    if (error) throw new Error(error.message);
    return data;
  },

  /** Registra un nuevo estudiante desaparecido. */
  async create(fields) {
    const {
      nombre, cedula, facultad, carrera, semestre,
      telefono_contacto, nombre_contacto, relacion_contacto,
      ultima_ubicacion, descripcion, registrado_por
    } = fields;

    const { data, error } = await supabase
      .from('estudiantes')
      .insert({
        nombre,
        cedula:             cedula            || null,
        facultad,
        carrera,
        semestre:           semestre          || null,
        telefono_contacto:  telefono_contacto || null,
        nombre_contacto:    nombre_contacto   || null,
        relacion_contacto:  relacion_contacto || null,
        ultima_ubicacion:   ultima_ubicacion  || null,
        descripcion:        descripcion       || null,
        registrado_por:     registrado_por    || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /** Marca un estudiante como aparecido con la info de confirmación. */
  async markFound(id, fields) {
    const {
      tipo_confirmacion,
      detalles_confirmacion,
      reportado_aparicion_por,
      contacto_reportador
    } = fields;

    const { data, error } = await supabase
      .from('estudiantes')
      .update({
        estado:                  'aparecido',
        fecha_aparecio:          new Date().toISOString(),
        tipo_confirmacion,
        detalles_confirmacion:   detalles_confirmacion   || null,
        reportado_aparicion_por: reportado_aparicion_por || null,
        contacto_reportador:     contacto_reportador     || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

};

module.exports = Student;
