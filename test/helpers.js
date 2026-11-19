'use strict';
// Arranca una copia del servidor con una carpeta de datos temporal y da un cliente HTTP mínimo.
// Cada archivo de prueba corre en su propio proceso, así que la configuración (PASSWORD, BASE…) se lee limpia.
const fs = require('fs');
const os = require('os');
const path = require('path');

const PASSWORD = 'clave-de-prueba';

async function startServer(env = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'colmena-test-'));
  Object.assign(process.env, { DATA_DIR: dataDir, PASSWORD, SITE_NAME: 'Mi kanban', SITE_DESC: 'Lo que construyo' }, env);
  const server = require('../server');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  // Cliente con una "cookie jar" de una sola sesión
  function client() {
    let cookie = '';
    return async (method, url, body, extraHeaders = {}) => {
      const res = await fetch(base + url, {
        method,
        redirect: 'manual',
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...extraHeaders },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: res.status, headers: res.headers, text, json };
    };
  }

  // Un cliente que ya entró como dueño
  async function owner() {
    const me = client();
    const login = await me('POST', '/api/login', { password: PASSWORD });
    if (login.status !== 200) throw new Error('No se pudo entrar en la prueba');
    return me;
  }

  const close = () => {
    server.closeAllConnections?.();
    server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  };
  return { base, client, owner, close, dataDir };
}

const card = (extra) => ({ id: 'k1', col: 'c1', title: 'Ficha', desc: '', vis: 'public', progress: null, tasks: [], notes: '', ...extra });
const board = (extra = {}) => ({
  id: 'b1', slug: 'arte', name: 'Arte', emoji: 'i:palette', color: '#f472b6', public: true,
  cols: [{ id: 'c1', name: 'Siguiente' }],
  cards: [card({ id: 'k1', title: 'Pública', desc: 'visible', progress: 10, notes: 'nota privada' }), card({ id: 'k2', title: 'Secreta', desc: 'no se ve', vis: 'private', progress: 45 }), card({ id: 'k3', title: 'Oculta', vis: 'hidden' })],
  ...extra,
});

module.exports = { startServer, PASSWORD, card, board };
