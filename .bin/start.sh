#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BUILD_HEAD="${1:-dev}"
BROWSER="${2:-chrome}"
SOURCE_DIR="./dist/${BUILD_HEAD}/${BROWSER}"
TARGET="chromium"

if [[ "$BROWSER" == "firefox" ]]; then
  TARGET="firefox-desktop"
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Build output not found: $SOURCE_DIR"
  echo "Run the corresponding build script first."
  exit 1
fi

pnpm exec web-ext run --source-dir "$SOURCE_DIR" --target="$TARGET"
