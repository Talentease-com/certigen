#!/bin/sh
set -e

echo "[certigen] Running database migrations..."
npx drizzle-kit push --force
echo "[certigen] Migrations complete."

echo "[certigen] Starting server..."
exec node .output/server/index.mjs
