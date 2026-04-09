#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/build-runtime.sh"

cd "$ROOT_DIR"
load_env

"$SCRIPT_DIR/clear.sh" build

build_browser() {
	local browser="$1"
	local -a page_targets=()
	mapfile -t page_targets < <(discover_page_targets)

	log "building production bundles for $browser"
	run_vite_build 'production' "$browser" 'background' 'false'
	run_vite_build 'production' "$browser" 'content' 'false'

	for page in "${page_targets[@]}"; do
		log "building production page bundle for $browser/$page"
		run_vite_build 'production' "$browser" 'page' 'false' "$page"
	done

	write_manifest 'production' "$browser"
}

build_browser 'chrome'
build_browser 'firefox'

log 'build finished -> dist/build/chrome, dist/build/firefox'
