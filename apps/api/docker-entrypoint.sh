#!/bin/sh
set -e

echo "🚀 Executing production database migration check..."

if [ -n "$DATABASE_URL" ]; then
  echo "Executing npx prisma migrate deploy..."
  npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
  echo "✅ Production database migrations successfully verified and applied."
else
  echo "ℹ️ DATABASE_URL not set in environment, skipping container migration step."
fi

echo "🚀 Launching JobHunter AI API process..."
exec "$@"
