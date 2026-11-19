// Etiquetas, filtros y vista de tabla. Lo usan el editor (/app) y las páginas públicas.
//
// Modelo (ver src/workspace.js):
//   grupo    { id, name, single, pop, boardIds[], tags: [{ id, name, color }] }
//   ficha    { …, tagIds: ['id de etiqueta', …] }
// Un grupo sin boardIds vale para todos los tableros.
import { t } from './i18n.js';
import { formatDue, isLate } from './cardinfo.js';
import { h, plain, verbatim } from './ui.js';

/* ── Consultas ──────────────────────────────────────────────────────────── */

export const groupsForBoard = (groups, boardId) => (groups || []).filter((g) => !g.boardIds || !g.boardIds.length || g.boardIds.includes(boardId));

export function tagIndex(groups) {
  const index = new Map();
  for (const group of groups) for (const tag of group.tags) index.set(tag.id, { tag, group });
  return index;
}

/** Etiquetas de la ficha en el orden de los grupos */
export const tagsOfCard = (card, index) => (card.tagIds || []).map((id) => index.get(id)).filter(Boolean).map((x) => x.tag);

/* ── Píldora de color ───────────────────────────────────────────────────── */

export const tagPill = (tag) => h('span', { class: 'tag-pill', style: `--tc:${tag.color}` }, verbatim(tag.name));

export function pillRow(tags) {
  return tags.length ? h('div', { class: 'pills' }, tags.map(tagPill)) : null;
}

/* ── Filtro ─────────────────────────────────────────────────────────────── */
// Dentro de un grupo suma (O): "YCH" o "Doodle". Entre grupos acota (Y): "Pagado" y "YCH". Más una búsqueda por texto.

export const newFilter = () => ({ query: '', picked: new Map() }); // picked: id de grupo → Set de ids de etiqueta

export const filterActive = (filter) => !!filter.query.trim() || [...filter.picked.values()].some((set) => set.size);

export function matchesFilter(card, filter) {
  const query = filter.query.trim().toLowerCase();
  if (query && !`${card.title || ''} ${card.desc || ''}`.toLowerCase().includes(query)) return false;
  for (const [groupId, picked] of filter.picked) {
    if (!picked.size) continue;
    const hasOne = (card.tagIds || []).some((id) => picked.has(id));
    if (!hasOne) return false;
  }
  return true;
}

// Quita del filtro etiquetas que ya no existen
export function cleanFilter(filter, groups) {
  const alive = new Set(groups.flatMap((g) => g.tags.map((x) => x.id)));
  for (const picked of filter.picked.values()) for (const id of [...picked]) if (!alive.has(id)) picked.delete(id);
}

/**
 * Barra de filtros: buscador + una fila de etiquetas por grupo. `onChange` se llama al cambiar algo.
 * `extra` son botones que van al final de la primera fila (vista, etiquetas…).
 */
export function filterBar({ groups, filter, onChange, extra = [] }) {
  const search = h('input', {
    type: 'search',
    class: 'tb-search',
    value: filter.query,
    placeholder: 'Buscar…',
    'aria-label': 'Buscar',
    oninput: (e) => {
      filter.query = e.target.value;
      onChange({ keepFocus: true });
    },
  });
  const clear = filterActive(filter)
    ? h('button', {
        class: 'btn sm',
        type: 'button',
        text: 'Limpiar filtros',
        onclick: () => {
          filter.query = '';
          filter.picked.clear();
          onChange();
        },
      })
    : null;

  const rows = groups
    .filter((g) => g.tags.length)
    .map((g) => {
      const picked = filter.picked.get(g.id) || new Set();
      return h(
        'div',
        { class: 'fg' },
        h('span', { class: 'fg-name' }, verbatim(g.name)),
        g.tags.map((tag) =>
          h(
            'button',
            {
              type: 'button',
              class: 'tag-pill chip' + (picked.has(tag.id) ? ' on' : ''),
              style: `--tc:${tag.color}`,
              'aria-pressed': picked.has(tag.id) ? 'true' : 'false',
              onclick: () => {
                if (picked.has(tag.id)) picked.delete(tag.id);
                else picked.add(tag.id);
                filter.picked.set(g.id, picked);
                onChange();
              },
            },
            verbatim(tag.name),
          ),
        ),
      );
    });

  const el = h('div', { class: 'toolbar' }, h('div', { class: 'tb-top' }, search, ...extra, clear), ...rows);
  return { el, search };
}

