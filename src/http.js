'use strict';
// Utilidades HTTP: cabeceras de seguridad, respuestas JSON, lectura del cuerpo e IP del visitante.
const { TRUST_PROXY, MAX_BODY_BYTES } = require('./config');
const { fail } = require('./errors');

// Política de contenido: qué puede cargar una página.
//  · script-src 'self'  → solo los archivos de public/js (no hay scripts dentro del HTML).
//  · img-src … https:   → permite portadas de fichas y GIF alojados en otras webs (solo https).
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join('; ');

const headers = (extra = {}) => ({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': CSP,
  ...extra,
});

function sendJson(res, status, data, extra = {}) {
  res.writeHead(status, headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }));
  res.end(JSON.stringify(data));
}

// Lee y valida el cuerpo JSON de una petición (máximo MAX_BODY_BYTES)
const readJson = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(fail(413, 'Demasiado grande'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {});
      } catch {
        reject(fail(400, 'JSON no válido'));
      }
    });
  });

const isJsonRequest = (req) => String(req.headers['content-type'] || '').startsWith('application/json');

// Detrás de nginx la IP real llega en X-Forwarded-For (solo se confía con TRUST_PROXY)
const clientIp = (req) => (TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress;

module.exports = { headers, sendJson, readJson, isJsonRequest, clientIp };
