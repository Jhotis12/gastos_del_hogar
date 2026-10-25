# Proposal

## Why

La app nació como un fondo común: el Dashboard gira alrededor del saldo del
hogar, el pagador de un gasto es opcional y el ahorro no descuenta del dinero
disponible. Eso deja al usuario sin la respuesta que más necesita en el día a
día: **cuánto he gastado yo, este mes y desde que me pagaron**, sin perder la
vista de cuánto se gastó en conjunto en el hogar.

La v2.0 corrige el foco y el modelo de datos sin perder información: cada gasto
sigue siendo un gasto del hogar, pero pasa a tener un pagador obligatorio y se
puede analizar por persona. Los ahorros pasan a ser movimientos reales
(personales o compartidos), con opción de aporte automático mensual. El cambio
incluye migración aditiva, pruebas de todos los niveles y una base para capturar
gastos por voz con IA en una fase posterior.

## What Changes

- **BREAKING — Pagador obligatorio.** Los gastos nuevos y las ediciones ya no
  aceptan `paid_by = null`; se puede elegir a otro miembro del hogar, pero no
  dejar el gasto sin responsable. Los gastos históricos sin pagador se
  conservan en una bolsa `Sin asignar (histórico)` y se pueden limpiar después.
- **BREAKING — Ahorro por movimientos.** El ahorro deja de ser un
  `saved_amount` editable a mano y pasa a registrarse con depósitos, retiros,
  apertura y aportes automáticos. El ahorro **no** descuenta del disponible:
  se muestra en su propia sección y en el Historial. El saldo de cada meta se
  recalcula desde sus movimientos.
- **Foco personal por defecto.** Inicio muestra primero los gastos y ahorros
  personales; el resumen del hogar queda como sección secundaria. No se muestra
  el monto del salario como protagonista: la persona ya lo conoce.
- **Dos lentes, una sola verdad.** `Mis gastos` filtra por pagador y muestra
  dos ventanas: mes calendario en curso y desde el último día de pago. `Hogar`
  muestra el total del mes, el desglose por persona y la bolsa `Sin asignar`.
  Todo gasto personal sigue siendo un gasto del hogar.
- **Ventana desde el pago sin depender del monto del salario.** La fecha se
  calcula con el último `salaries.pay_date` real de la persona o, si no hay
  nómina registrada, con su `profiles.payday`. El monto del salario solo se usa
  para calcular el disponible cuando existe; nunca se inventa.
- **Disponible desde el último pago y del hogar.** El disponible personal es
  ingresos desde el último pago menos gastos desde esa fecha, sin descontar
  ahorro. El disponible del hogar es la suma de los disponibles personales.
  El acumulado histórico y el sobrante mensual quedan en Historial
  (`Libre`/`Acumulado`).
- **Ingresos dejan de ser protagonistas.** Salarios y dinero extra se mantienen
  como datos opcionales para calcular el disponible y los totales del hogar,
  pero no son la métrica principal de Inicio. La app puede mostrar gasto y
  ahorro aunque no haya ingresos registrados.
- **Ahorros personales y compartidos.** Las metas existentes quedan como metas
  del hogar. Las metas nuevas son personales por defecto (visibles solo para su
  dueño) y se puede crear una meta compartida. Los aportes se atribuyen a quien
  los hace; los retiros suman a quien los recibe. El autoahorro mensual es
  idempotente y se ejecuta al abrir la app o al reconectar.
- **Consolidación de la experiencia.** Se eliminan tarjetas y opciones
  duplicadas o ambiguas: “Sobrantes por mes” y “Salarios del mes” del Inicio,
  el widget de proyección, el “Ingreso unificado”, el lenguaje de “fondo
  común” y “A favor / Debe”, y la opción “Sin asignar” en gastos nuevos. No se
  agregan ítems nuevos al menú.
- **Migración aditiva y sin pérdida de datos.** No se recrean ni se copian
  `expenses`, `salaries` ni `incomes`. Se agregan reglas RLS, índices, RPCs,
  `savings_movements`, `savings_plans`, `savings_goals.owner_id` y
  `savings_goals.archived_at`; el saldo viejo de ahorro se convierte en un
  movimiento de apertura. Los históricos sin pagador o sin dueño no se
  inventan.
- **Calidad verificable.** Pruebas unitarias de fechas y saldos, pruebas SQL de
  RLS/migración/RPCs, e2e principal con dos miembros y días de pago distintos,
  e2e móvil, `check-mobile`, realtime, offline y un paso de IA con fixtures.
  `pnpm build`, `pnpm lint`, CI y E2E en verde; la PR la aprueba y mergea
  Jhotis12.
- **IA de voz como fase posterior, con confirmación.** Se incluye la capacidad
  de grabar un audio (“gasté 50 mil en mercado ayer”), transcribirlo/parsearlo
  con Gemini y dejar un borrador de gasto editable. Nunca se crea un gasto
  definitivo sin confirmación del usuario. Queda detrás de una bandera de
  funcionalidad y no bloquea el núcleo de la v2.0.
- **Cierre del change anterior.** `fix-datos-y-seguridad` se cierra como no
  aplicable a esta versión. Su alcance de seguridad/infraestructura no se
  implementa aquí; solo se toma la validación de integridad del pagador que
  necesita el nuevo modelo.
- **Versión 2.0.0.** Se actualizan `package.json`, `ARQUITECTURA.md`,
  `README.md`, las specs y el diagrama de arquitectura de la v2.0.

## Capabilities

### New Capabilities

