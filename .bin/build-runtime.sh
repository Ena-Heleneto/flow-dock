#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/secrets-store.sh"

write_manifest() {
  local node_env="$1"
  local browser="$2"
  local mode_dir
  mode_dir="$(resolve_mode_dir "$node_env")"

  local out_dir="$ROOT_DIR/dist/$mode_dir/$browser"
  mkdir -p "$out_dir"

  local gecko_id="${FIREFOX_GECKO_ID:-}"
  if [[ "$browser" == 'firefox' ]]; then
    ensure_firefox_gecko_id
    gecko_id="$FIREFOX_GECKO_ID"
  fi

  NODE_ENV="$node_env" EXTENSION="$browser" FIREFOX_GECKO_ID="$gecko_id" MANIFEST_OUT="$out_dir/manifest.json" pnpm exec esno "$ROOT_DIR/manifest.ts"
  log "manifest generated -> dist/$mode_dir/$browser/manifest.json"
}

discover_page_targets() {
  pnpm exec esno "$ROOT_DIR/scripts/discover-modules.ts" --kind page --format lines
}

run_vite_build() {
  local node_env="$1"
  local browser="$2"
  local target="$3"
  local watch="${4:-false}"
  local page_name="${5:-}"

  local gecko_id="${FIREFOX_GECKO_ID:-}"
  if [[ "$browser" == 'firefox' ]]; then
    ensure_firefox_gecko_id
    gecko_id="$FIREFOX_GECKO_ID"
  fi

  if [[ -n "$page_name" ]]; then
    NODE_ENV="$node_env" EXTENSION="$browser" BUILD_TARGET="$target" PAGE_NAME="$page_name" WATCH="$watch" FIREFOX_GECKO_ID="$gecko_id" pnpm exec vite build
    return
  fi

  NODE_ENV="$node_env" EXTENSION="$browser" BUILD_TARGET="$target" WATCH="$watch" FIREFOX_GECKO_ID="$gecko_id" pnpm exec vite build
}