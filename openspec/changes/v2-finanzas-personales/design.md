# Design

## Context

La v1.x trata el hogar como un fondo común: `expenses.paid_by` es opcional,
`savings_goals.saved_amount` se edita a mano, el Dashboard muestra el saldo del
hogar y la proyección/wishlist usan ese saldo. Los salarios y el dinero extra
existen, pero el foco visual sigue siendo el hogar. La app ya tiene PWA,
offline para gastos/ingresos/salarios, Realtime, RLS por hogar, Edge Function de
facturas con Gemini y una suite e2e de 47 pasos.

La v2.0 cambia el sujeto del producto: el gasto personal es el protagonista y
el hogar es una vista conjunta. Los specs de `finanzas/gastos-personales`,
`finanzas/hogar`, `finanzas/ahorros`, `finanzas/migracion-datos`,
`producto/experiencia-v2` e `ia/captura-gastos-voz` definen el comportamiento.
Este documento explica cómo implementarlo sin perder datos ni duplicar fuentes
de verdad.

## Goals / Non-Goals

**Goals:**

- Un solo ledger: cada gasto tiene pagador y pertenece a un hogar. Lo personal
  es un filtro, no una tabla paralela.
- Totales personales de mes y de ciclo desde el pago, derivados de las mismas
  filas que ve el usuario y consistentes con el total del hogar.
- Ahorro personal/compartido con movimientos, autoahorro idempotente y efecto
  real en el disponible.
- Migración aditiva, auditada y reversible, con los históricos incompletos
  tratados como legado explícito.
- UI consolidada, mobile-first, sin duplicados ni opciones ambiguas.
- Pruebas unitarias, SQL/RLS, e2e de dos miembros, móvil, realtime, offline y
  una base verificable para la captura por voz.

**Non-Goals:**

- Reparto justo, deudas entre miembros o liquidaciones.
- Integración bancaria, multi-moneda o conciliación de cuentas reales.
- Navegación de ciclos de pago históricos.
- Presupuestos por persona.
- Creación silenciosa de gastos por IA.
- Implementar `fix-datos-y-seguridad`.

## Decisions

### 1. Un solo ledger con dos lentes

No se crea una tabla de “gastos personales”. `expenses` sigue siendo la única
fuente de gastos; `paid_by` es la atribución y `household_id` el alcance. La
vista personal filtra `paid_by = auth.uid()`; la del hogar agrega todos los
pagos del mes. Esto evita duplicar filas, mantener dos write paths y explicar
por qué un gasto personal no aparece en el hogar.

Alternativa considerada: tabla `personal_expenses` separada. Se descarta porque
rompe el principio “todo gasto personal sigue siendo un gasto del hogar” y
obliga a sincronizar dos ledgers.

### 2. Pagador obligatorio por RLS, no por `NOT NULL`

La regla se aplica en las políticas INSERT/UPDATE de `expenses`:

```text
is_household_member(household_id)
and paid_by is not null
and exists (
  select 1 from profiles p
  where p.id = paid_by and p.household_id = expenses.household_id
)
```

No se usa `ALTER COLUMN paid_by SET NOT NULL` porque:

- los gastos históricos nulos deben conservarse y mostrarse en `Sin asignar`;
- la FK `paid_by ... ON DELETE SET NULL` debe seguir funcionando si se elimina
  un perfil;
- un backfill automático al “dueño del hogar” inventaría información
  financiera.

Los RPCs `security definer` que crean gastos (aplicar servicios) repiten la
validación de hogar porque no pasan por RLS. Se prueba explícitamente que el
borrado de un perfil no deja la base inconsistente; si el `SET NULL` choca con
la política, se cambia la FK a `RESTRICT` y se resuelve la reasignación en la UI.

Verificado en local (2026-10-24): al borrar un perfil, la acción
`ON DELETE SET NULL` de `expenses.paid_by` se ejecuta sin pasar por la política
RLS. Sus 147 gastos quedan con `paid_by = null` y se tratan como legado
(`Sin asignar`); el total del hogar no cambia. Se mantiene la FK con `SET NULL`
y no se cambia a `RESTRICT`.

### 3. Ventanas de fecha calculadas en el cliente con utilidades compartidas

Los totales visibles (mes, ciclo, hogar, categorías) se derivan en el cliente de
las filas cargadas para la ventana. Es la misma fuente que alimenta las listas,
funciona offline con la caché optimista y evita un RPC grande que duplique la
agregación.

La fecha de inicio del ciclo se calcula con una función pura en
`src/shared/lib/periods.ts`:

```ts
lastPaydayDate({ payday, salaries, asOf }): string
monthToDateWindow(asOf): { start: string; end: string }
sincePaydayWindow({ payday, salaries, asOf }): { start: string; end: string }
```

