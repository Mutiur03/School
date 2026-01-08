#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CMD1="cd server && npm i && npm run dev"
CMD2="cd client && npm i && npm run dev"
CMD3="cd dashboard && npm i && npm run dev:admin"
CMD4="cd dashboard && npm i && npm run dev:teacher"

echo "Starting dev servers (close this terminal to stop all)..."

npx --yes concurrently \
  "$CMD1" \
  "$CMD2" \
  "$CMD3" \
  "$CMD4" \
  --names "SERVER,CLIENT,ADMIN,TEACHER" --kill-others --success first

exit $?