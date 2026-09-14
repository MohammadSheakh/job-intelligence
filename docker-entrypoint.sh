#!/bin/sh
set -eu

if [ "${SKIP_DOCKER_BOOTSTRAP:-false}" != "true" ]; then
  echo "[docker] preparing database..."
  ./node_modules/.bin/tsx scripts/docker-bootstrap.ts
fi

exec "$@"
