# Proposal: ¿Me alcanza hasta el próximo pago?

## Why

La pantalla de Proyección hoy no responde una pregunta de decisión: muestra un
gasto estimado del próximo mes y un "ahorro" que multiplica un solo mes,
mezclando el ciclo desde el último pago con el mes calendario y con un promedio
histórico que descuenta ahorro. El usuario no puede saber si su dinero actual
alcanza para los compromisos que vencen antes de su próximo pago, y las cifras
no siempre cuadran.

La app ya tiene los datos para responder esa pregunta: disponible personal,
nóminas, servicios recurrentes, planes de autoahorro y gastos variables. Este
change reenfoca la pantalla en esa decisión y retira la proyección multi-mes de
esta vista.

## What Changes

- **BREAKING (UI)**: la pantalla `/proyeccion` deja de mostrar el selector
  1/3/6, el "ahorro proyectado" y la tarjeta de promedio mensual; el foco pasa a
  ser **"¿Me alcanza hasta el próximo pago?"**.
- Nuevo veredicto con tres estados: **te alcanza**, **no te alcanza** o
  **ajustado** (cuando el rango pesimista es negativo pero el optimista no).
  Incluye el saldo esperado al próximo pago o el faltante.
- Desglose reconstruible: disponible de hoy, ingresos registrados antes del
  próximo pago, servicios recurrentes, aportes de autoahorro y estimación de
  gastos variables. La suma de las líneas explica el veredicto.
- Cálculo del próximo pago con la primera fecha efectiva de nómina posterior a
  hoy, o el `payday` configurado si no hay nómina; recorte al último día del
  mes. Si hoy es día de pago, el próximo pago es el del mes siguiente.
- La nómina que llega en el próximo pago es el **inicio del siguiente ciclo**,
  no un ingreso para cubrir los compromisos anteriores a esa fecha.
- Compromisos del ciclo: servicios recurrentes activos del usuario con
  `next_due_date` menor o igual al próximo pago (incluidos los vencidos) y
  aportes de autoahorro activos que vencen antes del pago. Se muestran con
  monto y fecha; no se cuentan dos veces los servicios ya aplicados.
- Estimación variable: mediana de gastos personales no recurrentes de hasta 6
  meses completos, incluyendo en cero los meses sin gasto, con rango p25–p75.
  Se escala solo a los días que faltan del ciclo. Con menos de 2 meses se
  muestra un estado preliminar, nunca un `$0` engañoso.
- Gasto diario: monto disponible por día para gastos variables después de los
  compromisos, comparado con el gasto variable habitual para emitir el
  veredicto.
- Estados explícitos: sin base de ingresos, sin historial variable, sin
  compromisos y disponible negativo. No se inventa un saldo ni se usa el saldo
  del hogar.
- **Sin migración**: no se cambian tablas, RLS ni RPCs. Se reutilizan
  `get_member_available`, `recurring_expenses`, `savings_plans`, `salaries`,
  `incomes` y `expenses`.
- Se corrige la invalidación de `member-available` al aplicar un servicio
  recurrente, para que la proyección refleje el gasto sin recargar.

## Supuestos

- La proyección cubre desde hoy hasta el día anterior al próximo pago.
- Se usa el mismo `available` personal que Inicio: el ahorro ya apartado no
  descuenta del disponible; se muestra por separado. No se resuelve en este
  change la contradicción existente entre `finanzas/ahorros` y
  `finanzas/gastos-personales` sobre ese punto.
- Solo se incluyen ingresos registrados con fecha anterior al próximo pago; no
  se inventan ingresos extra.
- La proyección sigue siendo personal: no incluye gastos ni ingresos de otros
  miembros.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `finanzas/gastos-personales`: la proyección personal pasa a ser un cálculo de
  alcance hasta el próximo pago, con desglose, compromisos, rango variable y
  estados sin base.

## Impact

- Código: `src/modules/forecast/Forecast.tsx`,
  `src/modules/forecast/hooks/useForecast.ts`,
  `src/modules/forecast/lib/forecast.ts`, `src/shared/lib/periods.ts`,
  `src/modules/services/hooks/useRecurring.ts` (invalidación),
  `src/modules/savings/hooks/useSavings.ts` y `useSavingsMovements.ts`
  (lectura), `tests/unit/*`, `tests/e2e-flow.mjs`, `tests/check-mobile.mjs` y
  `ARQUITECTURA.md`.
- Datos/API: sin migraciones, RLS ni RPCs nuevas. Solo lecturas existentes.
- Producto: se mantienen la ruta `/proyeccion` y el acceso; cambia el contenido
  de la pantalla. La proyección sigue siendo personal.

## Git y PR

- Rama propuesta: `feat/me-alcanza-hasta-proximo-pago`.
- Migraciones: ninguna. No hay cambios de esquema, RLS ni datos.
- Checks locales: `pnpm build`, `pnpm lint`, `pnpm test`,
  `node tests/e2e-flow.mjs` y `node tests/check-mobile.mjs` con Supabase local,
  dev server y sandbox reseteados.
- CI: `CI` (build + lint) y `E2E` (Supabase local + suites) en verde. No se
  mergea con checks en rojo.
- El merge lo hace Jhotis12; el agente no mergea.

## Out of Scope

- Proyección multi-mes (3/6 meses), factibilidad de metas de ahorro y
  "¿puedo comprar X?".
- Proyección del hogar o toggle personal/hogar.
- Nuevas RPCs, migraciones, RLS, notificaciones o recordatorios.
- Cambiar la semántica del disponible personal o el tratamiento del ahorro.
- Rediseñar Inicio, Historial, Calendario, Servicios o Ahorros.
