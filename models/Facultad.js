'use strict';
/**
 * models/Facultad.js
 * Datos estáticos de facultades y carreras de la UCV.
 * Para agregar una nueva facultad o carrera, editar FACULTADES aquí.
 */

const FACULTADES = {
  'Ciencias': [
    'Biología', 'Computación', 'Física',
    'Matemáticas', 'Química', 'Estudios Ambientales'
  ],
  'Medicina': [
    'Medicina', 'Enfermería', 'Bioanálisis', 'Nutrición y Dietética'
  ],
  'Ingeniería': [
    'Civil', 'Eléctrica', 'Mecánica', 'Química', 'Geodesia',
    'Computación', 'Petróleo', 'Telecomunicaciones', 'Industrial', 'Biomédica'
  ],
  'Odontología': ['Odontología'],
  'Farmacia': ['Farmacia', 'Bioquímica'],
  'Humanidades y Educación': [
    'Letras', 'Historia', 'Filosofía', 'Psicología', 'Educación',
    'Geografía', 'Comunicación Social', 'Trabajo Social', 'Artes'
  ],
  'Derecho': ['Derecho'],
  'Arquitectura y Urbanismo': ['Arquitectura', 'Urbanismo'],
  'Ciencias Económicas y Sociales': [
    'Economía', 'Administración y Contaduría',
    'Estadística', 'Sociología', 'Trabajo Social', 'Antropología'
  ],
  'Agronomía': ['Ingeniería Agronómica', 'Forestal'],
  'Veterinaria': ['Medicina Veterinaria'],
};

const Facultad = {
  getAll()           { return FACULTADES; },
  getCarreras(fac)   { return FACULTADES[fac] || []; },
  exists(fac)        { return Object.prototype.hasOwnProperty.call(FACULTADES, fac); },
  listNames()        { return Object.keys(FACULTADES); },
};

module.exports = Facultad;
