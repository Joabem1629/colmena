'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, board } = require('./helpers');

test('datos de versiones anteriores', async (t) => {
  const app = await startServer();
  t.after(app.close);
  const me = await app.owner();

  await t.test('un respaldo sin grupos ni campos nuevos se importa bien', async () => {
    const old = { boards: [board()], notices: [{ id: 'n1', kind: 'work', date: '2026-01-01', text: 'Hola' }] }; // sin "groups"
    const res = await me('PUT', '/api/workspace?import=1', old);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.groups, []);
    assert.deepEqual(res.json.boards[0].cards[0].tagIds, []);
    assert.equal(res.json.boards[0].cards[0].client, '');
    assert.equal(res.json.notices[0].text, 'Hola');
  });

  await t.test('un emoji suelto de versiones anteriores sigue siendo el icono', async () => {
    const res = await me('PUT', '/api/workspace', { boards: [board({ emoji: '🎨' })], notices: [] });
    assert.equal(res.json.boards[0].emoji, '🎨');
  });

  await t.test('un kanban.json ilegible se aparta y no se pierde', async () => {
    // Lo que hace el servidor al arrancar con un archivo roto: se prueba con un proceso aparte
    const { execFileSync } = require('child_process');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'colmena-roto-'));
    fs.writeFileSync(path.join(dir, 'kanban.json'), '{esto no es json');
    const out = execFileSync(process.execPath, ['-e', "const w=require('./src/workspace');console.log(JSON.stringify(w.getWorkspace().boards))"], { cwd: path.join(__dirname, '..'), env: { ...process.env, DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    assert.equal(out.trim(), '[]');
    assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('kanban.json.roto-')));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
