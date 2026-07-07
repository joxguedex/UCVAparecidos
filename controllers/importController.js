'use strict';
const xlsx = require('xlsx');
const { supabase, supabaseAdmin } = require('../config/database');

// Robust normalization of headers to snake_case
function normalizeHeader(h) {
  return String(h)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '_') // replace non-alphanumeric with underscore
    .replace(/_+/g, '_') // compress multiple underscores
    .replace(/^_+|_+$/g, '') // trim leading/trailing underscores
    .trim();
}

const FIELD_MAP = {
  // Nombres
  nombre:                        'nombre',
  nombre_completo:               'nombre',
  estudiante:                    'nombre',
  nombres:                       'nombre',
  nombre_s:                      'nombre_nombres',
  apellido_s:                    'nombre_apellidos',

  // Cédula
  cedula:                        'cedula',
  ci:                            'cedula',
  c_i:                           'cedula',
  cedula_identidad:              'cedula',
  cedula_de_identidad:           'cedula',

  // Facultad
  facultad:                      'facultad',

  // Carrera / Escuela
  carrera:                       'carrera',
  escuela:                       'carrera',

  // Semestre
  semestre:                      'semestre',
  semestre_ano:                  'semestre',

  // Contacto Teléfono
  telefono_contacto:             'telefono_contacto',
  telefono:                      'telefono_contacto',
  tel:                           'telefono_contacto',
  tel_contacto:                  'telefono_contacto',
  contacto:                      'telefono_contacto',
  numero_de_contacto:            'telefono_contacto',

  // Contacto Nombre
  nombre_contacto:               'nombre_contacto',
  nombre_del_contacto:           'nombre_contacto',
  contacto_nombre:               'nombre_contacto',
  familiar_conocido_a_contactar: 'nombre_contacto',

  // Contacto Relación
  relacion_contacto:             'relacion_contacto',
  relacion:                      'relacion_contacto',
  parentesco:                    'relacion_contacto',
  relacion_con_el_estudiante:    'relacion_contacto',

  // Ubicación
  ultima_ubicacion:              'ultima_ubicacion',
  ubicacion:                     'ultima_ubicacion',
  ultima_ubicacion_conocida:     'ultima_ubicacion',
  ultima_vez_visto:              'ultima_ubicacion',
  ultima_localizacion:           'ultima_ubicacion',

  // Descripción / Requerimientos / Notas
  descripcion:                   'descripcion',
  descripcion_adicional:         'descripcion',
  notas:                         'descripcion',
  observaciones:                 'descripcion',
  requerimientos:                'descripcion',

  // Estado
  estado:                        'estado',
  situacion:                     'estado',
  estado_en_el_que_se_encuentra: 'estado',

  // Confirmación
  tipo_confirmacion:             'tipo_confirmacion',
  tipo:                          'tipo_confirmacion',
  como_aparecio:                 'tipo_confirmacion',
  detalles_confirmacion:         'detalles_confirmacion',
  detalles:                      'detalles_confirmacion',
  detalles_de_aparicion:         'detalles_confirmacion',
  donde_o_con_quien_se_encuentra:'detalles_confirmacion',

  // Registro
  registrado_por:                'registrado_por',
  quien_registro:                'registrado_por',
  reportado_por:                 'registrado_por',
  reportado_aparicion_por:       'reportado_aparicion_por',
  quien_reporto_aparicion:       'reportado_aparicion_por',
  contacto_reportador:           'contacto_reportador',
};

