#!/bin/sh
set -eu

if [ "${SKIP_DB_MIGRATIONS:-false}" != "true" ]; then
  echo "[docker-backend] Checking and applying database migrations..."
  pnpm run prisma:migrate:deploy || echo "[docker-backend] Migration check finished."
fi

if [ "${AUTO_SEED_IF_EMPTY:-true}" = "true" ]; then
  echo "[docker-backend] Ensuring baseline catalog seed exists..."
  pnpm run prisma:seed --apply || echo "[docker-backend] Seed step skipped or already populated."
fi

exec "$@"
