#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/build-runtime.sh"

cd "$ROOT_DIR"
load_env

"$SCRIPT_DIR/clear.sh" build

declare -a background_targets=()
mapfile -t background_targets < <(discover_background_targets)

declare -a content_targets=()
mapfile -t content_targets < <(discover_content_targets)

declare -a page_targets=()
mapfile -t page_targets < <(discover_page_targets)

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

build_browser() {
	local browser="$1"

	log "building production bundles for $browser"

	if [[ "$has_background" == 'true' ]]; then
		run_vite_build 'production' "$browser" 'background' 'false'
	else
		log "skipping production background bundle for $browser (no module discovered)"
	fi

	if [[ "$has_content" == 'true' ]]; then
		run_vite_build 'production' "$browser" 'content' 'false'
	else
		log "skipping production content bundle for $browser (no module discovered)"
	fi

	if [[ "$has_page" == 'true' ]]; then
		for page in "${page_targets[@]}"; do
			log "building production page bundle for $browser/$page"
			run_vite_build 'production' "$browser" 'page' 'false' "$page"
		done
	else
		log "skipping production page bundles for $browser (no module discovered)"
	fi

	write_manifest 'production' "$browser"
}

build_browser 'chrome'
build_browser 'firefox'

log 'build finished -> dist/build/chrome, dist/build/firefox'
