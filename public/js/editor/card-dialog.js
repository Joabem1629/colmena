// Diálogo para editar una ficha: título, descripción, visibilidad, tareas con subtareas y su registro, notas.
import { LANG, t } from '../i18n.js';
import { icon } from '../icons.js';
import { h, plain, verbatim } from '../ui.js';
import { calendarUrl } from '../cardinfo.js';
import { groupsForBoard } from '../tags.js';
import { cardProgress, currentBoard, newId, render, save, state } from './store.js';
import { openTagManager } from './tag-manager.js';

const VISIBILITY_OPTIONS = [
  ['public', 'Pública: se ve todo'],
  ['private', 'Privada: solo se ve 🔒 y su avance'],
  ['hidden', 'Oculta: solo tú'],
];
const INDENT = 22; // píxeles de sangría por nivel de subtarea (máximo 8 niveles)

const option = (value, label, selected) => {
  const el = h('option', { value }, label);
  el.selected = selected;
  return el;
};

export function openCardDialog(card) {
  const board = currentBoard();
  const overlay = h('div', { class: 'ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Editar ficha', onclick: (e) => e.target === overlay && close() });
  const onKey = (e) => e.key === 'Escape' && close();
  const taskBox = h('div');

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    render();
  }
  document.addEventListener('keydown', onKey);

  /* ── Avance: manual si no hay tareas; si las hay, se calcula con ellas ── */
  const progressLabel = h('label');
  const progressInput = h('input', {
    type: 'number',
    min: 0,
    max: 100,
    value: card.progress === null ? '' : card.progress,
    placeholder: 'sin avance',
    oninput: (e) => {
      card.progress = e.target.value === '' ? null : Math.min(100, Math.max(0, +e.target.value));
      save();
    },
  });

  /* ── Cliente, entrega, enlace y portada ── */
  const calendarLink = h('a', { class: 'small', target: '_blank', rel: 'noopener noreferrer', text: '📅 Añadir a Google Calendar' });
  const syncCalendarLink = () => {
    const url = calendarUrl(card);
    calendarLink.hidden = !url;
    if (url) calendarLink.href = url;
  };
  const textField = (label, key, attrs) =>
    h(
      'label',
      null,
      label,
      h('input', {
        ...attrs,
        value: card[key] || '',
        oninput: (e) => {
          card[key] = e.target.value;
          if (key === 'due') syncCalendarLink();
          save();
        },
      }),
    );

  /* ── Etiquetas: una fila por grupo; tocar una etiqueta la pone o la quita ── */
  const tagBox = h('div', { class: 'tagbox' });

  function toggleTag(group, tag) {
    card.tagIds ||= [];
    if (card.tagIds.includes(tag.id)) card.tagIds = card.tagIds.filter((id) => id !== tag.id);
    else {
      if (group.single) card.tagIds = card.tagIds.filter((id) => !group.tags.some((x) => x.id === id)); // una por grupo: reemplaza
      card.tagIds.push(tag.id);
    }
    save();
    drawTags();
  }

  function drawTags() {
    const groups = groupsForBoard(state.ws.groups, board.id).filter((g) => g.tags.length);
    const rows = groups.map((group) =>
      h(
        'div',
        { class: 'fg' },
        h('span', { class: 'fg-name' }, verbatim(group.name)),
        group.tags.map((tag) => {
          const on = (card.tagIds || []).includes(tag.id);
          return h('button', { type: 'button', class: 'tag-pill chip' + (on ? ' on' : ''), style: `--tc:${tag.color}`, 'aria-pressed': on ? 'true' : 'false', onclick: () => toggleTag(group, tag) }, verbatim(tag.name));
        }),
      ),
    );
    tagBox.replaceChildren(
      ...(rows.length ? rows : [h('p', { class: 'muted tip', text: 'Todavía no hay etiquetas para este tablero.' })]),
      h('button', { class: 'btn sm', type: 'button', onclick: () => openTagManager(drawTags), text: rows.length ? 'Editar etiquetas' : 'Crear etiquetas' }),
    );
  }

  /* ── Reglas de las tareas ──────────────────────────────────────────────── */
  const childrenOf = (task) => card.tasks.filter((x) => x.parent === task.id);
  const anyDone = (task) => childrenOf(task).some((c) => c.done || anyDone(c));

  // Cada cambio de estado queda en el registro de la tarea, como un commit
  function addLog(task, kind, text) {
    (task.log ||= []).push({ id: Math.random().toString(16).slice(2, 9), at: new Date().toISOString(), kind, text: text || '' });
  }

  // Marcar una tarea marca todo lo que tiene dentro
  function setDone(task, done) {
    if (task.done !== done) {
      task.done = done;
      addLog(task, done ? 'done' : 'open');
    }
    childrenOf(task).forEach((c) => setDone(c, done));
  }

  // Una tarea con subtareas sigue a sus hijos (de abajo hacia arriba)
  function syncParents() {
    for (let i = card.tasks.length - 1; i >= 0; i--) {
      const task = card.tasks[i];
      const kids = childrenOf(task);
      if (!kids.length) continue;
      const done = kids.every((c) => c.done);
      if (task.done !== done) {
        task.done = done;
        addLog(task, done ? 'done' : 'open');
      }
    }
  }

  function removeTask(task) {
    childrenOf(task).forEach(removeTask);
    card.tasks = card.tasks.filter((x) => x !== task);
  }

  const afterChange = () => {
    syncParents();
    save();
    drawTasks();
  };

  /* ── Lista de tareas ───────────────────────────────────────────────────── */
  const openLogs = {}; // tareas con el registro desplegado
  let focusLog = null; // tarea cuyo campo de registro debe recibir el cursor

  function drawTasks() {
    const rows = [];
    (function walk(parent, depth) {
      for (const task of card.tasks.filter((x) => (x.parent || null) === parent)) {
        rows.push(taskRow(task, depth));
        if (openLogs[task.id]) rows.push(logBox(task, depth));
        walk(task.id, depth + 1);
      }
    })(null, 0);
    taskBox.replaceChildren(...rows);

    const hasTasks = card.tasks.length > 0;
    progressInput.disabled = hasTasks;
    progressLabel.replaceChildren(...(hasTasks ? [t('El avance se calcula con tus tareas ({p}%)', { p: cardProgress(card) })] : [t('Avance manual (0–100)'), progressInput]));
  }

  function taskRow(task, depth) {
    const logCount = (task.log || []).length;
    const checkbox = h('input', {
      type: 'checkbox',
      checked: task.done,
      'aria-label': 'Hecha',
      onchange: (e) => {
        setDone(task, e.target.checked);
        afterChange();
      },
    });
    checkbox.indeterminate = !task.done && anyDone(task); // a medias: algunas subtareas hechas

    return h(
      'div',
      { class: 'tr', style: `margin-left:${Math.min(depth, 8) * INDENT}px` },
      checkbox,
      h('input', {
        type: 'text',
        value: task.title,
        maxlength: 200,
        'aria-label': 'Tarea',
        oninput: (e) => {
          task.title = e.target.value;
          save();
        },
      }),
      h(
        'button',
        {
          class: 'ghost sub',
          type: 'button',
          title: 'Agregar subtarea',
          'aria-label': 'Agregar subtarea',
          onclick: () => {
            card.tasks.push({ id: newId(), title: '', done: false, parent: task.id, log: [] });
            afterChange();
          },
        },
        icon('i:corner-down-right') || '↳',
        h('span', { text: 'Subtarea' }),
      ),
      h(
        'button',
        {
          class: 'ghost',
          type: 'button',
          title: 'Registro de la tarea',
          'aria-label': 'Registro de la tarea',
          onclick: () => {
            openLogs[task.id] = !openLogs[task.id];
            if (openLogs[task.id]) focusLog = task.id;
            drawTasks();
          },
        },
        icon('i:git-commit-horizontal') || '⎇',
        logCount ? String(logCount) : null,
      ),
      h(
        'button',
        {
          class: 'ghost',
          type: 'button',
          title: 'Borrar tarea',
          'aria-label': 'Borrar tarea',
          onclick: () => {
            removeTask(task);
            afterChange();
          },
        },
        icon('i:trash-2') || '×',
      ),
    );
  }

  // Registro de una tarea: mensajes y cambios de estado, el más nuevo arriba
  function logBox(task, depth) {
    const input = h('input', { type: 'text', maxlength: 500, placeholder: 'Mensaje para el registro (como un commit)', 'aria-label': 'Mensaje para el registro (como un commit)' });
    const list = h('div', { class: 'lgl' });
    const entries = (task.log || []).slice().reverse();

    if (!entries.length) list.append(h('div', { class: 'le sys', text: 'Sin registros todavía.' }));
    for (const entry of entries) {
      const isNote = entry.kind === 'note';
      list.append(
        h(
          'div',
          { class: 'le' + (isNote ? '' : ' sys') },
          h('code', null, plain(String(entry.id).slice(0, 7))),
          h('time', null, plain(new Date(entry.at).toLocaleString(LANG, { dateStyle: 'medium', timeStyle: 'short' }))),
          isNote ? plain(entry.text) : t(entry.kind === 'done' ? 'Tarea completada' : 'Tarea reabierta'),
        ),
      );
    }

    const add = () => {
      const text = input.value.trim();
      if (!text) return;
      addLog(task, 'note', text);
      focusLog = task.id;
      save();
      drawTasks();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      add();
    });
    if (focusLog === task.id) {
      focusLog = null;
      setTimeout(() => input.focus(), 0);
    }

    return h('div', { class: 'lg', style: `margin-left:${Math.min(depth, 8) * INDENT + 28}px` }, h('div', { class: 'lgi' }, input, h('button', { class: 'btn sm', type: 'button', onclick: add, text: 'Registrar' })), list);
  }

  /* ── El diálogo ────────────────────────────────────────────────────────── */
  overlay.append(
    h(
      'div',
      { class: 'dlg' },
      h(
        'label',
        null,
        'Título',
        h('input', {
          type: 'text',
          value: card.title,
          maxlength: 200,
          oninput: (e) => {
            card.title = e.target.value;
            save();
          },
        }),
      ),
      h(
        'label',
        null,
        'Descripción (se ve en tu página)',
        h('textarea', {
          maxlength: 2000,
          value: card.desc,
          oninput: (e) => {
            card.desc = e.target.value;
            save();
          },
        }),
      ),
      h('div', { class: 'two' }, textField('Cliente', 'client', { type: 'text', maxlength: 80 }), textField('Fecha de entrega', 'due', { type: 'date' })),
      calendarLink,
      textField('Enlace', 'link', { type: 'url', maxlength: 500, placeholder: 'https://…' }),
      textField('Portada (dirección de una imagen)', 'cover', { type: 'url', maxlength: 500, placeholder: 'https://…/imagen.jpg' }),
      h(
        'label',
        null,
        'Quién la ve',
        h(
          'select',
          {
            onchange: (e) => {
              card.vis = e.target.value;
              save();
            },
          },
          VISIBILITY_OPTIONS.map(([value, label]) => option(value, t(label), card.vis === value)),
        ),
      ),
      h(
        'label',
        null,
        'Mover a',
        h(
          'select',
          {
            onchange: (e) => {
              card.col = e.target.value;
              save();
            },
          },
          board.cols.map((col) => option(col.id, plain(col.name), card.col === col.id)),
        ),
      ),
      h('div', null, h('b', { text: 'Etiquetas' }), tagBox),
      h(
        'div',
        null,
        h('b', { text: 'Tareas' }),
        h('p', { class: 'muted tip', text: 'Marcar una tarea marca también sus subtareas. Cada tarea guarda un registro, como los commits de git.' }),
        taskBox,
        h(
          'button',
          {
            class: 'btn sm',
            onclick: () => {
              card.tasks.push({ id: newId(), title: '', done: false, parent: null, log: [] });
              save();
              drawTasks();
            },
            text: '+ Tarea',
          },
        ),
      ),
      progressLabel,
      h(
        'label',
        null,
        'Notas privadas (nunca salen en tu página)',
        h('textarea', {
          maxlength: 5000,
          value: card.notes,
          oninput: (e) => {
            card.notes = e.target.value;
            save();
          },
        }),
      ),
      h(
        'div',
        { class: 'row' },
        h('button', {
          class: 'btn del',
          onclick: () => {
            if (!confirm(t('¿Borrar esta ficha?'))) return;
            board.cards = board.cards.filter((x) => x !== card);
            save();
            close();
          },
          text: 'Borrar ficha',
        }),
        h('button', { class: 'btn pri', onclick: close, text: 'Listo' }),
      ),
    ),
  );

  syncCalendarLink();
  drawTags();
  drawTasks();
  document.body.appendChild(overlay);
  overlay.querySelector('input')?.focus();
}