Reglas:

- si hay `salaries.pay_date <= asOf`, se usa el máximo;
- si no, se usa `payday` del mes de `asOf` o del mes anterior si aún no llega;
- el día se recorta al último día del mes (31 → 28/29/30);
- las fechas se construyen al mediodía local, nunca con `Date.UTC` + getters
  locales;
- los rangos son inclusivos y las comparaciones usan strings `YYYY-MM-DD`.

El cliente carga la unión `[min(monthStart, cycleStart), asOf]` para que ambas
ventanas tengan todas sus filas. El historial mensual y el disponible acumulado
sí usan RPCs porque requieren todo el historial.

Alternativa considerada: un RPC `get_personal_summary` que devuelva todos los
totales. Se descarta para el mes/ciclo porque complica la caché optimista
offline y duplica en SQL la misma agregación que ya hace la UI. El RPC de
disponible/historial se mantiene porque no se puede derivar de una sola ventana.

### 4. Ingreso opcional, gasto protagonista

El monto del salario no es una cifra principal. La app solo lo usa para:

- calcular el disponible cuando hay ingresos registrados;
- alimentar el total del hogar si se muestra en detalle;
- calcular el historial personal cuando hay base.

Si no hay ingresos registrados, el disponible es `null` y la UI muestra gasto y
ahorro. No se muestra un cero ni un saldo negativo inventado. La ventana “desde
mi pago” no necesita el monto: solo la fecha real o el `payday`.

Alternativas consideradas:

- **Eliminar salarios/ingresos del producto:** se pierde el disponible y el
  historial de meses con ingreso; el usuario ya los tiene registrados.
- **Exigir salario para usar la app:** fricción y contradice “no necesito ver
  cuánto me pagaron”.
- **Presupuesto personal en lugar de ingreso:** es una funcionalidad nueva; se
  deja fuera de alcance y se puede agregar después sobre el mismo ledger.

### 5. Ahorro personal por defecto, compartido opcional

Modelo:

```text
savings_goals
  id, household_id, name, target_amount, target_date,
  saved_amount (cache), owner_id (null = compartida),
  archived_at, created_at

savings_movements
  id, household_id, goal_id, member_id (null = legado),
  plan_id (null = manual), amount (con signo),
  kind ('deposit'|'withdrawal'|'opening'|'auto'),
  movement_date, period_month (solo auto), note, created_at

savings_plans
  id, household_id, goal_id, member_id, amount,
  day_of_month, is_active, start_month, last_run_month, created_at
```

Reglas:

- `owner_id = null` significa compartida; las metas existentes se migran así.
- Una meta personal solo la ve y administra su dueño (RLS). Una compartida la ve
  todo el hogar.
- `saved_amount` deja de ser editable por el cliente. Un trigger lo recalcula
  como `sum(savings_movements.amount)` después de insert/update/delete.
- `amount` lleva signo: depósitos/apertura/auto positivos, retiros negativos.
  Un check impide signos incoherentes.
- El retiro en meta compartida se limita al aporte neto del miembro; se valida
  en un RPC `create_savings_movement`.
- El saldo viejo se backfillea como movimiento `opening` con fecha de
  migración y `member_id = null`. No se inventa el dueño ni la fecha original.
- Archivar (`archived_at`) en vez de borrar metas con movimientos. Para devolver
  el dinero se retira primero.
- La FK `savings_movements.goal_id` es `ON DELETE RESTRICT`; el cliente archiva.
- La FK `savings_goals.owner_id` es `ON DELETE CASCADE`: si se elimina la cuenta,
  sus metas personales y movimientos se van con ella; las compartidas quedan.

Alternativa considerada: metas siempre del hogar. Se descarta porque el usuario
pidió ahorros personales. Alternativa: tabla separada para metas personales;
se descarta por duplicar la lógica de progreso y movimientos.

### 6. Autoahorro idempotente por RPC, no por cron en la v2.0

`run_due_savings()` se ejecuta al iniciar la app y al reconectar. Recorre los
planes activos del hogar y, para cada mes pendiente entre `last_run_month + 1`
y el mes actual:

1. calcula la fecha con `day_of_month` recortado al fin de mes;
2. omite si la meta está archivada, alcanzó el objetivo o el miembro no tiene
   base de ingreso y el monto supera su disponible;
3. inserta un movimiento `auto` con `period_month` y `plan_id`;
4. actualiza `last_run_month` aunque el mes se haya omitido, para no reintentar
   el mismo mes en cada arranque;
5. devuelve solo counts (creados, omitidos) para no filtrar metas personales de
   otros miembros.

