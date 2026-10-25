# Design

## Context

Ver `proposal.md` — Why. El estado actual que condiciona el diseño:

- `get_member_available(p_as_of)` devuelve el disponible personal como
  ingresos menos gastos desde el último pago. **No descuenta ahorro**
  (`20261025004847_available_since_payday.sql`). El spec de
  `finanzas/gastos-personales` refleja esa definición; el de `finanzas/ahorros`
  todavía dice lo contrario en "Archivar sin perder el ahorro". Este change usa
  la definición vigente y no resuelve esa contradicción.
- `src/shared/lib/periods.ts` ya tiene `lastPaydayDate`, `sincePaydayWindow` y
  `clampPayday`, pero no una función para el **próximo** pago.
- `recurring_expenses.next_due_date` es la fuente de verdad del próximo
  vencimiento. `apply_recurring_expense` lo adelanta según la frecuencia; por
  eso un servicio ya aplicado no debe volver a restarse.
- `savings_plans` tiene `day_of_month`, `last_run_month` e `is_active`.
  `run_due_savings` se ejecuta al abrir o reconectar (`Layout.tsx`).
- `expenses.recurring_id` distingue los gastos aplicados de un servicio de los
  gastos variables. Los gastos históricos pagados a mano antes de convertir un
  servicio en recurrente no tienen `recurring_id`.
- El motor actual mezcla el ciclo desde el último pago (`available`), el mes
  calendario (fijos del mes siguiente) y un promedio histórico que descuenta
  ahorro (`free`). Ese es el origen de las cifras que no cuadran.
- Los tests unitarios usan `node --test` sobre libs puras; hoy no hay tests de
  `forecast.ts`.

## Goals / Non-Goals

**Goals:**

- Un solo modelo temporal: el ciclo que va de hoy al día anterior al próximo
  pago.
- Reutilizar datos y RPCs existentes; sin migración ni RLS nueva.
- Dejar el cálculo en funciones puras testeables y la UI como una composición
  de esas funciones.
- Que cada número visible se pueda reconstruir con las líneas del desglose.

**Non-Goals:**

- Proyección multi-mes, metas de ahorro, cuotas de "Quiero comprar", hogar o
  toggle personal/hogar.
- Cambiar la semántica de `available` o del ahorro.
- Nuevas RPCs, migraciones, notificaciones o recordatorios.
- Rediseñar otras pantallas.

## Decisions

### 1. Modelo de ciclo y próximo pago

La ventana es `[hoy, próximo pago - 1]`. El próximo pago se calcula con una
función pura nueva en `periods.ts`:

```text
nextPaydayDate({ payday, salaries, asOf }):
  fechas = salaries.pay_date > asOf
  si hay fechas -> min(fechas)
  si no:
    pagoEsteMes = payday recortado al último día del mes de asOf
    si pagoEsteMes > asOf -> pagoEsteMes
    si no -> payday del mes siguiente, recortado
```

`salaries` son las nóminas efectivas de los meses actual y siguiente (las que
ya calcula `useSalaries`). Si hoy es día de pago, la nómina de hoy no pasa el
filtro `> asOf` y el próximo pago cae en el mes siguiente. Si hay una nómina
atrasada con fecha futura, esa fecha manda sobre el `payday` configurado.

Se agrega también `daysBetween(from, to)` con fechas al mediodía local, para
contar los días del ciclo sin cruces de UTC. `remainingDays` es
`daysBetween(hoy, próximoPago)` y siempre es al menos 1.

Alternativas descartadas:

- `lastPaydayDate + 30 días`: falla con meses de 28/31 días y con nóminas
  atrasadas.
- Seguir usando el mes calendario: mezcla dos bases y reintroduce el problema
  actual.

### 2. Fórmula y veredicto

```text
spendable = available + incomeBefore - fixedCommitments - savingsCommitments
dailyBudget = spendable / remainingDays
variableDaily = variable.median / 30.44
expected = spendable - variableEscalado
```

- `incomeBefore`: ingresos registrados con fecha posterior a hoy y anterior al
  próximo pago. La nómina del próximo pago **no** entra: es el reinicio del
  siguiente ciclo. En la práctica suele ser 0; la línea existe para ingresos
  extra registrados antes del pago.
- `fixedCommitments`: servicios recurrentes activos del usuario con
  `next_due_date <= próximoPago`, incluidos los vencidos.
- `savingsCommitments`: aportes de autoahorro activos que vencen antes del
  próximo pago y no se han ejecutado este mes.
- `variableEscalado`: rango mensual escalado a `remainingDays / 30.44`.

El veredicto usa el rango, no solo la mediana:

- `expected.low >= 0` → **te alcanza**.
- `expected.high < 0` → **no te alcanza**.
- en otro caso → **ajustado** (el rango cruza cero).

