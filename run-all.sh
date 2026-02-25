#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

UI_PID=""
SERVER_PID=""
CLIENT_PID=""
ADMIN_PID=""
TEACHER_PID=""

trap 'cleanup; exit 130' INT TERM HUP
trap cleanup EXIT

is_port_available() {
  local port="$1"
  node -e 'const net=require("net");const p=Number(process.argv[1]);const s=net.createServer();s.once("error",e=>process.exit(e.code==="EADDRINUSE"?1:2));s.once("listening",()=>s.close(()=>process.exit(0)));s.listen(p,"127.0.0.1");' "$port" >/dev/null 2>&1
}

is_server_reachable() {
  local server_port="${1:-3001}"
  # Use a raw TCP connect check so readiness does not depend on HTTP routes.
  node -e 'const net=require("net");const p=Number(process.argv[1]);const s=net.connect({host:"127.0.0.1",port:p});const done=(c)=>{try{s.destroy();}catch{};process.exit(c)};s.setTimeout(1500);s.once("connect",()=>done(0));s.once("timeout",()=>done(1));s.once("error",()=>done(1));' "$server_port" >/dev/null 2>&1
}

is_server_health_reachable() {
  local server_port="${1:-3001}"
  local health_url_local="http://localhost:${server_port}/api/health"
  local health_url_loopback="http://127.0.0.1:${server_port}/api/health"

  if command -v curl >/dev/null 2>&1; then
    if curl -fsS --max-time 2 "$health_url_local" >/dev/null 2>&1; then
      return 0
    fi
    if curl -fsS --max-time 2 "$health_url_loopback" >/dev/null 2>&1; then
      return 0
    fi
  fi

  return 1
}

wait_for_ui_dist() {
  local dist_dir="packages/client-ui/dist"
  local js_file="$dist_dir/index.js"
  local css_file="$dist_dir/index.css"
  local timeout_sec=30
  local elapsed=0

  while [ $elapsed -lt $timeout_sec ]; do
    if [ -s "$js_file" ] && [ -s "$css_file" ]; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  echo "❌ Timed out waiting for @school/client-ui dist files in $dist_dir"
  return 1
}

stop_tree() {
  local pid="$1"

  if ! kill -0 "$pid" 2>/dev/null; then
    return
  fi

  # In WSL/Git Bash, prefer POSIX process-tree shutdown. taskkill can exist
  # but does not reliably terminate Linux child PIDs.
  if command -v taskkill >/dev/null 2>&1 && [ -z "${WSL_INTEROP:-}" ]; then
    taskkill /PID "$pid" /T /F >/dev/null 2>&1 || true
    return
  fi

  if command -v pgrep >/dev/null 2>&1; then
    local child
    while read -r child; do
      [ -n "$child" ] && stop_tree "$child"
    done < <(pgrep -P "$pid" || true)
  fi

  kill -TERM "$pid" 2>/dev/null || true
  sleep 1
  kill -KILL "$pid" 2>/dev/null || true
}

stop_tree_if_set() {
  local pid="${1:-}"
  [ -n "$pid" ] || return 0
  stop_tree "$pid"
}

wait_for_server() {
  local server_port="${SERVER_PORT:-3001}"
  local timeout_sec="${SERVER_START_TIMEOUT:-20}"
  local elapsed=0

  echo "⏳ Waiting for server on http://localhost:${server_port} ..."

  while [ "$elapsed" -lt "$timeout_sec" ]; do
    if is_server_health_reachable "$server_port" || is_server_reachable "$server_port"; then
      echo "✅ Server is reachable on port ${server_port}."
      return 0
    fi

    if [ -n "$SERVER_PID" ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo "⚠️ Server process exited before readiness check passed; continuing startup."
      return 0
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  echo "⚠️ Server readiness timed out after ${timeout_sec}s; continuing to start frontend apps."
  return 0
}

cleanup() {
  trap - INT TERM HUP EXIT
  echo "🛑 Stopping all started processes..."

  stop_tree_if_set "$UI_PID"
  stop_tree_if_set "$SERVER_PID"
  stop_tree_if_set "$CLIENT_PID"
  stop_tree_if_set "$ADMIN_PID"
  stop_tree_if_set "$TEACHER_PID"

  # Fallback: terminate any remaining direct child processes of this script.
  if command -v pkill >/dev/null 2>&1; then
    pkill -TERM -P "$$" >/dev/null 2>&1 || true
    sleep 1
    pkill -KILL -P "$$" >/dev/null 2>&1 || true
  fi
}

echo "📦 Installing root dependencies..."
npm install

echo "🔨 Building @school/client-ui once..."
npm run build:client:ui

echo "⏳ Waiting for initial @school/client-ui artifacts..."
wait_for_ui_dist

echo "👀 Starting @school/client-ui in watch mode..."
npm run dev:client:ui &
UI_PID=$!

echo "⏳ Ensuring watched @school/client-ui artifacts are ready..."
wait_for_ui_dist

SERVER_PORT_VALUE="${SERVER_PORT:-3001}"

if is_port_available "$SERVER_PORT_VALUE"; then
  echo "🚀 Starting server first..."
  (cd server && npm install)
  (cd server && npm run dev) &
  SERVER_PID=$!
else
  if is_server_reachable "$SERVER_PORT_VALUE"; then
    echo "ℹ️ Port ${SERVER_PORT_VALUE} is in use and reachable; reusing existing server process."
  else
    echo "⚠️ Port ${SERVER_PORT_VALUE} is in use but server is not reachable; starting server anyway."
    (cd server && npm install)
    (cd server && npm run dev) &
    SERVER_PID=$!
  fi
fi

if [ "${WAIT_FOR_SERVER:-0}" = "1" ]; then
  wait_for_server
else
  echo "⏭️ Skipping server readiness wait (set WAIT_FOR_SERVER=1 to enable)."
fi

echo "🚀 Starting client and dashboard apps..."

(cd client && npm install && npm run dev) &
CLIENT_PID=$!

echo "📦 Installing dashboard dependencies once..."
(cd dashboard && npm install)

(cd dashboard && npm run dev:admin) &
ADMIN_PID=$!

(cd dashboard && npm run dev:teacher) &
TEACHER_PID=$!

echo "✅ All processes started. Press Ctrl+C to stop everything."

WAIT_PIDS=("$UI_PID" "$CLIENT_PID" "$ADMIN_PID" "$TEACHER_PID")
if [ -n "$SERVER_PID" ]; then
  WAIT_PIDS+=("$SERVER_PID")
fi

wait -n "${WAIT_PIDS[@]}" || true
