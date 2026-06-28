'use strict';
const { supabase } = require('../config/database');

exports.getStats = async (_req, res) => {
  try {
    const { data: all, error } = await supabase
      .from('estudiantes')
      .select('estado(nombre), carrera(nombre, facultad(nombre))');

    if (error) throw new Error(error.message);

    const total         = all.length;
    const desaparecidos = all.filter(s => s.estado?.nombre === 'desaparecido').length;
    const aparecidos    = all.filter(s => s.estado?.nombre === 'aparecido').length;
    const fallecidos    = all.filter(s => s.estado?.nombre === 'fallecido').length;

    const facMap = {};
    for (const s of all) {
      const facNombre    = s.carrera?.facultad?.nombre ?? 'Sin facultad';
      const estadoNombre = s.estado?.nombre            ?? 'desaparecido';

      if (!facMap[facNombre]) {
        facMap[facNombre] = { facultad: facNombre, desaparecidos: 0, aparecidos: 0, fallecidos: 0, total: 0 };
      }
      facMap[facNombre].total++;
      if      (estadoNombre === 'desaparecido') facMap[facNombre].desaparecidos++;
      else if (estadoNombre === 'aparecido')    facMap[facNombre].aparecidos++;
      else if (estadoNombre === 'fallecido')    facMap[facNombre].fallecidos++;
    }

    const porFacultad = Object.values(facMap)
      .sort((a, b) => b.desaparecidos - a.desaparecidos);

    res.json({ total, desaparecidos, aparecidos, fallecidos, porFacultad });
  } catch (err) {
    console.error('[statsController]', err.message);
    res.status(500).json({ error: 'Error interno del servidor. Intenta de nuevo.' });
  }
};
