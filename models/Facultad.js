'use strict';
/**
 * models/Facultad.js
 * Datos estáticos de facultades y carreras de la UCV.
 * Para agregar una nueva facultad o carrera, editar FACULTADES aquí.
 */

const FACULTADES = {
  'Ciencias': [
    'Biología', 'Computación', 'Física',
    'Matemáticas', 'Química', 'Geoquimica'
  ],
  'Arquitectura y Urbanismo': [
    'Arquitectura',
  ],
  'Ciencias Economicas y Sociales': [
    'Ciencias Actuariales', 'Economía', 'Estadística', 'Contaduría',
    'Estudios Internacionales', 'Administración', 'Sociología',
    'Trabajo Social', 'Antropología'
  ],
  'Ciencias Jurídicas y Políticas': [
    'Derecho', 'Estudios Políticos y Administrativos'
  ],
  'Farmacia': [
    'Farmacia'
  ], 
  'Humanidades y Educación': [
    'Letras', 'Historia', 'Filosofía', 'Psicología', 'Educación',
    'Geografía', 'Comunicación Social', 'Artes',
    'Traducción', 'Traducción e Interpretación', 'Idiomas Modernos',
    'Archivología', 'Bibliotecología', 
  ],     
  'Ingeniería': [
    'Civil', 'Eléctrica', 'Mecánica', 'Química', 'Geodésica', 'Geofísica', 
    'Geológica', 'Petróleo', 'Metalúrgica', 'Procesos Industriales', 'Minas',
    'Hidrometereológica'  
  ],
  'Medicina': [
    'Medicina', 'Enfermería', 'Bioanálisis', 'Nutrición y Dietética', 
    'Salud Pública', 'Terapia Ocupasional', 'Cardiorrespiratorio',
    'Radiología e Imagenología', 'Fisioterapia', 'Cardio Pulmonar'
  ],
  'Odontología': ['Odontología'],
  'Agronomía': ['Agronómia'],
  'Veterinaria': ['Medicina Veterinaria'],
  'Administración UCV': ['Personal Administrativo', 'Trabajador', 'Deportes', 'Servicios'],
};

const Facultad = {
  getAll()           { return FACULTADES; },
  getCarreras(fac)   { return FACULTADES[fac] || []; },
  exists(fac)        { return Object.prototype.hasOwnProperty.call(FACULTADES, fac); },
  listNames()        { return Object.keys(FACULTADES); },
};

module.exports = Facultad;

