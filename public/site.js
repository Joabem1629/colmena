/* Idioma ES/EN, iconos y traducción de la página. Las claves del diccionario son el texto en español. */
(function () {
'use strict';
var EN = {
"Entrar":"Sign in",
"comisiones":"commissions",
"Siguiente":"Next",
"En curso":"In progress",
"Terminado":"Done",
"🔒 Privado":"🔒 Private",
"Contraseña":"Password",
"mínimo 8 caracteres":"at least 8 characters",
"Entra":"Sign in",
"Cargando…":"Loading…",
"Sin título":"Untitled",
"Tareas ({d}/{n})":"Tasks ({d}/{n})",
"Sin fichas por ahora.":"No cards yet.",
"Este tablero todavía no tiene columnas.":"This board has no columns yet.",
"{n} ficha":"{n} card",
"{n} fichas":"{n} cards",
"{n} tablero público":"{n} public board",
"{n} tableros públicos":"{n} public boards",
"Todavía no hay tableros públicos.":"There are no public boards yet.",
"Avisos":"Notices",
"No encontramos esta página":"We could not find this page",
"Puede que no exista o que sea privada.":"It may not exist, or it may be private.",
"Ir al inicio":"Go to the home page",
"Ver mi página":"View my page",
"Salir":"Sign out",
"Respaldo":"Backup",
"Guardando…":"Saving…",
"Guardado ✓":"Saved ✓",
"Enlace copiado ✓":"Link copied ✓",
"+ Tablero":"+ Board",
"Crea tu primer tablero":"Create your first board",
"Tendrá tres columnas listas (Siguiente, En curso, Terminado). Podrás cambiarlas.":"It comes with three ready columns (Next, In progress, Done). You can change them.",
"+ Crear tablero":"+ Create board",
"Nuevo tablero":"New board",
"se genera sola":"generated automatically",
"Icono":"Icon",
"Nombre del tablero":"Board name",
"Color":"Color",
"Público":"Public",
"Dirección":"Address",
"Copiar enlace":"Copy link",
"Borrar":"Delete",
"¿Borrar este tablero y todas sus fichas?":"Delete this board and all its cards?",
"Nombre de la columna":"Column name",
"Borrar columna":"Delete column",
"¿Borrar la columna y sus fichas?":"Delete the column and its cards?",
"Deja al menos una columna":"Keep at least one column",
"+ Ficha":"+ Card",
"+ Columna":"+ Column",
"{d}/{n} tareas":"{d}/{n} tasks",
"Editar ficha":"Edit card",
"Título":"Title",
"Descripción (se ve en tu página)":"Description (shown on your page)",
"Quién la ve":"Who sees it",
"Pública: se ve todo":"Public: everything is visible",
"Privada: solo se ve 🔒 y su avance":"Private: only 🔒 and its progress are visible",
"Oculta: solo tú":"Hidden: only you",
"Mover a":"Move to",
"Tareas":"Tasks",
"+ Tarea":"+ Task",
"Hecha":"Completed",
"Tarea":"Task",
"Agregar subtarea":"Add subtask",
"Borrar tarea":"Delete task",
"Avance manual (0–100)":"Manual progress (0–100)",
"sin avance":"no progress",
"El avance se calcula con tus tareas ({p}%)":"Progress is calculated from your tasks ({p}%)",
"Notas privadas (nunca salen en tu página)":"Private notes (never shown on your page)",
"Borrar ficha":"Delete card",
"Listo":"Done",
"¿Borrar esta ficha?":"Delete this card?",
"Avisos en tu página":"Notices on your page",
"Para decir cosas como “comisiones cerradas” o “vuelvo el lunes”. Salen en tu perfil público.":"For things like “commissions closed” or “back on Monday”. They appear on your public profile.",
"Aviso":"Notice",
"Personal":"Personal",
"Trabajo":"Work",
"Vacaciones":"Vacation",
"Tipo":"Type",
"Fecha":"Date",
"Texto":"Text",
"Borrar aviso":"Delete notice",
"+ Aviso":"+ Notice",
"Elige un icono":"Choose an icon",
"Registro de la tarea":"Task log",
"Subtarea":"Subtask",
"Mensaje para el registro (como un commit)":"Log message (like a commit)",
"Registrar":"Log",
"Tarea completada":"Task completed",
"Tarea reabierta":"Task reopened",
"Sin registros todavía.":"No log entries yet.",
"Marcar una tarea marca también sus subtareas. Cada tarea guarda un registro, como los commits de git.":"Checking a task also checks its subtasks. Each task keeps a log, like git commits.",
"Quitar icono":"Remove icon",
"Cerrar":"Close",
"Demasiados intentos. Espera un rato.":"Too many attempts. Please wait a while.",
"Inicia sesión":"Please sign in",
"No existe":"Not found",
"Tablero no encontrado":"Board not found",
"Se espera JSON":"JSON expected",
"JSON no válido":"Invalid JSON",
"Demasiado grande":"Too large",
"Error interno":"Internal error",
"Contraseña incorrecta":"Wrong password",
"Entrar para editar":"Sign in to edit",
"Falta definir PASSWORD en la configuración (mínimo 8 caracteres).":"PASSWORD is not set in the configuration (minimum 8 characters).",
"Importar":"Import",
"Archivo no válido":"Invalid file",
"¿Reemplazar todo con este respaldo?":"Replace everything with this backup?",
"Importado ✓":"Imported ✓"
};
var L = ''; try { L = localStorage.getItem('cm_lang') || ''; } catch (e) {}
if (L !== 'es' && L !== 'en') L = /^en/i.test(navigator.language || '') ? 'en' : 'es';
document.documentElement.lang = L;
function T(s, v) {
  var r = (L === 'en' && EN[s]) || s;
  return v ? String(r).replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined ? v[k] : m; }) : r;
}
var CM = window.CM = { L: L, T: T };
CM.setLang = function (l) {
  try { localStorage.setItem('cm_lang', l); } catch (e) {}
  Promise.resolve(CM.before ? CM.before() : null).then(function () { location.reload(); }, function () { location.reload(); });
};
CM.langSwitch = function () {
  var d = document.createElement('div'); d.className = 'lang'; d.setAttribute('role', 'group'); d.setAttribute('aria-label', T('Idioma'));
  ['es', 'en'].forEach(function (l) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = l.toUpperCase(); b.lang = l;
    if (l === L) b.setAttribute('aria-current', 'true');
    b.onclick = function () { if (l !== L) CM.setLang(l); }; d.appendChild(b);
  });
  return d;
};
/* Icono de un tablero: "i:python" (logo) o "i:palette" (trazo), de icons.js. Un emoji suelto de versiones anteriores sigue viéndose. */
CM.icon = function (v, s) {
  var m = /^i:([a-z0-9-]+)$/.exec(v || ''), I = window.CMI;
  if (m && I && I[m[1]]) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), e = I[m[1]];
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('width', s || '1.1em'); svg.setAttribute('height', s || '1.1em');
    if (e[1] === 's') { svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); }
    else svg.setAttribute('fill', 'currentColor');
    svg.style.verticalAlign = '-.2em'; svg.innerHTML = e[2]; return svg;
  }
  return v && !/^i:/.test(v) ? document.createTextNode(v) : null;
};
CM.iconName = function (v) { var m = /^i:([a-z0-9-]+)$/.exec(v || ''); return m && window.CMI && CMI[m[1]] ? CMI[m[1]][0] : ''; };
function translate(root) {
  if (L !== 'en') return;
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
    var p = n.parentNode && n.parentNode.nodeName; return /^(SCRIPT|STYLE|PRE|CODE)$/.test(p) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } }), n, list = [];
  while ((n = w.nextNode())) list.push(n);
  list.forEach(function (n) { var t = n.nodeValue.trim(); if (t && EN[t]) n.nodeValue = n.nodeValue.replace(t, function () { return EN[t]; }); });
  root.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(function (e) {
    ['placeholder', 'aria-label', 'title', 'alt'].forEach(function (a) { var v = e.getAttribute(a); if (v && EN[v]) e.setAttribute(a, EN[v]); });
  });
}
function chrome() {
  document.querySelectorAll('[data-lang]').forEach(function (x) { x.replaceWith(CM.langSwitch()); });
  translate(document.body);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', chrome); else chrome();
})();
