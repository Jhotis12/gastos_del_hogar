#!/usr/bin/env bash
# =============================================================
# Seed del entorno local con una copia (solo datos) de producción.
#
# Lee credenciales de tools/seed-local/.env (gitignored).
# Uso:
#   bash tools/seed-local/seed-local.sh            # pide confirmación
#   bash tools/seed-local/seed-local.sh -y         # sin confirmación (agentes)
#   bash tools/seed-local/seed-local.sh --dry-run  # muestra los comandos
#
# Va a producción SOLO para leer (pg_dump). Nunca escribe en producción.
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"
BACKUPS_DIR="$REPO_ROOT/backups"
DATA_DUMP="$BACKUPS_DIR/prod-data.sql"
SCHEMA_DUMP="$BACKUPS_DIR/prod-schema.sql"

# Tablas que NO se copian:
# - storage.*: el reset local crea los buckets y las imágenes no viajan igual.
# - auth efímero (sesiones/tokens/OTP): son secretos de producción, no hacen
#   falta para probar y evitan drift con el esquema de GoTrue local.
#   auth.users + auth.identities SÍ se copian (login con usuarios reales).
DUMP_EXCLUDES="--exclude storage.buckets --exclude storage.objects --exclude auth.sessions --exclude auth.refresh_tokens --exclude auth.one_time_tokens --exclude auth.flow_state --exclude auth.mfa_amr_claims --exclude auth.audit_log_entries"

DRY_RUN=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -y|--yes) ASSUME_YES=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Argumento no reconocido: $arg" >&2; exit 1 ;;
  esac
done

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
run() {
  if [ "$DRY_RUN" = 1 ]; then
    printf '+ %s\n' "$*"
  else
    "$@"
  fi
}

# ---------- 0) Credenciales y seguridad ----------
if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  die "Creé $ENV_FILE desde el ejemplo. Completa las credenciales y vuelve a ejecutar."
fi

# El .env NUNCA debe poder commitearse.
if git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$REPO_ROOT" check-ignore -q "$ENV_FILE" \
    || die "$ENV_FILE no está gitignored. Abortado por seguridad."
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

SUPABASE_BIN="${SUPABASE_BIN:-supabase}"
command -v "$SUPABASE_BIN" >/dev/null 2>&1 \
  || die "No encontré '$SUPABASE_BIN'. Instala la CLI de Supabase o define SUPABASE_BIN."

# Docker o Podman rootless: si no hay DOCKER_HOST, detecta el socket de Podman.
if [ -z "${DOCKER_HOST:-}" ] && [ -S "/run/user/$(id -u)/podman/podman.sock" ]; then
  export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
fi
docker info >/dev/null 2>&1 \
  || die "Docker/Podman no responde. Agrega tu usuario al grupo docker o usa Podman rootless (ver README.md en esta carpeta)."

# Ref del proyecto: env > .temp > default del repo.
PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
if [ -z "$PROJECT_REF" ] && [ -f "$REPO_ROOT/supabase/.temp/project-ref" ]; then
  PROJECT_REF="$(cat "$REPO_ROOT/supabase/.temp/project-ref")"
fi
PROJECT_REF="${PROJECT_REF:-xqfemqgokoedpenmqsmq}"

if [ -z "${SUPABASE_DB_URL:-}" ] && [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  die "Falta SUPABASE_ACCESS_TOKEN en $ENV_FILE (o define SUPABASE_DB_URL)."
fi

# Estado del stack local: de aquí salen la URL real de la DB y el contenedor.
STATUS_ENV="$("$SUPABASE_BIN" status -o env 2>/dev/null || true)"
if [ -z "$STATUS_ENV" ] && [ "$DRY_RUN" != 1 ]; then
  die "El stack local no está arriba. Ejecuta 'supabase start' primero."
fi
status_get() { printf '%s\n' "$STATUS_ENV" | grep -m1 "^$1=" | cut -d= -f2- | tr -d '"'; }

PROJECT_ID="$(grep -m1 '^project_id' "$REPO_ROOT/supabase/config.toml" | cut -d'"' -f2)"
LOCAL_DB_URL="${LOCAL_DB_URL:-$(status_get DB_URL)}"
LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54332/postgres}"
LOCAL_DB_CONTAINER="${LOCAL_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -m1 '^supabase_db_' || true)}"
LOCAL_DB_CONTAINER="${LOCAL_DB_CONTAINER:-supabase_db_${PROJECT_ID}}"

# ---------- 1) Dump de producción (solo lectura) ----------
log "1/4 Dump de producción (solo lectura) → $BACKUPS_DIR"
mkdir -p "$BACKUPS_DIR"

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  run "$SUPABASE_BIN" db dump --db-url "$SUPABASE_DB_URL" --data-only \
    $DUMP_EXCLUDES -f "$DATA_DUMP"
  run "$SUPABASE_BIN" db dump --db-url "$SUPABASE_DB_URL" --schema public -f "$SCHEMA_DUMP"
else
  # --project-ref funciona en un clon nuevo (no requiere `supabase link`).
  run "$SUPABASE_BIN" db dump --project-ref "$PROJECT_REF" --data-only \
    $DUMP_EXCLUDES -f "$DATA_DUMP"
  run "$SUPABASE_BIN" db dump --project-ref "$PROJECT_REF" --schema public -f "$SCHEMA_DUMP"
fi

# ---------- 2) Confirmación (reset local es destructivo) ----------
if [ "$DRY_RUN" != 1 ] && [ "$ASSUME_YES" != 1 ]; then
  read -r -p "Esto BORRA la base local y restaura el dump de producción. ¿Continuar? [y/N] " answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) die "Cancelado por el usuario." ;;
  esac
fi

# ---------- 3) Reset local + restore ----------
log "2/4 Reset de la base local (aplica todas las migraciones)"
run "$SUPABASE_BIN" db reset --local --yes

log "3/4 Restaurando datos de producción en local"
if [ "$DRY_RUN" = 1 ]; then
  echo "+ psql/docker exec < $DATA_DUMP"
elif command -v psql >/dev/null 2>&1; then
  psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f "$DATA_DUMP"
else
  docker exec -i "$LOCAL_DB_CONTAINER" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$DATA_DUMP"
fi

# Cinturón de seguridad: si quedó alguna migración local pendiente, se aplica
# (el dump excluye supabase_migrations, así que normalmente es un no-op).
log "4/4 Aplicando migraciones locales pendientes"
run "$SUPABASE_BIN" migration up --local

# ---------- Verificación ----------
if [ "$DRY_RUN" != 1 ]; then
  log "Verificación rápida"
  QUERY="select 'households' as tabla, count(*) from public.households
         union all select 'profiles', count(*) from public.profiles
         union all select 'expenses', count(*) from public.expenses
         union all select 'wishlist_items', count(*) from public.wishlist_items
         union all select 'auth.users', count(*) from auth.users;"
  if command -v psql >/dev/null 2>&1; then
    psql "$LOCAL_DB_URL" -c "$QUERY"
  else
    docker exec "$LOCAL_DB_CONTAINER" psql -U postgres -d postgres -c "$QUERY"
  fi
fi

if [ "$DRY_RUN" = 1 ]; then
  log "Dry-run: no se ejecutó nada. Quita --dry-run para hacerlo de verdad."
  exit 0
fi

log "Listo. Datos de producción cargados en el entorno local."
echo "Detalle: las imágenes de Storage (facturas/avatares) NO vienen en el dump."
echo "Siguiente paso: pnpm dev y probar con datos reales."
