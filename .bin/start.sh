#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/build-runtime.sh"

cd "$ROOT_DIR"
load_env

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

choose_browser() {
	local input="${1:-}"
	case "$input" in
		chrome|firefox)
			echo "$input"
			return
			;;
	esac

	if [[ ! -t 0 ]]; then
		printf '[%s] non-interactive terminal detected, please use: pnpm run start:chrome or pnpm run start:firefox\n' "$PACKAGE_NAME" >&2
		exit 1
	fi

	while true; do
		printf '请选择要启动的浏览器:\n'
		printf '  1) chrome\n'
		printf '  2) firefox\n'
		printf '输入编号 [1/2]: '

		read -r choice
		case "$choice" in
			1|chrome)
				echo 'chrome'
				return
				;;
			2|firefox)
				echo 'firefox'
				return
				;;
			*)
				printf '[%s] invalid choice: %s (可用: 1/2/chrome/firefox)\n' "$PACKAGE_NAME" "$choice" >&2
				;;
		esac
	done
}

ensure_dev_bundle() {
	local browser="$1"
	local manifest_file="$ROOT_DIR/dist/dev/$browser/manifest.json"
	local bundle_root="$ROOT_DIR/dist/dev/$browser"
	local needs_build='false'

	if [[ ! -f "$manifest_file" ]]; then
		needs_build='true'
	fi

	if [[ "$has_background" == 'true' && ! -f "$bundle_root/background/index.mjs" ]]; then
		needs_build='true'
	fi

	if [[ "$has_content" == 'true' && ! -f "$bundle_root/content-scripts/index.global.js" ]]; then
		needs_build='true'
	fi

	if [[ "$has_page" == 'true' ]]; then
		for page in "${page_targets[@]}"; do
			if [[ ! -f "$bundle_root/$page/index.html" ]]; then
				needs_build='true'
				break
			fi
		done
	fi

	if [[ "$needs_build" == 'false' ]]; then
		return
	fi

	log "dev bundle not found for $browser, generating now"

	if [[ "$has_background" == 'true' ]]; then
		run_vite_build 'development' "$browser" 'background' 'false'
	else
		log "skipping dev background bundle for $browser (no module discovered)"
	fi

	if [[ "$has_content" == 'true' ]]; then
		run_vite_build 'development' "$browser" 'content' 'false'
	else
		log "skipping dev content bundle for $browser (no module discovered)"
	fi

	if [[ "$has_page" == 'true' ]]; then
		for page in "${page_targets[@]}"; do
			log "building missing dev page bundle for $browser/$page"
			run_vite_build 'development' "$browser" 'page' 'false' "$page"
		done
	else
		log "skipping dev page bundles for $browser (no module discovered)"
	fi

	write_manifest 'development' "$browser"
}

target_browser="$(choose_browser "${1:-}")"
ensure_dev_bundle "$target_browser"

if [[ "$has_background" == 'false' && "$has_content" == 'false' && "$has_page" == 'false' ]]; then
	log 'no runnable modules discovered in apps/*, skipping extension runner'
	exit 0
fi

log 'web-ext runner will stay in foreground'
log 'press Ctrl+C to stop runner'

if [[ "$target_browser" == 'chrome' ]]; then
	command=(pnpm exec web-ext run --target=chromium --source-dir "$ROOT_DIR/dist/dev/chrome" --no-input)
	if [[ -n "${CHROMIUM_BINARY:-}" ]]; then
		command+=(--chromium-binary "$CHROMIUM_BINARY")
	fi

	log 'starting chromium extension runner'
	"${command[@]}"
	exit
fi

command=(pnpm exec web-ext run --target=firefox-desktop --source-dir "$ROOT_DIR/dist/dev/firefox" --no-input)
if [[ -n "${FIREFOX_BINARY:-}" ]]; then
	command+=(--firefox "$FIREFOX_BINARY")
fi

log 'starting firefox extension runner'
"${command[@]}"
