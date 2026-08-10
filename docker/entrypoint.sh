#!/bin/sh
set -e

PUSH_ARGS="--skip-generate"
if [ "$PRISMA_ACCEPT_DATA_LOSS" = "true" ]; then
  echo "[entrypoint] PRISMA_ACCEPT_DATA_LOSS=true — schema push allowed to drop/narrow columns if needed."
  PUSH_ARGS="$PUSH_ARGS --accept-data-loss"
fi

attempt=1
max_attempts=5

until node_modules/.bin/prisma db push $PUSH_ARGS; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[entrypoint] 'prisma db push' failed after $max_attempts attempts."
    echo "[entrypoint] If this is a destructive schema change, restart with PRISMA_ACCEPT_DATA_LOSS=true."
    exit 1
  fi

  echo "[entrypoint] 'prisma db push' failed (attempt $attempt/$max_attempts) — retrying in 5s..."
  attempt=$((attempt + 1))
  sleep 5
done

echo "[entrypoint] Database schema is up to date. Starting server..."
exec node server.js