// --- PASO 1: ANALIZAR EXCEL ---
exports.analizarExcel = async (req, res) => {
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

  // 1. Cargar catálogos de base de datos
  let carreraMap = {};
  let estadoMap = {};
  let studentLookup = {};

  try {
    const { data: carreras, error: carrErr } = await supabase.from('carrera').select('id, nombre');
    if (carrErr) throw carrErr;
    for (const c of carreras) {
      carreraMap[c.nombre.toLowerCase().trim()] = c.id;
    }

    const { data: estados, error: estErr } = await supabase.from('estado').select('id, nombre');
    if (estErr) throw estErr;
    for (const e of estados) {
      estadoMap[e.nombre.toLowerCase().trim()] = e.id;
    }

    // Traer estudiantes existentes y sus contactos para compararlos (Paginado porque hay más de 1000)
    let existing = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: chunk, error: existErr } = await supabase
        .from('estudiantes')
        .select(`
          id, nombre, cedula, semestre, ultima_ubicacion, descripcion, tipo,
          estado(id, nombre),
          carrera(id, nombre),
          contacto(id, nombre, telefonos, relacion)
        `)
        .range(from, from + pageSize - 1);

      if (existErr) throw existErr;
      
      if (chunk && chunk.length > 0) {
        existing.push(...chunk);
        from += pageSize;
        if (chunk.length < pageSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    for (const st of existing) {
      if (st.cedula) {
        studentLookup['c_' + st.cedula] = st;
      }
      const normName = st.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      studentLookup['n_' + normName] = st;
    }
  } catch (dbErr) {
    console.error('[analizarExcel] DB catalog load error:', dbErr.message);
    return res.status(500).json({ error: 'Error al inicializar la base de datos para el análisis.' });
  }

  const recordsToInsert = [];
  const recordsToUpdate = [];
  const recordsNoChanges = [];
  const errors = [];
  const listadoWarnings = [];
  
  const processedCedulas = new Set();
  const processedNames = new Set();

  // 2. Procesar y analizar cada fila
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Normalizar cabeceras de la fila
    const normRow = {};
    for (const [k, v] of Object.entries(row)) {
      normRow[normalizeHeader(k)] = v;
    }
    
    // Mapear campos
    const mapped = {};
    for (const [normKey, dbField] of Object.entries(FIELD_MAP)) {
      if (normRow[normKey] !== undefined) {
        const val = String(normRow[normKey] ?? '').trim();
        if (val) mapped[dbField] = val;
      }
    }
    
    // Resolver nombre completo
    let nombre = '';
    if (mapped.nombre_nombres) {
      nombre = (mapped.nombre_nombres + ' ' + (mapped.nombre_apellidos || '')).trim();
    } else if (mapped.nombre) {
      nombre = mapped.nombre;
    }
    
    if (!nombre) {
      errors.push({ fila: i + 2, motivo: 'Falta el nombre del estudiante.' });
      continue;
    }
    
    // Resolver cédula
    let cedula = null;
    const rawCedula = normRow['cedula'] || normRow['ci'] || normRow['c_i'] || normRow['cedula_identidad'] || normRow['cedula_de_identidad'];
    if (rawCedula !== undefined && rawCedula !== null && String(rawCedula).trim() !== '') {
      const cleanCed = String(rawCedula).replace(/\D/g, '');
      if (cleanCed) {
        cedula = parseInt(cleanCed, 10);
      }
    }
    
    // Resolver carrera/escuela
    const rawCarrera = normRow['escuela'] || normRow['carrera'];
    if (!rawCarrera) {
      errors.push({ fila: i + 2, motivo: `Falta la carrera o escuela — ${nombre}` });
      continue;
    }
    
    const cleanCarrera = String(rawCarrera).toLowerCase().trim();
    let carreraId = carreraMap[cleanCarrera];
    let warningsList = [];
    
    if (!carreraId) {
      carreraId = 67; // Fallback: no especificada (ID 67)
      warningsList.push(`Carrera "${rawCarrera}" no encontrada. Asignada como "no especificada".`);
    }
    
    // Resolver estado
    let estadoId = estadoMap['desaparecido'];
    const rawEstado = String(normRow['estado_en_el_que_se_encuentra'] || normRow['estado'] || normRow['situacion'] || '').toLowerCase().trim();
    const rawLocalizado = String(normRow['fue_localizado'] || '').toLowerCase().trim();
    
    if (rawEstado === 'fallecido' || rawEstado === 'tapiado') {
      estadoId = estadoMap['fallecido'];
    } else if (rawEstado.startsWith('localizado') || rawEstado.startsWith('herido') || ['si', 'si', 'sí', 'sí'].includes(rawLocalizado)) {
      estadoId = estadoMap['aparecido'];
    } else if (rawEstado === 'desaparecido' || rawLocalizado === 'no') {
      estadoId = estadoMap['desaparecido'];
    }
    
    // Evitar duplicados dentro del mismo Excel
    if (cedula && processedCedulas.has(cedula)) {
      errors.push({ fila: i + 2, motivo: `Fila duplicada en el archivo Excel por cédula ${cedula} — ${nombre}` });
      continue;
    }
    const normName = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (!cedula && processedNames.has(normName)) {
      errors.push({ fila: i + 2, motivo: `Fila duplicada en el archivo Excel por nombre "${nombre}"` });
      continue;
    }
    
    if (cedula) processedCedulas.add(cedula);
    processedNames.add(normName);
    
    // Resolver grupo / tipo
    const rawGrupo = String(normRow['grupo'] || '').trim();
    const tipo = rawGrupo || 'Pregrado';
    
    // Construir objeto de base de datos
    const studentDbObj = {
      nombre,
      cedula,
      semestre: String(normRow['semestre'] || normRow['semestre_ano'] || '').trim() || null,
      ultima_ubicacion: String(normRow['ultima_localizacion'] || normRow['ultima_ubicacion'] || normRow['ubicacion'] || '').trim() || null,
      descripcion: String(normRow['requerimientos'] || normRow['descripcion'] || '').trim() || null,
      carrera: carreraId,
      estado: estadoId,
      tipo,
      registrado_por: String(normRow['registrado_por'] || normRow['quien_registro'] || '').trim() || 'Importador Excel',
      tipo_confirmacion: estadoId === estadoMap['aparecido'] ? 'otro' : null,
      detalles_confirmacion: String(normRow['donde_o_con_quien_se_encuentra'] || normRow['detalles_confirmacion'] || '').trim() || null,
    };
    
    if (estadoId === estadoMap['aparecido'] || estadoId === estadoMap['fallecido']) {
      studentDbObj.fecha_aparecio = new Date().toISOString();
    } else {
      // Limpiar campos de aparición explícitamente si vuelve a desaparecido
      studentDbObj.fecha_aparecio = null;
      studentDbObj.tipo_confirmacion = null;
      studentDbObj.detalles_confirmacion = null;
    }
    
    // Datos de contacto
    const contactObj = {
      nombre: String(normRow['familiar_conocido_a_contactar'] || normRow['nombre_contacto'] || '').trim() || null,
      telefonos: String(normRow['numero_de_contacto'] || normRow['telefono_contacto'] || '').trim() || null,
      relacion: String(normRow['relacion_contacto'] || normRow['parentesco'] || '').trim() || null,
    };
    
    // Determinar si ya existe
    let existingStudent = null;
    if (cedula && studentLookup['c_' + cedula]) {
      existingStudent = studentLookup['c_' + cedula];
    } else if (!cedula && studentLookup['n_' + normName]) {
      existingStudent = studentLookup['n_' + normName];
    }
    
    const excelCarreraName = Object.keys(carreraMap).find(k => carreraMap[k] === carreraId) || '';
    const excelStatusName = Object.keys(estadoMap).find(k => estadoMap[k] === estadoId) || 'desaparecido';
    
    if (existingStudent) {
      // Comparar campos para detectar modificaciones reales
      const dbStContact = Array.isArray(existingStudent.contacto) ? (existingStudent.contacto[0] || {}) : (existingStudent.contacto || {});
      const diffs = [];
      
      // 1. Estado
      const dbStatusName = existingStudent.estado?.nombre || 'desaparecido';
      if (dbStatusName.toLowerCase() !== excelStatusName.toLowerCase()) {
        diffs.push({ campo: 'Estado', anterior: dbStatusName, nuevo: excelStatusName });
      }
      
      // 2. Carrera
      const dbCarreraName = existingStudent.carrera?.nombre || '';
      if (dbCarreraName.toLowerCase().trim() !== excelCarreraName.toLowerCase().trim()) {
        diffs.push({ campo: 'Carrera', anterior: dbCarreraName || '(sin carrera)', nuevo: excelCarreraName });
      }
      
      // 3. Semestre
      const dbSem = (existingStudent.semestre || '').trim();
      const excelSem = (studentDbObj.semestre || '').trim();
      if (dbSem.toLowerCase() !== excelSem.toLowerCase()) {
        diffs.push({ campo: 'Semestre', anterior: dbSem || '(vacío)', nuevo: excelSem || '(vacío)' });
      }
      
      // 4. Ubicación
      const dbLoc = (existingStudent.ultima_ubicacion || '').trim();
      const excelLoc = (studentDbObj.ultima_ubicacion || '').trim();
      if (dbLoc.toLowerCase() !== excelLoc.toLowerCase()) {
        diffs.push({ campo: 'Ubicación', anterior: dbLoc || '(vacío)', nuevo: excelLoc || '(vacío)' });
      }
      
      // 5. Contacto Nombre
      const dbContName = (dbStContact.nombre || '').trim();
      const excelContName = (contactObj.nombre || '').trim();
      if (dbContName.toLowerCase() !== excelContName.toLowerCase()) {
        diffs.push({ campo: 'Contacto (Nombre)', anterior: dbContName || '(vacío)', nuevo: excelContName || '(vacío)' });
      }
      
      // 6. Contacto Teléfono
      const dbContTel = (dbStContact.telefonos || '').trim();
      const excelContTel = (contactObj.telefonos || '').trim();
      if (dbContTel.toLowerCase() !== excelContTel.toLowerCase()) {
        diffs.push({ campo: 'Contacto (Teléfono)', anterior: dbContTel || '(vacío)', nuevo: excelContTel || '(vacío)' });
      }
      
      // 7. Grupo
      const dbTipo = (existingStudent.tipo || '').trim();
      const excelTipo = (studentDbObj.tipo || '').trim();
      if (dbTipo.toLowerCase() !== excelTipo.toLowerCase()) {
        diffs.push({ campo: 'Grupo', anterior: dbTipo || '(vacío)', nuevo: excelTipo || '(vacío)' });
      }
      
      if (diffs.length > 0) {
        recordsToUpdate.push({
          id: existingStudent.id,
          nombre,
          cedula,
          carrera: excelCarreraName,
          estado: excelStatusName,
          diffs,
          student: studentDbObj,
          contacto: contactObj,
        });
      } else {
        recordsNoChanges.push({
          nombre,
          cedula,
          carrera: excelCarreraName,
          estado: excelStatusName,
        });
      }
    } else {
      // Es un estudiante nuevo
      recordsToInsert.push({
        student: studentDbObj,
        contacto: contactObj,
        nombre,
        cedula,
        carrera: excelCarreraName,
        estado: excelStatusName,
        warnings: warningsList,
      });
    }
  }

  res.json({
    insertar: recordsToInsert.map(r => ({
      nombre: r.nombre,
      cedula: r.cedula,
      carrera: r.carrera,
      estado: r.estado,
      warnings: r.warnings
    })),
    actualizar: recordsToUpdate.map(r => ({
      id: r.id,
      nombre: r.nombre,
      cedula: r.cedula,
      carrera: r.carrera,
      estado: r.estado,
      diffs: r.diffs
    })),
    omitidos: errors,
    noCambiosCount: recordsNoChanges.length,
    // El payload completo que el cliente enviará al confirmar
    payload: {
      insertar: recordsToInsert,
      actualizar: recordsToUpdate
    }
  });
};

