// Pantalla principal del editor: pestañas de tableros, cabecera del tablero, filtros, columnas y fichas.
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { $, h, plain, verbatim } from '../ui.js';
import { openCardDialog } from './card-dialog.js';
import { openIconPicker } from './icon-picker.js';
import { noticesSection } from './notices.js';
import { DEFAULT_BOARD_COLOR, cardProgress, currentBoard, leafTasks, newCard, newId, openBoard, publicUrl, render, save, setStatus, state, updatePublicLink } from './store.js';
import { openTagManager } from './tag-manager.js';
import { cardMeta, coverImage } from '../cardinfo.js';
import { cleanFilter, filterBar, groupsForBoard, matchesFilter, pillRow, restoreSearchFocus, saveView, tableView, tagIndex, tagsOfCard, viewSwitch } from '../tags.js';

// El primer color de columna es el del tablero; las demás siguen la paleta del tema (theme.css)
const COLUMN_ACCENTS = [null, 'var(--pink)', 'var(--teal)', 'var(--amber)', 'var(--sky)'];
const FIRST_COLUMNS = ['Siguiente', 'En curso', 'Terminado'];
const VISIBILITY_MARK = { private: '🔒 ', hidden: '🙈 ' };

let dragging = null; // ficha que se está arrastrando

/* ── Pantalla completa ──────────────────────────────────────────────────── */
export function renderEditor() {
  const board = currentBoard();
  const parts = [tabs()];
  if (board) parts.push(boardHeader(board), toolbar(board), state.view === 'table' ? tableSection(board) : columns(board));
  else parts.push(emptyState());
  parts.push(noticesSection());
  $('app').replaceChildren(...parts);
  updatePublicLink();
}

function tabs() {
  const row = h('div', { class: 'tabs' });
  for (const board of state.ws.boards) {
    const onclick = () => {
      openBoard(board.id);
      render();
    };
    row.append(h('button', { class: 'tab' + (board.id === state.currentId ? ' on' : ''), onclick }, icon(board.emoji), verbatim((board.emoji ? ' ' : '') + board.name)));
  }
  row.append(h('button', { class: 'btn sm', onclick: newBoard, text: '+ Tablero' }));
  return row;
}

function emptyState() {
  return h(
    'div',
    { class: 'empty' },
    h('b', { text: 'Crea tu primer tablero' }),
    h('p', { text: 'Tendrá tres columnas listas (Siguiente, En curso, Terminado). Podrás cambiarlas.' }),
    h('button', { class: 'btn pri', onclick: newBoard, text: '+ Crear tablero' }),
  );
}

function newBoard() {
  const board = {
    id: newId(),
    name: t('Nuevo tablero'),
    emoji: '',
    color: DEFAULT_BOARD_COLOR,
    public: true,
    auto: true, // mientras sea true, la dirección sigue al nombre
    slug: '',
    cols: FIRST_COLUMNS.map((name) => ({ id: newId(), name: t(name) })),
    cards: [],
  };
  state.ws.boards.push(board);
  openBoard(board.id);
  save();
  render();
}

/* ── Cabecera del tablero: icono, nombre, color, público, dirección ─────── */
function boardHeader(board) {
  return h(
    'div',
    { class: 'bh' },
    h('button', { class: 'emo btn sm', type: 'button', title: 'Icono', 'aria-label': 'Icono', onclick: () => openIconPicker(board) }, icon(board.emoji, '1.4em') || '＋'),
    h('input', {
      class: 'name',
      value: board.name,
      maxlength: 80,
      'aria-label': 'Nombre del tablero',
      oninput: (e) => {
        board.name = e.target.value;
        if (board.auto) board.slug = '';
        save();
      },
      onchange: render,
    }),
    h('input', {
      type: 'color',
      value: board.color,
      'aria-label': 'Color',
      oninput: (e) => {
        board.color = e.target.value;
        save();
      },
      onchange: render,
    }),
    h(
      'label',
      null,
      h('input', {
        type: 'checkbox',
        checked: board.public,
        onchange: (e) => {
          board.public = e.target.checked;
          save();
        },
      }),
      'Público',
    ),
    h(
      'label',
      null,
      'Dirección',
      h('input', {
        value: board.slug,
        maxlength: 40,
        placeholder: 'se genera sola',
        'aria-label': 'Dirección',
        onchange: (e) => {
          board.slug = e.target.value;
          board.auto = false;
          save();
        },
      }),
    ),
    h('button', { class: 'btn sm', onclick: () => copyLink(board), text: 'Copiar enlace' }),
    h('button', { class: 'btn sm del', onclick: () => deleteBoard(board), text: 'Borrar' }),
  );
}

function copyLink(board) {
  navigator.clipboard?.writeText(publicUrl(board)).then(() => setStatus('Enlace copiado ✓'));
}

function deleteBoard(board) {
  if (!confirm(t('¿Borrar este tablero y todas sus fichas?'))) return;
  state.ws.boards = state.ws.boards.filter((b) => b !== board);
  for (const group of state.ws.groups) group.boardIds = group.boardIds.filter((id) => id !== board.id);
  openBoard(state.ws.boards.length ? state.ws.boards[0].id : null);
  save();
  render();
}

