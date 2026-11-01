# Gastos del Hogar · v2.0

App de finanzas personales y del hogar: cada persona ve **su** gasto del mes y
desde su último pago, su ahorro y su disponible; el **hogar** conserva el total
mensual, el desglose por persona y la bolsa histórica `Sin asignar`.

**Enfoque v2.0:** pagador obligatorio, ahorro por movimientos con metas
personales/compartidas y autoahorro, historial por mes, presupuestos del hogar,
servicios recurrentes, proyección personal, lista de deseos y captura de gastos
por voz o factura con IA (detrás de banderas). Sincronización en tiempo real y
modo offline para gastos, ingresos y salarios.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · TanStack Query ·
Supabase (Auth, Postgres + RLS, Realtime, Storage, Edge Functions) · PWA.

## Novedades de la 2.0

- **Inicio personal:** `Disponible desde mi último pago` y `Disponible del
  hogar` (suma de los personales, sin ahorro), más `Mi mes`, `Gastos desde mi
  último pago` y `Mi ahorro`; la sección `Hogar` queda debajo y enlaza a
  Historial.
- **Gastos con dos lentes:** `Hogar` / `Mis gastos`, con ventana de mes o desde
  el último pago. El pagador es obligatorio.
- **Ahorro real:** depósitos y retiros como movimientos; el saldo de la meta se
  recalcula por trigger. Metas personales privadas y compartidas del hogar.
- **Autoahorro idempotente:** se ejecuta al abrir/reconectar y recupera hasta 12
  meses.
- **Historial personal y del hogar**, proyección y lista de deseos con el
  dinero personal (nunca con el saldo de otra persona). Historial →
  `Hogar`/`Mis meses` muestra solo `Recibido`, `Gastado` y `Quedó`
  (recibido − gastado) por mes. El ahorro se gestiona en Ahorros y no aparece
  en Historial.
- **Captura por voz (opcional):** graba un audio, Gemini propone un borrador y
  tú lo confirmas; requiere red y no guarda el audio.

---

## 0. Ruta rápida (clon nuevo)

```bash
git clone <url-del-repositorio> App-gastos && cd App-gastos
pnpm install
supabase start                                  # Docker o Podman rootless
cp .env.example .env.local                      # ya trae URL + anon key del local
cp tools/seed-local/.env.example tools/seed-local/.env
$EDITOR tools/seed-local/.env                   # pega tu SUPABASE_ACCESS_TOKEN
bash tools/seed-local/seed-local.sh -y          # datos reales para pruebas
pnpm dev
```

- El paso del seed es **opcional**: sin él el local arranca vacío (ideal para
  probar el flujo desde “crear hogar”).
- El seed copia datos, no Storage; y nunca escribe en producción.
- Detalle completo: [`tools/seed-local/README.md`](tools/seed-local/README.md).
- Si usas Podman rootless:
  `export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock`.

---

## 1. Requisitos (desde cero)

