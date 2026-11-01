# Design

## Context

Ver `proposal.md` — Why. El estado actual que condiciona el diseño:

- `get_member_available(p_as_of)` (migración `20261025004847_available_since_payday.sql`)
  suma salarios e ingresos y resta gastos en la ventana del ciclo, sin ahorro.
  Ya existe `member_cycle_start(p_profile, p_as_of)` que delimita esa ventana, y
  `v_has_base` devuelve `available = null` sin ingresos registrados.
- `get_household_available(p_as_of)` recalcula lo mismo dentro de un loop por
  miembro (no llama a `get_member_available`, que usa `auth.uid()`).
- `savings_movements` es la fuente de verdad del ahorro: `amount` lleva signo
  (depósitos y aportes automáticos positivos, retiros negativos), las aperturas
  migradas tienen `member_id = null` (constraint
  `savings_movements_member_check`) y existe el índice
  `savings_movements_household_member_date_idx (household_id, member_id,
  movement_date)`. `get_personal_monthly_history` ya resta el ahorro en
  `free`/`accumulated`: el Historial no cambia.
- El hero de Inicio mezcla dos ventanas: el disponible es "desde tu último
  pago" (RPC) pero la tarjeta "Mi ahorro" filtra por mes calendario
  (`financeWindows.month` en `Dashboard.tsx`).
- Proyección (`me-alcanza-hasta-proximo-pago`, rama `feat/` aún sin mergear)
  usa ese `available` y muestra "Ahorro ya apartado" con textos que dicen "No
  modifica tu disponible personal".
- La invalidación ya funciona: `LEDGER_INVALIDATION.savings` incluye
  `member-available`, así que un depósito ya refresca el hero; solo cambia el
  número que devuelve la RPC.

## Goals / Non-Goals

**Goals:**

- Una sola fórmula del disponible, idéntica en Inicio, Proyección y Quiero
  comprar (la RPC como única fuente; ninguna pantalla recalcula aparte).
- Que la resta del ahorro sea visible y reconstruible en el hero.
- Mínima superficie: reemplazo de dos funciones SQL, textos y pruebas.

**Non-Goals:**

- Alinear `run_due_savings` a la nueva base (su chequeo de "sin saldo" usa base
  histórica acumulada; se documenta el desfase en Riesgos).
- Historial, Wishlist (hereda el RPC sin cambios de código) y la terminología
  "Libre después del ahorro" de `producto/experiencia-v2`.
- Cambiar el contrato del RPC: sigue devolviendo `(available, income_basis,
  last_pay_date)`.

## Decisions

### 1. Fórmula y ventana

Se extiende la fórmula vigente con la suma propia de movimientos, con signo, en
la **misma ventana del ciclo**:

```sql
select coalesce(sum(m.amount), 0) into v_savings
from public.savings_movements m
where m.member_id = v_uid
  and m.movement_date >= v_start
  and m.movement_date <= p_as_of;

-- available = case when v_has_base
--   then v_income - v_expenses - v_savings else null end
```

`v_start` es el `member_cycle_start` ya calculado. Con el signo en `amount`,
los retiros devuelven dinero solos. `v_has_base` no cambia: sin ingresos el
disponible sigue siendo `null` aunque haya ahorro.

Alternativas descartadas:

- **Restar el saldo de las metas** (`savings_goals.saved_amount`): las
  aperturas migradas no tienen dueño y los aportes de otros miembros no son
  atribuibles a la persona; el movimiento con `member_id` es la única fuente
  que atribuye correctamente.
- **Restar el ahorro del mes calendario** (lo que la tarjeta muestra hoy):
  mezcla dos bases cuando el pago no cae a fin de mes (un depósito hecho el día
  25 con pago el 24 quedaría fuera) y rompe el objetivo de "cuánto me queda
  desde mi último pago". La tarjeta se alinea a la ventana del ciclo
  (decisión 4) en vez de al revés.

### 2. Aperturas y aportes de otros

El filtro `member_id = v_uid` excluye por sí solo las aperturas (que son
`null`) y los aportes de otros miembros. El límite de retiro en metas
compartidas ya restringe a "aporte neto propio" (`create_savings_movement`),
así que la devolución al disponible también es solo del dinero propio: la
fórmula y la regla de retiro quedan alineadas sin código extra.

### 3. Disponible del hogar

Dentro del loop por miembro de `get_household_available` se agrega la misma
suma y resta. No se refactoriza para llamar a `get_member_available` (esa
resuelve el miembro desde `auth.uid()`); duplicar las tres líneas es el cambio
mínimo y conserva la semántica "suma de los personales". Sigue sin sumar
saldos de metas.

### 4. Hero reconstruible

- Subtítulo del disponible: "Ingresos − gastos − ahorro desde tu último pago".
- Tarjeta "Mi ahorro": el filtro pasa de `financeWindows.month` a
  `financeWindows.cycle` y la etiqueta de "Neto de este mes" a la ventana desde
  el último pago. Así el disponible resta exactamente lo que la tarjeta muestra
  y el hero no mezcla bases (el gasto del mes sigue en su propia tarjeta).
