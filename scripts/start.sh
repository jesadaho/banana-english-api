#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Add a PostgreSQL service on Railway and link it to this service."
  exit 1
fi

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting Banana English API on port ${PORT:-8000}..."
exec node dist/main.js