| Herramienta | Versión mínima | Para qué |
|---|---|---|
| [Node.js](https://nodejs.org) | ≥ 20.19 (recomendado: 24 LTS) | Runtime de Vite/TS |
| [pnpm](https://pnpm.io/installation) | ≥ 9 | Gestor de paquetes |
| [Docker](https://www.docker.com/products/docker-desktop/) (o Podman rootless) | Cualquiera reciente | Supabase local (API, Postgres, Storage…) |
| [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) | ≥ 2 | Levantar/administrar Supabase y migraciones |
| [git](https://git-scm.com/) | Cualquiera | Clonar el repositorio |

Instalación sugerida por sistema:

```bash
# Node (cualquier SO, vía nvm — luego reiniciar la terminal)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install --lts && nvm alias default --lts

# pnpm (requiere Node)
npm install -g pnpm

# Supabase CLI (Linux/macOS)
curl -sSfL https://supabase.com/install | sh
#   Windows: supabase.com/docs/guides/cli/getting-started#installing-the-supabase-cli
```

Verificar que todo quedó instalado:

```bash
node --version && pnpm --version && supabase --version
docker run --rm hello-world   # Docker levantado y con permisos
```

> Si `docker` da error de permisos en Linux, agregar el usuario al grupo
> `docker` (`sudo usermod -aG docker $USER`) y volver a iniciar sesión.
> Alternativa sin sudo: Podman rootless
> (`systemctl --user enable --now podman.socket` y
> `export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock`).

## 2. Clonar e instalar dependencias

```bash
git clone <url-del-repositorio> App-gastos
cd App-gastos
pnpm install
```

## 3. Configurar Supabase

### 3.1 Entorno local (recomendado para desarrollo)

```bash
supabase start
```

La primera vez descarga las imágenes de Docker (varios minutos). Al terminar,
la API queda en `http://127.0.0.1:54331`, la DB en `54332`, el Studio
(panel web) en `http://127.0.0.1:54333`. Verificar con `supabase status`.

> Si usas **Podman rootless**, habilita el socket de usuario y exporta
> `DOCKER_HOST` antes de `supabase start`:
> `systemctl --user enable --now podman.socket` y
> `export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock`.

Aplicar el esquema (tablas, RLS, RPCs) desde las migraciones del repo. **Las
migraciones son la fuente de verdad**; `schema.sql` es solo un snapshot
histórico y no debe usarse para instalaciones nuevas:

```bash
supabase db reset        # desde cero: borra la DB local y reaplica todo
# o, si solo hay migraciones nuevas y quieres conservar datos:
supabase migration up --local
```

> `supabase db reset` es **destructivo**: borra todos los datos locales.

### 3.1.1 Sembrar el entorno local con datos de producción (solo lectura)

Para probar con datos reales sin tocar producción hay un script y un tutorial
completo en **[`tools/seed-local/README.md`](tools/seed-local/README.md)**.
Resumen:

1. Pon tus credenciales en `tools/seed-local/.env` (gitignored; ver
   `.env.example`). Basta un `SUPABASE_ACCESS_TOKEN`.
2. Ejecuta:

```bash
bash tools/seed-local/seed-local.sh        # pide confirmación
bash tools/seed-local/seed-local.sh -y     # sin confirmación (agentes)
bash tools/seed-local/seed-local.sh --dry-run  # muestra qué haría
bash tools/seed-local/seed-local.sh --reuse-dump -y  # resetea con el dump ya descargado
```

El script hace dump **solo de datos** a `backups/prod-data.sql` (gitignored),
resetea el local, restaura y verifica. No escribe en producción.

> Esto copia datos sensibles a tu máquina: no subas `backups/` a git ni a
> ningún servicio. Las imágenes de facturas/avatares (y sus metadatos) viven
> en Storage y se excluyen del dump; para probar esos visores hay que
> copiarlas aparte.

Crear el bucket de almacenamiento para las facturas (una sola vez):
en el Studio (`http://127.0.0.1:54333` → Storage → New bucket) crear el
bucket **`receipts`** (privado), o ejecutar:

```sql
-- En el Studio: SQL Editor
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);
```

### 3.2 Variables de entorno

La app necesita dos variables. **Nunca** se suben a git (`.env` y `.env.local`
ya están en `.gitignore`). Hay una plantilla en **`.env.example`**; cópiala a
`.env.local` para desarrollo:

| Variable | Local (`.env.local`) | Producción (`.env`) |
|---|---|---|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54331` | `https://<ref-del-proyecto>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Key anon de `supabase status` | Key anon del Dashboard de Supabase (Settings → API) |

```bash
# .env.local  (desarrollo contra Supabase local)
VITE_SUPABASE_URL=http://127.0.0.1:54331
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# .env  (producción — reemplazar con las keys reales del proyecto)
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> En desarrollo Vite da prioridad a `.env.local` sobre `.env`: puedes tener
> ambos y usar local sin tocar nada más.

### 3.3 Proyecto remoto (producción) — solo si vas a desplegar

En este repo las migraciones se aplican a producción automáticamente con el
workflow `.github/workflows/supabase-migrations.yml` al hacer **push a
`master`**. Requiere el secret `SUPABASE_ACCESS_TOKEN` (el
`SUPABASE_DB_PASSWORD` es opcional: sin él la CLI crea un rol temporal) y
opcionalmente la variable `SUPABASE_PROJECT_REF`.

Antes de aplicarlas puedes revisar qué se va a correr:

```bash
supabase db push --project-ref <ref-del-proyecto> --dry-run
```

Si alguna vez se aplicó SQL a mano en el dashboard de Supabase, el historial
queda desincronizado: repáralo con `bash tools/db/repair-history.sh -y
<version>` (solo escribe el historial; no re-ejecuta SQL). Detalle:
`tools/db/README.md`.

Las variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` de producción se
definen también en la plataforma de hosting (p. ej. Vercel → Project Settings
→ Environment Variables).

## 4. Levantar la app

```bash
pnpm dev
```

Abrir `http://localhost:5173`:

1. **Crear cuenta** (cualquier email y contraseña ≥ 8 caracteres). En el
   entorno local las confirmaciones están activadas
   (`enable_confirmations = true` en `supabase/config.toml`): el correo de
   confirmación se ve en **Mailpit** (`http://127.0.0.1:54334`). Para pruebas
   automatizadas, `tests/reset-sandbox.sh` crea el usuario ya confirmado.
2. La app te lleva a **crear tu hogar** (nombre + código de invitación para
   los demás miembros).

### Inicio y Gastos (v2.0)

- **Inicio** abre con tu dinero personal: `Disponible desde mi último pago`,
  `Mi mes`, `Gastos desde mi último pago` y `Mi ahorro` (el disponible ya
  descuenta ese ahorro). El `Disponible del hogar` es la suma de los
  disponibles personales y no suma saldos de metas. Debajo
  está la sección `Hogar` con el total del mes, el desglose por persona y la
  bolsa `Sin asignar`.
- **Gastos** tiene dos vistas: `Hogar` y `Mis gastos`. La personal permite
  alternar `Este mes` / `Desde mi último pago`; el CSV y el desglose por
  categoría respetan los filtros.
- **El pagador es obligatorio** en gastos nuevos y editados. Los gastos
  históricos sin pagador se conservan en `Sin asignar (histórico)` y se
  pueden limpiar en bloque desde el aviso dorado de Gastos.
- **Ahorro por movimientos**: los depósitos y retiros son movimientos; el
  saldo de la meta se recalcula solo. Las metas nuevas pueden ser personales
  o compartidas (las viejas quedan compartidas). Archivar conserva el saldo;
  eliminar borra la meta con sus movimientos y deja de contar como ahorro (si
  ya gastaste ese dinero, registra el gasto).
- **Nómina automática opt-in**: en Miembros puedes activar que la nómina del
  mes se cree sola al llegar tu día de pago, usando el último monto. Se
  ejecuta al abrir/reconectar y no duplica la fila.
- Si no hay ingresos registrados, `Disponible` no se inventa: la app sigue
  mostrando gasto y ahorro.

> **Modo offline (PWA)**: la app funciona sin conexión para registrar gastos,
> dinero extra y salarios, y para ver los últimos datos cargados. Sin red
> aparece un aviso y los cambios se guardan localmente; al reconectar se
> sincronizan solos (o con el botón "Sincronizar ahora"). La primera vez se
> necesita internet.

## 5. Escaneo de facturas (Edge Function `analyze-receipt`) — opcional

La app funciona sin esto (el flujo muestra el error controlado). Para
activarlo necesitas una API key de Google Gemini:

```bash
# Local: servir la función y darle las secrets
supabase functions serve analyze-receipt --env-file supabase/functions/analyze-receipt/.env.local

# Producción: desplegar y configurar
export SUPABASE_ACCESS_TOKEN=<token-de-acceso-de-Supabase>
supabase secrets set GEMINI_API_KEY=<tu-key-de-Gemini> --project-ref <ref>
supabase functions deploy analyze-receipt
```

## 5.1 Captura de gastos por voz (Edge Function `analyze-expense-audio`) — opcional

Apagada por defecto. Para activarla en local/CI:

```bash
echo 'VITE_FEATURE_VOICE_EXPENSE=true' >> .env.local
# reinicia pnpm dev
```

La Edge Function necesita `GEMINI_API_KEY` (puede ser la misma del escaneo de
facturas):

```bash
supabase functions serve analyze-expense-audio --env-file supabase/functions/analyze-expense-audio/.env.local
# producción
supabase functions deploy analyze-expense-audio
```

- El audio (máx. 30 s / 5 MB) se envía a la función, no a Storage; se descarta
  al terminar y los logs no incluyen audio ni transcripciones.
- El primer uso pide consentimiento. La app muestra un borrador editable; el
  gasto se crea **solo** al confirmar.
- Rate limit: 10 análisis por usuario en 24 h (tabla
  `audio_analysis_attempts`, RLS sin políticas).
- Chrome graba `audio/webm;codecs=opus`; la función normaliza el MIME y el
  data URL antes de Gemini (clientes viejos también funcionan).
- Prueba real (24-oct-2026): la llamada directa con el mismo audio devolvió un
  borrador; dos intentos desde la app recibieron **503 de Gemini** por demanda
  alta. La app muestra el error y ofrece reintentar o el formulario manual. Es
  un límite del proveedor, no del formato del audio.
- Con la bandera apagada el micrófono no aparece y el formulario manual sigue
  igual. Si la IA falla (sin red, cuota, timeout o audio ininteligible), la app
  ofrece el formulario manual.

## 6. Verificación: build, lint y suites

```bash
pnpm build     # typecheck (tsc) + build de producción
pnpm lint      # oxlint
pnpm test      # unitarias (node --test: periodos, ledger, hooks, voz)
```

Suites e2e (Playwright/Firefox) — requieren:

1. Dev server corriendo (`pnpm dev`, puerto 5173).
2. El `.env`/`.env.local` apuntando al entorno contra el que se probará.
   `reset-sandbox.sh` usa `SUPABASE_URL` si se pasa; si no, lee `.env`
   (producción) y, si no existe, `.env.local` (local). Siempre imprime el
   target antes de borrar/crear el usuario.
3. La variable `SUPABASE_SERVICE_ROLE` con la key de *service role*:

```bash
# Local: la key sale de `supabase status`
export SUPABASE_SERVICE_ROLE=$(supabase status -o env \
  | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')

# Producción: key service_role del Dashboard (Settings → API)
export SUPABASE_SERVICE_ROLE=eyJhbGciOi...
```

Ejecutar:

```bash
# Local (recomendado): apunta explícitamente al stack local
# Cada suite que crea datos reinicia el sandbox antes de correr.
SUPABASE_URL=http://127.0.0.1:54331 bash tests/reset-sandbox.sh
node tests/e2e-flow.mjs       # flujo principal v2
SUPABASE_URL=http://127.0.0.1:54331 bash tests/reset-sandbox.sh
node tests/e2e-money.mjs      # dos miembros, pagador, ahorro y disponible
SUPABASE_URL=http://127.0.0.1:54331 bash tests/reset-sandbox.sh
node tests/e2e-mobile.mjs     # móvil
node tests/check-mobile.mjs   # overflow 375/320px
SUPABASE_URL=http://127.0.0.1:54331 bash tests/reset-sandbox.sh
node tests/e2e-realtime.mjs   # dos miembros sin recargar
SUPABASE_URL=http://127.0.0.1:54331 bash tests/reset-sandbox.sh
node tests/e2e-voice.mjs      # captura por voz con análisis mockeado

# SQL/RLS contra local
DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
for f in tests/db/ledger-integrity.sql tests/db/savings.sql tests/db/finance-rpcs.sql tests/db/auto-salary.sql; do
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"
done
```

> El flujo termina eliminando el **hogar** del sandbox (queda en `/setup`);
> el usuario se reinicia/elimina al inicio con `reset-sandbox.sh`.
> Si usas Podman rootless, exporta
> `DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock` antes de
> `supabase status`/`supabase start`.

### Flujo de PR y CI

Todo cambio va en **rama nueva + Pull Request**; la aprueba/mergea Jhotis12
(la branch protection de GitHub no está disponible en el plan Free privado:
el flujo se cumple por convención + CI). En cada PR, GitHub Actions corre:

- **`CI`** — `pnpm install --frozen-lockfile` + `pnpm build` + `pnpm lint` + `pnpm test`.
- **`E2E`** — Supabase local (aplica las migraciones) + pruebas SQL/RLS + `e2e-flow`, `e2e-money`, `e2e-voice`,
  `e2e-mobile`, `check-mobile` y `e2e-realtime`.

Al mergear a `master` con migraciones nuevas,
`.github/workflows/supabase-migrations.yml` las aplica a producción. Abrir o
actualizar la PR **no** aplica nada: el workflow solo corre con push a
`master` (o dispatch desde `master`). Detalle y comandos:
`.agents/skills/pull-request-workflow/SKILL.md`.

## 7. Comandos útiles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Dev server en `http://localhost:5173` |
| `pnpm build` | Typecheck + build de producción (`dist/`) |
| `pnpm lint` | Lint con oxlint |
| `pnpm preview` | Servir el build local |
| `supabase start` / `stop` / `status` | Ciclo de vida de Supabase local |
| `supabase login` / `supabase link` | Autenticar y enlazar el proyecto remoto |
| `supabase db reset` | Reaplicar migraciones desde cero (borra datos) |
| `supabase migration up --local` | Aplicar migraciones nuevas conservando datos |
| `supabase db dump --linked --data-only -f backups/prod-data.sql` | Copia solo datos de producción (solo lectura) |
| `supabase db push --dry-run` | Lista migraciones pendientes para producción (no aplica) |
| `bash tools/db/repair-history.sh` | Pone al día el historial de migraciones aplicadas a mano |
| `supabase db push` | Aplicar migraciones al proyecto remoto enlazado |
| `supabase functions deploy analyze-receipt` | Desplegar la Edge Function |
| `node tests/e2e-flow.mjs` | Suite e2e (requiere dev server + sandbox reseteado) |
| `node tests/e2e-mobile.mjs` | Suite e2e móvil (Chromium touch) |
| `node tests/check-mobile.mjs` | Verificación de overflow a 375/320px |
| `node tests/e2e-realtime.mjs` | Realtime entre 2 miembros |
| `gh pr create --base master --fill` | Abrir la PR (requiere `gh` autenticado) |
| `openspec list` / `openspec status --change <change>` | Ver changes activos y su progreso |
| `openspec validate <change>` | Validar un change/spec antes de la PR |

## 8. Solución de problemas

- **`docker` deniega permisos** → agregar el usuario al grupo `docker` y
  volver a iniciar sesión. Alternativa sin sudo: Podman rootless
  (`systemctl --user enable --now podman.socket` y
  `export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock`).
- **Puertos ocupados (54331/54332/54333)** → cambiar los puertos en
  `supabase/config.toml` y ejecutar `supabase start` de nuevo.
- **La app muestra datos de un entorno que no esperas** → revisar qué URL usa
  el entorno activo: `grep VITE_SUPABASE_URL .env .env.local`.
- **Cambios de esquema que no aparecen** → `supabase migration up --local`
  (las migraciones nuevas no se aplican solas).
- **UI con caché vieja de Vite** → `rm -rf node_modules/.vite` y reiniciar
  `pnpm dev`.
- **No puedo conectarme a la DB local** → `docker exec -it supabase_db_App-gastos psql -U postgres -d postgres` (o usar el SQL Editor del Studio en `http://127.0.0.1:54333`).