/* ── Barra de filtros, vista y etiquetas ────────────────────────────────── */
function toolbar(board) {
  const groups = groupsForBoard(state.ws.groups, board.id);
  cleanFilter(state.filter, groups);
  const { el } = filterBar({
    groups,
    filter: state.filter,
    onChange: ({ keepFocus } = {}) => {
      render();
      if (keepFocus) restoreSearchFocus($('app'));
    },
    extra: [
      viewSwitch(state.view, (view) => {
        state.view = view;
        saveView(view);
        render();
      }),
      h('button', { class: 'btn sm', type: 'button', onclick: () => openTagManager(render), text: '🏷 Etiquetas' }),
    ],
  });
  return el;
}

const visibleCards = (board) => board.cards.filter((card) => matchesFilter(card, state.filter));

function tableSection(board) {
  return tableView({
    board,
    cards: visibleCards(board),
    groups: groupsForBoard(state.ws.groups, board.id),
    onOpen: openCardDialog,
    titleOf: (card) => (VISIBILITY_MARK[card.vis] || '') + (card.title || t('Sin título')),
    progressOf: cardProgress,
    showVisibility: true,
  });
}

/* ── Columnas y fichas ──────────────────────────────────────────────────── */
function bar(percent) {
  return h('div', { class: 'bar' }, h('i', { style: `width:${percent || 0}%` }));
}

function columns(board) {
  const wrap = h('div', { class: 'cols', style: `--bc:${board.color}` });
  board.cols.forEach((col, i) => wrap.append(columnView(board, col, i)));
  wrap.append(
    h('button', {
      class: 'btn sm no-grow',
      onclick: () => {
        board.cols.push({ id: newId(), name: t('Nueva columna') });
        save();
        render();
      },
      text: '+ Columna',
    }),
  );
  return wrap;
}

function columnView(board, col, index) {
  const cards = visibleCards(board).filter((card) => card.col === col.id);
  const values = cards.map(cardProgress).filter((p) => p !== null);
  const average = values.length ? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length) : null;

  const section = h(
    'section',
    {
      class: 'col',
      style: `--bc:${COLUMN_ACCENTS[index % 5] || board.color}`,
      ondragover: (e) => {
        if (!dragging) return;
        e.preventDefault();
        section.classList.add('over');
      },
      ondragleave: () => section.classList.remove('over'),
      ondrop: (e) => {
        e.preventDefault();
        moveCard(board, col.id, null);
      },
    },
    h(
      'div',
      { class: 'ch' },
      h('input', {
        value: col.name,
        maxlength: 60,
        'aria-label': 'Nombre de la columna',
        oninput: (e) => {
          col.name = e.target.value;
          save();
        },
      }),
      h('small', { class: 'muted', text: cards.length + (average !== null ? ` · ${average}%` : '') }),
      h('button', { class: 'ghost', title: 'Borrar columna', 'aria-label': 'Borrar columna', onclick: () => deleteColumn(board, col), text: '×' }),
    ),
  );

  if (average !== null) section.append(bar(average));
  const tagsIndex = tagIndex(groupsForBoard(state.ws.groups, board.id));
  cards.forEach((card) => section.append(cardView(board, col, card, tagsIndex)));
  section.append(
    h('button', {
      class: 'btn sm add',
      onclick: () => {
        const card = newCard(col.id);
        board.cards.push(card);
        save();
        openCardDialog(card);
      },
      text: '+ Ficha',
    }),
  );
  return section;
}

function deleteColumn(board, col) {
  if (board.cols.length < 2) return setStatus('Deja al menos una columna', true);
  if (!confirm(t('¿Borrar la columna y sus fichas?'))) return;
  board.cards = board.cards.filter((card) => card.col !== col.id);
  board.cols = board.cols.filter((c) => c !== col);
  save();
  render();
}

function cardView(board, col, card, tagsIndex) {
  const percent = cardProgress(card);
  const leaves = leafTasks(card);
  const details =
    percent === null
      ? null
      : h('small', { text: percent + '%' + (card.tasks.length ? ' · ' + t('{d}/{n} tareas', { d: leaves.filter((x) => x.done).length, n: leaves.length }) : '') });

  return h(
    'div',
    {
      class: 'k',
      draggable: true,
      tabindex: 0,
      ondragstart: (e) => {
        dragging = card;
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', card.id);
        } catch {}
      },
      ondragend: () => {
        dragging = null;
        render();
      },
      ondragover: (e) => {
        if (!dragging) return;
        e.preventDefault();
        e.stopPropagation();
      },
      ondrop: (e) => {
        e.preventDefault();
        e.stopPropagation();
        moveCard(board, col.id, card);
      },
      onclick: () => openCardDialog(card),
      onkeydown: (e) => e.key === 'Enter' && openCardDialog(card),
    },
    coverImage(card),
    h('b', null, plain((VISIBILITY_MARK[card.vis] || '') + (card.title || t('Sin título')))),
    cardMeta(card, percent),
    pillRow(tagsOfCard(card, tagsIndex)),
    percent !== null ? bar(percent) : null,
    details,
  );
}

// Suelta la ficha arrastrada en la columna `columnId`, justo antes de `before` (o al final)
function moveCard(board, columnId, before) {
  if (!dragging) return;
  const card = dragging;
  dragging = null;
  if (card === before) return render();
  board.cards = board.cards.filter((x) => x !== card);
  card.col = columnId;
  const index = before ? board.cards.indexOf(before) : -1;
  if (index < 0) board.cards.push(card);
  else board.cards.splice(index, 0, card);
  save();
  render();
}
