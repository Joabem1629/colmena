# Colmena (núcleo)

Un kanban **público de solo lectura** y un editor privado, para un único dueño.
Tú editas en `/edit`; cualquiera con el enlace mira el avance. Las fichas privadas salen como 🔒 con su progreso y las ocultas no salen.

- Sin dependencias, sin registro de usuarios, sin base de datos: un solo archivo (`kanban.json`).
- Tareas con subtareas sin límite, avance calculado, registro por tarea (como commits), avisos, +250 iconos.
- Interfaz en español e inglés (selector ES | EN).

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | Página pública: tus tableros públicos y avisos |
| `/<tablero>` | Un tablero público (la dirección la eliges al crearlo) |
| `/edit` | Editor, con contraseña |

Con `BASE=/kanban` todo cuelga de ahí: `/kanban/`, `/kanban/<tablero>`, `/kanban/edit`.

## Probarlo en 30 segundos

Necesitas Node 18 o más.

```bash
git clone https://github.com/Joabem1629/colmena && cd colmena
PASSWORD=una-clave-larga node server.js
# abre http://localhost:3000/edit
```

## Configuración

Todo se configura con variables de entorno (en `/etc/colmena.env` con systemd, o `.env` con Docker; hay un ejemplo en `deploy/env.example`).

| Variable | Por defecto | Para qué |
|---|---|---|
| `PASSWORD` | — | **Obligatoria** para editar (mínimo 8 caracteres). Si la cambias, las sesiones abiertas se cierran |
| `SITE_NAME` | `Kanban` | Nombre que se ve en la cabecera y en el título de la pestaña |
| `SITE_DESC` | vacío | Frase corta bajo el nombre (opcional) |
| `BASE` | vacío | Prefijo si lo publicas en una subruta, p. ej. `/kanban` |
| `PORT` | `3000` | Puerto |
| `HOST` | `127.0.0.1` | Dirección donde escucha. Déjalo así detrás de nginx; en Docker ya se pone `0.0.0.0` |
| `TRUST_PROXY` | — | `1` si estás detrás de nginx/Caddy (para limitar intentos por IP y marcar la cookie como *Secure*) |
| `DATA_DIR` | `./data` | Dónde se guarda `kanban.json` |
| `SECRET` | se crea sola | Clave que firma las cookies (`data/secret.key`). No la subas a git |

## Instalar en un VPS (systemd + nginx)

```bash
sudo useradd --system --home /opt/colmena --shell /usr/sbin/nologin colmena
sudo git clone https://github.com/Joabem1629/colmena /opt/colmena
sudo mkdir -p /var/lib/colmena && sudo chown colmena:colmena /var/lib/colmena
sudo cp /opt/colmena/deploy/env.example /etc/colmena.env && sudo chmod 600 /etc/colmena.env
sudo nano /etc/colmena.env            # pon PASSWORD, SITE_NAME, BASE...
sudo cp /opt/colmena/deploy/colmena.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now colmena
journalctl -u colmena -n 20 --no-pager
```

Luego pega `deploy/nginx-snippet.conf` dentro del `server { }` de tu dominio (si ya tienes un `location` con esa misma ruta, **reemplázalo**: nginx usa el primero que coincide) y:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Con HTTPS (certbot o Caddy) la cookie de sesión sale como *Secure*; entra siempre por `https://`.

## Docker

```bash
cp deploy/env.example .env && nano .env && chmod 600 .env
docker compose up -d --build        # queda en 127.0.0.1:3100; publícalo con nginx
```

## Actualizar

`sudo bash /opt/colmena/deploy/update.sh` (hace `git fetch` + `reset --hard` al repositorio y reinicia). Con Docker: `git pull && docker compose up -d --build`.

## Respaldos y migración

- En el editor: **Respaldo** descarga un JSON y **Importar** lo restaura (reemplaza todo).
- En el servidor, `sudo -u colmena bash /opt/colmena/deploy/backup.sh` copia `kanban.json`; para que sea diario: `0 4 * * * sudo -u colmena bash /opt/colmena/deploy/backup.sh` en `sudo crontab -e`.
- ¿Vienes de la versión con cuentas (SQLite)? Antes de actualizar, entra a tu editor viejo, pulsa **Respaldo**, y después de actualizar usa **Importar** en `/edit`. El archivo `colmena.sqlite` ya no se usa.

## Si algo falla

- **Ves otra aplicación en tu ruta:** otro `location` de nginx (o el kanban viejo) responde antes. Busca con `sudo grep -rn "kanban" /etc/nginx/` y deja uno solo apuntando al puerto de este servicio.
- **502 Bad Gateway:** el servicio no corre o el puerto no coincide. `systemctl status colmena` y `journalctl -u colmena -e`.
- **La página carga sin estilos o en blanco:** `BASE` no coincide con el `location` de nginx (`/kanban` ↔ `location ^~ /kanban/`).
- **Al entrar te devuelve al login:** falta `X-Forwarded-Proto` en nginx o entras por `http`. Usa `https`.
- **"Falta definir PASSWORD":** pon `PASSWORD` (8+ caracteres) en el `.env` y reinicia.

## Licencia

[AGPL-3.0](LICENSE). Los iconos de terceros están en [THIRD-PARTY.md](THIRD-PARTY.md).
