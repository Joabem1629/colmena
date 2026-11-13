'use strict';
// Núcleo: un tablero kanban público (solo lectura) y un editor privado en /edit, para un único dueño.
// Sin dependencias: Node 18+. Variables en README.md. Licencia AGPL-3.0.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');

const PORT = +process.env.PORT || 3000, HOST = process.env.HOST || '127.0.0.1';
const BASE = ('/' + (process.env.BASE || '').replace(/^\/+|\/+$/g, '')).replace(/^\/$/, '');   // "" o "/kanban"
const NAME = (process.env.SITE_NAME || 'Kanban').slice(0, 60), DESC = (process.env.SITE_DESC || '').slice(0, 200);
const PASSWORD = process.env.PASSWORD || '';
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data'), PUB = path.join(__dirname, 'public');
fs.mkdirSync(DATA, { recursive: true });
const SECRET = process.env.SECRET || (() => {                    // firma las cookies; se crea sola en data/secret.key (nunca a git)
  const f = path.join(DATA, 'secret.key');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(f, s, { mode: 0o600 }); return s; }
})();

/* ---------- seguridad ---------- */
const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const FP = hmac('pw:' + PASSWORD).slice(0, 12);                    // si cambias PASSWORD, las sesiones abiertas dejan de valer
const makeToken = () => { const p = `${Date.now() + 14 * 864e5}.${FP}`; return p + '.' + hmac(p); };
function authed(req) {
  const m = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || ''), t = m && m[1].split('.');
  return !!(PASSWORD.length >= 8 && t && t.length === 3 && same(hmac(t[0] + '.' + t[1]), t[2]) && t[1] === FP && +t[0] > Date.now());
}
const buckets = new Map();
function limit(kind, ip, max, ms) {
  const k = kind + ':' + ip, now = Date.now(); let b = buckets.get(k);
  if (!b || b.until < now) b = { n: 0, until: now + ms };
  if (++b.n > max) throw fail(429, 'Demasiados intentos. Espera un rato.');
  buckets.set(k, b);
}
setInterval(() => { const n = Date.now(); for (const [k, b] of buckets) if (b.until < n) buckets.delete(k); }, 6e5).unref();
const fail = (status, msg) => Object.assign(new Error(msg), { status });