/* ── Vista de tabla ─────────────────────────────────────────────────────── */

const PROGRESS = (value) => (value === null || value === undefined ? '' : value + '%');

/**
 * Tabla de fichas. `cards` ya vienen filtradas. `onOpen(card)` (opcional) abre la ficha al hacer clic.
 * `titleOf(card)` da el texto del título; `showVisibility` añade la columna "Quién la ve" (solo editor).
 */
export function tableView({ board, cards, groups, onOpen, titleOf, progressOf, showVisibility }) {
  const index = tagIndex(groups);
  const columns = new Map(board.cols.map((c, i) => [c.id, { name: c.name, order: i }]));
  const rows = cards.slice().sort((a, b) => (columns.get(a.col)?.order ?? 0) - (columns.get(b.col)?.order ?? 0));

  // Cliente y Entrega solo salen si alguna ficha de la lista los tiene
  const hasClient = rows.some((c) => c.client);
  const hasDue = rows.some((c) => c.due);
  const head = h(
    'tr',
    null,
    h('th', { text: 'Ficha' }),
    hasClient ? h('th', { text: 'Cliente' }) : null,
    h('th', { text: 'Columna' }),
    h('th', { text: 'Etiquetas' }),
    hasDue ? h('th', { text: 'Entrega' }) : null,
    h('th', { text: 'Avance' }),
    showVisibility ? h('th', { text: 'Quién la ve' }) : null,
  );
  const body = rows.map((card) => {
    const open = onOpen ? () => onOpen(card) : null;
    return h(
      'tr',
      open ? { class: 'click', tabindex: 0, onclick: open, onkeydown: (e) => e.key === 'Enter' && open() } : {},
      h('td', { class: 'ttl' }, plain(titleOf(card))),
      hasClient ? h('td', { class: 'muted' }, verbatim(card.client || '')) : null,
      h('td', { class: 'muted' }, plain(columns.get(card.col)?.name || '')),
      h('td', null, pillRow(tagsOfCard(card, index))),
      hasDue ? h('td', { class: isLate(card, progressOf(card)) ? 'late' : 'muted' }, verbatim(card.due ? formatDue(card.due) : '')) : null,
      h('td', { class: 'muted' }, plain(PROGRESS(progressOf(card)))),
      showVisibility ? h('td', { class: 'muted', text: { public: 'Pública', private: 'Privada', hidden: 'Oculta' }[card.vis] }) : null,
    );
  });

  if (!rows.length) return h('div', { class: 'empty', text: 'No hay fichas con estos filtros.' });
  return h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, head), h('tbody', null, body)));
}

/* ── Vista elegida (tablero o tabla): se recuerda en este navegador ─────── */

const VIEW_KEY = 'cm_view';
export function loadView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'board';
  } catch {
    return 'board';
  }
}
export function saveView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {}
}

/** Botones "Tablero | Tabla" */
export function viewSwitch(view, onPick) {
  return h(
    'div',
    { class: 'seg', role: 'group', 'aria-label': t('Vista') },
    [
      ['board', 'Tablero'],
      ['table', 'Tabla'],
    ].map(([value, label]) =>
      h('button', { type: 'button', class: 'seg-btn' + (view === value ? ' on' : ''), 'aria-pressed': view === value ? 'true' : 'false', onclick: () => view !== value && onPick(value), text: label }),
    ),
  );
}

/** Para volver a poner el cursor en el buscador tras redibujar */
export function restoreSearchFocus(root) {
  const input = root.querySelector('.tb-search');
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

/* ── Limpieza (misma regla que cleanCardTags de src/workspace.js) ───────── */
// Tras borrar una etiqueta o cambiar los tableros de un grupo, las fichas dejan de apuntar a lo que ya no vale
export function pruneCardTags(ws) {
  for (const board of ws.boards) {
    const tagGroup = new Map();
    for (const g of groupsForBoard(ws.groups, board.id)) for (const tag of g.tags) tagGroup.set(tag.id, g);
    for (const card of board.cards) {
      const singles = new Set();
      card.tagIds = (card.tagIds || []).filter((id) => {
        const g = tagGroup.get(id);
        if (!g) return false;
        if (!g.single) return true;
        if (singles.has(g.id)) return false;
        singles.add(g.id);
        return true;
      });
    }
  }
}
