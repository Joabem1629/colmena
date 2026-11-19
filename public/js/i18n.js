// Idioma (español / inglés). Las claves del diccionario (i18n.en.js) son el propio texto en español:
// si una frase no tiene traducción, se muestra tal cual en español.
import { EN } from './i18n.en.js';

let lang = '';
try {
  lang = localStorage.getItem('cm_lang') || '';
} catch {}
if (lang !== 'es' && lang !== 'en') lang = /^en/i.test(navigator.language || '') ? 'en' : 'es';
document.documentElement.lang = lang;

export const LANG = lang;

/** Traduce un texto. Los marcadores {x} se rellenan con `vars`:  t('{n} fichas', { n: 3 }) */
export function t(text, vars) {
  const translated = (lang === 'en' && EN[text]) || text;
  return vars ? String(translated).replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? vars[key] : match)) : translated;
}

// Nombres que la propia app pone al crear un tablero o una columna. Son los únicos textos escritos por la
// persona que se traducen (así el tablero recién creado se ve en inglés); todo lo demás se muestra tal cual.
const APP_NAMES = new Set(['Siguiente', 'En curso', 'Terminado', 'Nuevo tablero', 'Nueva columna', 'Sin título']);

/** Texto escrito por la persona (títulos de ficha, columnas…): solo se traduce si es uno de los nombres de la app */
export function userText(text) {
  const trimmed = String(text).trim();
  return lang === 'en' && APP_NAMES.has(trimmed) && EN[trimmed] ? text.replace(trimmed, () => EN[trimmed]) : text;
}

// Antes de recargar al cambiar de idioma, el editor guarda lo pendiente
let beforeChange = null;
export const onBeforeLangChange = (fn) => (beforeChange = fn);

function setLang(next) {
  try {
    localStorage.setItem('cm_lang', next);
  } catch {}
  Promise.resolve(beforeChange ? beforeChange() : null).then(
    () => location.reload(),
    () => location.reload(),
  );
}

/** Selector "ES | EN" */
export function langSwitch() {
  const box = document.createElement('div');
  box.className = 'lang';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', t('Idioma'));
  for (const code of ['es', 'en']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = code.toUpperCase();
    button.lang = code;
    if (code === lang) button.setAttribute('aria-current', 'true');
    button.onclick = () => code !== lang && setLang(code);
    box.appendChild(button);
  }
  return box;
}

/** Traduce el texto ya escrito en el HTML (solo en inglés; el HTML está en español) */
export function translateDom(root) {
  if (lang !== 'en') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (/^(SCRIPT|STYLE|PRE|CODE)$/.test(node.parentNode?.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue.trim();
    if (text && EN[text]) node.nodeValue = node.nodeValue.replace(text, () => EN[text]);
  }
  for (const el of root.querySelectorAll('[placeholder],[aria-label],[title],[alt]')) {
    for (const attr of ['placeholder', 'aria-label', 'title', 'alt']) {
      const value = el.getAttribute(attr);
      if (value && EN[value]) el.setAttribute(attr, EN[value]);
    }
  }
}
