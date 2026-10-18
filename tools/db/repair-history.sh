#!/usr/bin/env bash
# =============================================================
# Puesta al día del historial de migraciones de producción.
#
# Para migraciones que YA están aplicadas en producción (por ejemplo,
# pegadas a mano en el SQL Editor) pero no aparecen en la tabla
# supabase_migrations.schema_migrations.
#
# Este script NO ejecuta el SQL de las migraciones: solo marca versiones
# como aplicadas en el historial. No toca esquema ni datos.
#
# Uso:
#   bash tools/db/repair-history.sh        # muestra el estado (dry-run)
#   bash tools/db/repair-history.sh -y     # repara las versiones por defecto
#   bash tools/db/repair-history.sh -y 20260901235402 20260902010806
#
# Credenciales: tools/seed-local/.env (SUPABASE_ACCESS_TOKEN; opcional
# SUPABASE_DB_PASSWORD). Ver tools/seed-local/README.md.
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/tools/seed-local/.env"

# Migraciones aplicadas a mano en producción que faltan en el historial.
DEFAULT_VERSIONS=(20260901235402 20260902010806)

REPAIR=0
VERSIONS=()
for arg in "$@"; do
  case "$arg" in
    -y|--yes) REPAIR=1 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    [0-9][0-9]*) VERSIONS+=("$arg") ;;
    *) echo "Argumento no reconocido: $arg" >&2; exit 1 ;;
  esac
done
if [ ${#VERSIONS[@]} -eq 0 ]; then VERSIONS=("${DEFAULT_VERSIONS[@]}"); fi

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "Falta $ENV_FILE (credenciales; ver tools/seed-local/README.md)."
if git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$REPO_ROOT" check-ignore -q "$ENV_FILE" || die "$ENV_FILE no está gitignored."
fi
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

SUPABASE_BIN="${SUPABASE_BIN:-supabase}"
command -v "$SUPABASE_BIN" >/dev/null 2>&1 || die "No encontré '$SUPABASE_BIN'."
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || die "Falta SUPABASE_ACCESS_TOKEN en $ENV_FILE."

if [ -z "${DOCKER_HOST:-}" ] && [ -S "/run/user/$(id -u)/podman/podman.sock" ]; then
  export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
fi
PROJECT_REF="${SUPABASE_PROJECT_REF:-xqfemqgokoedpenmqsmq}"

log "Estado actual del historial (local | remoto)"
"$SUPABASE_BIN" migration list --project-ref "$PROJECT_REF" || true

if [ "$REPAIR" != 1 ]; then
  log "Dry-run: no se tocó nada. Para marcar como aplicadas:"
  echo "  bash tools/db/repair-history.sh -y ${VERSIONS[*]}"
  echo "Esto escribe SOLO en el historial de migraciones de producción."
  exit 0
fi

log "Marcando como aplicadas: ${VERSIONS[*]}"
echo "Solo historial: NO se ejecuta el SQL de esas migraciones."
"$SUPABASE_BIN" migration repair --status applied "${VERSIONS[@]}" \
  --project-ref "$PROJECT_REF" --yes

log "Verificación"
"$SUPABASE_BIN" migration list --project-ref "$PROJECT_REF"
