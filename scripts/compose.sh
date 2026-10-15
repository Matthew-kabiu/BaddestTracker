#!/usr/bin/env sh
# Always pair interpolation and runtime configuration with the intended environment.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
case "${1-}" in
  development) compose=dev ;;
  production) compose=prod ;;
  *) printf '%s\n' 'Usage: sh scripts/compose.sh development|production <compose arguments>' >&2; exit 2 ;;
esac
environment=$1
shift
env_file="$ROOT/.env.$environment"
test -f "$env_file" || { printf 'Missing %s; run scripts/init-env.py first.\n' "$env_file" >&2; exit 1; }
python3 "$ROOT/scripts/validate-env.py" "$environment" >&2
# Prevent an exported variable (or .env) from silently overriding the selected file.
while IFS='=' read -r key rest; do
  case "$key" in ''|'#'*) continue ;; esac
  case "$key" in *[!A-Z0-9_]*) printf '%s\n' 'Invalid environment key' >&2; exit 1 ;; esac
  unset "$key"
done < "$env_file"
exec docker compose --project-directory "$ROOT" --env-file "$env_file" -f "$ROOT/docker-compose.$compose.yml" "$@"
