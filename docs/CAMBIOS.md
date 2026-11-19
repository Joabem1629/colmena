# Cambios de esta versión (0.3.0)

## 1. Código más legible

El núcleo era un `server.js` de ~300 líneas y dos HTML con CSS y JS dentro. Ahora sigue la organización de la versión test_1_4, pero sin su parte multiusuario (cuentas, planes, estado, correo):

- `server.js` solo arranca y enruta; la lógica está en `src/` (un archivo por tema, con comentarios).
- Las páginas están en `views/` y no llevan scripts: el JS vive en `public/js/` como módulos pequeños y el CSS en `public/css/`, con los colores en un único `theme.css`.
- Mismas rutas, mismas variables de entorno, mismo formato de `kanban.json` (los datos y respaldos anteriores se importan igual).
- La política de seguridad ahora es `script-src 'self'` (antes permitía scripts en línea).
- Pruebas automáticas en `test/` (`npm test`, sin dependencias).

## 2. Funciones del kanban de test_1_4 que se añadieron

Etiquetas en grupos · cliente, entrega, enlace y portada en cada ficha · Google Calendar · vista de tabla con búsqueda y filtros (editor y página pública) · iconos propios (carpeta `public/assets/icons/`) y subida de imagen.

**No** se añadió: estado/plan de cuentas, multiusuario, correo, kanban global, páginas de marketing.

## Pequeños cambios de comportamiento

- Si `kanban.json` está dañado, el servidor guarda una copia (`kanban.json.roto-…`) antes de empezar vacío; antes lo sobrescribía al guardar.
- En inglés solo se traducen los nombres que pone la app (Siguiente, En curso, Terminado…); los textos que escribes tú ya no se traducen aunque coincidan con una frase del diccionario.
- Los botones de la cabecera del editor se ocultan mientras no has entrado.

## Al actualizar tu carpeta

Copia el contenido de este zip encima de tu proyecto conservando `.git`, `data/` y `deploy/.env`, y **borra los archivos que ya no existen**:
`public/edit.html`, `public/public.html`, `public/site.js`, `public/site.css`, `public/icons.js` y `public/manrope-latin.woff2`.
En el VPS, `deploy/update.sh` ya hace el reemplazo completo al actualizar desde git.
