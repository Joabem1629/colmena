'use strict';
// Colmena (núcleo): un kanban público de solo lectura y un editor privado en /edit, para un único dueño.
// Sin dependencias: Node 18+. Variables de entorno en README.md. Licencia AGPL-3.0.
//
//   PASSWORD=una-clave-larga node server.js     →  http://localhost:3000  (editor en /edit)
//
// Dónde está cada cosa:  src/ (servidor) · views/ (páginas) · public/ (css, js, imágenes) · data/ (tus tableros)
const http = require('http');
const { PORT, HOST, BASE, SITE_NAME, DATA_DIR, PASSWORD, PASSWORD_MIN_LENGTH } = require('./src/config');
const { fail } = require('./src/errors');
const { headers, sendJson, clientIp } = require('./src/http');
const { handleApi } = require('./src/api');
const { serveStatic } = require('./src/static');
const { renderView } = require('./src/views');
const { getWorkspace, publicBoard } = require('./src/workspace');

function sendPage(res, view, status = 200) {
  res.writeHead(status, headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }));
  res.end(renderView(view));
}

async function handle(req, res) {
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    throw fail(400, 'Dirección no válida');
  }

  // Si se publica bajo un prefijo (BASE=/kanban), se quita antes de enrutar
  if (BASE) {
    if (path === BASE) {
      res.writeHead(301, { Location: BASE + '/' });
      return res.end();
    }
    if (!path.startsWith(BASE + '/')) throw fail(404, 'No existe');
    path = path.slice(BASE.length);
  }

  const seg = path.split('/').filter(Boolean);

  if (seg[0] === 'api') return handleApi(req, res, seg.slice(1), clientIp(req));

  if (!seg.length) return sendPage(res, 'public'); // la portada
  if (seg.length === 1 && seg[0] === 'edit') return sendPage(res, 'edit'); // el editor (la API exige sesión)
  if (serveStatic(req, res, path)) return; // css, js, imágenes, fuentes
  if (seg.length === 1) return sendPage(res, 'public', publicBoard(getWorkspace(), seg[0]) ? 200 : 404); // /<tablero>

  throw fail(404, 'No existe');
}

const server = http.createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (e) {
    if (!e.status) console.error(e);
    const status = e.status || 500;
    const message = e.status ? e.message : 'Error interno';
    if (req.url.includes('/api/')) return sendJson(res, status, { error: message });
    res.writeHead(status, headers({ 'Content-Type': 'text/plain; charset=utf-8' }));
    res.end(message);
  }
});

if (require.main === module) {
  if (PASSWORD.length < PASSWORD_MIN_LENGTH) console.warn(`AVISO: define PASSWORD (${PASSWORD_MIN_LENGTH}+ caracteres) o no podrás entrar a /edit.`);
  server.listen(PORT, HOST, () => console.log(`${SITE_NAME} en http://${HOST}:${PORT}${BASE}/  ·  editor en ${BASE}/edit  ·  datos en ${DATA_DIR}`));
}
module.exports = server;
