#!/bin/sh
# Boot-time seed population.
#
# The Railway volume mounted at /app/data starts empty on first
# deploy. The seed corpus lives baked into the image at
# /app/data/seed; we copy any missing files into the volume's
# /app/data/seed on every boot, using `cp -n` so user-added
# seed files in the volume are preserved across redeploys.
set -e

DEST="${DATA_DIR:-/app/data}/seed"
SRC="/app/data/seed"

if [ -d "$SRC" ]; then
  mkdir -p "$DEST"
  cp -n "$SRC"/. "$DEST"/ 2>/dev/null || true
  echo "[entrypoint] Seeded $DEST from $SRC"
fi

exec "$@"
