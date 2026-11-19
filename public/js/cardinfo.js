// Datos extra de una ficha: cliente, fecha de entrega, enlace y portada. Lo usan el editor y las páginas públicas.
import { LANG, t } from './i18n.js';
import { h, verbatim } from './ui.js';

const todayISO = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD en hora local

/** "1 dic 2026" (según el idioma) */
export const formatDue = (due) => new Date(due + 'T00:00:00').toLocaleDateString(LANG, { day: 'numeric', month: 'short', year: 'numeric' });

/** Entrega vencida: la fecha ya pasó y la ficha no está al 100 % */
export const isLate = (card, progress) => !!card.due && card.due < todayISO() && progress !== 100;

/** Imagen de portada (solo https; el servidor ya lo comprobó) */
export const coverImage = (card) => (card.cover ? h('img', { class: 'cover', src: card.cover, alt: '', draggable: false, loading: 'lazy', referrerpolicy: 'no-referrer' }) : null);

/** Línea con cliente, fecha y enlace. `link` = poner el enlace como <a> (páginas públicas) o solo el icono (editor). */
export function cardMeta(card, progress, { clickableLink } = {}) {
  const items = [];
  if (card.client) items.push(h('span', null, '👤 ', verbatim(card.client)));
  if (card.due) items.push(h('span', { class: isLate(card, progress) ? 'late' : '', title: isLate(card, progress) ? 'Entrega vencida' : '' }, '📅 ', verbatim(formatDue(card.due))));
  if (card.link) {
    items.push(clickableLink ? h('a', { href: card.link, target: '_blank', rel: 'noopener noreferrer', title: t('Abrir enlace') }, '🔗 ', t('Enlace')) : h('span', { title: card.link }, '🔗'));
  }
  return items.length ? h('div', { class: 'meta' }, items) : null;
}

/** Enlace que abre Google Calendar con la entrega ya escrita (sin conectar ninguna cuenta) */
export function calendarUrl(card) {
  if (!card.due) return '';
  const day = card.due.replaceAll('-', '');
  const next = new Date(card.due + 'T00:00:00');
  next.setDate(next.getDate() + 1);
  const end = next.toLocaleDateString('sv-SE').replaceAll('-', '');
  const params = new URLSearchParams({ action: 'TEMPLATE', text: card.title || t('Entrega'), dates: `${day}/${end}`, details: card.client ? `${t('Cliente')}: ${card.client}` : '' });
  return 'https://calendar.google.com/calendar/render?' + params;
}
