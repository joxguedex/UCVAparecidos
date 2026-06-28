'use strict';
const { supabase } = require('../config/database');

const INTERVAL_HOURS = 12;

const Snapshot = {

  async findAll() {
    const { data, error } = await supabase
      .from('snapshots')
      .select('*')
      .order('tomado_en', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  },

  async latest() {
    const { data, error } = await supabase
      .from('snapshots')
      .select('*')
      .order('tomado_en', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async create() {
    const { data: estudiantes, error: eErr } = await supabase
      .from('estudiantes')
      .select('estado(nombre)');
    if (eErr) throw new Error(eErr.message);

    const desaparecidos = estudiantes.filter(s => s.estado?.nombre === 'desaparecido').length;
    const aparecidos    = estudiantes.filter(s => s.estado?.nombre === 'aparecido').length;
    const fallecidos    = estudiantes.filter(s => s.estado?.nombre === 'fallecido').length;
    const total         = estudiantes.length;

    const { data, error } = await supabase
      .from('snapshots')
      .insert({ desaparecidos, aparecidos, fallecidos, total })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async autoCapture() {
    const last = await this.latest();
    if (last) {
      const diffHours = (Date.now() - new Date(last.tomado_en).getTime()) / 36e5;
      if (diffHours < INTERVAL_HOURS) return null;
    }
    return this.create();
  },

};

module.exports = Snapshot;
