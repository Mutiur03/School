#!/bin/bash

set -euo pipefail

echo "🔨 Building @school/client-ui once..."
npm run build:client:ui

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

echo "⏳ Waiting for initial @school/client-ui artifacts..."
wait_for_ui_dist

echo "👀 Starting @school/client-ui in watch mode..."
npm run dev:client:ui &
UI_PID=$!

echo "⏳ Ensuring watched @school/client-ui artifacts are ready..."
wait_for_ui_dist

echo "🌐 Starting client dev server..."
npm run dev:client &
CLIENT_PID=$!

echo "✅ Both processes started. Press Ctrl+C to stop both."

stop_tree() {
	local pid="$1"

	if ! kill -0 "$pid" 2>/dev/null; then
		return
	fi

	if command -v taskkill >/dev/null 2>&1; then
		taskkill //PID "$pid" //T //F >/dev/null 2>&1 || true
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

cleanup() {
	trap - INT TERM HUP EXIT
	echo "🛑 Stopping all started processes..."

	stop_tree "$UI_PID"
	stop_tree "$CLIENT_PID"
}

trap cleanup INT TERM HUP EXIT

wait -n "$UI_PID" "$CLIENT_PID" || true