`expected.low` usa el variable p75 (pesimista) y `expected.high` usa el p25
(optimista). Si `available` es null, no hay veredicto: se muestran los
compromisos y se explica que falta registrar un ingreso. Si `variable` es null
(menos de 2 meses completos), el estado es **preliminar**: se muestra
`spendable` sin variables y se aclara que la estimación mejorará con historial.

`dailyBudget` es el monto total por día para gastos variables después de
compromisos, no el remanente después de la estimación. La UI lo compara con
`variableDaily` para explicar si el ritmo habitual cabe o no. Si `spendable` es
negativo, el gasto diario se muestra como 0 y el faltante va en el hero.

### 3. Fuentes de datos y consultas

`useForecast` se reescribe para leer:

- `useMemberAvailable(todayISO())`.
- `useRecurringExpenses()`.
- `useSavingsPlans()` y `useSavingsGoals()` (para el nombre de la meta).
- `useSalaries(currentMonth)` y `useSalaries(nextMonth)` para el próximo pago y
  los ingresos antes del pago.
- `useVariableHistory(currentMonth)` (se amplía para traer `description` y
  `category_id`).
- Nueva consulta liviana de `incomes` con `income_date > hoy` y
  `< próximoPago`, filtrada por `member_id`.

Se eliminan del hook `usePersonalMonthlyHistory`, `useExtraIncomeHistory` y los
cálculos de promedio/sobrante mensual. La consulta de ingresos futuros usa la
clave `['incomes', 'future', householdId, memberId, from, to]`, que queda
cubierta por la invalidación existente de `['incomes']`.

No se agrega ningún RPC. La consulta de gastos variables sigue usando
`['expenses', 'history', ...]` y se invalida con el prefijo `['expenses']`.

### 4. Compromisos

**Servicios recurrentes.** Se filtran por `is_active`, `paid_by = profile.id` y
`next_due_date <= próximoPago`. Se incluyen los vencidos
(`next_due_date < hoy`) y se ordenan por fecha. El `id` del servicio se usa como
clave de lista y para mostrar el detalle; no la descripción. Un servicio se
considera ya pagado si su `next_due_date` quedó después del próximo pago, que
es lo que hace `apply_recurring_expense` al aplicarlo. Los servicios legacy sin
pagador no se atribuyen al usuario; si existen, la UI muestra un aviso para
asignarlos.

**Autoahorro.** Se filtran los planes activos con `member_id = profile.id`. La
fecha del plan se calcula con `day_of_month` recortado al último día del mes,
en el mes actual o siguiente según caiga antes del próximo pago. Se resta si la
fecha es anterior al próximo pago y `last_run_month` es anterior al mes actual.
Si ya se ejecutó este mes, no se resta y se muestra como "ahorro ya apartado".
El nombre de la meta sale de `useSavingsGoals`.

**Ahorro ya apartado.** Se muestra por separado y no se resta del
`available`, porque la definición vigente no lo descuenta. Esto evita romper
Inicio y deja explícita la limitación.

### 5. Estimación variable

La consulta trae los gastos personales no recurrentes de los últimos 6 meses
completos. Sobre esos datos:

1. Se construye la secuencia de meses completos desde el primer mes con datos
   hasta el último mes completo, con tope de 6. Los meses sin gasto variable se
   rellenan con 0.
2. Se excluyen los gastos históricos que coinciden con un servicio hoy
   recurrente. La coincidencia es por descripción normalizada (trim, minúsculas,
   sin diacríticos); si la descripción está vacía, se usa `category_id`. Es una
   heurística para evitar el doble conteo al convertir un gasto manual en
   servicio recurrente.
3. Se calculan mediana, p25 y p75 sobre los totales mensuales.
4. Se escala el rango a los días restantes: `valor * remainingDays / 30.44`.

Si hay menos de 2 meses completos, `variable` es null y la pantalla muestra el
estado preliminar. Si hay 2 o más meses, aunque sean meses en cero, el rango es
válido y puede ser 0–0.

Alternativas descartadas: usar el promedio (sensible a one-offs), usar el total
de gastos incluyendo recurrentes (duplicaría los fijos) o prorratear el mes
completo en vez de los días restantes (sobreestimaría el ciclo).

### 6. UI y estados

La pantalla mantiene la ruta `/proyeccion` y el acceso actual. Se organiza así:

| Sección | Contenido |
|---|---|
| Header | "¿Me alcanza?" y "Hasta tu próximo pago · [fecha]" |
| Hero | Veredicto con texto e ícono, saldo esperado o faltante, rango y gasto diario |
| Desglose | Disponible, ingresos antes del pago, servicios, autoahorro, variables |
| Compromisos | Servicios con fecha/monto y aviso de vencido; planes de autoahorro con meta/día |
| Ahorro ya apartado | Monto separado, sin afectar el disponible |
| Supuestos | Mediana de 6 meses, rango p25–p75, sin ingresos extra no registrados |

