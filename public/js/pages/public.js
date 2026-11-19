// Página pública de solo lectura: la portada (tableros públicos y avisos) y cada tablero (/<tablero>).
import { initChrome } from '../chrome.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { cleanFilter, filterBar, loadView, matchesFilter, newFilter, pillRow, restoreSearchFocus, saveView, tableView, tagIndex, tagsOfCard, viewSwitch } from '../tags.js';
import { cardMeta, coverImage } from '../cardinfo.js';
import { $, api, brandName, h, plain, verbatim } from '../ui.js';

initChrome();

const app = $('app');

// La dirección del tablero: lo que sigue a la raíz del sitio (que puede ser /kanban/)
const rootPath = new URL(document.baseURI).pathname;
const slug = decodeURIComponent(location.pathname.slice(rootPath.length).split('/').filter(Boolean)[0] || '');

// El primer color de columna es el del tablero; las demás siguen la paleta del tema (theme.css)
const COLUMN_ACCENTS = [null, 'var(--pink)', 'var(--teal)', 'var(--amber)', 'var(--sky)'];

/* ── Piezas de una ficha ────────────────────────────────────────────────── */

// Barra de avance; se anima al aparecer
function bar(percent) {
  const fill = h('i');
  const el = h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': percent, 'aria-valuemin': 0, 'aria-valuemax': 100 }, fill);
  requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.width = percent + '%')));
  return el;
}

// Lista de tareas con sus subtareas (sangradas por nivel)
function taskList(tasks) {
  const list = h('ul', { class: 't' });
  (function walk(parent, depth) {
    for (const task of tasks.filter((x) => (x.parent || null) === parent)) {
      list.append(h('li', { class: task.done ? 'd' : '', style: `padding-left:${Math.min(depth, 8) * 18}px` }, icon(task.done ? 'i:square-check' : 'i:square', '1em'), plain(' ' + task.title)));
      walk(task.id, depth + 1);
    }
  })(null, 0);
  return list;
}

function cardView(card, tags) {
  // Ficha privada: solo se ve 🔒, su avance y las etiquetas de grupos marcados como visibles
  if (card.vis === 'private') {
    const el = h('div', { class: 'k lock' }, h('b', { text: '🔒 Privado' }), pillRow(tags));
    if (card.progress !== null) el.append(bar(card.progress), h('div', { class: 'pct', text: card.progress + '%' }));
    return el;
  }

  const el = h('div', { class: 'k' }, coverImage(card), h('b', null, card.title ? plain(card.title) : t('Sin título')), cardMeta(card, card.progress, { clickableLink: true }), pillRow(tags));
  if (card.desc) el.append(h('p', null, plain(card.desc)));
  if (card.progress !== null) el.append(bar(card.progress), h('div', { class: 'pct', text: card.progress + '%' }));
  if (card.tasks && card.tasks.length) {
    const parents = new Set(card.tasks.map((x) => x.parent));
    const leaves = card.tasks.filter((x) => !parents.has(x.id));
    const summary = t('Tareas ({d}/{n})', { d: leaves.filter((x) => x.done).length, n: leaves.length });
    el.append(h('details', null, h('summary', null, plain(summary)), taskList(card.tasks)));
  }
  return el;
}

/* ── Un tablero: filtros, vista de columnas o de tabla ──────────────────── */

function columnsView(board, shownCards, index) {
  if (!board.cols.length) return h('div', { class: 'empty', text: 'Este tablero todavía no tiene columnas.' });

  const columns = h('div', { class: 'cols' });
  board.cols.forEach((col, i) => {
    const cards = shownCards.filter((card) => card.col === col.id);
    const count = cards.length + (col.progress !== null ? ` · ${col.progress}%` : '');
    const section = h('section', { class: 'col', style: `--bc:${COLUMN_ACCENTS[i % 5] || board.color}` }, h('h3', null, plain(col.name), h('span', null, plain(count))));
    if (col.progress !== null) section.append(bar(col.progress));
    cards.forEach((card) => section.append(cardView(card, tagsOfCard(card, index))));
    if (!cards.length) section.append(h('p', { class: 'muted', text: 'Sin fichas por ahora.' }));
    columns.append(section);
  });
  return columns;
}

