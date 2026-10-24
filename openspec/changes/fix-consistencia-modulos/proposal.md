# Proposal

## Why

Los 12 módulos de dominio crecieron por PRs sucesivos y cada uno resolvió a su
manera lo mismo: mensajes de error, montos, etiquetas de formulario, fechas y
acciones táctiles. Una auditoría de los 12 módulos (con archivo:línea) encontró
inconsistencias verificadas, dos de ellas con impacto directo en el usuario:
un monto de factura se interpreta mal (`"20.500"` se muestra como **$21**) y
tres botones de la lista de deseos fallan sin mensaje. Además la documentación
canónica se desvió del código: `ARQUITECTURA.md` perdió sus secciones 4 (modelo
de datos) y 5 (seguridad) y todavía las referencia, y los specs de offline
describen un clasificador de errores distinto al real; un agente que los siga al
pie puede "corregir" código que está bien.

## What Changes

- **Errores visibles y consistentes**: eliminar los rechazos sin manejar
  (botones de estado de wishlist, salir/eliminar hogar en Perfil), mover el
  único `toast` que vive dentro de un hook a su página, mostrar `QueryError`
  donde hoy hay texto casero o un `return null` silencioso (IncomeSection,
  ForecastWidget, Perfil), y dejar de ignorar en silencio un monto inválido
  (BudgetModal) o un borrado sin confirmación (quitar presupuesto).
- **Montos y fechas**: interpretar el total de factura con `parseMoneyInput`
  (hoy `Number("20.500")` = 20,5), y unificar el locale a `es-CO` en
  `formatDate` (hoy `es-MX`); mostrar con `formatDate` las fechas ISO que se
  pintan en crudo (Ahorros, wizard de servicios).
- **UI accesible y consistente**: asociar `label`/`id` en los formularios que
  no lo hacen (nombre de Login, `MoneyInput`, `ExpenseForm`, buscador de
  Gastos), subir a contraste AA los textos que no llegan (`EmptyState`,
  `CategoryBadge`, "Sin salario" en oscuro) y las acciones táctiles bajo 44px
  (chips y botones de fila con `min-h-8/9/10`); centralizar `inputClass`
  (8 copias divergentes), dar rol/Escape/foco a los sheets propios (action
  sheet de Gastos y sheet "Más") y agregar el FAB de gasto que el Dashboard
  documenta y no tiene en móvil.
