'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

test('páginas y archivos', async (t) => {
  const app = await startServer({ SITE_NAME: 'Mi <kanban>' });
  t.after(app.close);
  const anonymous = app.client();
  const owner = await app.owner();
  await owner('PUT', '/api/workspace', {
    boards: [{ id: 'b1', slug: 'arte', name: 'Arte', emoji: '', color: '#f472b6', public: true, cols: [{ id: 'c1', name: 'Siguiente' }], cards: [] }],
    notices: [],
  });

  await t.test('portada y editor', async () => {
    const home = await anonymous('GET', '/');
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type'), /text\/html/);
    assert.ok(home.text.includes('<base href="/">'));
    assert.ok(home.text.includes('Mi &lt;kanban&gt;'), 'el nombre del sitio va escapado');
    assert.ok(!home.text.includes('{{'), 'no quedan marcas sin rellenar');
    assert.ok(home.text.includes('js/pages/public.js'));

    const edit = await anonymous('GET', '/edit');
    assert.equal(edit.status, 200);
    assert.ok(edit.text.includes('js/editor/app.js'));
    assert.ok(edit.text.includes('name="robots" content="noindex"'));
  });

  await t.test('cada tablero público tiene su dirección; si no existe, 404', async () => {
    assert.equal((await anonymous('GET', '/arte')).status, 200);
    assert.equal((await anonymous('GET', '/no-existe')).status, 404);
    assert.equal((await anonymous('GET', '/arte/otra-cosa')).status, 404);
  });

  await t.test('las páginas no llevan scripts dentro y la política de seguridad lo exige', async () => {
    for (const url of ['/', '/edit']) {
      const page = await anonymous('GET', url);
      assert.ok(!/<script(?![^>]*\bsrc=)/.test(page.text), `${url} no debe tener scripts en línea`);
      const csp = page.headers.get('content-security-policy');
      assert.ok(csp.includes("script-src 'self'") && !/script-src[^;]*unsafe-inline/.test(csp));
      assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
    }
  });

  await t.test('archivos estáticos: css, js, fuente, favicon', async () => {
    const files = { '/css/theme.css': 'text/css', '/css/tags.css': 'text/css', '/js/editor/app.js': 'text/javascript', '/js/pages/public.js': 'text/javascript', '/js/icons.data.js': 'text/javascript', '/fonts/manrope-latin.woff2': 'font/woff2', '/assets/favicon.svg': 'image/svg+xml' };
    for (const [url, type] of Object.entries(files)) {
      const res = await anonymous('GET', url);
      assert.equal(res.status, 200, url);
      assert.ok(res.headers.get('content-type').startsWith(type), url);
    }
  });

  await t.test('todos los módulos que se importan existen', async () => {
    const seen = new Set();
    const visit = async (url) => {
      if (seen.has(url)) return;
      seen.add(url);
      const res = await anonymous('GET', url);
      assert.equal(res.status, 200, `falta ${url}`);
      for (const [, spec] of res.text.matchAll(/from '(\.[^']+)'/g)) await visit(new URL(spec, 'http://x' + url).pathname);
    };
    await visit('/js/pages/public.js');
    await visit('/js/editor/app.js');
    assert.ok(seen.size > 15);
  });

  await t.test('ETag: la segunda visita responde 304', async () => {
    const first = await anonymous('GET', '/css/base.css');
    const second = await anonymous('GET', '/css/base.css', undefined, { 'If-None-Match': first.headers.get('etag') });
    assert.equal(second.status, 304);
  });

  await t.test('gzip si el navegador lo acepta', async () => {
    const res = await fetch(app.base + '/js/icons.data.js', { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(res.headers.get('content-encoding'), 'gzip');
  });

  await t.test('solo se sirve lo de public/: nada de src/, views/ ni data/', async () => {
    for (const url of ['/server.js', '/src/config.js', '/views/public.html', '/data/kanban.json', '/package.json', '/..%2fserver.js', '/%2e%2e/server.js', '/js/../../server.js']) {
      const res = await anonymous('GET', url);
      assert.notEqual(res.status, 200, url);
      assert.ok(!res.text.includes('require('), url);
    }
  });

  await t.test('un error de la API siempre es JSON', async () => {
    const res = await anonymous('GET', '/api/no-existe');
    assert.equal(res.status, 401); // sin sesión, ni siquiera dice qué rutas existen
    assert.ok(res.json.error);
    assert.equal((await owner('GET', '/api/no-existe')).status, 404);
  });
});
