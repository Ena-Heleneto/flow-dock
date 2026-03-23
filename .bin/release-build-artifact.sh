#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SECRET_DIR="./.secret/release"
KEY_PATH="$SECRET_DIR/key.pem"

node -e "require('node:fs').mkdirSync('dist/release', { recursive: true })"
node -e "require('node:fs').mkdirSync('.secret/release', { recursive: true })"
pnpm exec rimraf --glob \
	./dist/release/chrome \
	./dist/release/firefox

NODE_ENV=production APP_ENV=production EXTENSION_DIR=dist/release/chrome pnpm run _build:single
NODE_ENV=production APP_ENV=production EXTENSION=firefox EXTENSION_DIR=dist/release/firefox pnpm run _build:single

pnpm exec rimraf --glob \
	./dist/release/extension.chrome.zip \
	./dist/release/extension.firefox.zip \
	./dist/release/extension.chrome.crx \
	./dist/release/extension.firefox.xpi \
	./dist/release/key.pem

pnpm exec jszip-cli add dist/release/chrome/* -o ./dist/release/extension.chrome.zip
pnpm exec jszip-cli add dist/release/firefox/* -o ./dist/release/extension.firefox.zip

if [[ ! -f "$KEY_PATH" ]]; then
	if command -v openssl >/dev/null 2>&1; then
		openssl genrsa -out "$KEY_PATH" 2048
	else
		node -e "const { generateKeyPairSync } = require('node:crypto'); const { writeFileSync } = require('node:fs'); const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' } }); writeFileSync(process.argv[1], privateKey);" "$KEY_PATH"
	fi
fi

pnpm exec crx pack dist/release/chrome -o ./dist/release/extension.chrome.crx -p "$KEY_PATH"

WEB_EXT_ARTIFACTS_DIR=./dist/release pnpm exec web-ext build --source-dir ./dist/release/firefox --filename extension.firefox.xpi --overwrite-dest
