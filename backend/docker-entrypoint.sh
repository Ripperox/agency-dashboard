#!/bin/sh
set -e

npx prisma migrate deploy

if [ "$SEED_ON_BOOT" = "true" ]; then
  npx tsx prisma/seed.ts
fi

node dist/src/index.js
