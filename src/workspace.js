'use strict';
// El espacio del dueño: tableros → columnas y fichas → tareas (anidadas) con su registro, más grupos
// de etiquetas y avisos. Vive en un solo archivo (data/kanban.json) que se escribe de forma atómica.
// El navegador NO es de fiar: todo lo que llega se revisa y se recorta aquí antes de guardarse.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./config');
const { cleanIcon } = require('./icons');

const RESERVED_SLUGS = ['edit', 'api']; // rutas del sistema: ningún tablero puede llamarse así
const DEFAULT_BOARD_COLOR = '#a78bfa';
const DEFAULT_TAG_COLOR = '#9aa0b4';
const CARD_VISIBILITY = ['public', 'private', 'hidden'];
const LOG_KINDS = ['note', 'done', 'open'];
const NOTICE_KINDS = ['update', 'personal', 'work', 'vacation'];

const LIMITS = { boards: 50, columns: 20, cards: 500, tasks: 500, log: 300, groups: 50, tagsPerGroup: 60, tagsPerCard: 40, notices: 100 };

/* ── Utilidades de limpieza ─────────────────────────────────────────────── */

const text = (value, max) => String(value ?? '').slice(0, max);
const isObject = (x) => x !== null && typeof x === 'object';
const list = (value, max) => (Array.isArray(value) ? value.slice(0, max).filter(isObject) : []);
const newId = () => crypto.randomBytes(5).toString('hex');
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const isColor = (value) => /^#[0-9a-f]{6}$/i.test(value);

// Dirección web: solo http/https (nunca javascript:, data:…). `httpsOnly` para imágenes (la política de seguridad solo carga https).
function cleanUrl(value, httpsOnly) {
  const raw = text(value, 500).trim();
  try {
    const protocol = new URL(raw).protocol;
    return protocol === 'https:' || (!httpsOnly && protocol === 'http:') ? raw : '';
  } catch {
    return '';
  }
}

// Fecha AAAA-MM-DD real (2026-02-31 no vale)
const cleanDate = (value) => {
  const raw = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && new Date(raw + 'T00:00:00Z').toISOString().slice(0, 10) === raw ? raw : '';
};

// "Retrato VTuber" → "retrato-vtuber" (sin tildes, solo a-z, 0-9 y guiones)
const slugify = (s) =>
  text(s, 40)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Cada identificador es único en todo el espacio: si falta, es inválido o está repetido, se crea otro
function idFactory() {
  const used = new Set();
  return (candidate) => {
    const valid = typeof candidate === 'string' && /^[\w-]{1,40}$/.test(candidate);
    let id = valid ? candidate : newId();
    while (used.has(id)) id = newId();
    used.add(id);
    return id;
  };
}

/* ── Tareas, fichas y tableros ──────────────────────────────────────────── */

function cleanTasks(rawTasks, id) {
  const known = new Set(); // un padre siempre va antes que sus hijos; sin límite de niveles
  const tasks = list(rawTasks, LIMITS.tasks).map((t) => {
    const log = list(t.log, LIMITS.log).map((e) => ({
      id: id(e.id),
      at: text(e.at, 30),
      kind: oneOf(e.kind, LOG_KINDS, 'note'),
      text: text(e.text, 500),
    }));
    const task = { id: id(t.id), title: text(t.title, 200), done: !!t.done, parent: known.has(t.parent) ? t.parent : null, log };
    known.add(task.id);
    return task;
  });

  // Una tarea con subtareas está hecha solo si todas las suyas lo están (de los hijos hacia arriba)
  const children = new Map();
  for (const task of tasks) {
    if (!task.parent) continue;
    if (!children.has(task.parent)) children.set(task.parent, []);
    children.get(task.parent).push(task);
  }
  for (let i = tasks.length - 1; i >= 0; i--) {
    const kids = children.get(tasks[i].id);
    if (kids) tasks[i].done = kids.every((kid) => kid.done);
  }
  return tasks;
}