- `hero-hogar` y Wishlist no tocan código: heredan las RPC.

Alternativa descartada: dejar la tarjeta en mes calendario y solo cambiar el
número grande; el hero deja de cuadrar en cuanto el ciclo cruza dos meses y
regresa la pregunta "¿por qué restó esto?".

### 5. Proyección sin doble conteo

- Aporte de autoahorro **ya ejecutado**: el movimiento existe con fecha dentro
  del ciclo → ya quedó dentro del `available`.
- Aporte **pendiente**: `savingsCommitmentsUntil` solo lo resta si
  `last_run_month` es anterior al mes actual → nunca se descuenta dos veces.
- Textos: "No modifica tu disponible personal; se muestra aparte" y la nota de
  supuestos pasan a explicar que ya está descontado. El desglose sigue sumando.
- Dependencia: esos textos los introduce `me-alcanza-hasta-proximo-pago`
  (rama sin mergear); la tarea es condicional a que ya estén en `master`.

### 6. Pruebas

- `tests/db/finance-rpcs.sql`: con `payday` por defecto (día 1) y movimientos
  fechados el día 1 del mes actual (dentro del ciclo de todos), los esperados
  pasan a: A = 3.600.000 − 1.200.000 − 450.000 = **1.950.000** (antes
  2.400.000); hogar = 1.950.000 + (2.000.000 − 300.000 − 600.000) =
  **3.050.000** (antes 4.100.000). Los casos posteriores del archivo (C y
  `run_due_savings`) se recalculan con la misma regla.
- `tests/e2e-money.mjs`: el primer hero sigue en 2.300.000; tras el depósito
  inicial de 100.000 pasa a **2.200.000** y tras el autoahorro de 50.000 a
  **2.150.000**; los pasos se renombran ("el ahorro manual descuenta el
  disponible"). El chequeo interno de `run_due_savings` (base histórica) sigue
  cubriendo el aporte: 3.500.000 − 1.200.000 − 100.000 ≥ 50.000.
- `tests/e2e-flow.mjs`: hoy solo espera `hero-saldo` sin cifras; se corre y se
  ajusta únicamente si algún texto asertado cambia (p. ej. el paso de
  Proyección de me-alcanza si valida los textos de "ahorro ya apartado").

### 7. Rendimiento

La suma nueva filtra `member_id + movement_date`; el índice existente lleva
`household_id` como primera columna, así que puede no usarse. Se verifica con
`EXPLAIN` en local; si cae en seq scan es aceptable: es la misma consulta que
ya hace `get_personal_monthly_history` (CTE `sav`) sobre una tabla acotada por
hogar y con `security definer` que ya recorre todo el loop del hogar.

## Risks / Trade-offs

- **El número del hero baja de golpe para quien ahorra.** → El subtítulo y la
  tarjeta "Mi ahorro" muestran exactamente qué se restó; el proposal lo marca
  BREAKING (semántica de cifra).
- **Disponible negativo si ya gastó el dinero ahorrado.** → Ya existe el estilo
  negativo (coral) y el disponible nunca fue efectivo de banco; el Historial
  ("Quedó") ya restaba ahorro, así que Inicio deja de contradecirlo.
- **Desfase con `run_due_savings`:** su chequeo de "sin saldo suficiente" usa
  base histórica acumulada, no el ciclo. Un plan puede ejecutarse con el ciclo
  en negativo, aunque nunca deja la meta en negativo. → Fuera de alcance;
  documentado aquí; candidato a change propio.
- **`me-alcanza-hasta-proximo-pago` sigue activo (completo, sin archivar) y su
  delta dice "no modifica el disponible personal".** → Archivar ese change
  primero; al archivar este, verificar que ese escenario quede ajustado a la
  nueva semántica.
- **Movimientos fechados antes del último pago no descuentan el ciclo actual.**
  → Misma regla que los gastos: pertenecen al ciclo anterior y el Historial
  por mes ya los refleja.
- **Pruebas con cifras exactas.** → Las tareas llevan los valores recalculados
  y CI (E2E) revalida todo en Supabase local.

## Migration Plan

- Crear la migración con `supabase migration new` (p. ej.
  `descuenta_ahorro_en_disponible`) y hacer `create or replace` de
  `get_member_available` y `get_household_available`, conservando:
  `security definer`, `set search_path = public`, `stable` y los
  `revoke`/`grant` existentes (ejecución solo para `authenticated` y
  `service_role`).
- Sin cambios de tablas, RLS, triggers, índices ni backfill: el dato recalcula
  en lectura.
- Prueba local: `supabase migration up --local` (o `supabase db reset --local`),
  luego `docker exec -i supabase_db_App-gastos psql -U postgres -d postgres -v
  ON_ERROR_STOP=1 < tests/db/finance-rpcs.sql` actualizado, y las suites e2e
  con el sandbox reseteado.
- Producción: solo la aplica el workflow `supabase-migrations.yml` al mergear
  a `master`; nunca SQL a mano.
- Rollback: migración nueva que restaure la fórmula anterior (forward-only).
