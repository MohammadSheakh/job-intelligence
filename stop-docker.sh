#!/bin/sh
set -eu
docker compose -f compose.yaml down --remove-orphans