function cleanCard(raw, id, columnIds, firstColumnId) {
  const tasks = cleanTasks(raw.tasks, id);
  const hasManualProgress = raw.progress !== null && raw.progress !== '' && Number.isFinite(+raw.progress);
  return {
    id: id(raw.id),
    col: columnIds.has(raw.col) ? raw.col : firstColumnId,
    title: text(raw.title, 200),
    desc: text(raw.desc, 2000),
    vis: oneOf(raw.vis, CARD_VISIBILITY, 'public'),
    client: text(raw.client, 80),
    due: cleanDate(raw.due), // fecha de entrega
    link: cleanUrl(raw.link),
    cover: cleanUrl(raw.cover, true), // imagen de portada
    progress: hasManualProgress ? Math.min(100, Math.max(0, Math.round(+raw.progress))) : null,
    tasks,
    notes: text(raw.notes, 5000),
    tagIds: Array.isArray(raw.tagIds) ? raw.tagIds.filter((x) => typeof x === 'string').slice(0, LIMITS.tagsPerCard) : [], // se validan en cleanWorkspace
  };
}

function cleanBoard(raw, id, usedSlugs) {
  const boardId = id(raw.id); // primero el tablero: los grupos de etiquetas lo referencian por su id
  let slug = slugify(raw.slug || raw.name) || 'tablero';
  for (let n = 2, base = slug; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
  usedSlugs.add(slug);

  const cols = list(raw.cols, LIMITS.columns).map((c) => ({ id: id(c.id), name: text(c.name, 60) }));
  const columnIds = new Set(cols.map((c) => c.id));
  const firstColumnId = (cols[0] || {}).id || null;
  const cards = list(raw.cards, LIMITS.cards).map((card) => cleanCard(card, id, columnIds, firstColumnId));

  return {
    id: boardId,
    slug,
    name: text(raw.name, 80) || 'Tablero',
    emoji: cleanIcon(raw.emoji), // el icono del tablero (ver src/icons.js)
    color: isColor(raw.color) ? raw.color : DEFAULT_BOARD_COLOR,
    public: raw.public !== false,
    cols,
    cards,
  };
}

/* ── Grupos de etiquetas ────────────────────────────────────────────────── */
// Un grupo (Pago, Tipo, Plataforma…) reúne etiquetas. Sin tableros asignados vale para todos los tableros.
//   single → una sola etiqueta del grupo por ficha · pop → sus etiquetas se ven también en fichas privadas

function cleanGroups(rawGroups, id, boardIds) {
  return list(rawGroups, LIMITS.groups).map((g) => ({
    id: id(g.id),
    name: text(g.name, 40).trim() || 'Grupo',
    single: !!g.single,
    pop: !!g.pop,
    boardIds: [...new Set((Array.isArray(g.boardIds) ? g.boardIds : []).filter((b) => boardIds.has(b)))],
    tags: list(g.tags, LIMITS.tagsPerGroup)
      .filter((t) => text(t.name, 40).trim())
      .map((t) => ({ id: id(t.id), name: text(t.name, 40).trim(), color: isColor(t.color) ? t.color : DEFAULT_TAG_COLOR })),
  }));
}

const appliesTo = (group, boardId) => !group.boardIds.length || group.boardIds.includes(boardId);

// Deja en cada ficha solo etiquetas que existen y valen para su tablero (y una por grupo "single")
function cleanCardTags(boards, groups) {
  for (const board of boards) {
    const groupOfTag = new Map();
    for (const group of groups) if (appliesTo(group, board.id)) for (const tag of group.tags) groupOfTag.set(tag.id, group);
    for (const card of board.cards) {
      const singlesUsed = new Set();
      card.tagIds = [...new Set(card.tagIds)].filter((tagId) => {
        const group = groupOfTag.get(tagId);
        if (!group) return false;
        if (!group.single) return true;
        if (singlesUsed.has(group.id)) return false;
        singlesUsed.add(group.id);
        return true;
      });
    }
  }
}

function cleanWorkspace(raw) {
  const id = idFactory();
  const usedSlugs = new Set(RESERVED_SLUGS);
  const boards = list(raw && raw.boards, LIMITS.boards).map((b) => cleanBoard(b, id, usedSlugs));
  const groups = cleanGroups(raw && raw.groups, id, new Set(boards.map((b) => b.id)));
  const notices = list(raw && raw.notices, LIMITS.notices).map((n) => ({
    id: id(n.id),
    kind: oneOf(n.kind, NOTICE_KINDS, 'update'),
    date: text(n.date, 10),
    text: text(n.text, 500),
  }));
  cleanCardTags(boards, groups);
  return { boards, groups, notices };
}

/* ── Guardado: un solo archivo, escrito de forma atómica ────────────────── */

const FILE = path.join(DATA_DIR, 'kanban.json');

function loadFromDisk() {
  let raw;
  try {
    raw = fs.readFileSync(FILE, 'utf8');
  } catch {
    return cleanWorkspace(null); // todavía no hay archivo: espacio vacío
  }
  try {
    return cleanWorkspace(JSON.parse(raw));
  } catch {
    // Archivo ilegible: se aparta una copia para no perderlo cuando se vuelva a guardar
    fs.writeFileSync(`${FILE}.roto-${Date.now()}`, raw, { mode: 0o600 });
    console.error(`AVISO: ${FILE} no se pudo leer; se guardó una copia aparte y se empieza vacío.`);
    return cleanWorkspace(null);
  }
}

let current = loadFromDisk();

const getWorkspace = () => current;

function saveWorkspace(next) {
  const temp = FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(next), { mode: 0o600 });
  fs.renameSync(temp, FILE);
  current = next;
  return current;
}

