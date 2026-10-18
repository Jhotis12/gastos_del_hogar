# Gastos del Hogar

App de gestión de gastos del hogar: gastos compartidos, salarios con día de
pago, sobrantes por mes, presupuestos por categoría, servicios recurrentes,
metas de ahorro, proyección, lista de deseos con cuotas y escaneo de facturas
(IA), con sincronización en tiempo real.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · TanStack Query ·
Supabase (Auth, Postgres + RLS, Realtime, Storage, Edge Functions) · PWA.

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

```bash
supabase link --project-ref <ref-del-proyecto>
supabase db push          # aplica las migraciones pendientes a la DB remota
```

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

## 6. Verificación: build, lint y suite e2e

```bash
pnpm build     # typecheck (tsc) + build de producción
pnpm lint      # oxlint
```

Suite e2e (47 pasos, Playwright/Firefox) — requiere:

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
SUPABASE_URL=http://127.0.0.1:54331 bash tests/reset-sandbox.sh
node tests/e2e-flow.mjs       # corre los 47 pasos y muestra el resumen
```

> El flujo termina eliminando el **hogar** del sandbox (queda en `/setup`);
> el usuario se reinicia/elimina al inicio con `reset-sandbox.sh`.
> Si usas Podman rootless, exporta
> `DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock` antes de
> `supabase status`/`supabase start`.

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
| `supabase db push` | Aplicar migraciones al proyecto remoto enlazado |
| `supabase functions deploy analyze-receipt` | Desplegar la Edge Function |
| `node tests/e2e-flow.mjs` | Suite e2e (requiere dev server + sandbox reseteado) |

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
