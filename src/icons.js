'use strict';
// Iconos de un tablero. Se guardan como texto en el campo `emoji` del tablero (el nombre se
// conserva para no romper datos antiguos). Hay cuatro formas de valor:
//
//   i:python               icono de la biblioteca (public/js/icons.data.js)
//   c:mi-logo.png          icono propio: archivo de public/assets/icons/ (lo pones tú)
//   data:image/png;base64… imagen subida desde el editor (se guarda dentro del tablero)
//   🎨                     un emoji cualquiera (hasta 8 caracteres)
const fs = require('fs');
const path = require('path');
const { PUBLIC_DIR, ICONS } = require('./config');

const FILE_ICON = /^[a-z0-9][a-z0-9-]{0,39}\.(svg|png|webp|gif|jpe?g|avif)$/;
const LIBRARY_ICON = /^i:[a-z0-9-]{1,32}$/;

// Lo subido es siempre PNG o WebP (el editor lo redibuja en un canvas). Se comprueba el
// tipo declarado Y los primeros bytes reales del archivo.
const UPLOAD_PREFIXES = ['data:image/png;base64,iVBORw0KGgo', 'data:image/webp;base64,UklGR'];
const UPLOAD_BODY = /^data:image\/(?:png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_UPLOAD_CHARS = Math.ceil(ICONS.upload.maxBytes / 3) * 4 + 40;

// Devuelve un valor de icono válido, o '' si no lo es
function cleanIcon(value) {
  const s = String(value ?? '');
  if (s.startsWith('i:')) return LIBRARY_ICON.test(s) ? s : '';
  if (s.startsWith('c:')) return FILE_ICON.test(s.slice(2)) ? s : '';
  if (s.startsWith('data:')) {
    const valid = ICONS.upload.enabled && s.length <= MAX_UPLOAD_CHARS && UPLOAD_BODY.test(s) && UPLOAD_PREFIXES.some((prefix) => s.startsWith(prefix));
    return valid ? s : '';
  }
  return s.slice(0, 8); // emoji
}

// Iconos propios que hay ahora mismo en la carpeta (para la pestaña "Mis iconos")
function listFileIcons() {
  let files = [];
  try {
    files = fs.readdirSync(path.join(PUBLIC_DIR, ICONS.dir));
  } catch {
    return [];
  }
  return files
    .filter((file) => FILE_ICON.test(file))
    .sort()
    .map((file) => ({ value: `c:${file}`, name: file.replace(/\.[^.]+$/, '') }));
}

// Lo que el editor necesita saber para mostrar el selector de iconos
const iconSettings = () => ({ dir: ICONS.dir, files: listFileIcons(), upload: { ...ICONS.upload } });

module.exports = { cleanIcon, iconSettings };
