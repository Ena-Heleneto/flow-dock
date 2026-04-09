#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/build-runtime.sh"

cd "$ROOT_DIR"
load_env
ensure_env_layout

"$SCRIPT_DIR/build.sh"

PACK_DIR="$ROOT_DIR/dist/pack"
"$SCRIPT_DIR/clear.sh" pack
mkdir -p "$PACK_DIR"

chrome_key="$(ensure_chrome_private_key)"

package_name="$(node -p "require('./package.json').name")"
package_version="$(node -p "require('./package.json').version")"
artifact_base="$package_name-$package_version"

log 'packing chrome artifacts (.zip + .crx)'
(
	cd "$ROOT_DIR/dist/build/chrome"
	zip -rq "$PACK_DIR/$artifact_base.zip" .
)

CRX_SOURCE_DIR="$ROOT_DIR/dist/build/chrome" CRX_KEY_FILE="$chrome_key" CRX_OUTPUT_FILE="$PACK_DIR/$artifact_base.crx" node -e "const fs=require('fs');const path=require('path');const { consola }=require('consola');const ChromeExtension=require('crx');(async()=>{const privateKey=fs.readFileSync(process.env.CRX_KEY_FILE);const crx=new ChromeExtension({privateKey});await crx.load(path.resolve(process.env.CRX_SOURCE_DIR));const crxBuffer=await crx.pack();fs.writeFileSync(process.env.CRX_OUTPUT_FILE,crxBuffer);})().catch((error)=>{consola.error(error);process.exit(1);});"

if [[ -n "${AMO_API_KEY:-}" && -n "${AMO_API_SECRET:-}" ]]; then
	amo_channel="${AMO_CHANNEL:-unlisted}"
	if [[ "$amo_channel" != 'listed' && "$amo_channel" != 'unlisted' ]]; then
		printf '[%s] AMO_CHANNEL must be listed or unlisted\n' "$PACKAGE_NAME" >&2
		exit 1
	fi

log 'signing firefox artifact (.xpi) with AMO credentials'
	pnpm exec web-ext sign --source-dir "$ROOT_DIR/dist/build/firefox" --artifacts-dir "$PACK_DIR" --api-key "$AMO_API_KEY" --api-secret "$AMO_API_SECRET" --channel "$amo_channel" --no-input
else
	log 'AMO credentials not found, generating unsigned firefox xpi'
	pnpm exec web-ext build --source-dir "$ROOT_DIR/dist/build/firefox" --artifacts-dir "$PACK_DIR" --filename "$artifact_base.xpi" --overwrite-dest --no-input
fi

if [[ ! -f "$PACK_DIR/$artifact_base.zip" ]]; then
	printf '[%s] missing zip artifact: %s\n' "$PACKAGE_NAME" "$PACK_DIR/$artifact_base.zip" >&2
	exit 1
fi

if [[ ! -f "$PACK_DIR/$artifact_base.crx" ]]; then
	printf '[%s] missing crx artifact: %s\n' "$PACKAGE_NAME" "$PACK_DIR/$artifact_base.crx" >&2
	exit 1
fi

mapfile -t xpi_files < <(find "$PACK_DIR" -maxdepth 1 -type f -name '*.xpi' -print)
if [[ "${#xpi_files[@]}" -eq 0 ]]; then
	printf '[%s] missing xpi artifact under %s\n' "$PACKAGE_NAME" "$PACK_DIR" >&2
	exit 1
fi

log 'pack finished -> dist/pack (.zip + .crx + .xpi)'
