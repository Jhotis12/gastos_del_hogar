# AGENTS.md — Instrucciones del proyecto

App de gestión de gastos del hogar (React 19 + TS + Vite + Tailwind v4 + Supabase).

## Antes de tocar código

1. **Lee `ARQUITECTURA.md`** — es la guía canónica: tecnologías, modelo de
   datos, RLS/RPCs, patrones de diseño y bugs ya corregidos.
2. Revisa las skills del proyecto en `.agents/skills/` (supabase,
   frontend-design, web-design-guidelines, request-refactor-plan).

## Reglas que no se negocian

- **Hooks por dominio**: cada dominio vive en su archivo en `src/hooks/`
  (useMembers, useCategories, useExpenses, useRecurring, useSavings,
  useReceipts). No crear god-files.
- **Montos COP**: siempre `MoneyInput` + `parseMoneyInput` (formato
  colombiano: puntos = miles, coma = decimales). No usar inputs < 16px
  (zoom de iOS al enfocar); usar `SelectInput`/`DateInput` para selects y
  fechas.
- **Guards declarativos**: nunca `navigate()` manual desde formularios; los
  guards de `App.tsx` esperan `loading`/`profileLoaded`.
- **Errores**: mutations con `try/catch` + `toast`; queries con `QueryError`.
- **Hooks antes de returns condicionales** (regla de hooks — ya rompió el
  Dashboard una vez).
- **Fecha/meses TZ-seguros**: usar `src/lib/dates.ts` (mediodía local), no
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
- `SUPABASE_ACCESS_TOKEN=… supabase functions deploy analyze-receipt` —
  desplegar la Edge Function de facturas

## Verificación antes de terminar

`pnpm build` + `pnpm lint` + suite e2e completa (41 pasos).
