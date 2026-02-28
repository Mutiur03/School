#!/bin/bash

# ─── Define your servers here ───────────────────────────────────────────────
declare -A SERVERS=(
  ["server"]="cd server && npm run dev"
  ["client"]="npm run dev:client"
  ["client-ui"]="npm run dev:client:ui"
)
# ────────────────────────────────────────────────────────────────────────────

PIDS=()
NAMES=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cleanup() {
  echo -e "\n${YELLOW}Shutting down all servers...${NC}"

  # Kill by port (most reliable for Windows Node processes)
  echo -e "  ${RED}Killing processes on ports 3001, 5173-5180...${NC}"
  for PORT in 3001 5173 5174 5175 5176 5177 5178 5179 5180; do
    PID=$(cmd.exe /c "netstat -ano | findstr :${PORT}" 2>/dev/null | awk '{print $5}' | head -1 | tr -d '\r')
    if [[ -n "$PID" && "$PID" != "0" ]]; then
      echo -e "  ${RED}Killing${NC} PID $PID on port $PORT"
      taskkill.exe /PID "$PID" /F /T 2>/dev/null
    fi
  done

  # Also kill by name to catch anything missed
  echo -e "  ${RED}Killing${NC} remaining node/nodemon processes..."
  taskkill.exe /IM node.exe /F 2>/dev/null
  taskkill.exe /IM nodemon.exe /F 2>/dev/null

  echo -e "${GREEN}All servers stopped.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "${CYAN}Starting dev servers...${NC}\n"

for NAME in "${!SERVERS[@]}"; do
  CMD=${SERVERS[$NAME]}
  echo -e "  ${GREEN}Starting${NC} ${NAME}: ${CMD}"

  bash -c "$CMD" 2>&1 | while IFS= read -r line; do
    echo -e "[${CYAN}${NAME}${NC}] $line"
  done &

  PIDS+=($!)
  NAMES+=("$NAME")
done

echo -e "\n${GREEN}All servers running.${NC} Press ${RED}Ctrl+C${NC} to stop all.\n"

while true; do sleep 1; done