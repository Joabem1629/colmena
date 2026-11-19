// Estado del editor y guardado automático. Todos los módulos del editor leen y escriben `state`
// y llaman a save() tras cada cambio; render() vuelve a dibujar la pantalla.
import { t } from '../i18n.js';
import { loadView, newFilter } from '../tags.js';
import { $, api } from '../ui.js';

export const state = {
  ws: null, // el espacio completo: { boards, groups (etiquetas), notices }
  currentId: null, // tablero abierto
  view: loadView(), // 'board' | 'table'
  filter: newFilter(), // filtro de fichas del tablero abierto
};

export const DEFAULT_BOARD_COLOR = '#a78bfa'; // igual que DEFAULT_BOARD_COLOR de src/workspace.js
export const SITE_ROOT = document.baseURI; // raíz del sitio, con el prefijo si lo hay: "https://…/" o "https://…/kanban/"
export const newId = () => Math.random().toString(36).slice(2, 10);

// Una ficha nueva, con todos sus campos
export const newCard = (columnId) => ({ id: newId(), col: columnId, title: '', desc: '', vis: 'public', client: '', due: '', link: '', cover: '', progress: null, tasks: [], notes: '', tagIds: [] });

export function openBoard(id) {
  state.currentId = id;
  state.filter = newFilter(); // cada tablero empieza sin filtros
}
export const currentBoard = () => state.ws.boards.find((b) => b.id === state.currentId);

/* ── Dibujar ────────────────────────────────────────────────────────────── */
let renderer = () => {};
export const setRenderer = (fn) => (renderer = fn); // lo registra app.js (evita dependencias circulares)
export const render = () => renderer();

/* ── Enlace público y estado ────────────────────────────────────────────── */
export const publicUrl = (board) => SITE_ROOT + (board ? encodeURIComponent(board.slug) : '');

export function updatePublicLink() {
  const board = state.currentId && currentBoard();
  $('pub').href = publicUrl(board);
}

export function setStatus(text, bad) {
  $('st').textContent = t(text);
  $('st').className = bad ? 'bad' : '';
}

/* ── Progreso (misma regla que src/workspace.js) ────────────────────────── */
// El avance de una ficha cuenta solo las tareas sin subtareas
export const leafTasks = (card) => {
  const parents = new Set(card.tasks.map((task) => task.parent).filter(Boolean));
  return card.tasks.filter((task) => !parents.has(task.id));
};

export function cardProgress(card) {
  const leaves = leafTasks(card);
  if (leaves.length) return Math.round((100 * leaves.filter((task) => task.done).length) / leaves.length);
  return card.progress === null || card.progress === '' ? null : +card.progress;
}

/* ── Guardado automático: medio segundo después del último cambio ───────── */
let timer = null;
let sessionLost = () => {};
export const setSessionLostHandler = (fn) => (sessionLost = fn); // lo registra app.js: vuelve a pedir la contraseña

export function save() {
  clearTimeout(timer);
  setStatus('Guardando…');
  timer = setTimeout(() => flush(), 500);
}

/**
 * Envía el espacio al servidor. Devuelve lo que el servidor guardó (ya revisado), o null si falló.
 * `isImport`: al importar un respaldo se respetan las fechas de sus registros.
 */
export async function flush({ isImport = false } = {}) {
  clearTimeout(timer);
  timer = null;
  try {
    const saved = await api(`workspace${isImport ? '?import=1' : ''}`, { method: 'PUT', body: state.ws });
    // El servidor puede ajustar la dirección (slug) de un tablero: se copia de vuelta
    for (const board of saved.boards) {
      const mine = state.ws.boards.find((b) => b.id === board.id);
      if (mine) mine.slug = board.slug;
    }
    setStatus('Guardado ✓');
    updatePublicLink();
    return saved;
  } catch (e) {
    if (e.status === 401) sessionLost();
    else setStatus('Error: ' + t(e.message), true);
    return null;
  }
}

// Hay cambios sin guardar → guardarlos ahora (al cambiar de idioma)
export const flushIfPending = () => (timer ? flush() : null);

// Al cerrar la pestaña: último intento de guardar lo pendiente
export function flushOnLeave() {
  if (!timer || !state.ws) return;
  clearTimeout(timer);
  timer = null;
  api('workspace', { method: 'PUT', body: state.ws, keepalive: true }).catch(() => {});
}
