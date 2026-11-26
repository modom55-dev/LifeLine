#!/bin/sh
# Production start: apply reviewed migrations, import the bulletin only into an
# empty database (never overwrites), then serve the app.
set -e
pnpm db:migrate
pnpm tsx scripts/import-content.ts data/wholelife-current-bulletin.json
exec node dist/index.js
