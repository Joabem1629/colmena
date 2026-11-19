'use strict';
// Rutas de la API (/api/...). Cada ruta es una función corta; `handleApi` decide cuál toca.
// Lo público no pide sesión (y ya viene redactado); todo lo demás exige la del dueño.
const { SITE_NAME, SITE_DESC, PASSWORD_MIN_LENGTH } = require('./config');
const { fail } = require('./errors');
const { sendJson, readJson, isJsonRequest } = require('./http');
const { passwordConfigured, passwordMatches, isLoggedIn, sessionCookie, rateLimit } = require('./security');
const { getWorkspace, saveWorkspace, cleanWorkspace, stampLogs, publicBoard, publicBoardList } = require('./workspace');
const { iconSettings } = require('./icons');

/* ── Lectura pública ────────────────────────────────────────────────────── */

// La portada (tableros públicos y avisos) o un tablero público (`slug`)
function publicPage(res, slug) {
  const workspace = getWorkspace();
  if (!slug) return sendJson(res, 200, { name: SITE_NAME, desc: SITE_DESC, boards: publicBoardList(workspace), notices: workspace.notices });
  const board = publicBoard(workspace, slug);
  if (!board) throw fail(404, 'Tablero no encontrado');
  sendJson(res, 200, { name: SITE_NAME, board });
}

/* ── Sesión ─────────────────────────────────────────────────────────────── */

async function login(req, res, ip) {
  rateLimit('login', ip, 10, 9e5);
  if (!passwordConfigured) throw fail(503, `Falta definir PASSWORD en la configuración (mínimo ${PASSWORD_MIN_LENGTH} caracteres).`);
  const body = await readJson(req);
  if (!passwordMatches(body.password)) throw fail(401, 'Contraseña incorrecta');
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, true) });
}

/* ── Con sesión: el espacio del dueño ───────────────────────────────────── */

async function putWorkspace(req, res) {
  const clean = cleanWorkspace(await readJson(req));
  const isImport = /[?&]import=1\b/.test(req.url);
  saveWorkspace(isImport ? clean : stampLogs(getWorkspace(), clean));
  sendJson(res, 200, getWorkspace());
}

/* ── Enrutador ──────────────────────────────────────────────────────────── */

// `seg` = partes de la ruta tras /api, p. ej. ["public", "arte"]
async function handleApi(req, res, seg, ip) {
  const method = req.method;
  if (method !== 'GET' && !isJsonRequest(req)) throw fail(415, 'Se espera JSON');

  if (method === 'GET' && seg[0] === 'public') return publicPage(res, seg[1]);
  if (method === 'GET' && seg[0] === 'me') return sendJson(res, 200, { auth: isLoggedIn(req), configured: passwordConfigured });
  if (method === 'POST' && seg[0] === 'login') return login(req, res, ip);
  if (method === 'POST' && seg[0] === 'logout') return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, false) });

  // Desde aquí hace falta sesión
  if (!isLoggedIn(req)) throw fail(401, 'Inicia sesión');
  if (seg[0] === 'workspace' && method === 'GET') return sendJson(res, 200, getWorkspace());
  if (seg[0] === 'workspace' && method === 'PUT') return putWorkspace(req, res);
  if (seg[0] === 'icons' && method === 'GET') return sendJson(res, 200, iconSettings());

  throw fail(404, 'No existe');
}

module.exports = { handleApi };
