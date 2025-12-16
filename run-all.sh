#!/usr/bin/env bash
# Run multiple project dev servers in one terminal (POSIX shell / WSL / macOS).
# Requires Node.js and npx to be available in PATH.

set -euo pipefail

# Ensure the script always runs from its own directory so commands are location-agnostic.
# This makes the script safe to run from any working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Edit these commands to match each package's dev script if needed.
CMD1="cd server && npm run dev"
CMD2="cd client && npm run dev"
CMD3="cd admin && npm run dev"

echo "Starting dev servers (close this terminal to stop all)..."

# Use npx concurrently to run them in one terminal.
npx --yes concurrently \
  "$CMD1" \
  "$CMD2" \
  "$CMD3" \
  --names "SERVER,CLIENT,ADMIN" --kill-others --success first

exit $?
