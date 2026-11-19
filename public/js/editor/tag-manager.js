// Gestor de etiquetas: grupos (Pago, Tipo, Plataforma…), sus etiquetas con color y a qué tableros aplican.
import { t } from '../i18n.js';
import { h, verbatim } from '../ui.js';
import { pruneCardTags } from '../tags.js';
import { newId, save, state } from './store.js';

// Colores que se van ofreciendo a las etiquetas nuevas (se pueden cambiar con el selector de color)
const TAG_COLORS = ['#a78bfa', '#f472b6', '#2dd4bf', '#fbbf24', '#38bdf8', '#6fd08c', '#ff8aa8', '#9aa0b4'];

const checkbox = (label, checked, onchange) => h('label', { class: 'inl' }, h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }), label);

/** Abre el gestor. `onClose` se llama al cerrarlo (para redibujar lo que haya detrás). */
export function openTagManager(onClose) {
  const overlay = h('div', { class: 'ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Etiquetas', onclick: (e) => e.target === overlay && close() });
  const box = h('div', { class: 'dlg wide' });
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.stopImmediatePropagation(); // que no cierre también la ficha que hay debajo
    close();
  };
  document.addEventListener('keydown', onKey, true);

  function close() {
    pruneCardTags(state.ws);
    save();
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    onClose?.();
  }

  const groups = state.ws.groups;

  function groupCard(group) {
    const addInput = h('input', { type: 'text', maxlength: 40, placeholder: 'Nueva etiqueta', 'aria-label': 'Nueva etiqueta' });
    const addTag = () => {
      const name = addInput.value.trim();
      if (!name) return;
      group.tags.push({ id: newId(), name, color: TAG_COLORS[group.tags.length % TAG_COLORS.length] });
      save();
      draw(group.id);
    };
    addInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      addTag();
    });

    return h(
      'section',
      { class: 'gcard', 'data-group': group.id },
      h(
        'div',
        { class: 'gh' },
        h('input', {
          type: 'text',
          class: 'gname',
          value: group.name,
          maxlength: 40,
          'aria-label': 'Nombre del grupo',
          oninput: (e) => {
            group.name = e.target.value;
            save();
          },
        }),
        h('button', {
          class: 'btn sm del',
          type: 'button',
          onclick: () => {
            if (!confirm(t('¿Borrar este grupo y sus etiquetas?'))) return;
            groups.splice(groups.indexOf(group), 1);
            pruneCardTags(state.ws);
            save();
            draw();
          },
          text: 'Borrar grupo',
        }),
      ),
      h(
        'div',
        { class: 'gopts' },
        checkbox(t('Una sola etiqueta por ficha'), group.single, (on) => {
          group.single = on;
          save();
        }),
        checkbox(t('Visible en fichas privadas'), group.pop, (on) => {
          group.pop = on;
          save();
        }),
      ),
      h(
        'div',
        { class: 'gscope' },
        h('span', { class: 'muted', text: 'Tableros:' }),
        state.ws.boards.length
          ? state.ws.boards.map((board) =>
              checkbox(verbatim(board.name), group.boardIds.includes(board.id), (on) => {
                group.boardIds = on ? [...group.boardIds, board.id] : group.boardIds.filter((id) => id !== board.id);
                save();
              }),
            )
          : null,
        h('span', { class: 'muted', text: '(sin marcar: todos)' }),
      ),
      h(
        'div',
        { class: 'gtags' },
        group.tags.map((tag) =>
          h(
            'div',
            { class: 'tgr' },
            h('input', {
              type: 'color',
              value: tag.color,
              'aria-label': 'Color',
              oninput: (e) => {
                tag.color = e.target.value;
                save();
              },
            }),
            h('input', {
              type: 'text',
              value: tag.name,
              maxlength: 40,
              'aria-label': 'Nombre de la etiqueta',
              oninput: (e) => {
                tag.name = e.target.value;
                save();
              },
            }),
            h('button', {
              class: 'ghost',
              type: 'button',
              title: 'Borrar etiqueta',
              'aria-label': 'Borrar etiqueta',
              onclick: () => {
                group.tags = group.tags.filter((x) => x !== tag);
                pruneCardTags(state.ws);
                save();
                draw(group.id);
              },
              text: '×',
            }),
          ),
        ),
        h('div', { class: 'tgr' }, addInput, h('button', { class: 'btn sm', type: 'button', onclick: addTag, text: '+ Etiqueta' })),
      ),
    );
  }

  // `focusGroup`: el grupo donde sigue el cursor (campo "nueva etiqueta") tras redibujar
  function draw(focusGroup) {
    box.replaceChildren(
      h('b', { text: 'Etiquetas' }),
      h('p', { class: 'muted tip', text: 'Agrupa las etiquetas por categoría (Pago, Tipo, Plataforma…). Un grupo puede valer para todos tus tableros o solo para algunos.' }),
      ...(groups.length ? groups.map(groupCard) : [h('div', { class: 'empty', text: 'Todavía no hay grupos de etiquetas.' })]),
      h(
        'div',
        { class: 'row' },
        h('button', {
          class: 'btn sm',
          type: 'button',
          onclick: () => {
            const group = { id: newId(), name: t('Nuevo grupo'), single: false, pop: false, boardIds: [], tags: [] };
            groups.push(group);
            save();
            draw(group.id);
            box.querySelector(`[data-group="${group.id}"] .gname`)?.select();
          },
          text: '+ Grupo',
        }),
        h('button', { class: 'btn pri', type: 'button', onclick: close, text: 'Listo' }),
      ),
    );
    if (focusGroup) box.querySelector(`[data-group="${focusGroup}"] .gtags .tgr:last-child input`)?.focus();
  }

  draw();
  overlay.append(box);
  document.body.appendChild(overlay);
}
