# Design

## Context

See `proposal.md` — Why. Estado actual que condiciona el enfoque:

- **Patrones de casa ya existen** y el change los aplica, no los inventa:
  `Modal`, `ConfirmDialog`, `MoneyInput`/`SelectInput`/`DateInput`, `QueryError`,
  `QueryError` + `PageSkeleton`, `Fab`, `toast` en el punto de uso, specs en
  `openspec/specs/`.
- **No hay runner de tests unitarios** (`package.json` solo tiene Playwright).
  La verificación es `pnpm build` + `pnpm lint` + las suites de `tests/`
  (`e2e-flow` 47 pasos, `e2e-mobile` 9, `check-mobile` 11 rutas) y comprobación
  por comportamiento observable; los escenarios de los specs se redactan para
  ser comprobables así (grep del patrón prohibido + paso e2e o revisión
  explícita).
- **Contrato offline vigente**: `runWithOfflineFallback(run, onOffline)` resuelve
  `undefined as T` cuando la operación se encoló; solo `expenses`, `incomes` y
  `salaries` lo usan con cola real (`src/shared/lib/offline/optimistic.ts`).
- **Caché de tokens**: `src/index.css` define los tokens de ambos temas y ya
  documenta que los grises de oscuro se sustituyeron para llegar a 4.5:1; el
  caso pendiente es el tema claro.

## Goals / Non-Goals

**Goals:**

- Que las inconsistencias transversales encontradas (archivo:línea) queden
  corregidas y con un contrato escrito que impida reintroducirlas.
- Verificar todo con el build, el lint y las suites existentes, sin agregar
  infraestructura de tests.
- Cambios de una sola capa (frontend) y sin impacto en la base de datos.

**Non-Goals:**

- Extraer un componente `Button` y unificar las 20+ variantes de CTA: se
  corrige solo lo que rompe accesibilidad (altura táctil) o duplica estilo
  literal (`inputClass`).
- Tocar la capa de datos, RLS, migraciones, cola offline o Edge Function
  (change `fix-datos-y-seguridad`).
- Rendimiento (Historial O(n²), re-render del Dashboard, `useAllSalaries`).

## Decisions

### 1. Errores: mismo patrón en el punto de uso

Las páginas que hoy ignoran el fallo (`Wishlist.tsx:309,316,326`,
`Profile.tsx:547,567`) ganan `try/catch` + `toast.error(errorMessage(err))`, con
el diálogo abierto si falla un borrado (permite reintentar). Los tres casos sin
`QueryError` (`IncomeSection.tsx:127`, `ForecastWidget.tsx:14` y
`Profile.tsx:131`) pasan a `<QueryError/>` con reintento; `useUpdatePayday`
devuelve el toast a `Members.tsx`. Alternativa descartada: `onError` en los
hooks — movería el mensaje lejos del flujo y dejaría los hooks emitiendo UI.

### 2. Montos: `parseMoneyInput` en la réplica del ticket

`ReceiptResult.tsx:126,129` usa `Number(total)` sobre texto que `MoneyInput`
formatea con puntos: `"20.500"` → `20.5`. Se cambia a `parseMoneyInput` (ya se
usa en el submit, `:60`) y la comparación contra la suma de items se hace en
número. `formatCurrency` (COP, `maximumFractionDigits: 0`) no se toca.

### 3. Fechas: `es-CO` y `formatDate` en toda la UI

`formatDate` (`dates.ts:38`) pasa de `es-MX` a `es-CO` (los formatos
`{day:'numeric', month:'short'}` coinciden, así que no cambian los textos del
e2e) y las dos pantallas que pintaban ISO en crudo (`Savings.tsx:137`,
`ApplyRecurringModal.tsx:88`) usan `formatDate`.

### 4. Accesibilidad: tokens existentes y 44px, sin rediseño

- **Etiquetas**: `id` + `htmlFor` en el nombre de Login, `MoneyInput` (prop
  `ariaLabel`/`id`), `ExpenseForm` y el buscador de Gastos.
- **Contraste**: se sustituyen los valores que no llegan a 4.5:1 por tokens que
  ya cumplen en claro y oscuro (`EmptyState`, `Members.tsx:192`, y en
  `CategoryBadge` el texto pasa a token del tema conservando el tinte del color
  del usuario). No se agregan tokens nuevos. Alcance acotado a los casos que
  señaló la auditoría: el resto del texto secundario (`text-ink/25..60`, ~209
  usos) necesita un rediseño de la escala de grises en claro y queda fuera
  (ver "Fuera de alcance" del proposal).
- **Táctil**: las acciones con `min-h-8/9/10` suben a `min-h-11` (44px); se
  conserva `min-h-12` en CTAs. `check-mobile.mjs` es el guard de layout.