// --- PASO 2: CONFIRMAR IMPORTACIÓN ---
exports.confirmarImportacion = async (req, res) => {
  const { insertar, actualizar } = req.body;
  
  if (!Array.isArray(insertar) || !Array.isArray(actualizar)) {
    return res.status(400).json({ error: 'Payload de confirmación inválido.' });
  }
  
  let insertados = 0;
  let actualizados = 0;
  let contactosFallidos = 0;

  try {
    // 1. Inserción de nuevos estudiantes
    if (insertar.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < insertar.length; i += BATCH) {
        const chunk = insertar.slice(i, i + BATCH);
        const dbStudents = chunk.map(r => r.student);
        
        const { data: insertedList, error: insertError } = await supabaseAdmin
          .from('estudiantes')
          .insert(dbStudents)
          .select('id, nombre, cedula');
          
        if (insertError) {
          console.error('[confirmarImportacion] error inserting batch:', insertError.message);
          return res.status(500).json({ error: 'Error al guardar nuevos estudiantes: ' + insertError.message });
        }
        
        // Insertar contactos
        const dbContacts = [];
        const list = insertedList || [];
        for (let j = 0; j < chunk.length; j++) {
          const item = chunk[j];
          const contact = item.contacto;
          const insertedStudent = list.find(x => 
            x.nombre === item.student.nombre &&
            (item.student.cedula ? Number(x.cedula) === Number(item.student.cedula) : true)
          );
          
          if (insertedStudent && (contact.nombre || contact.telefonos)) {
            dbContacts.push({
              ...contact,
              estudiante: insertedStudent.id
            });
          }
        }
        
        if (dbContacts.length > 0) {
          const { error: contactError } = await supabaseAdmin
            .from('contacto')
            .insert(dbContacts);
          if (contactError) {
            console.error('[confirmarImportacion] error inserting contacts:', contactError.message);
            contactosFallidos += dbContacts.length;
          }
        }
        
        insertados += insertedList.length;
      }
    }
    
    // 2. Actualización de estudiantes existentes
    if (actualizar.length > 0) {
      for (let i = 0; i < actualizar.length; i++) {
        const item = actualizar[i];
        
        const { error: updateError } = await supabaseAdmin
          .from('estudiantes')
          .update(item.student)
          .eq('id', item.id);
          
        if (updateError) {
          console.error(`[confirmarImportacion] error updating student ${item.id}:`, updateError.message);
          continue;
        }
        
        // Actualizar contacto (borrar anterior y volver a insertar si aplica)
        const contact = item.contacto;
        if (contact.nombre || contact.telefonos) {
          await supabaseAdmin.from('contacto').delete().eq('estudiante', item.id);
          const { error: contactError } = await supabaseAdmin.from('contacto').insert({
            ...contact,
            estudiante: item.id
          });
          if (contactError) {
            console.error(`[confirmarImportacion] error updating contact for student ${item.id}:`, contactError.message);
            contactosFallidos++;
          }
        }

        actualizados++;
      }
    }
    
  } catch (err) {
    console.error('[confirmarImportacion] execution error:', err.message);
    return res.status(500).json({ error: 'Error inesperado al guardar los datos: ' + err.message });
  }
  
  const respuesta = {
    importados: insertados,
    actualizados: actualizados
  };
  if (contactosFallidos > 0) {
    respuesta.advertencia =
      `No se pudieron guardar ${contactosFallidos} contacto(s) por permisos de la base de datos. ` +
      `Configura SUPABASE_SERVICE_ROLE_KEY o revisa las políticas RLS de la tabla "contacto".`;
  }
  res.json(respuesta);
};

exports.downloadTemplate = (_req, res) => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([
    [
      'Nombre(s)', 'Apellido(s)', 'Cédula', 'Grupo', 'Escuela', 'Facultad',
      'Última localización', 'Familiar/conocido a contactar', 'Número de contacto',
      '¿Fue localizado?', 'Estado en el que se encuentra:', '¿Dónde o con quién se encuentra?',
      'Requerimientos'
    ],
    [
      'María', 'González', '24567890', 'Estudiante', 'Computación', 'Ciencias',
      'Edificio de Ciencias, Ciudad Universitaria', 'Carlos González', '0412-1234567',
      'NO', 'Desaparecido', '', 'Última vez vista saliendo de laboratorio'
    ],
    [
      'Valentina', 'Díaz', '26234567', 'Estudiante', 'Medicina', 'Medicina',
      'Hospital Universitario de Caracas', 'Luis Díaz', '0416-5554321',
      'SI', 'Localizado', 'Casa de su tía en Los Teques', 'Sana y salva, perdió su celular'
    ],
  ]);
  xlsx.utils.book_append_sheet(wb, ws, 'Estudiantes');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_ucv_aparecidos.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};
