# Colmena (núcleo)

Un kanban **público de solo lectura** con un editor privado, para un único dueño.
Tú editas en `/edit`; cualquiera con el enlace mira el avance de tus tableros.

- Sin dependencias, sin registro de usuarios, sin base de datos: todo vive en un solo archivo (`data/kanban.json`).
- Funciona en Windows, macOS, Linux, Raspberry Pi y Docker. Solo necesita **Node.js 18 o más**.
- Interfaz en español e inglés (selector ES | EN).

## Índice

1. [Qué se puede hacer](#qué-se-puede-hacer)
2. [Cómo se usa](#cómo-se-usa)
3. [Instalación](#instalación)
4. [Configuración](#configuración)
5. [Respaldos, migración y actualización](#respaldos-migración-y-actualización)
6. [Personalizar](#personalizar)
7. [Cómo está organizado el código](#cómo-está-organizado-el-código)
8. [Si algo falla](#si-algo-falla)
9. [Licencia](#licencia)

---

## Qué se puede hacer

**Tableros y fichas**
- Varios tableros, cada uno con icono, color, nombre y dirección propia (`/mi-tablero`). Puedes marcarlos como públicos o dejarlos solo para ti.
- Columnas a tu gusto (por defecto: Siguiente, En curso, Terminado) y fichas que se arrastran entre columnas.
- Cada ficha tiene: título, descripción, **cliente**, **fecha de entrega**, **enlace**, **portada** (imagen), etiquetas, tareas, avance y notas privadas.
- La entrega vencida se marca en rojo, y desde la ficha puedes añadirla a **Google Calendar**.

**Tareas y avance**
- Tareas con subtareas sin límite de niveles. Marcar una tarea marca también sus subtareas.
- El avance de la ficha se calcula solo con sus tareas; sin tareas, puedes poner un porcentaje a mano.
- Cada tarea guarda un registro (como los commits de git): lo escrito no se edita y la hora la pone el servidor.
- Cada columna muestra el avance promedio de sus fichas.

**Etiquetas**
- Se agrupan por categoría (Pago, Tipo, Plataforma…) y cada etiqueta tiene su color.
- Un grupo puede permitir **una sola etiqueta por ficha** (útil para Pago: Pagado / Pendiente) o varias.
- Un grupo puede valer para todos tus tableros o solo para algunos.
- Un grupo puede marcarse como **visible en fichas privadas**, para que el público vea el estado sin ver el contenido.

**Vistas y filtros**
- **Tablero** (columnas) o **Tabla** (una fila por ficha, con cliente, columna, etiquetas, entrega y avance). La vista elegida se recuerda en tu navegador.
- Búsqueda por texto y filtro por etiquetas, tanto en el editor como en la página pública.

**Iconos**
- Más de 250 iconos de biblioteca (lenguajes, herramientas, arte, juegos, trabajo, vida…), cualquier emoji, y **tus propios iconos**.
- Tus iconos: copia imágenes a `public/assets/icons/` y aparecen en la pestaña "Mis iconos", o súbelas desde el editor (se reducen a 64×64 y se guardan con el tablero).

**Privacidad de cada ficha**
| Visibilidad | Qué ve el público |
|---|---|
| Pública | Todo menos las notas privadas |
| Privada | Solo "🔒 Privado", su avance y las etiquetas de grupos marcados como visibles en privadas. No salen título, descripción, cliente, entrega, enlace ni portada |
| Oculta | Nada, ni siquiera cuenta en el total de fichas |

Las notas privadas nunca salen en la página pública. Una etiqueta que no usa ninguna ficha visible tampoco se envía al público, para no revelar nombres de clientes o proyectos.

**Otros**
- **Avisos** en la portada ("comisiones cerradas", "vuelvo el lunes"), con tipo: aviso, personal, trabajo o vacaciones.
- **Respaldo** en un clic (descarga un JSON) e **Importar** para restaurarlo.
- Sesión con contraseña, límite de intentos de acceso y cookie protegida.

---

## Cómo se usa

### Rutas

| Ruta | Qué es |
|---|---|
| `/` | Página pública: tus tableros públicos y avisos |
| `/<tablero>` | Un tablero público (la dirección sale del nombre; puedes cambiarla) |
| `/edit` | Editor, con contraseña |

Con `BASE=/kanban` todo cuelga de ahí: `/kanban/`, `/kanban/<tablero>`, `/kanban/edit`.

### Primeros pasos en el editor

1. Entra a `/edit` con tu contraseña (la variable `PASSWORD`).
2. Pulsa **+ Crear tablero**. Cámbiale el nombre, el color y el icono (el botón junto al nombre).
3. Añade columnas con **+ Columna** y fichas con **+ Ficha**. Arrastra las fichas entre columnas.
4. Haz clic en una ficha para completar sus datos: cliente, entrega, enlace, portada, etiquetas, tareas, quién la ve y notas.
5. Para crear etiquetas pulsa **🏷 Etiquetas**: crea un grupo, escribe cada etiqueta y pulsa **+ Etiqueta**. Elige color, si es de una sola por ficha, si se ve en fichas privadas y a qué tableros aplica.
6. Cambia entre **Tablero** y **Tabla** con el selector de la barra de filtros.
7. Pulsa **Copiar enlace** en la cabecera del tablero para compartirlo, o **Ver mi página** (arriba) para ver lo que ve el público.
8. Todo se guarda solo, medio segundo después de cada cambio. Arriba verás "Guardado ✓".

### Cabecera del editor
**Ver mi página** · **Respaldo** (descarga un JSON) · **Importar** (restaura un JSON, reemplaza todo) · **Salir**.

### Límites
50 tableros · 20 columnas por tablero · 500 fichas por tablero · 500 tareas por ficha · 50 grupos de etiquetas · 60 etiquetas por grupo · 100 avisos. Iconos subidos: máximo 9 KB cada uno.

---

## Instalación

Requisito en todos los sistemas: **Node.js 18 o más** (`node --version` para comprobarlo). No hay `npm install`: el proyecto no usa paquetes externos.

En todos los casos el servidor necesita una contraseña de 8 caracteres o más en la variable `PASSWORD`. Una vez en marcha, abre `http://localhost:3000/edit`.

> Esto es para probar en tu equipo. Para tenerlo en internet, usa la sección [Servidor (VPS)](#servidor-vps-linux--systemd--nginx) o [Docker](#docker).

### Windows

1. Instala Node.js LTS desde [nodejs.org](https://nodejs.org) o con `winget install OpenJS.NodeJS.LTS`.
2. Descomprime el proyecto en una carpeta, por ejemplo `C:\Users\TuUsuario\colmena\`.
3. Abre PowerShell dentro de esa carpeta (clic derecho → "Abrir en Terminal") y ejecuta:

```powershell
$env:PASSWORD="una-clave-larga"
node server.js
```

En CMD (símbolo del sistema) el primer comando es `set PASSWORD=una-clave-larga`.

Para no escribir la clave cada vez, crea un archivo `iniciar.bat` en la carpeta:

```bat
@echo off
set PASSWORD=una-clave-larga
set SITE_NAME=Mi kanban
node server.js
pause
```

Haz doble clic en él para arrancar. Cierra la ventana (o pulsa `Ctrl + C`) para detenerlo.

Si el firewall de Windows pregunta, acepta solo "redes privadas". Por defecto el servidor solo escucha en tu propio equipo (`127.0.0.1`).

### macOS

```bash
brew install node          # o descarga el instalador desde nodejs.org
cd colmena
PASSWORD=una-clave-larga node server.js
```

### Linux

Instala Node.js 18 o más. Si tu distribución trae una versión más vieja (por ejemplo Ubuntu 22.04), usa [NodeSource](https://github.com/nodesource/distributions) o [nvm](https://github.com/nvm-sh/nvm).

```bash
# Debian / Ubuntu
sudo apt install nodejs        # comprueba que `node --version` sea 18 o más
# Fedora
sudo dnf install nodejs
# Arch
sudo pacman -S nodejs

cd colmena
PASSWORD=una-clave-larga node server.js
```

Con Node 20.6 o más puedes guardar las variables en un archivo `.env` y arrancar con `node --env-file=.env server.js`.

### Raspberry Pi y otros ARM

Igual que Linux: instala Node 18+ (con NodeSource o nvm) y ejecuta `node server.js`. Para que arranque solo, usa la unidad de systemd de la siguiente sección.

### Docker

Funciona en cualquier sistema con Docker (Windows, macOS o Linux).

```bash
cp deploy/env.example .env     # en Windows: copy deploy\env.example .env
nano .env                      # pon PASSWORD, SITE_NAME… (en Windows, abre .env con el Bloc de notas)
docker compose up -d --build
```

Queda en `http://127.0.0.1:3100`. Tus datos se guardan en un volumen de Docker (`kanban-data`), así que sobreviven a reconstruir la imagen. Para publicarlo en internet, ponle delante nginx o Caddy.

### Servidor (VPS Linux + systemd + nginx)

```bash
sudo useradd --system --home /opt/colmena --shell /usr/sbin/nologin colmena
sudo git clone https://github.com/Joabem1629/colmena /opt/colmena
sudo mkdir -p /var/lib/colmena && sudo chown colmena:colmena /var/lib/colmena
sudo cp /opt/colmena/deploy/env.example /etc/colmena.env && sudo chmod 600 /etc/colmena.env
sudo nano /etc/colmena.env            # pon PASSWORD, SITE_NAME, BASE, TRUST_PROXY=1…
sudo cp /opt/colmena/deploy/colmena.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now colmena
journalctl -u colmena -n 20 --no-pager
```

Luego pega `deploy/nginx-snippet.conf` dentro del `server { }` de tu dominio. Si ya tienes un `location` con esa misma ruta, **reemplázalo**: nginx usa el primero que coincide. Después:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Con HTTPS (certbot o Caddy) la cookie de sesión sale como *Secure*; entra siempre por `https://`.

**Con Caddy** en lugar de nginx, basta esto en tu `Caddyfile`:

```
tu-dominio.com {
    reverse_proxy 127.0.0.1:3000
}
```

Y pon `TRUST_PROXY=1` en las variables de entorno.

### Dejarlo corriendo en segundo plano (sin systemd)

En cualquier sistema, con [PM2](https://pm2.keymetrics.io):

```bash
npm install -g pm2
PASSWORD=una-clave-larga pm2 start server.js --name colmena
pm2 save
```

---

## Configuración

Todo se configura con **variables de entorno**. En systemd van en `/etc/colmena.env`; en Docker, en `.env`; en una terminal, antes del comando. Hay un ejemplo en `deploy/env.example`.

| Variable | Por defecto | Para qué |
|---|---|---|
| `PASSWORD` | — | **Obligatoria** para editar (mínimo 8 caracteres). Si la cambias, las sesiones abiertas se cierran |
| `SITE_NAME` | `Kanban` | Nombre en la cabecera y en el título de la pestaña |
| `SITE_DESC` | vacío | Frase corta bajo el nombre en la portada (opcional) |
| `BASE` | vacío | Prefijo si lo publicas en una subruta, p. ej. `/kanban` |
| `PORT` | `3000` | Puerto |
| `HOST` | `127.0.0.1` | Dirección donde escucha. Déjalo así detrás de nginx; en Docker ya se pone `0.0.0.0` |
| `TRUST_PROXY` | — | `1` si estás detrás de nginx/Caddy (para limitar intentos por IP y marcar la cookie como *Secure*) |
| `DATA_DIR` | `./data` | Dónde se guarda `kanban.json` |
| `SECRET` | se crea sola | Clave que firma las cookies (`data/secret.key`). No la subas a git |
| `ICON_UPLOAD` | `1` | `0` quita el botón "Subir imagen" del selector de iconos (los iconos de `public/assets/icons/` siguen funcionando) |

La sesión dura 14 días. Tras 10 intentos fallidos de contraseña desde una misma IP, se bloquea el acceso por 15 minutos.

---

## Respaldos, migración y actualización

**Respaldo desde el editor:** **Respaldo** descarga un JSON con todo; **Importar** lo restaura (reemplaza todo). Un respaldo de una versión anterior, sin etiquetas ni datos de ficha, se importa sin problema.

**Respaldo en el servidor:** `sudo -u colmena bash /opt/colmena/deploy/backup.sh` copia `kanban.json`. Para hacerlo a diario, agrega en `sudo crontab -e`:

```
0 4 * * * sudo -u colmena bash /opt/colmena/deploy/backup.sh
```

**Mover tus datos a otro equipo:** copia la carpeta `data/` (o usa Respaldo + Importar).

**Si `kanban.json` se daña:** el servidor guarda una copia llamada `kanban.json.roto-<fecha>` y arranca vacío, para que no pierdas nada. Puedes recuperar el contenido de esa copia.

**Actualizar**
- Instalación con git (VPS): `sudo bash /opt/colmena/deploy/update.sh` (hace `git fetch` + `reset --hard` y reinicia).
- Docker: `git pull && docker compose up -d --build`.
- Copia manual: reemplaza el código conservando tu carpeta `data/` y tus variables de entorno.

**¿Vienes de la versión con cuentas (SQLite)?** Antes de actualizar, entra a tu editor viejo y pulsa **Respaldo**. Después de actualizar, usa **Importar** en `/edit`. El archivo `colmena.sqlite` ya no se usa.

---

## Personalizar

- **Colores, formas y tipografía:** `public/css/theme.css`. Cambia un valor y cambia en toda la página y el editor.
- **Tus iconos:** imágenes (`.svg .png .webp .gif .jpg .avif`) en `public/assets/icons/`, con nombre en minúsculas, números y guiones (`mi-logo.png`). No hace falta reiniciar.
- **Otro idioma:** `public/js/i18n.en.js` es el diccionario; la clave es el texto en español.
- **Textos de las páginas:** `views/public.html` y `views/edit.html`.

---

## Cómo está organizado el código

```
server.js              arranque y rutas de páginas
src/                   servidor
  config.js            variables de entorno y límites
  security.js          contraseña, sesión, límite de intentos
  workspace.js         validación y guardado de los datos, vista pública
  icons.js             validación de iconos
  api.js               rutas /api
  http.js, static.js, views.js, errors.js
views/                 las dos páginas HTML (solo marcado, sin scripts)
public/
  css/                 theme.css (empieza aquí), base, public, editor, tags
  js/                  módulos compartidos (i18n, ui, icons, tags, cardinfo)
  js/pages/public.js   página pública
  js/editor/           editor: store, boards, card-dialog, tag-manager, icon-picker, notices…
  assets/icons/        tus iconos propios
  fonts/
test/                  pruebas automáticas
data/                  tus datos (kanban.json y la clave de cookies); no se sube a git
deploy/                systemd, nginx, scripts de respaldo y actualización
```

**Pruebas:** `npm test` (no necesitan instalar nada).
**Desarrollo:** `npm run dev` reinicia el servidor solo al guardar cambios en `src/` o `server.js`.

El servidor nunca confía en lo que manda el navegador: todo se revisa y recorta en `src/workspace.js` antes de guardarse (enlaces solo http/https, portadas solo https, fechas reales, colores válidos, etc.).

---

## Si algo falla

- **"node" no se reconoce (Windows) o "command not found":** Node no está instalado o la terminal se abrió antes de instalarlo. Ciérrala, ábrela de nuevo y prueba `node --version`.
- **"Falta definir PASSWORD":** pon `PASSWORD` (8 o más caracteres) antes de arrancar.
- **El puerto está ocupado (`EADDRINUSE`):** usa otro, por ejemplo `PORT=3001`.
- **Cambié un archivo de `public/` y no veo el cambio:** recarga con `Ctrl + F5`.
- **Cambié algo de `src/` y no pasa nada:** reinicia el servidor (o usa `npm run dev`).
- **Ves otra aplicación en tu ruta:** otro `location` de nginx (o el kanban viejo) responde antes. Busca con `sudo grep -rn "kanban" /etc/nginx/` y deja uno solo apuntando al puerto de este servicio.
- **502 Bad Gateway:** el servicio no corre o el puerto no coincide. `systemctl status colmena` y `journalctl -u colmena -e`.
- **La página carga sin estilos o en blanco:** `BASE` no coincide con el `location` de nginx (`/kanban` ↔ `location ^~ /kanban/`).
- **Al entrar te devuelve al login:** falta `X-Forwarded-Proto` en nginx o entras por `http`. Usa `https`.
- **Un icono de `public/assets/icons/` no aparece:** revisa que el nombre solo tenga minúsculas, números y guiones, y que la extensión sea una de las permitidas.

---

## Licencia

[AGPL-3.0](LICENSE). Los iconos de terceros están en [THIRD-PARTY.md](THIRD-PARTY.md).