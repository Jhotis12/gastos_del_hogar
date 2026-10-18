# Seed local desde Supabase de producción

Tutorial para que **cualquier persona o agente** traiga una copia de los datos
de producción a Supabase local y pruebe la app contra datos reales.

> La fuente de verdad del esquema son `supabase/migrations/`. Esto no aplica
> migraciones a producción ni toca la base remota más allá de un `pg_dump`
> (solo lectura).

## 0. Desde un clon nuevo (flujo completo)

```bash
git clone <url-del-repositorio> App-gastos
cd App-gastos
pnpm install

# 1) Supabase local arriba (Docker o Podman rootless)
supabase start

# 2) Variables de la app (el ejemplo trae la URL y anon key del local)
cp .env.example .env.local

# 3) Datos reales de producción para probar (opcional pero recomendado)
cp tools/seed-local/.env.example tools/seed-local/.env
$EDITOR tools/seed-local/.env            # pega tu SUPABASE_ACCESS_TOKEN
bash tools/seed-local/seed-local.sh -y

# 4) App
pnpm dev
```

> Si usas Podman rootless, exporta antes
> `DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock` (el script también
> lo autodetecta).

## 1. Qué hace y qué no hace

**Hace**

- Lee de producción: dump **solo de datos** (`backups/prod-data.sql`) y un
  dump de esquema público (`backups/prod-schema.sql`) para comparar drift.
- Reinicia la base **local** (`supabase db reset --local`).
- Restaura el dump en el local.
- Reaplica migraciones locales que producción todavía no tenga.
- Verifica y muestra conteos de `households`, `profiles`, `expenses`,
  `wishlist_items` y `auth.users`.

**No hace**

- No escribe en producción (`db push`, `functions deploy`, `secrets set`, etc.
  quedan prohibidos en este flujo).
- No copia las imágenes de Storage (facturas y avatares) ni sus metadatos:
  se excluyen `storage.buckets`/`storage.objects` del dump. Verás filas con
  `receipt_id`/`avatar_path` pero el archivo puede dar 404.
- No copia tokens/sesiones de auth (`auth.sessions`, `auth.refresh_tokens`,
  `auth.one_time_tokens`, etc.): son secretos de producción y no hacen falta
  para probar. Sí copia `auth.users` + `auth.identities`, así que puedes
  iniciar sesión con usuarios reales (necesitas su contraseña).
- No sustituye `tests/reset-sandbox.sh` (ese es para la suite e2e).

## 2. Requisitos

| Herramienta | Verificación |
|---|---|
| Supabase CLI ≥ 2 | `supabase --version` |
| Docker o Podman rootless | `docker info` (si usas Podman: `export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock`) |
| El stack local arriba | `supabase status` |
| Node/pnpm (para probar la app) | `node --version` / `pnpm --version` |

## 3. Credenciales

Van en **`tools/seed-local/.env`** (ya está creado y gitignored). Llena **una**
de las dos opciones:

### Opción A (recomendada): access token

| Variable | ¿Obligatoria? | Dónde se obtiene |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Sí | Dashboard de Supabase → Account → Access Tokens → Generate new token (`sbp_...`) |
| `SUPABASE_DB_PASSWORD` | No | Project Settings → Database → Password. Si la omites, la CLI crea un **rol temporal** vía API (también requiere el token) |
| `SUPABASE_PROJECT_REF` | No | Default: `supabase/.temp/project-ref` o `xqfemqgokoedpenmqsmq` |

### Opción B (alternativa): connection string

| Variable | ¿Obligatoria? | Dónde se obtiene |
|---|---|---|
| `SUPABASE_DB_URL` | Sí (en esta opción) | Dashboard → Connect → Session pooler/Direct connection (incluye password) |

Variables opcionales: `DOCKER_HOST`, `SUPABASE_BIN`, `LOCAL_DB_URL`,
`LOCAL_DB_CONTAINER` (los defaults funcionan en este repo).

> El `.env` no se sube a git. El script aborta si detecta que no está ignorado.

## 4. Uso

