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

declare -a background_targets=()
mapfile -t background_targets < <(discover_background_targets)

declare -a content_targets=()
mapfile -t content_targets < <(discover_content_targets)

has_background='false'
if [[ ${#background_targets[@]} -gt 0 ]]; then
	has_background='true'
fi

has_content='false'
if [[ ${#content_targets[@]} -gt 0 ]]; then
	has_content='true'
fi

has_page='false'
if [[ ${#page_targets[@]} -gt 0 ]]; then
	has_page='true'
fi

bootstrap_browser() {
	local browser="$1"
	log "bootstrapping dev bundles for $browser"

	if [[ "$has_background" == 'true' ]]; then
		run_vite_build 'development' "$browser" 'background' 'false'
	else
		log "skipping bootstrap bundle for $browser/background (no module discovered)"
	fi

	if [[ "$has_content" == 'true' ]]; then
		run_vite_build 'development' "$browser" 'content' 'false'
	else
		log "skipping bootstrap bundle for $browser/content (no module discovered)"
	fi

	if [[ "$has_page" == 'true' ]]; then
		for page in "${page_targets[@]}"; do
			log "bootstrapping dev page bundle for $browser/$page"
			run_vite_build 'development' "$browser" 'page' 'false' "$page"
		done
	else
		log "skipping bootstrap page bundles for $browser (no module discovered)"
	fi

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
watch_count=0

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
	watch_count=$((watch_count + 1))
}

cleanup() {
	for pid in "${pids[@]}"; do
		if kill -0 "$pid" 2>/dev/null; then
			kill "$pid" 2>/dev/null || true
		fi
	done
}

trap cleanup INT TERM EXIT

if [[ "$has_background" == 'true' ]]; then
	start_watch 'chrome' 'background'
	start_watch 'firefox' 'background'
else
	log 'skipping background watcher (no module discovered)'
fi

if [[ "$has_content" == 'true' ]]; then
	start_watch 'chrome' 'content'
	start_watch 'firefox' 'content'
else
	log 'skipping content watcher (no module discovered)'
fi

if [[ "$has_page" == 'true' ]]; then
	for page in "${page_targets[@]}"; do
		start_watch 'chrome' 'page' "$page"
		start_watch 'firefox' 'page' "$page"
	done
else
	log 'skipping page watcher (no module discovered)'
fi

if [[ "$watch_count" -eq 0 ]]; then
	log 'no watch targets discovered in apps/*, exiting dev script successfully'
	exit 0
fi

log 'dev watchers ready (chrome + firefox, foreground mode)'
log 'press Ctrl+C to stop all watchers'
wait
