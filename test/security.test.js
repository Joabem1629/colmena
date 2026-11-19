'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, PASSWORD } = require('./helpers');

test('seguridad de la sesión', async (t) => {
  const app = await startServer();
  t.after(app.close);

  await t.test('la cookie es HttpOnly y SameSite=Strict; con HTTPS detrás del proxy, Secure', async () => {
    const plain = await app.client()('POST', '/api/login', { password: PASSWORD });
    const cookie = plain.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.doesNotMatch(cookie, /Secure/);

    const secure = await app.client()('POST', '/api/login', { password: PASSWORD }, { 'X-Forwarded-Proto': 'https' });
    assert.match(secure.headers.get('set-cookie'), /Secure/);
  });

  await t.test('una cookie inventada o manipulada no vale', async () => {
    const forged = ['session=9999999999999.abc.def', 'session=1.2', 'session=', 'session=a.b.c.d'];
    for (const cookie of forged) {
      const res = await fetch(app.base + '/api/workspace', { headers: { cookie } });
      assert.equal(res.status, 401, cookie);
    }
    const good = (await app.client()('POST', '/api/login', { password: PASSWORD })).headers.get('set-cookie').split(';')[0];
    const [name, value] = good.split('=');
    const tampered = `${name}=${value.replace(/^\d+/, (n) => String(+n + 1))}`; // alarga la fecha de vencimiento
    assert.equal((await fetch(app.base + '/api/workspace', { headers: { cookie: tampered } })).status, 401);
  });

  await t.test('cerrar sesión borra la cookie', async () => {
    const res = await app.client()('POST', '/api/logout', {});
    assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
  });

  await t.test('demasiados intentos de contraseña → 429', async () => {
    const attacker = app.client();
    let last;
    for (let i = 0; i < 12; i++) last = await attacker('POST', '/api/login', { password: 'mala-' + i });
    assert.equal(last.status, 429);
  });
});