/* ---------- datos: un solo archivo JSON, escrito de forma atómica ---------- */
const FILE = path.join(DATA, 'kanban.json');
const str = (s, n) => String(s ?? '').slice(0, n), arr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
const rid = () => crypto.randomBytes(5).toString('hex');
const icon = (e) => { const s = String(e ?? ''); return /^i:[a-z0-9-]{1,32}$/.test(s) ? s : s.startsWith('i:') ? '' : s.slice(0, 8); };
const RESERVED = ['edit', 'api'];                                   // rutas del sistema: ningún tablero puede llamarse así
function clean(w) {                                                 // el cliente no manda: todo se revisa y se recorta aquí
  const seen = new Set(), id = (x) => { let i = typeof x === 'string' && /^[\w-]{1,40}$/.test(x) ? x : rid(); while (seen.has(i)) i = rid(); seen.add(i); return i; };
  const slugs = new Set(RESERVED);
  const boards = arr(w && w.boards, 50).map((b) => {
    let slug = str(b.slug || b.name, 40).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tablero';
    for (let n = 2, s0 = slug; slugs.has(slug); n++) slug = s0 + '-' + n;
    slugs.add(slug);
    const cols = arr(b.cols, 20).map((c) => ({ id: id(c.id), name: str(c.name, 60) })), ok = new Set(cols.map((c) => c.id));
    const cards = arr(b.cards, 500).map((k) => {
      const tids = new Set(), tasks = arr(k.tasks, 500).map((t) => {            // sin límite de niveles: un padre siempre va antes que sus hijos
        const log = arr(t.log, 300).map((e) => ({ id: id(e.id), at: str(e.at, 30), kind: ['note', 'done', 'open'].includes(e.kind) ? e.kind : 'note', text: str(e.text, 500) }));
        const o = { id: id(t.id), title: str(t.title, 200), done: !!t.done, parent: tids.has(t.parent) ? t.parent : null, log }; tids.add(o.id); return o; });
      const kids = new Map(); tasks.forEach((t) => { if (t.parent) { if (!kids.has(t.parent)) kids.set(t.parent, []); kids.get(t.parent).push(t); } });
      for (let i = tasks.length - 1; i >= 0; i--) { const c = kids.get(tasks[i].id); if (c) tasks[i].done = c.every((x) => x.done); }   // un padre está hecho si todos sus hijos lo están
      const pr = Number.isFinite(+k.progress) && k.progress !== null && k.progress !== '' ? Math.min(100, Math.max(0, Math.round(+k.progress))) : null;
      return { id: id(k.id), col: ok.has(k.col) ? k.col : (cols[0] || {}).id || null, title: str(k.title, 200), desc: str(k.desc, 2000), vis: ['public', 'private', 'hidden'].includes(k.vis) ? k.vis : 'public',
        progress: pr, tasks, notes: str(k.notes, 5000) };
    });
    return { id: id(b.id), slug, name: str(b.name, 80) || 'Tablero', emoji: icon(b.emoji), color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#a78bfa', public: b.public !== false, cols, cards };
  });
  const notices = arr(w && w.notices, 100).map((n) => ({ id: id(n.id), kind: ['update', 'personal', 'work', 'vacation'].includes(n.kind) ? n.kind : 'update', date: str(n.date, 10), text: str(n.text, 500) }));
  return { boards, notices };
}
let WS; try { WS = clean(JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch { WS = { boards: [], notices: [] }; }
function saveWs() { const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(WS), { mode: 0o600 }); fs.renameSync(t, FILE); }

// Avance de una ficha: si tiene tareas se calcula con ellas (solo las hojas); si no, el valor manual (o null)
const leaves = (ts) => { const p = new Set(ts.map((t) => t.parent)); return ts.filter((t) => !p.has(t.id)); };
const prog = (k) => { const l = leaves(k.tasks); return l.length ? Math.round((100 * l.filter((t) => t.done).length) / l.length) : k.progress; };
function publicBoard(slug) {
  const b = WS.boards.find((x) => x.slug === slug && x.public);
  if (!b) return null;
  const cards = b.cards.filter((k) => k.vis !== 'hidden').map((k) => (k.vis === 'private'      // privada: solo existe su avance
    ? { id: k.id, col: k.col, vis: 'private', title: '', desc: '', progress: prog(k) }
    : { id: k.id, col: k.col, vis: 'public', title: k.title, desc: k.desc, progress: prog(k), tasks: k.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done, parent: t.parent })) }));
  const cols = b.cols.map((c) => { const p = cards.filter((k) => k.col === c.id && k.progress !== null).map((k) => k.progress); return { ...c, progress: p.length ? Math.round(p.reduce((a, n) => a + n, 0) / p.length) : null }; });
  return { id: b.id, slug: b.slug, name: b.name, emoji: b.emoji, color: b.color, cols, cards };
}
const publicHome = () => ({ name: NAME, desc: DESC, boards: WS.boards.filter((b) => b.public).map((b) => ({ slug: b.slug, name: b.name, emoji: b.emoji, color: b.color, count: b.cards.filter((k) => k.vis !== 'hidden').length })), notices: WS.notices });

