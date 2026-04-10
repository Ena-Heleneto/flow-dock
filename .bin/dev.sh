#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/build-runtime.sh"

cd "$ROOT_DIR"
load_env

"$SCRIPT_DIR/clear.sh" dev

declare -a page_targets=()
mapfile -t page_targets < <(discover_page_targets)

bootstrap_browser() {
	local browser="$1"
	log "bootstrapping dev bundles for $browser"
	run_vite_build 'development' "$browser" 'background' 'false'
	run_vite_build 'development' "$browser" 'content' 'false'

	for page in "${page_targets[@]}"; do
		log "bootstrapping dev page bundle for $browser/$page"
		run_vite_build 'development' "$browser" 'page' 'false' "$page"
	done

	write_manifest 'development' "$browser"
}

if [[ "${DEV_BOOTSTRAP:-false}" == 'true' ]]; then
	bootstrap_browser 'chrome'
	bootstrap_browser 'firefox'
else
	log 'skipping bootstrap bundles (DEV_BOOTSTRAP=false); watchers will run initial build'
	write_manifest 'development' 'chrome'
	write_manifest 'development' 'firefox'
fi

declare -a pids=()

start_watch() {
	local browser="$1"
	local target="$2"
	local page_name="${3:-}"

	if [[ -n "$page_name" ]]; then
		log "starting watcher -> $browser/$target:$page_name"
		run_vite_build 'development' "$browser" "$target" 'true' "$page_name" &
	else
		log "starting watcher -> $browser/$target"
		run_vite_build 'development' "$browser" "$target" 'true' &
	fi

	pids+=("$!")
}

cleanup() {
	for pid in "${pids[@]}"; do
		if kill -0 "$pid" 2>/dev/null; then
			kill "$pid" 2>/dev/null || true
		fi
	done
}

trap cleanup INT TERM EXIT

start_watch 'chrome' 'background'
start_watch 'chrome' 'content'
for page in "${page_targets[@]}"; do
	start_watch 'chrome' 'page' "$page"
done

start_watch 'firefox' 'background'
start_watch 'firefox' 'content'
for page in "${page_targets[@]}"; do
	start_watch 'firefox' 'page' "$page"
done

log 'dev watchers ready (chrome + firefox, foreground mode)'
log 'press Ctrl+C to stop all watchers'
wait