Se retiran el selector 1/3/6, la tarjeta de promedio, el gráfico de historial y
las tarjetas de fijos/ingresos del mes siguiente. El promedio y los meses
anteriores siguen en Historial.

Estados:

- **Sin base de ingresos** (`available` null): hero "Sin base de ingresos",
  compromisos visibles y enlace a Miembros e ingresos.
- **Preeliminar** (variable null): badge "Estimación preliminar", saldo sin
  variables y explicación.
- **Ajustado**: badge con el rango; no afirmar que alcanza.
- **Sin compromisos**: mensaje "Sin compromisos antes de tu próximo pago" y
  gasto diario calculado solo con el disponible.
- **Error / carga**: `QueryError` con reintento y `PageSkeleton`, como el resto
  de la app.

El veredicto se comunica con texto ("Te alcanza", "No te alcanza", "Ajustado")
y un ícono; el color es refuerzo, no el único canal. Los montos usan
`formatCurrency`; las fechas, `formatDate`. Los botones/enlaces mantienen
`min-h-11` y la pantalla no debe desbordar a 320px.

### 7. Invalidación y refresco

`useApplyRecurringOne` hoy invalida `expenses`, `recurring`, `running-balance`
y `monthly-surpluses`, pero no `member-available`. Se cambia a invalidar
`LEDGER_INVALIDATION.expenses` (que incluye `member-available`,
`personal-history` y `household-history`) más `['recurring']`. Así, al aplicar
un servicio, la proyección y el hero de Inicio reflejan el gasto sin recargar.
Las mutaciones de ahorro y salario ya invalidan sus claves; no requieren
cambios.

### 8. Alternativas descartadas

- **RPC `get_projection`:** centralizaría el cálculo, pero agrega migración,
  RLS y pruebas de SQL para un cambio que es de presentación. Se prefiere
  mantener las funciones puras en el frontend.
- **Reutilizar `useFinanceWindow`:** trae gastos e ingresos con relaciones y
  solo hasta hoy; no incluye ingresos futuros ni servicios/planes. Añadiría
  payload sin cubrir el caso.
- **Restar el ahorro del disponible:** daría un "efectivo libre" más realista,
  pero cambia la semántica de Inicio y choca con el spec vigente. Queda fuera.
- **Mantener el selector 1/3/6:** multiplicar un mes sigue siendo incorrecto
  para servicios no mensuales y no responde la pregunta del ciclo.

## Risks / Trade-offs

- **`available` es presupuesto, no efectivo.** Si el usuario ya movió dinero a
  ahorro, el disponible no lo descuenta. → Mitigación: mostrar "ahorro ya
  apartado" por separado y declararlo en los supuestos. La contradicción con
  `finanzas/ahorros` queda documentada, no resuelta.
- **Estimación variable imperfecta.** La mediana y el prorrateo no predicen
  gastos atípicos. → Mitigación: rango p25–p75, estado ajustado, supuestos
  visibles y estado preliminar con menos de 2 meses.
- **Doble conteo al convertir manual en recurrente.** La coincidencia por
  descripción/categoría es heurística. → Mitigación: normalización, test con un
  fixture de servicio convertido y nota de limitación si la descripción cambia.
- **Servicio pagado a mano sin aplicar.** Si el usuario registra un gasto
  manual del servicio sin usar "Aplicar", el `next_due_date` no avanza y la
  proyección lo resta otra vez. → Mitigación: el flujo oficial es aplicar el
  servicio; la UI mantiene el acceso a Servicios y el aviso de pendientes. No
  se puede detectar un pago manual sin vínculo.
- **Próximo pago mal estimado.** Si no hay nómina y el `payday` no refleja la
  realidad, la fecha puede quedar corrida. → Mitigación: priorizar nóminas
  reales sobre el `payday`, recortar fin de mes y cubrir los casos con tests.
- **Proyección personal.** Un gasto compartido asignado a otra persona no
  aparece. → Trade-off aceptado; el hogar queda fuera de alcance.
- **Retirar el selector 1/3/6 puede sorprender.** → Mitigación: el proposal lo
  marca como BREAKING (UI) y la pantalla enlaza a Historial para el promedio.

## Migration Plan

No hay cambios de esquema, RLS, datos ni RPCs. El cambio es solo de frontend y
se despliega con la PR; el workflow `supabase-migrations.yml` no tiene nada que
aplicar. Rollback: revertir la PR.

Verificación local antes de la PR:

1. `pnpm build`, `pnpm lint`, `pnpm test`.
2. Con Supabase local, dev server y sandbox reseteados:
   `node tests/e2e-flow.mjs` y `node tests/check-mobile.mjs`.
3. Casos manuales en `/proyeccion`: con nómina, sin nómina, hoy día de pago,
   servicio vencido, servicio ya aplicado, plan de autoahorro ejecutado y
   pendiente, y menos de 2 meses de variables.
