'use strict';
/**
 * controllers/statsController.js
 * Estadísticas globales y por facultad.
 * Agrega en JS para evitar depender de funciones SQL personalizadas.
 */
const { supabase } = require('../config/database');

exports.getStats = async (_req, res) => {
  try {
    const { data: all, error } = await supabase
      .from('estudiantes')
      .select('facultad, estado');

    if (error) throw new Error(error.message);

    const total        = all.length;
    const desaparecidos = all.filter(s => s.estado === 'desaparecido').length;
    const aparecidos    = all.filter(s => s.estado === 'aparecido').length;

    // Agrupar por facultad
    const facMap = {};
    for (const s of all) {
      if (!facMap[s.facultad]) {
        facMap[s.facultad] = { facultad: s.facultad, desaparecidos: 0, aparecidos: 0, total: 0 };
      }
      facMap[s.facultad].total++;
      if (s.estado === 'desaparecido') facMap[s.facultad].desaparecidos++;
      else                             facMap[s.facultad].aparecidos++;
    }

    const porFacultad = Object.values(facMap)
      .sort((a, b) => b.desaparecidos - a.desaparecidos);

    res.json({ total, desaparecidos, aparecidos, porFacultad });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
