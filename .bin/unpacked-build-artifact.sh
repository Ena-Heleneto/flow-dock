#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SECRET_DIR="./.secret/unpacked"
KEY_PATH="$SECRET_DIR/key.pem"

node -e "require('node:fs').mkdirSync('dist/unpacked', { recursive: true })"
node -e "require('node:fs').mkdirSync('.secret/unpacked', { recursive: true })"
pnpm exec rimraf --glob \
	./dist/unpacked/chrome \
	./dist/unpacked/firefox

NODE_ENV=production APP_ENV=testing EXTENSION_DIR=dist/unpacked/chrome pnpm run _build:single
NODE_ENV=production APP_ENV=testing EXTENSION=firefox EXTENSION_DIR=dist/unpacked/firefox pnpm run _build:single

pnpm exec rimraf --glob \
	./dist/unpacked/extension.chrome.zip \
	./dist/unpacked/extension.firefox.zip \
	./dist/unpacked/extension.chrome.crx \
	./dist/unpacked/extension.firefox.xpi \
	./dist/unpacked/key.pem

pnpm exec jszip-cli add dist/unpacked/chrome/* -o ./dist/unpacked/extension.chrome.zip
pnpm exec jszip-cli add dist/unpacked/firefox/* -o ./dist/unpacked/extension.firefox.zip

if [[ ! -f "$KEY_PATH" ]]; then
	openssl genrsa -out "$KEY_PATH" 2048
fi

pnpm exec crx pack dist/unpacked/chrome -o ./dist/unpacked/extension.chrome.crx -p "$KEY_PATH"

WEB_EXT_ARTIFACTS_DIR=./dist/unpacked pnpm exec web-ext build --source-dir ./dist/unpacked/firefox --filename extension.firefox.xpi --overwrite-dest
