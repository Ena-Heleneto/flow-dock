#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/env-config.sh"

ensure_firefox_gecko_id() {
  ensure_env_layout

  local id_file="$ENV_SECRETS_DIR/firefox.gecko.id"
  local gecko_prefix
  gecko_prefix="$(printf '%s' "$PACKAGE_NAME" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-')"

  if [[ -z "$gecko_prefix" ]]; then
    gecko_prefix='extension'
  fi

  if [[ -n "${FIREFOX_GECKO_ID:-}" ]]; then
    printf '%s\n' "$FIREFOX_GECKO_ID" > "$id_file"
  fi

  if [[ -f "$id_file" ]]; then
    FIREFOX_GECKO_ID="$(tr -d '\r\n' < "$id_file")"
  fi

  if [[ -z "${FIREFOX_GECKO_ID:-}" ]]; then
    FIREFOX_GECKO_ID="$gecko_prefix-$(date +%s)-$RANDOM@flowdock.local"
    printf '%s\n' "$FIREFOX_GECKO_ID" > "$id_file"
  fi

  export FIREFOX_GECKO_ID
}

ensure_chrome_private_key() {
  ensure_env_layout

  local chrome_key="$ENV_SECRETS_DIR/chrome.pem"
  local generated_key="$ENV_SECRETS_DIR/key.pem"

  if [[ ! -f "$chrome_key" ]]; then
    if [[ -f "$generated_key" ]]; then
      mv "$generated_key" "$chrome_key"
    else
      log 'chrome key not found, generating a new one in env/secrets/'
      pnpm exec crx keygen "$ENV_SECRETS_DIR"
      mv "$generated_key" "$chrome_key"
    fi
  fi

  printf '%s\n' "$chrome_key"
}