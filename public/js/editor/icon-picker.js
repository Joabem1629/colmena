// Selector de icono de un tablero. Pestañas: las de la biblioteca (icons.categories.js) y "Mis iconos",
// que reúne lo que subes desde aquí y lo que pones en la carpeta de iconos del sitio.
import { t } from '../i18n.js';
import { CATEGORIES, icon, iconName, iconSettings, imageToIcon } from '../icons.js';
import { h } from '../ui.js';
import { render, save, state } from './store.js';

const OFFLINE = { files: [], upload: { enabled: false } };

export function openIconPicker(board) {
  const overlay = h('div', { class: 'ov', onclick: (e) => e.target === overlay && overlay.remove() });
  const tabs = h('div', { class: 'itabs' });
  const grid = h('div', { class: 'ig' });
  const hint = h('p', { class: 'hint' });
  hint.hidden = true;

  const pick = (value) => {
    board.emoji = value;
    save();
    overlay.remove();
    render();
  };

  const iconButton = (value, name = iconName(value)) =>
    h('button', { class: 'ib', type: 'button', title: name, 'aria-label': name || value, onclick: () => pick(value) }, icon(value, '1.4em'));

  function highlight(index) {
    [...tabs.children].forEach((tab, i) => (tab.className = 'tab' + (i === index ? ' on' : '')));
    hint.hidden = true;
  }

  function showCategory(index) {
    highlight(index);
    grid.replaceChildren(...CATEGORIES[index].icons.map((name) => iconButton(`i:${name}`)));
  }

  // Imágenes subidas en cualquier tablero de esta cuenta (para reutilizarlas)
  const uploadedBefore = () => [...new Set(state.ws.boards.map((b) => b.emoji).filter((v) => v && v.startsWith('data:image/')))];

  async function showMine() {
    highlight(CATEGORIES.length);
    const { files, upload } = await iconSettings().catch(() => OFFLINE);
    const cells = [];

    if (upload.enabled) {
      const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
      input.onchange = async () => {
        if (!input.files[0]) return;
        try {
          pick(await imageToIcon(input.files[0], upload));
        } catch (e) {
          hint.textContent = t(e.message);
          hint.hidden = false;
        }
      };
      cells.push(h('button', { class: 'ib up', type: 'button', title: 'Subir imagen', 'aria-label': 'Subir imagen', onclick: () => input.click() }, '＋'), input);
      hint.textContent = t('Sube una imagen: se reduce a {size}×{size} px y se guarda con el tablero.', { size: upload.size });
      hint.hidden = false;
    }
    for (const file of files) cells.push(iconButton(file.value, file.name));
    for (const value of uploadedBefore()) cells.push(iconButton(value, t('Imagen')));
    grid.replaceChildren(...cells);
  }

  CATEGORIES.forEach((category, i) => tabs.append(h('button', { class: 'tab', type: 'button', onclick: () => showCategory(i), text: category.name })));
  tabs.append(h('button', { class: 'tab', type: 'button', onclick: showMine, text: 'Mis iconos' }));

  overlay.append(
    h(
      'div',
      { class: 'dlg', role: 'dialog', 'aria-modal': 'true' },
      h('b', { text: 'Elige un icono' }),
      tabs,
      grid,
      hint,
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn sm', type: 'button', onclick: () => pick(''), text: 'Quitar icono' }),
        h('button', { class: 'btn sm', type: 'button', onclick: () => overlay.remove(), text: 'Cerrar' }),
      ),
    ),
  );
  document.body.appendChild(overlay);
  showCategory(0);
}
