# AGENTS.md — Instrucciones del proyecto

App de gestión de gastos del hogar (React 19 + TS + Vite + Tailwind v4 + Supabase).

## Antes de tocar código

1. **Lee `ARQUITECTURA.md`** — es la guía canónica: tecnologías, modelo de
   datos, RLS/RPCs, patrones de diseño y bugs ya corregidos.
2. Revisa las skills del proyecto en `.agents/skills/` (supabase,
   frontend-design, web-design-guidelines, request-refactor-plan).
3. En un clon nuevo: `README.md` §0 (ruta rápida) y
   `tools/seed-local/README.md` (datos reales de producción para pruebas).

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
  Los commits son locales; el `git push` y el `supabase db push` esperan
  orden.

## Comandos

- `pnpm dev` — desarrollo (puerto 5173)
- `pnpm build` — typecheck + build
- `pnpm lint` — oxlint
- `node tests/e2e-flow.mjs` — suite e2e (dev server arriba; antes:
  `SUPABASE_SERVICE_ROLE=… bash tests/reset-sandbox.sh`)
- `bash tools/seed-local/seed-local.sh -y` — trae datos de producción al
  local (solo lectura en producción; credenciales en `tools/seed-local/.env`,
  tutorial en `tools/seed-local/README.md`)
- `SUPABASE_ACCESS_TOKEN=… supabase functions deploy analyze-receipt` —
  desplegar la Edge Function de facturas

## Verificación antes de terminar

`pnpm build` + `pnpm lint` + suite e2e completa (47 pasos).
