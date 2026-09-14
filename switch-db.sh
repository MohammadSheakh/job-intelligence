#!/bin/sh
set -eu

mode="${1:-}"
case "$mode" in
  local)
    echo "[db-switch] switching to LOCAL Docker PostgreSQL"
    docker compose -f compose.yaml down --remove-orphans
    docker compose -f compose.yaml up --build -d --remove-orphans
    echo "[db-switch] LOCAL is active: http://localhost:${APP_PORT:-3000}"
    ;;
  neon)
    if ! grep -Eq '^DATABASE_URL=.+$' .env 2>/dev/null; then
      echo "[db-switch] DATABASE_URL is empty in .env. Add the Neon connection string first." >&2
      exit 1
    fi
    echo "[db-switch] switching to NEON"
    docker compose -f compose.yaml down --remove-orphans
    docker compose -f compose.neon.yaml up --build -d --remove-orphans
    echo "[db-switch] NEON is active: http://localhost:${APP_PORT:-3000}"
    ;;
  *)
    echo "Usage: ./switch-db.sh local|neon" >&2
    exit 2
    ;;
esac