/* ---------- HTTP ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const CSP = "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'";
const H = (x = {}) => ({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': CSP, ...x });
const json = (res, st, o, x = {}) => { res.writeHead(st, H({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...x })); res.end(JSON.stringify(o)); };
const ipOf = (req) => (process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress;
const cookie = (req, on) => `session=${on ? makeToken() : ''}; HttpOnly; SameSite=Strict; Path=${BASE || '/'}; Max-Age=${on ? 14 * 86400 : 0}` + (req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '');
const body = (req) => new Promise((ok, no) => {
  let n = 0; const c = [];
  req.on('data', (d) => { n += d.length; if (n > 1e6) { no(fail(413, 'Demasiado grande')); req.destroy(); } else c.push(d); });
  req.on('end', () => { try { ok(c.length ? JSON.parse(Buffer.concat(c)) : {}); } catch { no(fail(400, 'JSON no válido')); } });
});
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(req, res, seg, ip) {
  const m = req.method;
  if (m !== 'GET' && !String(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, 'Se espera JSON');
  if (m === 'GET' && seg[0] === 'public') {                                       // lo privado ya viene redactado
    if (!seg[1]) return json(res, 200, publicHome());
    const b = publicBoard(seg[1]); if (!b) throw fail(404, 'Tablero no encontrado');
    return json(res, 200, { name: NAME, board: b });
  }
  if (m === 'GET' && seg[0] === 'me') return json(res, 200, { auth: authed(req), configured: PASSWORD.length >= 8 });
  if (m === 'POST' && seg[0] === 'login') {
    limit('login', ip, 10, 9e5);
    if (PASSWORD.length < 8) throw fail(503, 'Falta definir PASSWORD en la configuración (mínimo 8 caracteres).');
    const b = await body(req);
    if (!same(hmac('pw:' + String(b.password || '').slice(0, 200)), hmac('pw:' + PASSWORD))) throw fail(401, 'Contraseña incorrecta');
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, true) });
  }
  if (m === 'POST' && seg[0] === 'logout') return json(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, false) });
  if (!authed(req)) throw fail(401, 'Inicia sesión');
  if (seg[0] === 'workspace' && m === 'GET') return json(res, 200, WS);
  if (seg[0] === 'workspace' && m === 'PUT') {
    const prev = new Map(); WS.boards.forEach((b) => b.cards.forEach((k) => k.tasks.forEach((t) => (t.log || []).forEach((e) => prev.set(e.id, e)))));
    const w = clean(await body(req)), now = new Date().toISOString();           // el registro es como un commit: lo ya guardado no se edita y la hora la pone el servidor
    if (!/[?&]import=1\b/.test(req.url)) w.boards.forEach((b) => b.cards.forEach((k) => k.tasks.forEach((t) => { t.log = t.log.map((e) => prev.get(e.id) || { ...e, at: now }); })));   // al importar un respaldo se respetan sus fechas
    WS = w; saveWs();
    return json(res, 200, WS);
  }
  throw fail(404, 'No existe');
}

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (BASE) { if (p === BASE) { res.writeHead(301, { Location: BASE + '/' }); return res.end(); } if (!p.startsWith(BASE + '/')) throw fail(404, 'No existe'); p = p.slice(BASE.length); }
    const seg = p.split('/').filter(Boolean);
    if (seg[0] === 'api') return await api(req, res, seg.slice(1), ipOf(req));
    const page = (f, st = 200) => {                                              // las páginas llevan el nombre y la ruta base ya puestos
      const t = fs.readFileSync(path.join(PUB, f), 'utf8').replace(/\{\{(NAME|DESC|BASE)\}\}/g, (_, k) => esc({ NAME, DESC, BASE: BASE + '/' }[k]));
      res.writeHead(st, H({ 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' })); res.end(t);
    };
    if (!seg.length) return page('public.html');
    if (seg.length === 1 && seg[0] === 'edit') return page('edit.html');          // el editor (la API exige sesión)
    const f = path.join(PUB, p);                                                  // archivos estáticos (css, js, tipografía)
    if (f.startsWith(PUB + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile() && MIME[path.extname(f)] && path.extname(f) !== '.html') {
      let b = fs.readFileSync(f); const etag = '"' + crypto.createHash('md5').update(b).digest('hex') + '"';
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, H({ ETag: etag, 'Cache-Control': 'no-cache' })); return res.end(); }
      const hd = { 'Content-Type': MIME[path.extname(f)], 'Cache-Control': 'no-cache', ETag: etag, Vary: 'Accept-Encoding' };
      if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && /\.(js|css|svg)$/.test(f)) { b = zlib.gzipSync(b); hd['Content-Encoding'] = 'gzip'; }
      res.writeHead(200, H(hd)); return res.end(b);
    }
    if (seg.length === 1) return page('public.html', publicBoard(seg[0]) ? 200 : 404);   // /BASE/<tablero>
    throw fail(404, 'No existe');
  } catch (e) {
    if (!e.status) console.error(e);
    const st = e.status || 500;
    if (req.url.includes('/api/')) return json(res, st, { error: e.status ? e.message : 'Error interno' });
    res.writeHead(st, H({ 'Content-Type': 'text/plain; charset=utf-8' })); res.end(e.status ? e.message : 'Error interno');
  }
});
if (require.main === module) {
  if (PASSWORD.length < 8) console.warn('AVISO: define PASSWORD (8+ caracteres) o no podrás entrar a /edit.');
  server.listen(PORT, HOST, () => console.log(`${NAME} en http://${HOST}:${PORT}${BASE}/  ·  editor en ${BASE}/edit  ·  datos en ${DATA}`));
}
module.exports = server;