```bash
# 1) Revisar qué haría, sin tocar nada
bash tools/seed-local/seed-local.sh --dry-run

# 2) Ejecutar (pide confirmación porque borra la base local)
bash tools/seed-local/seed-local.sh

# 3) Igual, pero sin confirmación (agentes/CI: solo local, nunca producción)
bash tools/seed-local/seed-local.sh -y

# 4) Repetir el reset local con el último dump descargado, sin leer producción
bash tools/seed-local/seed-local.sh --reuse-dump -y
```

Salida esperada al final:

```text
==> Listo. Datos de producción cargados en el entorno local.
```

> `--reuse-dump` no necesita credenciales ni contacta a Supabase: solo
> resetea el local y restaura `backups/prod-data.sql`. Úsalo cuando ya
> tengas el dump y quieras volver a un estado limpio.

## 5. Pasos manuales (si el script falla)

```bash
export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock   # solo Podman
set -a; . tools/seed-local/.env; set +a

mkdir -p backups
EXCLUDES="--exclude storage.buckets --exclude storage.objects \
  --exclude auth.sessions --exclude auth.refresh_tokens --exclude auth.one_time_tokens \
  --exclude auth.flow_state --exclude auth.mfa_amr_claims --exclude auth.audit_log_entries"
supabase db dump --project-ref "$SUPABASE_PROJECT_REF" --data-only \
  $EXCLUDES -f backups/prod-data.sql
supabase db dump --project-ref "$SUPABASE_PROJECT_REF" --schema public -f backups/prod-schema.sql

supabase db reset --local --yes
docker exec -i supabase_db_App-gastos \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 < backups/prod-data.sql
supabase migration up --local
```

## 6. Verificación

```bash
# Conteos en local
docker exec supabase_db_App-gastos psql -U postgres -d postgres -c \
  "select 'households' t, count(*) from public.households
   union all select 'profiles', count(*) from public.profiles
   union all select 'expenses', count(*) from public.expenses;"

# La app contra datos reales
pnpm dev
```

Comparar drift de esquema:

```bash
diff <(grep -iE 'create table|create policy' backups/prod-schema.sql | sort) \
     <(grep -iE 'create table|create policy' supabase/schema.sql | sort) | head
```

## 7. Troubleshooting

| Síntoma | Causa / solución |
|---|---|
| `Access token not provided` | Falta `SUPABASE_ACCESS_TOKEN` (o define `SUPABASE_DB_URL`) |
| `failed to connect` / `password authentication failed` | `SUPABASE_DB_PASSWORD` incorrecta. Déjala vacía para que la CLI cree un rol temporal |
| `Cannot connect to the Docker daemon` | Tu usuario no está en el grupo `docker`. Alternativa: Podman rootless + `DOCKER_HOST` |
| `no container with name ...` | El stack local no está arriba: `supabase start` |
| `relation "..." does not exist` o FK violation al restaurar | Producción tiene esquema más nuevo que las migraciones locales: actualiza migraciones y repite |
| `column "..." of relation "auth...." does not exist` | Drift de GoTrue entre prod y local. Agrega esa tabla a los `--exclude` del dump (no hace falta para probar) o actualiza la CLI local |
| `must be owner of table ...` al modificar auth | Las tablas `auth` son de `supabase_auth_admin`; no las toques: mejor excluir la tabla del dump |
| `psql: command not found` | El script usa `docker exec` automáticamente; verifica que el contenedor `supabase_db_App-gastos` exista |
| Las facturas/avatares dan 404 | Esperado: Storage no se copia en el dump de Postgres |

## 8. Seguridad

- `backups/prod-data.sql` contiene datos sensibles (incluidos `auth.users` con
  hashes de contraseñas). No lo subas a git, no lo compartas, no lo dejes en
  una carpeta sincronizada a la nube.
- El stack local escucha en `127.0.0.1`; no lo expongas a la red.
- Nunca ejecutes `supabase db push`, `functions deploy` o `secrets set` como
  parte de este flujo.
- Tras terminar, puedes borrar `backups/prod-*.sql` si no los necesitas.

## 9. Referencias

- `README.md` §3.1.1 — resumen del seed en el README principal.
- `ARQUITECTURA.md` §8 — comandos y entorno local.
- `tests/reset-sandbox.sh` — sandbox para la suite e2e (no usa producción).
