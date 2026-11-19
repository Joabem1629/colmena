// Cabecera común: pone el selector ES | EN y traduce el texto que ya viene escrito en el HTML.
import { langSwitch, translateDom } from './i18n.js';

export function initChrome() {
  document.querySelectorAll('[data-lang]').forEach((slot) => slot.replaceWith(langSwitch()));
  translateDom(document.body);
}
