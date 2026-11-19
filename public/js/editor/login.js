// Pantalla de entrada: pide la contraseña del dueño.
import { t } from '../i18n.js';
import { $, api, h } from '../ui.js';

/** Muestra el formulario. `onSuccess` se llama cuando la contraseña es correcta. */
export function showLogin(message, onSuccess) {
  $('tools').hidden = true;

  const password = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Contraseña' });
  const error = h('p', { class: 'error' }, message ? t(message) : '');

  async function submit() {
    try {
      await api('login', { body: { password: password.value } });
      onSuccess();
    } catch (e) {
      error.textContent = t(e.message);
      password.select();
    }
  }
  password.addEventListener('keydown', (e) => e.key === 'Enter' && submit());

  $('app').replaceChildren(
    h('div', { class: 'dlg login' }, h('h2', { text: 'Entrar para editar' }), h('label', null, 'Contraseña', password), error, h('button', { class: 'btn pri', onclick: submit, text: 'Entrar' })),
  );
  password.focus();
}
