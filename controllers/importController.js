'use strict';
const xlsx = require('xlsx');
const { supabase } = require('../config/database');

function normalizeHeader(h) {
  return String(h)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\s_\-\.\/]+/g, '_')
    .trim();
}

const FIELD_MAP = {
  nombre:                        'nombre',
  nombre_completo:               'nombre',
  estudiante:                    'nombre',
  cedula:                        'cedula',
  ci:                            'cedula',
  c_i:                           'cedula',
  cedula_identidad:              'cedula',
  cedula_de_identidad:           'cedula',
  facultad:                      'facultad',
  carrera:                       'carrera',
  semestre:                      'semestre',
  telefono_contacto:             'telefono_contacto',
  telefono:                      'telefono_contacto',
  tel:                           'telefono_contacto',
  tel_contacto:                  'telefono_contacto',
  contacto:                      'telefono_contacto',
  numero_de_contacto:            'telefono_contacto',
  nombre_contacto:               'nombre_contacto',
  nombre_del_contacto:           'nombre_contacto',
  contacto_nombre:               'nombre_contacto',
  relacion_contacto:             'relacion_contacto',
  relacion:                      'relacion_contacto',
  parentesco:                    'relacion_contacto',
  relacion_con_el_estudiante:    'relacion_contacto',
  ultima_ubicacion:              'ultima_ubicacion',
  ubicacion:                     'ultima_ubicacion',
  ultima_ubicacion_conocida:     'ultima_ubicacion',
  ultima_vez_visto:              'ultima_ubicacion',
  descripcion:                   'descripcion',
  descripcion_adicional:         'descripcion',
  notas:                         'descripcion',
  observaciones:                 'descripcion',
  estado:                        'estado',
  situacion:                     'estado',
  tipo_confirmacion:             'tipo_confirmacion',
  tipo:                          'tipo_confirmacion',
  como_aparecio:                 'tipo_confirmacion',
  detalles_confirmacion:         'detalles_confirmacion',
  detalles:                      'detalles_confirmacion',
  detalles_de_aparicion:         'detalles_confirmacion',
  registrado_por:                'registrado_por',
  quien_registro:                'registrado_por',
  reportado_por:                 'registrado_por',
  reportado_aparicion_por:       'reportado_aparicion_por',
  quien_reporto_aparicion:       'reportado_aparicion_por',
  contacto_reportador:           'contacto_reportador',
};

const VALID_ESTADOS       = new Set(['desaparecido', 'aparecido', 'fallecido']);
const VALID_CONFIRMACIONES = new Set([
  'contacto_directo','llamada_telefonica','mensaje_texto',
  'video','presencia_fisica','tercero_confiable','redes_sociales','otro',
]);

exports.importExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });

  let workbook;
  try {
    workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  } catch {
    return res.status(400).json({ error: 'No se pudo leer el archivo. Verifica que sea un .xlsx o .xls válido.' });
  }

  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  if (!rows.length) return res.status(400).json({ error: 'El archivo está vacío o no tiene datos en la primera hoja.' });

  // Build header → DB field map from actual column names
  const headerMap = {};
  for (const key of Object.keys(rows[0])) {
    const norm = normalizeHeader(key);
    if (FIELD_MAP[norm]) headerMap[key] = FIELD_MAP[norm];
  }

  const records = [];
  const errors  = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const record = {};

    for (const [rawKey, dbField] of Object.entries(headerMap)) {
      const val = String(row[rawKey] ?? '').trim();
      if (val) record[dbField] = val;
    }

    if (!record.nombre)   { errors.push({ fila: i + 2, motivo: 'Falta el nombre' }); continue; }
    if (!record.facultad) { errors.push({ fila: i + 2, motivo: `Falta la facultad — ${record.nombre}` }); continue; }
    if (!record.carrera)  { errors.push({ fila: i + 2, motivo: `Falta la carrera — ${record.nombre}` }); continue; }

    const estadoRaw = (record.estado || '').toLowerCase().trim();
    record.estado = VALID_ESTADOS.has(estadoRaw) ? estadoRaw : 'desaparecido';

    if (record.tipo_confirmacion) {
      const tcRaw = record.tipo_confirmacion.toLowerCase().replace(/\s+/g, '_');
      record.tipo_confirmacion = VALID_CONFIRMACIONES.has(tcRaw) ? tcRaw : 'otro';
    }

    if (record.estado === 'aparecido' || record.estado === 'fallecido') {
      record.fecha_aparecio = new Date().toISOString();
    }

    records.push(record);
  }

  if (!records.length) {
    return res.status(400).json({
      error: 'Ninguna fila tiene los campos mínimos requeridos (nombre, facultad, carrera).',
      errores: errors,
    });
  }

  const BATCH = 500;
  let insertados = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const { error } = await supabase.from('estudiantes').insert(records.slice(i, i + BATCH));
    if (error) {
      console.error('[importController]', error.message);
      return res.status(500).json({ error: 'Error al guardar los registros. Intenta de nuevo.' });
    }
    insertados += Math.min(BATCH, records.length - i);
  }

  res.json({ importados: insertados, omitidos: errors.length, errores: errors.slice(0, 20) });
};

exports.downloadTemplate = (_req, res) => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([
    [
      'nombre', 'cedula', 'facultad', 'carrera', 'semestre',
      'telefono_contacto', 'nombre_contacto', 'relacion_contacto',
      'ultima_ubicacion', 'descripcion', 'estado',
      'tipo_confirmacion', 'detalles_confirmacion', 'registrado_por',
    ],
    [
      'María González', 'V-24567890', 'Ciencias', 'Computación', '6to semestre',
      '0412-1234567', 'Carlos González', 'Padre',
      'Edificio de Ciencias, Ciudad Universitaria',
      'Última vez vista el día del temblor', 'desaparecido',
      '', '', 'Carlos González',
    ],
    [
      'Valentina Díaz', 'V-26234567', 'Medicina', 'Medicina', '4to semestre',
      '0416-5554321', 'Luis Díaz', 'Hermano',
      'Hospital Universitario de Caracas',
      'Estaba en prácticas clínicas', 'aparecido',
      'llamada_telefonica', 'Me llamó desde el celular de una amiga. Está bien.', 'Luis Díaz',
    ],
  ]);
  xlsx.utils.book_append_sheet(wb, ws, 'Estudiantes');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_ucv_aparecidos.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};