- `finanzas/gastos-personales`: seguimiento de gastos por persona, pagador
  obligatorio, ventanas de mes en curso y desde el último pago, disponible
  opcional y relación con el gasto del hogar.
- `finanzas/hogar`: vista conjunta del mes, total gastado, desglose por
  persona, bolsa histórica sin pagador y ahorro compartido.
- `finanzas/ahorros`: metas personales y compartidas, movimientos de depósito y
  retiro, autoahorro mensual, efecto en el disponible y conservación del
  historial.
- `finanzas/migracion-datos`: migración aditiva, backfill de apertura de
  ahorro, reglas de integridad entre hogar y pagador, RLS e índices, sin pérdida
  de información.
- `producto/experiencia-v2`: organización por defecto en torno a lo personal,
  sección de hogar, consolidación de pantallas, lenguaje y eliminación de
  opciones confusas.
- `ia/captura-gastos-voz`: captura de un audio, extracción estructurada del
  gasto, revisión y confirmación, con privacidad, límites y feature flag.

### Modified Capabilities

- `offline/offline-mode`: los gastos encolados exigen pagador y conservan su
  nombre en la caché optimista; los cambios de ahorro siguen requiriendo red;
  el autoahorro se ejecuta al reconectar.
- `shared/montos-y-fechas`: nuevas utilidades TZ-seguras para “mes en curso”,
  “último día de pago” y “desde mi último pago”, con recorte de día 31/febrero.
- `docs/guia-canonica`: la guía canónica, el README, la versión 2.0.0 y las
  skills instaladas reflejan el nuevo modelo y la captura por voz.

## Impact

- **Migraciones**: migraciones aditivas en `supabase/migrations/` (datos,
  RLS, índices y RPCs del ledger personal; ahorro con movimientos y planes;
  voz, nómina automática, correcciones de datos y disponible desde el pago).
  No se borran tablas ni columnas. El saldo histórico de ahorro se backfillea
  como movimiento de apertura. Producción solo por el workflow al mergear a
  `master`.
- **Base de datos**: `savings_movements`, `savings_plans`,
  `savings_goals.owner_id`, `savings_goals.archived_at`; políticas RLS de
  pagador/miembro del mismo hogar; índices por persona/fecha; RPCs de
  disponible personal, historiales y autoahorro. Los totales visibles de
  mes/ciclo/hogar se derivan de las filas cargadas. `get_running_balance` y
  `get_monthly_surpluses` se revisan para no quedar como fuentes de verdad
  duplicadas.
- **Frontend**: `src/modules/dashboard`, `expenses`, `members`, `savings`,
  `history`, `forecast`, `wishlist`, `calendar`, `services`, `categories`,
  `profile`; `src/shared/components/layout`; hooks de datos, offline,
  realtime, tipos y utilidades de fechas. Se retiran hooks y componentes que
  queden sin uso.
- **Edge Function**: nueva `analyze-expense-audio` (Deno + Gemini) para la
  captura por voz, con rate limit y validación de hogar. No se modifica
  `analyze-receipt` salvo extraer helpers compartidos si las pruebas lo
  permiten.
- **Pruebas**: unidad con `node:test`, SQL/RLS con `psql`, e2e principal
  reescrito con dos miembros, nueva suite de dinero, móvil, `check-mobile`,
  realtime, offline y fixtures de audio. CI/E2E actualizados.
- **Documentación**: `ARQUITECTURA.md`, `README.md`, `AGENTS.md` (skills),
  diagrama `DIAGRAMA-REFACTOR-DINERO.html`, `package.json` 2.0.0.
- **Datos**: no se pierde información. Los gastos sin pagador y los ingresos
  sin dueño se conservan como legado explícito. El ahorro viejo queda como
  apertura sin dueño inventado. Se hace backup y auditoría antes/después en
  local con datos de producción.

## Git y PR

- **Rama**: `feat/v2-finanzas-personales` desde `master`, después de cerrar
  `fix-datos-y-seguridad` (no aplica) y dejar el árbol limpio.
- **Migraciones**: sí, migraciones aditivas. Se prueban en local con
  `supabase db reset --local` y `supabase migration up --local`; antes de
  producción se corre `supabase db push --dry-run` y el merge dispara
  `supabase-migrations.yml`.
- **Checks obligatorios**: `pnpm build`, `pnpm lint`, pruebas unitarias
  (`node --test`), pruebas SQL/RLS, `node tests/e2e-flow.mjs`,
  `node tests/e2e-money.mjs`, `node tests/e2e-mobile.mjs`,
  `node tests/check-mobile.mjs`, `node tests/e2e-realtime.mjs` y los workflows
  `CI` + `E2E` en verde.
- **Revisión**: Jhotis12 revisa, aprueba y mergea. El agente no mergea ni toca
  producción.

## Fuera de alcance

- Reparto justo de gastos, deudas entre miembros y liquidaciones.
- Integración bancaria, saldos reales de cuentas o conciliación automática.
- Multi-moneda.
- Navegación de ciclos de pago históricos (la ventana “desde mi pago” es la
  actual; los meses pasados siguen en calendario).
- Presupuestos por persona: los presupuestos por categoría siguen siendo del
  hogar en la v2.0.
- Creación automática de gastos por IA sin confirmación humana.
- Streaming de audio en tiempo real o almacenamiento permanente de audios.
- Implementación de `fix-datos-y-seguridad` y de cualquier migración manual a
  producción.
- Rediseño de autenticación, invitaciones o bucket de facturas más allá de lo
  necesario para el nuevo ledger.
