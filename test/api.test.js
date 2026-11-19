'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, PASSWORD, card, board } = require('./helpers');

// PNG y WebP válidos (solo cabeceras reales; el servidor comprueba tipo + primeros bytes)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const WEBP = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

test('API de Colmena', async (t) => {
  const app = await startServer();
  t.after(app.close);
  const me = await app.owner();

  await t.test('entrar y salir', async () => {
    const other = app.client();
    assert.equal((await other('GET', '/api/me')).json.auth, false);
    assert.equal((await other('POST', '/api/login', { password: 'mala-clave' })).status, 401);
    assert.equal((await other('POST', '/api/login', { password: PASSWORD })).status, 200);
    assert.equal((await other('GET', '/api/me')).json.auth, true);
    assert.equal((await other('GET', '/api/workspace')).status, 200);
    await other('POST', '/api/logout', {});
    assert.equal((await other('GET', '/api/workspace')).status, 401);
  });

  await t.test('lo privado exige sesión', async () => {
    const anonymous = app.client();
    assert.equal((await anonymous('GET', '/api/workspace')).status, 401);
    assert.equal((await anonymous('PUT', '/api/workspace', { boards: [] })).status, 401);
    assert.equal((await anonymous('GET', '/api/icons')).status, 401);
  });

  await t.test('solo acepta JSON al escribir', async () => {
    const res = await fetch(app.base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
    assert.equal(res.status, 415);
  });

  await t.test('guardar y recuperar el espacio', async () => {
    const saved = await me('PUT', '/api/workspace', { boards: [board()], notices: [] });
    assert.equal(saved.status, 200);
    const back = (await me('GET', '/api/workspace')).json;
    assert.equal(back.boards.length, 1);
    assert.equal(back.boards[0].cards.length, 3);
    assert.equal(back.boards[0].cards[0].notes, 'nota privada');
    assert.deepEqual(back.groups, []);
  });

  await t.test('lo guardado sobrevive a un reinicio (archivo en disco)', async () => {
    const onDisk = JSON.parse(fs.readFileSync(path.join(app.dataDir, 'kanban.json'), 'utf8'));
    assert.equal(onDisk.boards[0].slug, 'arte');
  });

  await t.test('la página pública oculta lo privado y lo oculto', async () => {
    const anonymous = app.client();
    const home = await anonymous('GET', '/api/public');
    assert.equal(home.json.name, 'Mi kanban');
    assert.deepEqual(home.json.boards.map((b) => [b.slug, b.count]), [['arte', 2]]);

    const { board: pub } = (await anonymous('GET', '/api/public/arte')).json;
    assert.equal(pub.cards.length, 2); // la oculta no sale
    const secret = pub.cards.find((k) => k.vis === 'private');
    assert.equal(secret.title, '');
    assert.equal(secret.desc, '');
    assert.equal(secret.progress, 45);
    assert.ok(!JSON.stringify(pub).includes('nota privada'));
    assert.ok(!JSON.stringify(pub).includes('no se ve'));
    assert.equal((await anonymous('GET', '/api/public/no-existe')).status, 404);
  });

  await t.test('un tablero no público no se ve', async () => {
    await me('PUT', '/api/workspace', { boards: [board({ public: false })], notices: [] });
    const anonymous = app.client();
    assert.equal((await anonymous('GET', '/api/public/arte')).status, 404);
    assert.deepEqual((await anonymous('GET', '/api/public')).json.boards, []);
  });

  await t.test('las direcciones reservadas y repetidas se corrigen', async () => {
    const saved = await me('PUT', '/api/workspace', { boards: [board({ id: 'x1', slug: 'edit' }), board({ id: 'x2', slug: 'api' }), board({ id: 'x3', slug: 'Retrato VTuber' }), board({ id: 'x4', slug: 'retrato-vtuber' })], notices: [] });
    assert.deepEqual(saved.json.boards.map((b) => b.slug), ['edit-2', 'api-2', 'retrato-vtuber', 'retrato-vtuber-2']);
  });

  await t.test('el avance se calcula con las tareas sin subtareas', async () => {
    const tasks = [
      { id: 'p', title: 'Padre', done: false, parent: null, log: [] },
      { id: 'h1', title: 'Hijo 1', done: true, parent: 'p', log: [] },
      { id: 'h2', title: 'Hijo 2', done: false, parent: 'p', log: [] },
    ];
    await me('PUT', '/api/workspace', { boards: [board({ cards: [card({ progress: 90, tasks })] })], notices: [] });
    const pub = (await app.client()('GET', '/api/public/arte')).json.board;
    assert.equal(pub.cards[0].progress, 50);
    assert.equal(pub.cols[0].progress, 50);
  });

  await t.test('el registro de tareas lo sella el servidor y no se reescribe', async () => {
    const entry = { id: 'e1', at: '1999-01-01T00:00:00Z', kind: 'note', text: 'primero' };
    const withLog = (log) => ({ boards: [board({ cards: [card({ tasks: [{ id: 't1', title: 'T', done: false, parent: null, log }] })] })], notices: [] });

    const first = (await me('PUT', '/api/workspace', withLog([entry]))).json.boards[0].cards[0].tasks[0].log[0];
    assert.notEqual(first.at, '1999-01-01T00:00:00Z'); // la hora la pone el servidor

    const forged = { ...first, text: 'cambiado', at: '2000-01-01T00:00:00Z' };
    const second = (await me('PUT', '/api/workspace', withLog([forged]))).json.boards[0].cards[0].tasks[0].log[0];
    assert.equal(second.text, 'primero'); // lo ya guardado no se edita
    assert.equal(second.at, first.at);

    const imported = (await me('PUT', '/api/workspace?import=1', withLog([{ id: 'e9', at: '2001-02-03T04:05:06Z', kind: 'note', text: 'de un respaldo' }]))).json;
    assert.equal(imported.boards[0].cards[0].tasks[0].log[0].at, '2001-02-03T04:05:06Z'); // al importar se respetan las fechas
  });

  await t.test('datos de ficha: cliente, entrega, enlace y portada se revisan', async () => {
    const good = card({ id: 'ok', client: 'Ana', due: '2026-12-01', link: 'https://ejemplo.com/pedido', cover: 'https://ejemplo.com/a.png' });
    const bad = card({ id: 'bad', client: 'x'.repeat(200), due: '2026-02-31', link: 'javascript:alert(1)', cover: 'http://ejemplo.com/a.png' });
    const saved = (await me('PUT', '/api/workspace', { boards: [board({ cards: [good, bad] })], notices: [] })).json.boards[0].cards;
    assert.deepEqual([saved[0].client, saved[0].due, saved[0].link, saved[0].cover], ['Ana', '2026-12-01', 'https://ejemplo.com/pedido', 'https://ejemplo.com/a.png']);
    assert.equal(saved[1].client.length, 80);
    assert.equal(saved[1].due, ''); // fecha imposible
    assert.equal(saved[1].link, ''); // nunca javascript:
    assert.equal(saved[1].cover, ''); // la portada solo por https
  });

  await t.test('lo público muestra los datos de ficha, pero no los de una privada', async () => {
    const open = card({ id: 'a', client: 'Ana', due: '2026-12-01', link: 'https://ejemplo.com' });
    const closed = card({ id: 'b', vis: 'private', client: 'Cliente secreto', due: '2026-12-02', link: 'https://secreto.com' });
    await me('PUT', '/api/workspace', { boards: [board({ cards: [open, closed] })], notices: [] });
    const pub = (await app.client()('GET', '/api/public/arte')).json.board;
    assert.equal(pub.cards[0].client, 'Ana');
    assert.equal(pub.cards[0].link, 'https://ejemplo.com');
    const text = JSON.stringify(pub.cards[1]);
    assert.ok(!text.includes('Cliente secreto') && !text.includes('secreto.com') && !text.includes('2026-12-02'));
  });

  await t.test('iconos: biblioteca, archivo propio, imagen subida y emoji', async () => {
    const icon = async (value) => (await me('PUT', '/api/workspace', { boards: [board({ emoji: value })], notices: [] })).json.boards[0].emoji;
    assert.equal(await icon('i:python'), 'i:python');
    assert.equal(await icon('i:../x'), '');
    assert.equal(await icon('c:mi-logo.png'), 'c:mi-logo.png');
    assert.equal(await icon('c:../secret.png'), '');
    assert.equal(await icon('c:script.js'), '');
    assert.equal(await icon(PNG), PNG);
    assert.equal(await icon(WEBP), WEBP);
    assert.equal(await icon('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), ''); // un SVG subido podría llevar scripts
    assert.equal(await icon('data:image/png;base64,AAAA'), ''); // no empieza como un PNG de verdad
    assert.equal(await icon('data:text/html;base64,PGI+'), '');
    assert.equal(await icon('🎨'), '🎨');
    assert.equal(await icon('🎨'.repeat(10)).then((v) => [...v].length <= 8), true);
  });

  await t.test('/api/icons da los ajustes del selector', async () => {
    const { json } = await me('GET', '/api/icons');
    assert.equal(json.dir, 'assets/icons');
    assert.ok(Array.isArray(json.files));
    assert.deepEqual([json.upload.enabled, json.upload.size], [true, 64]);
  });

  await t.test('un icono subido demasiado grande se descarta', async () => {
    const big = 'data:image/png;base64,iVBORw0KGgo' + 'A'.repeat(20000);
    const saved = (await me('PUT', '/api/workspace', { boards: [board({ emoji: big })], notices: [] })).json;
    assert.equal(saved.boards[0].emoji, '');
  });
});
