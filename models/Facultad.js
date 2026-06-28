'use strict';
const { supabase } = require('../config/database');

const Facultad = {
  // Retorna { [facultad]: [carrera, carrera, ...] } leyendo de la BD
  async getAll() {
    const { data, error } = await supabase
      .from('carrera')
      .select('nombre, facultad(nombre)')
      .order('nombre');

    if (error) throw new Error(error.message);

    const result = {};
    for (const c of data ?? []) {
      const facNombre = c.facultad?.nombre;
      if (!facNombre) continue;
      if (!result[facNombre]) result[facNombre] = [];
      result[facNombre].push(c.nombre);
    }
    return result;
  },
};

module.exports = Facultad;
