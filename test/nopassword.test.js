'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

test('sin PASSWORD no se puede entrar', async (t) => {
  // La contraseña corta cuenta como "sin configurar"
  const app = await startServer({ PASSWORD: 'corta' });
  t.after(app.close);
  const me = await app.client()('GET', '/api/me');
  assert.deepEqual(me.json, { auth: false, configured: false });
  assert.equal((await app.client()('POST', '/api/login', { password: 'corta' })).status, 503);
});