La unicidad `(plan_id, period_month)` (índice parcial) garantiza idempotencia.
Se recuperan hasta 12 meses; los más viejos se omiten con aviso. Si no hay base
de ingreso, el plan se ejecuta igual (el usuario lo configuró) pero no se
muestra un disponible inventado. Si hay base y no alcanza, se omite y se avisa.

Alternativa considerada: `pg_cron`. Se descarta para la v2.0 porque agrega una
extensión/operación de producción y el hogar abre la app con frecuencia. Queda
documentado como upgrade si se necesita garantía sin abrir la app.

### 7. Disponible e historial en RPC; totales visibles en cliente

- `get_member_available(p_as_of)` devuelve `available` (nullable),
  `income_basis` y el último `pay_date` real. Suma ingresos menos gastos
  pagados menos movimientos netos de ahorro de la persona. Es `security definer`
  y solo permite el propio perfil o un miembro del mismo hogar.
- `get_personal_monthly_history()` devuelve `(month, income, expenses,
  savings, free, accumulated)` para la persona actual. Reemplaza el uso de
  `get_monthly_surpluses` en la pestaña `Mis meses`.
- `get_household_monthly_history()` devuelve lo mismo para el hogar, con
  `savings` separado, para la pestaña `Hogar`.
- Los totales de mes/ciclo/hogar y el desglose por categoría se calculan en el
  cliente con las filas cargadas y `periods.ts`.
- `get_running_balance` y `get_monthly_surpluses` se dejan de usar en el
  frontend. Se mantienen por una release como compatibilidad para PWAs
  cacheadas y se retiran en una limpieza posterior; no se convierten en una
  segunda fuente de verdad.

### 8. Una capa `finance` para el read model

Se agrega `src/modules/finance/` para el modelo de lectura transversal:

- `hooks/useMemberAvailable.ts` (RPC de disponible);
- `hooks/usePersonalMonthlyHistory.ts` y `useHouseholdMonthlyHistory.ts`;
- `lib/` con selectores puros de totales, desglose por categoría y
  reconciliación (`sum(perPerson) + unassigned = total`).

Los CRUD siguen en sus módulos: `expenses` (gastos), `members`
(salarios/ingresos/miembros), `savings` (metas/movimientos/planes). `finance`
no escribe; solo lee y deriva. Esto respeta la regla de módulos por dominio y
evita un god-file en `shared/`.

### 9. UI consolidada, sin ruta nueva

- Inicio: hero personal (`Mi mes`, `Desde mi último pago`, `Mi ahorro`,
  `Disponible` si hay base), lista reciente con pagador y acceso a `Hogar`.
  Se retiran las tarjetas duplicadas de sobrantes, salarios y proyección.
- Gastos: tabs `Hogar` / `Mis gastos`; en personal, toggle de ventana; pagador
  obligatorio; filtros por persona y categoría.
- Miembros: personas, `payday`, invitación e ingresos (salarios + extra) como
  sección secundaria; se retira la tarjeta `Saldos del mes`.
- Ahorros: tabs `Mis metas` / `Compartidas`; tarjetas con progreso, movimientos,
  autoahorro y archivo.
- Historial: tabs `Hogar` / `Mis meses`.
- Proyección y Quiero comprar: personales; usan `useMemberAvailable` y el
  sobrante personal.
- Calendario: filtro `Todos / Mis gastos`; pagador visible.
- Servicios: pagador obligatorio; bloqueo de legacy sin responsable.
- Categorías: presupuesto del hogar + desglose por persona.
- Navegación: se mantienen las rutas; solo se renombra `Dashboard` a `Inicio`
  en la etiqueta. La barra móvil conserva 4 + `Más`.

### 10. IA de voz con confirmación y bandera

Nueva Edge Function `analyze-expense-audio` (Deno + Gemini), hermana de
`analyze-receipt`:

- valida JWT, hogar y rate limit por usuario (tabla de intentos, RLS sin
  políticas, como el patrón existente);
- recibe un audio corto (máx. 30 s / 5 MB), lo envía a Gemini con un prompt
  estructurado en español/COP y devuelve
  `{ amount, description, date, category_hint, payer_hint, confidence }`;
- no persiste el audio; lo descarta al terminar;
- errores internos solo a logs, mensaje genérico al cliente;
- el cliente muestra un borrador editable y crea el gasto solo al confirmar;
- bandera `VITE_FEATURE_VOICE_EXPENSE` (apagada por defecto);
- `Permissions-Policy` de `vercel.json` agrega `microphone=(self)`;
- el flujo manual y el offline siguen funcionando si la IA falla.