function tableOf(board, cards, groups) {
  return tableView({
    board,
    cards,
    groups,
    titleOf: (card) => (card.vis === 'private' ? t('🔒 Privado') : card.title || t('Sin título')),
    progressOf: (card) => card.progress,
  });
}

function renderBoard({ name, board }) {
  const groups = board.groups || [];
  const index = tagIndex(groups);
  const filter = newFilter();
  let view = loadView();
  document.title = `${board.name} · ${name}`;

  const page = h(
    'div',
    { style: `--bc:${board.color}` },
    h('p', { class: 'crumb muted' }, h('a', { href: './' }, verbatim(name)), plain(' / ' + board.slug)),
    h('h1', null, icon(board.emoji, '1em'), verbatim((board.emoji ? ' ' : '') + board.name)),
  );
  const body = h('div');
  page.append(body);

  // Se vuelve a dibujar al cambiar el filtro o la vista
  function draw({ keepFocus } = {}) {
    cleanFilter(filter, groups);
    const { el } = filterBar({
      groups,
      filter,
      onChange: draw,
      extra: [
        viewSwitch(view, (next) => {
          view = next;
          saveView(next);
          draw();
        }),
      ],
    });
    const cards = board.cards.filter((card) => matchesFilter(card, filter));
    body.replaceChildren(el, view === 'table' ? tableOf(board, cards, groups) : columnsView(board, cards, index));
    if (keepFocus) restoreSearchFocus(body);
  }
  draw();
  app.replaceChildren(page);
}

/* ── La portada ─────────────────────────────────────────────────────────── */

function renderHome({ name, desc, boards, notices }) {
  const page = h('div', null, h('h1', null, verbatim(name)));
  if (desc) page.append(h('p', { class: 'muted' }, verbatim(desc)));
  page.append(h('p', { class: 'muted' }, plain(t(boards.length === 1 ? '{n} tablero público' : '{n} tableros públicos', { n: boards.length }))));

  const tiles = h('div', { class: 'tiles' });
  for (const board of boards) {
    tiles.append(
      h(
        'a',
        { class: 'tile', href: encodeURIComponent(board.slug), style: `--bc:${board.color}` },
        h('b', null, icon(board.emoji), verbatim((board.emoji ? ' ' : '') + board.name)),
        h('div', { class: 'muted' }, plain(t(board.count === 1 ? '{n} ficha' : '{n} fichas', { n: board.count }))),
      ),
    );
  }
  page.append(boards.length ? tiles : h('div', { class: 'empty mt-18', text: 'Todavía no hay tableros públicos.' }));

  if (notices.length) {
    const list = h('div', { class: 'notices' });
    for (const notice of notices.slice().reverse()) list.append(h('div', { class: 'n ' + notice.kind }, h('small', null, plain(notice.date)), h('div', null, plain(notice.text))));
    page.append(h('h2', { text: 'Avisos' }), list);
  }
  app.replaceChildren(page);
}

function renderMissing(message) {
  document.title = `${t('No encontramos esta página')} · ${brandName()}`;
  app.replaceChildren(
    h('h1', { text: 'No encontramos esta página' }),
    h('p', { class: 'muted' }, plain((message ? t(message) + '. ' : '') + t('Puede que no exista o que sea privada.'))),
    h('a', { class: 'btn pri', href: './', text: 'Ir al inicio' }),
  );
}

/* ── Arranque ───────────────────────────────────────────────────────────── */

async function main() {
  try {
    const data = await api(`public${slug ? '/' + encodeURIComponent(slug) : ''}`);
    if (slug) renderBoard(data);
    else renderHome(data);
  } catch (e) {
    renderMissing(e.message);
  }
}
main();
