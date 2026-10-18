---
name: pull-request-workflow
description: "Use when making ANY change in this repo, or when the user says 'haz un cambio', 'sube esto', 'crea la rama/PR', 'manda la PR', or asks about git flow, branches, CI, tests en GitHub, or merge. Define el flujo estándar: rama nueva + PR, validaciones locales y CI (build+lint+e2e), y el usuario Jhotis12 es quien aprueba y mergea. También cubre migraciones (se aplican solas al mergear a master) y qué hacer si CI no puede correr los tests."
---

# Flujo de trabajo: rama + PR + CI

## Regla de oro

**Nunca** commit ni push directo a `master`. Todo cambio va en una rama nueva
y se integra por Pull Request. `master` está protegida y solo **Jhotis12**
aprueba y mergea. El agente **no mergea**.

```
cambio → rama → validar local → push rama → PR → CI (GitHub) → Jhotis12 aprueba/mergea
```

## 1. Crear la rama

```bash
git checkout master
git pull --ff-only            # si el remoto existe
git checkout -b feat/mi-cambio   # o fix/…, chore/…, docs/…
```

Un cambio por PR. Commits con convención del repo (`feat:`, `fix:`, `chore:`,
`docs:`). El hook de pre-commit sube la versión PATCH solo; no lo pelees.

## 2. Validar en local ANTES de subir

Requisitos: Supabase local arriba (`supabase start`), dev server
(`pnpm dev`) y sandbox (`tests/reset-sandbox.sh`). Ver `README.md` §6 y
`ARQUITECTURA.md` §9.

```bash
pnpm build
pnpm lint
SUPABASE_URL=http://127.0.0.1:54331 SUPABASE_SERVICE_ROLE=… bash tests/reset-sandbox.sh
node tests/e2e-flow.mjs        # suite principal (47 pasos)
```

Si el cambio toca UI móvil o realtime, sumar:

```bash
node tests/e2e-mobile.mjs
node tests/check-mobile.mjs
node tests/e2e-realtime.mjs
```

Si toca base de datos:

```bash
supabase db reset --local      # aplica TODAS las migraciones desde cero
# o, conservando datos:
supabase migration up --local
```

Si algún test no se puede correr en local, dilo explícitamente en la PR (qué
faltó y por qué). **No** abras la PR con tests en rojo conocidos.

## 3. Subir la rama y crear la PR

```bash
git push -u origin <rama>
```

Con GitHub CLI autenticado (`gh auth status`):

```bash
gh pr create --base master --fill
```

Sin `gh`, entrega al usuario la URL:

```
https://github.com/Jhotis12/gastos_del_hogar/compare/master...<rama>?expand=1
```

La PR usa la plantilla `.github/pull_request_template.md`. CODEOWNERS pide la
revisión de `@Jhotis12`.

## 4. CI (GitHub Actions)

En cada PR a `master` corren:

| Workflow | Job | Qué hace |
|---|---|---|
| `.github/workflows/ci.yml` | `build + lint` | `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm lint` |
| `.github/workflows/e2e.yml` | `Supabase local + suites` | `supabase start`, `db reset` implícito (valida migraciones), `reset-sandbox`, dev server, `e2e-flow`, `e2e-mobile`, `check-mobile`, `e2e-realtime` |

- No necesita secretos: todo corre contra el stack local del runner.
- No mergear con checks en rojo. Si un check falla, se arregla en la misma rama
  (nuevos commits) y la PR se actualiza sola.

## 5. Después del merge

- Si la PR incluye `supabase/migrations/**`, el workflow
  `.github/workflows/supabase-migrations.yml` aplica `supabase db push` a
  producción automáticamente al mergear a `master`.
- **Nunca** pegar SQL a mano en el dashboard de Supabase. Si pasó, el
  historial queda desincronizado: `bash tools/db/repair-history.sh -y <version>`
  (ver `tools/db/README.md`).
- Vercel despliega el front solo al mergear a `master`.

## 6. Setup que hace el humano una sola vez

1. **Branch protection** en GitHub → Settings → Branches → `master`:
   - Require a pull request before merging (1 aprobación: Jhotis12).
   - Require status checks to pass: `build + lint` y `Supabase local + suites`.
2. **Secrets** para el workflow de migraciones (Settings → Secrets and variables → Actions):
   - `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD`.
   - Variable opcional `SUPABASE_PROJECT_REF` (default `xqfemqgokoedpenmqsmq`).
3. Opcional: instalar y autenticar `gh` (`gh auth login`) para que el agente
   abra las PR solo.

## 7. Prohibiciones

- No `git push` a `master` (ni force).
- No mergear PR (lo hace Jhotis12).
- No `supabase db push`, deploys ni cambios remotos sin orden explícita.
- No commitear secretos: `tools/seed-local/.env`, `backups/` y `*.local` están
  gitignored y deben seguir estándolo.