Alternativa considerada: Web Speech API del navegador. Se descarta porque la
calidad/estructuración varía por navegador y no produce un JSON financiero
fiable; Gemini ya está integrado y probado para facturas. Alternativa:
auto-crear el gasto sin confirmación. Se descarta por riesgo de montos/fechas
incorrectos y por la promesa de calidad de la v2.0.

### 11. Migración en tres pasos lógicos

1. **Integridad del ledger**: políticas RLS de pagador/miembro del mismo hogar,
   índices por persona/fecha. Sin tocar datos.
2. **Ahorro**: tablas `savings_movements` y `savings_plans`, columnas
   `owner_id`/`archived_at`, backfill de apertura, trigger de `saved_amount`,
   RLS de metas personales/compartidas.
3. **RPCs y realtime**: `get_member_available`, historiales, creación de
   movimientos, `run_due_savings`, grants y publicación Realtime de las tablas
   nuevas.

Se pueden agrupar en dos migraciones si el revisor prefiere menos archivos, pero
el orden lógico se mantiene. No se borran tablas ni columnas; `expenses.splits`
se conserva. El change anterior `fix-datos-y-seguridad` se cierra antes de la
rama y no se implementa.

## Migration Plan

### Local

1. `bash tools/seed-local/seed-local.sh -y` para traer datos de producción a
   local (solo lectura en producción).
2. Guardar la auditoría pre: counts y sumas de `expenses`, `salaries`,
   `incomes`, `savings_goals`; counts de `paid_by`/`member_id` nulos.
3. `supabase db reset --local` y `supabase migration up --local`.
4. Auditoría post: comparar counts/sumas; verificar
   `sum(movements) = saved_amount` por meta; verificar RLS con dos usuarios y
   dos hogares; probar pagador nulo/cruzado y borrado de perfil.
5. `pnpm build`, `pnpm lint`, unitarias, SQL, e2e, móvil, realtime, offline.
6. Backup local del dump antes de modificar datos de prueba.

### Producción

- La migración se aplica **solo** al mergear a `master` con
  `.github/workflows/supabase-migrations.yml` (`supabase db push`).
- Antes del merge: `supabase db push --dry-run` y backup de producción.
- No se ejecuta SQL a mano en el dashboard.
- La migración es aditiva; el rollback de emergencia sería desplegar la versión
  anterior del frontend y, si hace falta, restaurar el backup. Los movimientos
  creados después del deploy no existen en el backup; por eso el backup se toma
  inmediatamente antes y la ventana de rollback se comunica.
- Ventana de compatibilidad: una PWA vieja puede intentar guardar un gasto sin
  pagador y recibir el error de RLS, o editar `saved_amount` directamente. El
  `UpdatePrompt` y un aviso en la PR cubren la actualización; no se promete
  compatibilidad perfecta con clientes cacheados.

## Risks / Trade-offs

- **Gastos históricos sin pagador** → no se adivinan; se muestran en
  `Sin asignar` y se ofrece limpieza individual/masiva. Riesgo: el usuario
  puede asignar mal; la UI muestra fecha, monto, categoría y descripción antes
  de confirmar.
- **Metas personales y RLS** → una política mal escrita filtraría ahorros
  privados. Mitigación: pruebas SQL con dos hogares y dos miembros, y revisión
  de `using`/`with check`.
- **Autoahorro con meses perdidos** → puede descontar varios meses de golpe.
  Mitigación: tope de 12 meses, resumen de cuántos se registraron/omitieron y
  opción de deshacer movimientos manuales; los automáticos se identifican.
- **Totales en cliente vs historial en RPC** → pueden divergir si las ventanas
  no coinciden. Mitigación: `periods.ts` compartido, pruebas de invariantes
  (`suma por persona + sin asignar = total`, `disponible = ingresos - gastos -
  ahorro`) y fixtures con nóminas atrasadas.
- **Sin ingresos registrados** → el disponible es `null`; la UI no debe verse
  rota. Mitigación: estados explícitos y foco en gasto/ahorro.
- **Retiro de la proyección del hogar** → puede sorprender a quien la usaba.
  Mitigación: la proyección personal usa el mismo motor y se explica en la
  documentación; no se elimina la página, solo cambia el alcance.
- **IA de voz** → costo, privacidad y errores de interpretación. Mitigación:
  bandera, rate limit, audio no persistido, confirmación humana y fallback
  manual; pruebas con fixture y mock.
- **Ventana de deploy PWA** → clientes viejos contra esquema nuevo. Mitigación:
  migración aditiva, `UpdatePrompt`, aviso en la PR y pruebas con caché
  limpiada.

## Open Questions

Ninguna que cambie el alcance o el modelo. Las decisiones de copy fino, el
límite exacto del rate limit de voz (se propone 10 análisis/día) y el tope de
meses de autoahorro (12) se validan en implementación sin cambiar los specs.
