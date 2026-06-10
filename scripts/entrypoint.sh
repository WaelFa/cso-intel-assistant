#!/bin/sh
# Boot-time seed population + verbose diagnostic logging.
set -e

echo "[entrypoint] start: DATA_DIR=${DATA_DIR:-/app/data}"

DEST="${DATA_DIR:-/app/data}/seed"
SRC="/app/data/seed"

echo "[entrypoint] SRC=$SRC DEST=$DEST"
echo "[entrypoint] checking /usr/bin/cp: $(which cp 2>/dev/null || echo 'not found')"
echo "[entrypoint] checking busybox: $(which busybox 2>/dev/null || echo 'not found')"

if [ ! -d "$SRC" ]; then
  echo "[entrypoint] ERROR: source seed directory $SRC does not exist in image"
  ls -la /app/data 2>&1 || true
  exit 1
fi

mkdir -p "$DEST"

# Use a portable copy that works on both busybox cp and GNU cp.
# Loop and copy one file at a time so we don't depend on cp flags.
count=0
for f in "$SRC"/*; do
  [ -e "$f" ] || continue
  base=$(basename "$f")
  if [ ! -e "$DEST/$base" ]; then
    cp "$f" "$DEST/$base"
    count=$((count + 1))
  fi
done

echo "[entrypoint] copied $count seed file(s) into $DEST"
ls -la "$DEST"

exec "$@"
