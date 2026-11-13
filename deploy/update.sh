#!/usr/bin/env bash
# Actualizar en el VPS:  sudo bash /opt/colmena/deploy/update.sh
set -euo pipefail
cd /opt/colmena
git fetch --quiet origin
git reset --hard origin/main      # sigue al repositorio aunque se haya reescrito su historial
systemctl restart colmena
sleep 1
systemctl is-active colmena
