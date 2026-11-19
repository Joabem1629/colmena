'use strict';
// Configuración del servidor: variables de entorno, carpetas y límites.
// Todas las variables están explicadas en README.md.
const fs = require('fs');
const path = require('path');

const env = process.env;
const ROOT = path.join(__dirname, '..');

// "0", "false" o "no" desactivan; cualquier otro valor activa
const flag = (value, fallback) => (value === undefined || value === '' ? fallback : !['0', 'false', 'no'].includes(String(value).toLowerCase()));

const DATA_DIR = env.DATA_DIR || path.join(ROOT, 'data'); // aquí vive kanban.json y la clave de cookies
fs.mkdirSync(DATA_DIR, { recursive: true });

module.exports = {
  ROOT,
  PUBLIC_DIR: path.join(ROOT, 'public'), // archivos estáticos: css, js, imágenes, fuentes
  VIEWS_DIR: path.join(ROOT, 'views'), // páginas HTML (solo marcado)
  DATA_DIR,

  PORT: +env.PORT || 3000,
  HOST: env.HOST || '127.0.0.1',
  // Prefijo si publicas bajo una ruta (p. ej. /kanban): siempre con "/" delante y sin "/" al final; vacío = raíz
  BASE: ('/' + (env.BASE || '').replace(/^\/+|\/+$/g, '')).replace(/^\/$/, ''),
  SITE_NAME: (env.SITE_NAME || 'Kanban').slice(0, 60),
  SITE_DESC: (env.SITE_DESC || '').slice(0, 200),
  TRUST_PROXY: !!env.TRUST_PROXY, // detrás de nginx/Caddy: la IP real llega en X-Forwarded-For

  PASSWORD: env.PASSWORD || '',
  PASSWORD_MIN_LENGTH: 8,
  SESSION_DAYS: 14,
  MAX_BODY_BYTES: 1e6,

  // Iconos propios de los tableros (ver src/icons.js)
  ICONS: {
    dir: 'assets/icons', // carpeta (dentro de public/) donde pones tus imágenes
    upload: {
      enabled: flag(env.ICON_UPLOAD, true), // ICON_UPLOAD=0 quita el botón "Subir imagen" del editor
      size: 64, // lado en píxeles al que el editor reduce la imagen
      maxBytes: 9000, // tamaño máximo de cada icono subido
    },
  },
};
