'use strict';
// Seguridad: clave de cookies, sesión del dueño y límite de intentos por IP.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR, BASE, PASSWORD, PASSWORD_MIN_LENGTH, SESSION_DAYS } = require('./config');
const { fail } = require('./errors');

/* ── Clave secreta ──────────────────────────────────────────────────────── */
// Firma las cookies. Si no pones SECRET, se crea sola en data/secret.key (nunca la subas a git).
function loadSecret() {
  if (process.env.SECRET) return process.env.SECRET;
  const file = path.join(DATA_DIR, 'secret.key');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}
const SECRET = loadSecret();

const hmac = (text) => crypto.createHmac('sha256', SECRET).update(text).digest('hex');

// Comparación de textos en tiempo constante
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/* ── Contraseña y sesión ────────────────────────────────────────────────── */
const passwordConfigured = PASSWORD.length >= PASSWORD_MIN_LENGTH;
const passwordMatches = (candidate) => same(hmac('pw:' + String(candidate || '').slice(0, 200)), hmac('pw:' + PASSWORD));

// Cookie "session" = vence.huella.firma
// La huella cambia al cambiar PASSWORD: las sesiones abiertas dejan de valer.
const COOKIE_NAME = 'session';
const FINGERPRINT = hmac('pw:' + PASSWORD).slice(0, 12);

function createSessionToken() {
  const payload = `${Date.now() + SESSION_DAYS * 864e5}.${FINGERPRINT}`;
  return `${payload}.${hmac(payload)}`;
}

function isLoggedIn(req) {
  const match = new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`).exec(req.headers.cookie || '');
  const parts = match && match[1].split('.');
  if (!passwordConfigured || !parts || parts.length !== 3) return false;
  const [expires, print, signature] = parts;
  return same(hmac(`${expires}.${print}`), signature) && print === FINGERPRINT && +expires > Date.now();
}

// Valor de la cabecera Set-Cookie (`open` falso = cerrar sesión)
function sessionCookie(req, open) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  const maxAge = open ? SESSION_DAYS * 86400 : 0;
  return `${COOKIE_NAME}=${open ? createSessionToken() : ''}; HttpOnly; SameSite=Strict; Path=${BASE || '/'}; Max-Age=${maxAge}${secure}`;
}

/* ── Límite de intentos ─────────────────────────────────────────────────── */
// `max` intentos de tipo `kind` por IP cada `ms` milisegundos; al pasarse responde 429.
const buckets = new Map();

function rateLimit(kind, ip, max, ms) {
  const key = `${kind}:${ip}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.until < now) bucket = { count: 0, until: now + ms };
  if (++bucket.count > max) throw fail(429, 'Demasiados intentos. Espera un rato.');
  buckets.set(key, bucket);
}

// Sin esta limpieza el mapa crecería para siempre (una entrada por IP y tipo)
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.until < now) buckets.delete(key);
}, 6e5).unref();

module.exports = { passwordConfigured, passwordMatches, isLoggedIn, sessionCookie, rateLimit };
