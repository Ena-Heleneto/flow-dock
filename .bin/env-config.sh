#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_ROOT_DIR="$ROOT_DIR/env"
ENV_CONFIG_DIR="$ENV_ROOT_DIR/config"
ENV_SECRETS_DIR="$ENV_ROOT_DIR/secrets"
ENV_FILE="${FLOW_DOCK_ENV_FILE:-$ENV_CONFIG_DIR/.env}"
PACKAGE_NAME="$(node -p "require('$ROOT_DIR/package.json').name" 2>/dev/null || true)"

if [[ -z "$PACKAGE_NAME" ]]; then
  PACKAGE_NAME='ena-workspace-kit-extension'
fi

log() {
  printf '[%s] %s\n' "$PACKAGE_NAME" "$1"
}

ensure_env_layout() {
  mkdir -p "$ENV_CONFIG_DIR" "$ENV_SECRETS_DIR"
}

migrate_legacy_env_layout() {
  local legacy_env_file="$ROOT_DIR/.env"
  local legacy_secret_dir="$ROOT_DIR/.secret"

  if [[ -f "$legacy_env_file" && ! -f "$ENV_FILE" ]]; then
    mv "$legacy_env_file" "$ENV_FILE"
    log 'migrated .env -> env/config/.env'
  fi

  if [[ -d "$legacy_secret_dir" ]]; then
    local migrated_any='false'

    shopt -s nullglob
    for legacy_file in "$legacy_secret_dir"/*; do
      mv "$legacy_file" "$ENV_SECRETS_DIR/"
      migrated_any='true'
    done
    shopt -u nullglob

    rmdir "$legacy_secret_dir" 2>/dev/null || true

    if [[ "$migrated_any" == 'true' ]]; then
      log 'migrated .secret/* -> env/secrets/'
    fi
  fi
}

load_env() {
  ensure_env_layout
  migrate_legacy_env_layout

  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck source=/dev/null
    . "$ENV_FILE"
    set +a
  fi
}

resolve_mode_dir() {
  local node_env="${1:-production}"
  if [[ "$node_env" == 'production' ]]; then
    echo 'build'
    return
  fi

  echo 'dev'
}