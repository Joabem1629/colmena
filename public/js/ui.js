// Utilidades de interfaz compartidas por todas las pantallas.
import { t, userText } from './i18n.js';

export const $ = (id) => document.getElementById(id);

/** Texto escrito por la persona (títulos de ficha, columnas…): solo se traduce si coincide exactamente con el diccionario (ver userText) */
export const plain = (text) => document.createTextNode(userText(text));

/** Texto que se muestra tal cual, sin traducir nunca (nombres de tablero: el original no los traducía) */
export const verbatim = (text) => document.createTextNode(text);

/** Nombre del sitio (viene de config/site.js a través del <head>) */
export const brandName = () => document.querySelector('meta[name=application-name]')?.content || '';

const DOM_PROPERTIES = new Set(['value', 'checked', 'disabled', 'draggable']); // se asignan como propiedad, no como atributo
const TRANSLATED_ATTRIBUTES = new Set(['placeholder', 'aria-label', 'title']);

/**
 * Crea un elemento:  h('button', { class: 'btn', onclick: fn, text: 'Guardar' }, hijo1, hijo2…)
 *  · text, placeholder, aria-label y title se traducen solos según el idioma
 *  · on<evento> añade un listener · class pone la clase · el resto son atributos
 *  · los hijos pueden ser texto (se traduce), nodos, arreglos o null (se ignora)
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === 'text') el.textContent = t(value);
    else if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (DOM_PROPERTIES.has(key)) el[key] = value;
    else el.setAttribute(key, TRANSLATED_ATTRIBUTES.has(key) ? t(value) : value);
  }
  for (const child of children.flat()) if (child) el.append(typeof child === 'string' ? t(child) : child);
  return el;
}

/**
 * Llama a la API (ruta relativa: 'workspace', 'login'…). Con `body` envía JSON por POST (o el método dado).
 * Si responde con error lanza un Error con el mensaje del servidor, `.status` y `.data`.
 */
export async function api(path, { method, body, keepalive } = {}) {
  const res = await fetch(`api/${path}`, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Error'), { status: res.status, data });
  return data;
}
