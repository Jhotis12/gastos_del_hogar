# AGENTS.md — Instrucciones del proyecto

App de gestión de gastos del hogar (React 19 + TS + Vite + Tailwind v4 + Supabase).

## Antes de tocar código

1. **Lee `ARQUITECTURA.md`** — es la guía canónica: tecnologías, modelo de
   datos, RLS/RPCs, patrones de diseño y bugs ya corregidos.
2. Revisa las skills del proyecto en `.agents/skills/` (supabase,
   supabase-postgres-best-practices, frontend-design, web-design-guidelines,
   mobile-app-ui-design, pwa-development, request-refactor-plan,
   pull-request-workflow, diagram-design).
3. En un clon nuevo: `README.md` §0 (ruta rápida) y
   `tools/seed-local/README.md` (datos reales de producción para pruebas).
4. Los cambios funcionales se planifican con **OpenSpec** (`openspec/`):
   `openspec/config.yaml` ya impone rama + PR + CI + merge de Jhotis12 en los
   artefactos y guías de apply/archive. No dupliques esas reglas.

## Reglas que no se negocian

- **Módulos por dominio**: cada dominio vive en `src/modules/<dominio>/`
  con su página, hooks, componentes y libs propios; lo transversal en
  `src/shared/`. Los hooks de datos viven en su módulo (p. ej.
  `modules/expenses/hooks/useExpenses`) y el resto importa de ahí.
  No crear god-files ni archivos nuevos en `src/hooks/` o `src/pages/`.
- **Montos COP**: siempre `MoneyInput` + `parseMoneyInput` (formato
  colombiano: puntos = miles, coma = decimales). No usar inputs < 16px
  (zoom de iOS al enfocar); usar `SelectInput`/`DateInput` para selects y
  fechas.
- **Guards declarativos**: nunca `navigate()` manual desde formularios; los
  guards de `App.tsx` esperan `loading`/`profileLoaded`.
- **Errores**: mutations con `try/catch` + `toast`; queries con `QueryError`.
- **Hooks antes de returns condicionales** (regla de hooks — ya rompió el
  Dashboard una vez).
- **Fecha/meses TZ-seguros**: usar `src/shared/lib/dates.ts` (mediodía local), no
  `Date.UTC` con getters locales.
- **Siempre local primero**: cualquier cambio, prueba o borrado de datos se
  hace SOLO en el entorno local (Supabase local + `docker exec`). NUNCA se
  toca producción (datos, usuarios, esquema, migraciones, deploys) hasta que
  el usuario lo pida explícitamente ("súbelo", "manda la migración", etc.).
  Los cambios se integran por **rama + PR** (ver abajo); el merge a `master`
  y cualquier escritura a producción esperan la aprobación de Jhotis12.
- **Migraciones**: se crean y prueban en local; a producción se aplican SOLO
  por el workflow de GitHub (`.github/workflows/supabase-migrations.yml`,
  `supabase db push` al push a `master`) o con un `supabase db push`
  revisado. Nunca SQL a mano en el dashboard; si algo se aplicó a mano,
  `bash tools/db/repair-history.sh -y <version>` (solo historial).

## Flujo de trabajo (rama + PR + CI)

- **Nunca** commit ni push directo a `master`: todo cambio va en una rama
  nueva y se integra por Pull Request.
- Antes de abrir la PR: `pnpm build` + `pnpm lint` + `node tests/e2e-flow.mjs`
  (con Supabase local, dev server, SQL y sandbox reseteados). Si el
  cambio toca UI móvil o realtime, sumar `e2e-mobile`/`check-mobile`/
  `e2e-realtime`.
- GitHub corre los workflows `CI` (build + lint) y `E2E` (Supabase local +
  suites) en cada PR. No se mergea con checks en rojo.
- La PR la revisa, aprueba y mergea **Jhotis12**; el agente no mergea.
  (Branch protection no está disponible en GitHub Free privado: el flujo se
  cumple por convención + CI.)
- Al mergear a `master`, si hay migraciones nuevas,
  `supabase-migrations.yml` las aplica a producción.
- Detalle y comandos: `.agents/skills/pull-request-workflow/SKILL.md`.

## Comandos

- `pnpm dev` — desarrollo (puerto 5173)
- `pnpm build` — typecheck + build
- `pnpm lint` — oxlint
- `node tests/e2e-flow.mjs` — suite e2e (dev server arriba; antes:
  `SUPABASE_SERVICE_ROLE=… bash tests/reset-sandbox.sh`)
- `git push -u origin <rama>` + `gh pr create --base master --fill` — subir
  el cambio y abrir la PR (si `gh` no está autenticado, pasar la URL de
  compare al usuario)
- `bash tools/seed-local/seed-local.sh -y` — trae datos de producción al
  local (solo lectura en producción; credenciales en `tools/seed-local/.env`,
  tutorial en `tools/seed-local/README.md`)
- `bash tools/db/repair-history.sh` — pone al día el historial de migraciones
  aplicadas a mano (solo historial; ver `tools/db/README.md`)
- `SUPABASE_ACCESS_TOKEN=… supabase functions deploy analyze-receipt` —
  desplegar la Edge Function de facturas

## Verificación antes de terminar

`pnpm build` + `pnpm lint` + `pnpm test` + SQL + suites e2e en local, y luego
**PR con CI en verde** (`CI` + `E2E`). Si algún test no se pudo correr en
local, decirlo explícitamente en la PR.
