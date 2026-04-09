#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/env-config.sh"

scope="${1:-all}"

case "$scope" in
	all)
		rm -rf "$ROOT_DIR/dist" "$ROOT_DIR/extension/dist" "$ROOT_DIR/extension/manifest.json"
		log 'cleaned all dist artifacts'
		;;
	dev)
		rm -rf "$ROOT_DIR/dist/dev"
		log 'cleaned dist/dev artifacts'
		;;
	build)
		rm -rf "$ROOT_DIR/dist/build"
		log 'cleaned dist/build artifacts'
		;;
	pack)
		rm -rf "$ROOT_DIR/dist/pack"
		log 'cleaned dist/pack artifacts'
		;;
	*)
		printf '[%s] unknown clear scope: %s (all|dev|build|pack)\n' "$PACKAGE_NAME" "$scope" >&2
		exit 1
		;;
esac
