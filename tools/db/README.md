# Historial de migraciones

Herramientas para mantener sincronizado el historial de migraciones de
producción (`supabase_migrations.schema_migrations`) con el repositorio.

## Flujo canónico

1. Crear la migración en `supabase/migrations/<timestamp>_nombre.sql`.
2. Probarla en local: `supabase db reset` o `supabase migration up --local`.
3. `pnpm build` + `pnpm lint` + suite e2e.
4. Commit y **push a `master`**.
5. GitHub Action `.github/workflows/supabase-migrations.yml` corre
   `supabase db push` contra producción.

**Regla:** nunca aplicar SQL a mano en el dashboard de Supabase. Si por una
urgencia se hizo, el historial queda desincronizado y hay que repararlo con
`repair-history.sh` (sin volver a ejecutar el SQL).

## repair-history.sh

Marca como aplicadas migraciones que **ya están aplicadas en producción**
pero faltan en el historial. No ejecuta SQL: solo escribe en la tabla de
historial.

```bash
# 1) Ver el estado (no toca nada)
bash tools/db/repair-history.sh

# 2) Reparar (solo con orden explícita; escribe en el historial de producción)
bash tools/db/repair-history.sh -y

# 3) Versiones específicas
bash tools/db/repair-history.sh -y 20260901235402 20260902010806
```

Usa las mismas credenciales que el seed: `tools/seed-local/.env`
(`SUPABASE_ACCESS_TOKEN`; el `SUPABASE_DB_PASSWORD` es opcional).

## Estado conocido (2026-10-18)

Producción tiene el esquema al día, pero su historial no registra:

- `20260901235402_salary_inheritance_surpluses` — solo `create or replace
  function get_monthly_surpluses` (idempotente).
- `20260902010806_fix_missing_july_salaries_spotify` — fix de datos de
  julio/agosto 2026; simulado contra los datos reales: `INSERT 0 0`,
  `UPDATE 0` (no-op).

La tercera pendiente es la migración nueva del repo
(`20261018120000_wishlist_realtime_hardening`), que sí debe aplicar el
workflow cuando se haga push a `master`.
