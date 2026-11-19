// Arranque del editor (/edit): comprueba la sesión, carga tus tableros y conecta los botones de la cabecera.
import { initChrome } from '../chrome.js';
import { onBeforeLangChange, t } from '../i18n.js';
import { $, api } from '../ui.js';
import { renderEditor } from './boards.js';
import { showLogin } from './login.js';
import { flush, flushIfPending, flushOnLeave, openBoard, render, setRenderer, setSessionLostHandler, setStatus, state } from './store.js';

initChrome();
setRenderer(renderEditor);
onBeforeLangChange(flushIfPending);
setSessionLostHandler(() => showLogin('Inicia sesión', start));
window.addEventListener('pagehide', flushOnLeave);

/* ── Botones de la cabecera: respaldo, importar, salir ──────────────────── */

function downloadBackup() {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(state.ws, null, 1)], { type: 'application/json' }));
  link.download = `kanban-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
}

// Lee un respaldo (.json) y reemplaza todo con él, después de confirmarlo
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    let data;
    try {
      data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.boards)) throw new Error('forma');
    } catch {
      return setStatus('Archivo no válido', true);
    }
    if (!confirm(t('¿Reemplazar todo con este respaldo?'))) return;

    state.ws = { boards: data.boards, groups: Array.isArray(data.groups) ? data.groups : [], notices: Array.isArray(data.notices) ? data.notices : [] };
    const saved = await flush({ isImport: true });
    if (!saved) return;
    state.ws = saved; // lo que el servidor guardó ya viene revisado
    openBoard(saved.boards.length ? saved.boards[0].id : null);
    render();
    setStatus('Importado ✓');
  };
  reader.readAsText(file);
}

$('bk').onclick = downloadBackup;
$('imp').onclick = () => $('file').click();
$('file').onchange = (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) importBackup(file);
};
$('out').onclick = async () => {
  await api('logout', { body: {} }).catch(() => {});
  location.reload();
};

/* ── Arranque ───────────────────────────────────────────────────────────── */

async function start() {
  try {
    const me = await api('me');
    if (!me.configured) return showLogin('Falta definir PASSWORD en la configuración (mínimo 8 caracteres).', start);
    if (!me.auth) return showLogin('', start);

    $('tools').hidden = false;
    state.ws = await api('workspace');
    state.ws.groups ||= [];
    openBoard(state.ws.boards.length ? state.ws.boards[0].id : null);
    render();
  } catch (e) {
    $('app').textContent = 'No se pudo cargar: ' + e.message;
  }
}
start();
