#!/bin/bash

set -euo pipefail

echo "🔨 Building @school/client-ui once..."
npm run build:client:ui

echo "👀 Starting @school/client-ui in watch mode..."
npm run dev:client:ui &
UI_PID=$!

echo "🌐 Starting client dev server..."
npm run dev:client &
CLIENT_PID=$!

echo "✅ Both processes started. Press Ctrl+C to stop both."

stop_tree() {
	local pid="$1"

	if ! kill -0 "$pid" 2>/dev/null; then
		return
	fi

	if command -v pgrep >/dev/null 2>&1; then
		local child
		while read -r child; do
			[ -n "$child" ] && stop_tree "$child"
		done < <(pgrep -P "$pid" || true)
	fi

	kill -TERM "$pid" 2>/dev/null || true
}

cleanup() {
	trap - INT TERM EXIT
	echo "🛑 Stopping all started processes..."

	stop_tree "$UI_PID"
	stop_tree "$CLIENT_PID"

	sleep 1
	kill -KILL "$UI_PID" "$CLIENT_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

wait
