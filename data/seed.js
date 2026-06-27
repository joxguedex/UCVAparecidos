'use strict';
/**
 * data/seed.js
 * Datos de ejemplo para desarrollo. Solo se insertan si la tabla está vacía.
 * Contribuidores: agregar aquí más casos de prueba sin tocar otra lógica.
 */
const { supabase } = require('../config/database');

const ESTUDIANTES = [
  {
    nombre: 'María González', cedula: 'V-24.567.890',
    facultad: 'Ciencias', carrera: 'Computación', semestre: '6to semestre',
    nombre_contacto: 'Carlos González', relacion_contacto: 'Padre',
    telefono_contacto: '0412-1234567',
    ultima_ubicacion: 'Edificio de Ciencias, Ciudad Universitaria',
    descripcion: 'Última vez vista el día del temblor, estaba saliendo del laboratorio',
    registrado_por: 'Carlos González', estado: 'desaparecido',
  },
  {
    nombre: 'Roberto Herrera', cedula: 'V-25.891.234',
    facultad: 'Ingeniería', carrera: 'Civil', semestre: '8vo semestre',
    nombre_contacto: 'Ana Herrera', relacion_contacto: 'Madre',
    telefono_contacto: '0424-9876543',
    ultima_ubicacion: 'Laboratorio de Materiales, Facultad de Ingeniería',
    descripcion: 'No ha respondido desde el martes. Salió de la facultad a las 2pm',
    registrado_por: 'Ana Herrera', estado: 'desaparecido',
  },
  {
    nombre: 'Valentina Díaz', cedula: 'V-26.234.567',
    facultad: 'Medicina', carrera: 'Medicina', semestre: '4to semestre',
    nombre_contacto: 'Luis Díaz', relacion_contacto: 'Hermano',
    telefono_contacto: '0416-5554321',
    ultima_ubicacion: 'Hospital Universitario de Caracas',
    descripcion: 'Estaba en prácticas clínicas cuando ocurrió el sismo',
    registrado_por: 'Luis Díaz', estado: 'aparecido',
    tipo_confirmacion: 'llamada_telefonica',
    detalles_confirmacion: 'Me llamó desde el celular de una amiga. Está bien en casa de su tía en Los Teques. Perdió su teléfono pero está sana y salva.',
    reportado_aparicion_por: 'Luis Díaz', contacto_reportador: '0416-5554321',
  },
  {
    nombre: 'Andrés Morales', cedula: 'V-23.456.789',
    facultad: 'Humanidades y Educación', carrera: 'Comunicación Social', semestre: '5to semestre',
    nombre_contacto: 'Patricia Morales', relacion_contacto: 'Madre',
    telefono_contacto: '0412-8765432',
    ultima_ubicacion: 'Escuela de Comunicación Social',
    descripcion: 'Salió de clases y no llegó a casa. Sus compañeros tampoco saben nada',
    registrado_por: 'Patricia Morales', estado: 'desaparecido',
  },
  {
    nombre: 'Laura Ramírez', cedula: 'V-27.123.456',
    facultad: 'Derecho', carrera: 'Derecho', semestre: '7mo semestre',
    nombre_contacto: 'José Ramírez', relacion_contacto: 'Padre',
    telefono_contacto: '0424-3214567',
    ultima_ubicacion: 'Facultad de Derecho, Auditorio Principal',
    descripcion: 'Iba a una reunión del Centro de Estudiantes',
    registrado_por: 'José Ramírez', estado: 'aparecido',
    tipo_confirmacion: 'presencia_fisica',
    detalles_confirmacion: 'La encontré en el puesto de Cruz Roja cerca de la UCV. Está bien, solo asustada. Ya está en casa.',
    reportado_aparicion_por: 'José Ramírez', contacto_reportador: '0424-3214567',
  },
  {
    nombre: 'Gabriel Suárez', cedula: 'V-26.890.123',
    facultad: 'Ingeniería', carrera: 'Eléctrica', semestre: '9no semestre',
    nombre_contacto: 'Marta Suárez', relacion_contacto: 'Madre',
    telefono_contacto: '0412-5678901',
    ultima_ubicacion: 'Laboratorio de Redes Eléctricas',
    descripcion: 'Estaba trabajando en su proyecto de grado',
    registrado_por: 'Marta Suárez', estado: 'desaparecido',
  },
  {
    nombre: 'Sofía Pérez', cedula: 'V-25.341.890',
    facultad: 'Ciencias', carrera: 'Biología', semestre: '3er semestre',
    nombre_contacto: 'Omar Pérez', relacion_contacto: 'Padre',
    telefono_contacto: '0424-7894561',
    ultima_ubicacion: 'Instituto de Biología Experimental',
    descripcion: 'No la hemos podido contactar desde el miércoles',
    registrado_por: 'Omar Pérez', estado: 'desaparecido',
  },
  {
    nombre: 'Carlos Fuentes', cedula: 'V-24.012.345',
    facultad: 'Arquitectura y Urbanismo', carrera: 'Arquitectura', semestre: '6to semestre',
    nombre_contacto: 'Elena Fuentes', relacion_contacto: 'Madre',
    telefono_contacto: '0412-3456789',
    ultima_ubicacion: 'Taller de Diseño, Facultad de Arquitectura',
    descripcion: 'Estaba presentando su proyecto cuando ocurrió el sismo',
    registrado_por: 'Elena Fuentes', estado: 'aparecido',
    tipo_confirmacion: 'mensaje_texto',
    detalles_confirmacion: 'Me envió un mensaje de WhatsApp. Pasó la noche en casa de un compañero en Bello Monte. Llegó a casa esta tarde.',
    reportado_aparicion_por: 'Elena Fuentes', contacto_reportador: '0412-3456789',
  },
];

module.exports = async function seedIfEmpty() {
  const { count, error: countError } = await supabase
    .from('estudiantes')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.warn('  ⚠  Seed: no se pudo verificar la tabla:', countError.message);
    return;
  }

  if (count > 0) return; // ya hay datos, no sembrar

  const now = new Date().toISOString();

  const rows = ESTUDIANTES.map(s => ({
    ...s,
    fecha_aparecio: s.estado === 'aparecido' ? now : null,
    // Limpiar campos opcionales
    cedula:                  s.cedula                  || null,
    semestre:                s.semestre                || null,
    telefono_contacto:       s.telefono_contacto       || null,
    nombre_contacto:         s.nombre_contacto         || null,
    relacion_contacto:       s.relacion_contacto       || null,
    ultima_ubicacion:        s.ultima_ubicacion        || null,
    descripcion:             s.descripcion             || null,
    registrado_por:          s.registrado_por          || null,
    tipo_confirmacion:       s.tipo_confirmacion       || null,
    detalles_confirmacion:   s.detalles_confirmacion   || null,
    reportado_aparicion_por: s.reportado_aparicion_por || null,
    contacto_reportador:     s.contacto_reportador     || null,
  }));

  const { error: insertError } = await supabase.from('estudiantes').insert(rows);

  if (insertError) {
    console.warn('  ⚠  Seed: error al insertar:', insertError.message);
    return;
  }

  console.log(`  ✦ Seed: ${rows.length} estudiantes de ejemplo cargados en Supabase`);
};