- **Feedback offline único**: cuando la mutación se encoló offline, la página
  no agrega su toast de éxito (hoy se ven "Guardado sin conexión" y "Gasto
  registrado"); y Wishlist queda explícito como dominio que requiere red, con
  mensaje claro en vez de un fallo mudo.
- **Documentación y specs alineados**: recuperar y actualizar las secciones 4
  y 5 de `ARQUITECTURA.md` (perdidas en `d54065e`, recuperables de `46d5511`),
  ubicar `useToast` donde realmente vive, corregir el alcance del sheet "Más",
  quitar del workflow el comentario que afirma branch protection, listar las 8
  skills instaladas en `AGENTS.md` y las páginas `/terminos` y `/privacidad`
  en el árbol de módulos; alinear los dos specs de offline con el código real.

## Capabilities

### New Capabilities

- `shared/manejo-errores`: todo fallo de mutación o query se ve y se explica —
  sin rechazos sin manejar, sin no-ops silenciosos, con `QueryError` en las
  consultas y el aviso en el punto de uso (no dentro del hook).
- `shared/montos-y-fechas`: los montos COP se interpretan y se muestran con
  `parseMoneyInput`/`formatCurrency` y las fechas con el locale y el formato
  del proyecto (`es-CO`, `formatDate`), nunca en crudo ni desde otra variante.
- `shared/ui-accesible`: los campos tienen etiqueta asociada, los textos
  llegan a contraste AA, las acciones táctiles miden ≥44px, los sheets propios
  se comportan como modales (rol, Escape, foco) y los campos comparten una
  sola definición de estilo.
- `docs/guia-canonica`: `ARQUITECTURA.md`, `AGENTS.md` y los comentarios de CI
  describen el proyecto que existe hoy (modelo de datos, seguridad, skills,
  rutas, alcance de la navegación móvil).

### Modified Capabilities

- `offline/offline-mode`: se agrega que el aviso offline es la única señal
  (la página no duplica el toast) y se hace explícito que Wishlist requiere
  red, con mensaje claro al usuario.
- `auth/offline-resilience`: el requerimiento "Criterio único de error de red"
  pasa a describir los dos clasificadores reales (el puro y el wrapper con
  `navigator.onLine`), sin cambiar el comportamiento.

## Impact

- **Código**: `src/modules/wishlist/Wishlist.tsx` (+ `hooks/useWishlist.ts`),
  `src/modules/profile/Profile.tsx` (+ `hooks/useHousehold.ts`),
  `src/modules/members/components/IncomeSection.tsx`,
  `src/modules/dashboard/components/ForecastWidget.tsx` y `Dashboard.tsx`,
  `src/modules/expenses/components/ReceiptResult.tsx` y `ExpenseForm.tsx`,
  `src/modules/expenses/Expenses.tsx`,
  `src/modules/categories/components/BudgetModal.tsx`,
  `src/modules/savings/Savings.tsx`,
  `src/modules/services/components/ApplyRecurringModal.tsx` y `ServiceForm.tsx`,
  `src/modules/auth/Login.tsx` y `Recover.tsx`,
  `src/shared/lib/dates.ts` y `offline/optimistic.ts`,
  `src/shared/components/ui/{EmptyState,CategoryBadge,MoneyInput,Toast}.tsx`,
  `src/shared/components/layout/Layout.tsx`, `src/App.tsx`.
- **Docs**: `ARQUITECTURA.md` (§3, §4, §5, §6), `AGENTS.md`,
  `.github/workflows/ci.yml` (comentario), specs de offline.
- **APIs/dependencias**: ninguna nueva; sin cambios de esquema, sin migraciones.
- **Riesgos**: subir tamaños táctiles y contrastes toca CSS compartido y puede
  mover el layout móvil (se valida con `check-mobile.mjs`, 11 rutas a 375/320px
  más modales); `formatDate` a `es-CO` cambia etiquetas visibles en varias
  pantallas (revisar en las suites e2e que esperan texto); la regla "la página
  no duplica el toast" depende de que la mutación resuelva sin fila al encolar
  (comportamiento actual de `runWithOfflineFallback`).
## Fuera de alcance

- Extraer un componente `Button` y migrar los 20+ CTAs: en este change solo se
  corrige el tamaño táctil y el estilo de los campos (una definición
  compartida); el rediseño de variantes queda para otro change (detalle en
  design.md).
- Rework de teclado/ARIA del `SelectInput` (listbox propio), deduplicar
  `StatCard` y las métricas de cabecera.
- Rendimiento: Historial O(n²), re-render del Dashboard con `useCountUp`,
  `useAllSalaries` sin límite, invalidaciones realtime por prefijo.
- Mapa global de contraste AA para el texto secundario en tema claro
  (`text-ink/25..60`, ~209 usos): oscurecerlo hasta 4.5:1 aplana la escala de
  grises de todo el proyecto, así que es un rediseño aparte; aquí solo se
  corrigen los casos que señaló la auditoría.
- Seguridad, RLS, migraciones, paridad de esquema, cola offline y caché
  optimista: van en el change `fix-datos-y-seguridad`.

## Git y PR

- **Rama**: `fix/consistencia-modulos` (desde `master`).
- **Migraciones**: ninguna. No hay `supabase db push` ni cambios de esquema.
- **Checks de CI que deben pasar**: `CI` (build + lint) y `E2E` (Supabase local
  + `e2e-flow`, `e2e-mobile`, `check-mobile`, `e2e-realtime`). En local, antes
  de abrir la PR: `pnpm build`, `pnpm lint`, `node tests/e2e-flow.mjs` (47
  pasos, con sandbox reseteado) y `node tests/check-mobile.mjs` +
  `node tests/e2e-mobile.mjs` por tocar UI móvil.
- Revisa, aprueba y mergea **Jhotis12**; el agente no mergea.
