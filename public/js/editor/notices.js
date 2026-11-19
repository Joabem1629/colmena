// Avisos del perfil público ("vacaciones hasta el lunes", "comisiones cerradas"…).
import { h } from '../ui.js';
import { newId, render, save, state } from './store.js';

const KINDS = [
  ['update', 'Aviso'],
  ['personal', 'Personal'],
  ['work', 'Trabajo'],
  ['vacation', 'Vacaciones'],
];

function noticeRow(notice) {
  return h(
    'div',
    { class: 'nt' },
    h(
      'select',
      {
        'aria-label': 'Tipo',
        onchange: (e) => {
          notice.kind = e.target.value;
          save();
        },
      },
      KINDS.map(([value, label]) => {
        const option = h('option', { value, text: label });
        option.selected = notice.kind === value;
        return option;
      }),
    ),
    h('input', {
      type: 'date',
      value: notice.date,
      'aria-label': 'Fecha',
      onchange: (e) => {
        notice.date = e.target.value;
        save();
      },
    }),
    h('input', {
      type: 'text',
      value: notice.text,
      maxlength: 500,
      'aria-label': 'Texto',
      oninput: (e) => {
        notice.text = e.target.value;
        save();
      },
    }),
    h('button', {
      class: 'ghost',
      title: 'Borrar aviso',
      'aria-label': 'Borrar aviso',
      onclick: () => {
        state.ws.notices = state.ws.notices.filter((x) => x !== notice);
        save();
        render();
      },
      text: '×',
    }),
  );
}

export function noticesSection() {
  return h(
    'section',
    null,
    h('h2', { text: 'Avisos en tu página' }),
    h('p', { class: 'muted', text: 'Para decir cosas como “comisiones cerradas” o “vuelvo el lunes”. Salen en tu perfil público.' }),
    h('div', null, state.ws.notices.map(noticeRow)),
    h('button', {
      class: 'btn sm',
      onclick: () => {
        state.ws.notices.push({ id: newId(), kind: 'update', date: new Date().toISOString().slice(0, 10), text: '' });
        save();
        render();
      },
      text: '+ Aviso',
    }),
  );
}