- **Sheets propios** (`Expenses.tsx:347`, `Layout.tsx:245`): `role="dialog"` +
  `aria-modal`, `Escape` y foco al abrir/cerrar. Alternativa descartada:
  convertirlos al `Modal` compartido — el action sheet tiene gesto de arrastre
  y el sheet "Más" tiene su propio layout; migrarlos es un cambio mayor.
- **FAB en Dashboard móvil**: se reutiliza `Fab` y el `ExpenseForm` de quick-add
  que la página ya tiene; el botón de header queda para `lg:`.

### 5. Una sola definición del estilo de campos

Nuevo export `fieldClass` en `src/shared/components/ui/fieldClass.ts` con la
cadena que hoy está copiada 8 veces (`Setup`, `ExpenseForm`, `ReceiptResult`,
`IncomeSection`, `Profile`, `GoalForm`, `ServiceForm`, `WishlistItemForm`) y que
`Categories.tsx:168` también implementa a mano. `MoneyInput`/`SelectInput`/
`DateInput` siguen con su estilo propio (ya centralizado). Alternativa
descartada: componente `TextField` — más churn del necesario en este change.

### 6. Un solo aviso offline: sentinel `OFFLINE_QUEUED`

`runWithOfflineFallback` pasa a resolver `OFFLINE_QUEUED` (constante exportada
en `offlineSafe.ts`) en vez de `undefined as T`; las páginas que hoy confirman
éxito después de la mutación (`Expenses.tsx:91,94`, `Dashboard.tsx:58`,
`Calendar.tsx:87`, `IncomeSection.tsx:76,79`, `Members.tsx:71`,
`Expenses.tsx:316`) solo muestran su toast si el resultado no es el sentinel.
Así el usuario ve una sola señal ("Guardado sin conexión") y el typecheck
señala cualquier punto que consuma el resultado sin contemplar el caso offline.
Alternativas descartadas: leer `navigator.onLine` en la página (falso con WiFi
sin internet) y dejar que el hook toastee (rompe la decisión 1).

### 7. Wishlist requiere red, con mensaje claro

Las 4 mutaciones de `useWishlist.ts` ya usan `runWithOfflineFallback` con un
fallback que lanza "Sin conexión: vuelve a intentarlo cuando estés en línea";
el hueco es que las páginas no lo capturan. Se captura y se toastea (decisión
1) y el spec declara `wishlist_items` como dominio que requiere red.
Alternativa descartada: agregar wishlist a la cola offline — implica entidad
nueva en el outbox, caché optimista y replay, y ni el producto ni el spec lo
piden.

### 8. Documentación: recuperar y refrescar, no reescribir

`ARQUITECTURA.md` recupera §4 y §5 desde `git show 46d5511:ARQUITECTURA.md`
(las perdió `d54065e`, que además dejó la numeración rota) y se refresca contra
las 13 migraciones actuales (aparecen `wishlist_items`, `incomes`,
`salaries.pay_date`, `initial_payment`); se corrigen las ubicaciones desviadas
(`useToast`, sheet "Más", `/terminos` y `/privacidad`) y la lista de skills de
`AGENTS.md`. Los dos desfases de los specs de offline son correcciones de
texto (el código es el correcto): el clasificador puro no lee `navigator` y el
drenado sí reintenta con `isAuthRetryableFetchError`.

## Risks / Trade-offs

- [Cambiar contraste y alturas mueve el layout móvil] → solo tokens y clases
  existentes; `check-mobile.mjs` (11 rutas a 375/320px + modales) como guard y
  revisión visual de las pantallas tocadas en ambos temas.
- [`formatDate` cambia de locale] → `{day:'numeric', month:'short'}` produce el
  mismo texto en `es-MX` y `es-CO`; si alguna aserción del e2e cambia, se
  actualiza en el mismo PR (los pasos del e2e no dependen del locale de `formatDate`).
- [El sentinel `OFFLINE_QUEUED` amplía el tipo de retorno de 9 mutaciones] →
  `pnpm build` marca cada punto que consuma el valor; hoy ninguno lo usa salvo
  las páginas que se ajustan.
- [Quitar el `navigate('/')` de Recover] → el guard decide; se verifica a mano
  con el enlace de recuperación (Mailpit local) antes de la PR.
- [Subir `min-h` en filas densas puede aumentar el alto de la lista] → es el
  objetivo (44px) y el e2e móvil (`e2e-mobile.mjs`) cubre sheets y arrastres.

## Migration Plan

No aplica: el change no toca la base de datos ni migraciones. El "despliegue" es
la PR (`fix/consistencia-modulos`) con `CI` y `E2E` en verde; rollback = revertir
el merge, sin estado persistente que limpiar.