// Los registros ya guardados no se editan y la hora la pone el servidor (como un commit).
// Al importar un respaldo se respetan sus fechas.
function stampLogs(previous, next) {
  const saved = new Map();
  for (const b of previous.boards) for (const k of b.cards) for (const t of k.tasks) for (const e of t.log) saved.set(e.id, e);
  const now = new Date().toISOString();
  for (const b of next.boards) for (const k of b.cards) for (const t of k.tasks) t.log = t.log.map((e) => saved.get(e.id) || { ...e, at: now });
  return next;
}

/* ── Lo que ve el público ───────────────────────────────────────────────── */

// El avance de una ficha cuenta solo las tareas sin subtareas
const leafTasks = (tasks) => {
  const parents = new Set(tasks.map((t) => t.parent));
  return tasks.filter((t) => !parents.has(t.id));
};

// Con tareas, el avance se calcula con ellas; sin tareas, vale el número manual (o null)
function cardProgress(card) {
  const leaves = leafTasks(card.tasks);
  return leaves.length ? Math.round((100 * leaves.filter((t) => t.done).length) / leaves.length) : card.progress;
}

// Un tablero público: lo oculto no sale y lo privado solo deja su avance
// (y las etiquetas de los grupos marcados "visible en fichas privadas")
function publicBoard(workspace, slug) {
  const board = workspace.boards.find((b) => b.slug === slug && b.public);
  if (!board) return null;

  const groups = workspace.groups.filter((g) => appliesTo(g, board.id));
  const knownTags = new Set(groups.flatMap((g) => g.tags.map((t) => t.id)));
  const tagsShownOnPrivate = new Set(groups.filter((g) => g.pop).flatMap((g) => g.tags.map((t) => t.id)));
  const shownTags = (card) => card.tagIds.filter((id) => knownTags.has(id) && (card.vis === 'public' || tagsShownOnPrivate.has(id)));

  const cards = board.cards
    .filter((card) => card.vis !== 'hidden')
    .map((card) =>
      card.vis === 'private'
        ? { id: card.id, col: card.col, vis: 'private', title: '', desc: '', progress: cardProgress(card), tagIds: shownTags(card) }
        : {
            id: card.id,
            col: card.col,
            vis: 'public',
            title: card.title,
            desc: card.desc,
            progress: cardProgress(card),
            tagIds: shownTags(card),
            client: card.client,
            due: card.due,
            link: card.link,
            cover: card.cover,
            tasks: card.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done, parent: t.parent })),
          },
    );

  // Las etiquetas que ninguna ficha visible usa no se envían (podrían delatar a un cliente)
  const usedTags = new Set(cards.flatMap((card) => card.tagIds));
  const publicGroups = groups
    .map((g) => ({ id: g.id, name: g.name, single: g.single, tags: g.tags.filter((t) => usedTags.has(t.id)) }))
    .filter((g) => g.tags.length);

  const cols = board.cols.map((col) => {
    const values = cards.filter((card) => card.col === col.id && card.progress !== null).map((card) => card.progress);
    const average = values.length ? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length) : null;
    return { ...col, progress: average };
  });

  return { id: board.id, slug: board.slug, name: board.name, emoji: board.emoji, color: board.color, cols, cards, groups: publicGroups };
}

// Resumen de los tableros públicos (la portada)
const publicBoardList = (workspace) =>
  workspace.boards
    .filter((b) => b.public)
    .map((b) => ({ slug: b.slug, name: b.name, emoji: b.emoji, color: b.color, count: b.cards.filter((k) => k.vis !== 'hidden').length }));

module.exports = { getWorkspace, saveWorkspace, cleanWorkspace, stampLogs, publicBoard, publicBoardList };
