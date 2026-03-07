#!/bin/bash

# ─── Define your servers here ───────────────────────────────────────────────
declare -A SERVERS=(
  ["server"]="cd server && npm run dev"
  ["client"]="npm run dev:client"
  ["client-ui"]="npm run dev:client:ui"
  ["common-ui"]="npm run dev:common:ui"
  ["shared-schemas"]="npm run dev:shared-schemas"
  ["admin"]="cd dashboard && npm run dev:admin"
  ["teacher"]="cd dashboard && npm run dev:teacher"
  # ["student"]="cd dashboard && npm run dev:student"
)
PORTS=(3001 5173 5174 5175 5176 5177 5178 5179 5180)
# ────────────────────────────────────────────────────────────────────────────

PIDS=()
NAMES=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Detect if running in WSL
is_wsl() {
  grep -qi microsoft /proc/version 2>/dev/null
}

kill_all() {
  if is_wsl; then
    # ── WSL: use taskkill + netstat to kill Windows processes ──
    for PORT in "${PORTS[@]}"; do
      PID=$(cmd.exe /c "netstat -ano | findstr :${PORT}" 2>/dev/null \
            | awk '{print $5}' | head -1 | tr -d '\r')
      if [[ -n "$PID" && "$PID" != "0" ]]; then
        echo -e "  ${RED}Killing${NC} PID $PID on port $PORT"
        taskkill.exe /PID "$PID" /F /T 2>/dev/null
      fi
    done
    taskkill.exe /IM node.exe /F 2>/dev/null
    taskkill.exe /IM nodemon.exe /F 2>/dev/null
  else
    # ── Linux: kill process tree recursively ──
    kill_tree() {
      local PID=$1
      for CHILD in $(pgrep -P "$PID" 2>/dev/null); do
        kill_tree "$CHILD"
      done
      kill -KILL "$PID" 2>/dev/null
    }

    for i in "${!PIDS[@]}"; do
      echo -e "  ${RED}Stopping${NC} ${NAMES[$i]} (PID: ${PIDS[$i]})"
      kill_tree "${PIDS[$i]}"
    done

    # Also free ports just in case
    for PORT in "${PORTS[@]}"; do
      PID=$(lsof -ti :"$PORT" 2>/dev/null)
      [[ -n "$PID" ]] && kill -KILL "$PID" 2>/dev/null
    done
  fi
}

cleanup() {
  echo -e "\n${YELLOW}Shutting down all servers...${NC}"
  kill_all
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