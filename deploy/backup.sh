#!/usr/bin/env bash
# Copia de tus tableros (un solo archivo). Guarda 14 días.
# Uso:  sudo -u colmena bash /opt/colmena/deploy/backup.sh [carpeta]     (por defecto /var/lib/colmena/backups)
set -euo pipefail
DATA_DIR="${DATA_DIR:-/var/lib/colmena}"; DEST="${1:-$DATA_DIR/backups}"; mkdir -p "$DEST"
cp "$DATA_DIR/kanban.json" "$DEST/kanban-$(date +%F).json"
find "$DEST" -name 'kanban-*.json' -mtime +14 -delete
echo "Respaldo listo: $DEST/kanban-$(date +%F).json"
