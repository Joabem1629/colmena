'use strict';
// Archivos estáticos de public/ (css, js, imágenes, fuentes) con ETag y gzip.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PUBLIC_DIR } = require('./config');
const { headers } = require('./http');

// Solo se sirven estos tipos. Para permitir otro, añádelo aquí.
const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = new Set(['.css', '.js', '.svg']);

// Se comprime una sola vez por versión del archivo (y no en cada visita)
const gzipCache = new Map();
function gzipped(file, etag, content) {
  const cached = gzipCache.get(file);
  if (cached && cached.etag === etag) return cached.buffer;
  const buffer = zlib.gzipSync(content);
  gzipCache.set(file, { etag, buffer });
  return buffer;
}

// Intenta servir `urlPath` desde public/. Devuelve false si no es un archivo servible.
function serveStatic(req, res, urlPath) {
  const file = path.join(PUBLIC_DIR, urlPath);
  const ext = path.extname(file);
  if (!file.startsWith(PUBLIC_DIR + path.sep) || !TYPES[ext]) return false;

  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;

  // Siempre se revalida (no-cache): quien sube un archivo nuevo lo ve al instante, sin versiones viejas
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const base = { ETag: etag, 'Cache-Control': 'no-cache' };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers(base));
    res.end();
    return true;
  }

  const head = { 'Content-Type': TYPES[ext], Vary: 'Accept-Encoding', ...base };
  if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const body = gzipped(file, etag, fs.readFileSync(file));
    res.writeHead(200, headers({ ...head, 'Content-Encoding': 'gzip', 'Content-Length': body.length }));
    res.end(body);
  } else {
    res.writeHead(200, headers({ ...head, 'Content-Length': stat.size }));
    fs.createReadStream(file).pipe(res);
  }
  return true;
}

module.exports = { serveStatic };
