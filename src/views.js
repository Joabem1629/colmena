'use strict';
// Páginas HTML (views/*.html). Son HTML normal con cuatro marcas que se rellenan aquí:
//
//   {{NAME}}       nombre del sitio (SITE_NAME)        {{DESC}}       frase corta (SITE_DESC)
//   {{BASE}}       raíz del sitio, para <base href>    {{ICONS_DIR}}  carpeta de iconos propios
//
// Los valores ya van escapados. Las páginas no llevan scripts dentro: todo el JS está en public/js.
const fs = require('fs');
const path = require('path');
const { VIEWS_DIR, BASE, SITE_NAME, SITE_DESC, ICONS } = require('./config');

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const VARIABLES = {
  NAME: escapeHtml(SITE_NAME),
  DESC: escapeHtml(SITE_DESC),
  BASE: escapeHtml(BASE + '/'), // el navegador resuelve todas las rutas relativas a partir de aquí
  ICONS_DIR: escapeHtml(ICONS.dir),
};

function renderView(name) {
  const html = fs.readFileSync(path.join(VIEWS_DIR, `${name}.html`), 'utf8');
  return html.replace(/\{\{(NAME|DESC|BASE|ICONS_DIR)\}\}/g, (_, key) => VARIABLES[key]);
}

module.exports = { renderView };
