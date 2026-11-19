// Iconos de los tableros. El valor guardado en el tablero puede ser (ver también src/icons.js):
//   i:python                 biblioteca incluida (icons.data.js)
//   c:mi-logo.png            tu archivo en public/assets/icons/ (carpeta configurable en config/site.js)
//   data:image/png;base64,…  imagen subida desde el editor
//   🎨                       un emoji
import { ICONS } from './icons.data.js';
import { CATEGORIES } from './icons.categories.js';
import { api } from './ui.js';

export { CATEGORIES };

const SVG_NS = 'http://www.w3.org/2000/svg';
const LIBRARY = /^i:([a-z0-9-]+)$/;
const FILE = /^c:([a-z0-9][a-z0-9-]*\.[a-z0-9]+)$/;
const UPLOADED = /^data:image\/(?:png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const ICONS_DIR = document.querySelector('meta[name=icons-dir]')?.content || 'assets/icons';

function svgIcon([, type, inner], size) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', size || '1.1em');
  svg.setAttribute('height', size || '1.1em');
  if (type === 's') {
    // icono de trazo (Lucide)
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
  } else svg.setAttribute('fill', 'currentColor'); // logo relleno (Simple Icons)
  svg.style.verticalAlign = '-.2em';
  svg.innerHTML = inner;
  return svg;
}

function imageIcon(src, size) {
  const img = document.createElement('img');
  img.className = 'icon-img';
  img.src = src;
  img.alt = '';
  img.style.width = img.style.height = size || '1.1em';
  return img;
}

/** Dibuja un icono. Devuelve un nodo, o null si no hay icono. `size` en unidades CSS (por defecto 1.1em). */
export function icon(value, size) {
  const v = value || '';
  const library = LIBRARY.exec(v);
  if (library && ICONS[library[1]]) return svgIcon(ICONS[library[1]], size);
  const file = FILE.exec(v);
  if (file) return imageIcon(`${ICONS_DIR}/${file[1]}`, size);
  if (UPLOADED.test(v)) return imageIcon(v, size);
  return v && !v.startsWith('i:') ? document.createTextNode(v) : null; // emoji
}

/** Nombre legible de un icono de la biblioteca ('' si no es de la biblioteca) */
export const iconName = (value) => {
  const m = LIBRARY.exec(value || '');
  return m && ICONS[m[1]] ? ICONS[m[1]][0] : '';
};

/* ── Iconos propios ─────────────────────────────────────────────────────── */

let settings = null;

/** Ajustes del selector: archivos de tu carpeta de iconos y si se permite subir imágenes */
export const iconSettings = () => (settings ||= api('icons'));

/**
 * Convierte una imagen elegida por la persona en un icono pequeño (PNG con transparencia).
 * Se reduce hasta que cabe en `maxBytes`. Devuelve el texto data:image/png;base64,…
 */
export async function imageToIcon(file, { size, maxBytes }) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file); // un GIF animado se queda con su primer cuadro
  } catch {
    throw new Error('No se pudo leer la imagen.');
  }
  const maxChars = Math.ceil(maxBytes / 3) * 4 + 40;
  for (let side = size; side >= 24; side = Math.floor(side * 0.75)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = side;
    const scale = Math.min(side / bitmap.width, side / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    canvas.getContext('2d').drawImage(bitmap, (side - w) / 2, (side - h) / 2, w, h);
    const url = canvas.toDataURL('image/png');
    if (url.length <= maxChars) return url;
  }
  throw new Error('La imagen es demasiado compleja. Prueba con una más simple.');
}
