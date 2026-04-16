#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pnpm exec rimraf --glob dist/dev

NODE_ENV=development APP_ENV=development NPM_CONFIG_LOGLEVEL=error pnpm exec run-p --npm-path pnpm _dev:web _dev:chrome _dev:firefox
