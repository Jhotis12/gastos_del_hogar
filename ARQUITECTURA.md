# 🏠 Guía del Proyecto — App de Gastos del Hogar

> Guía canónica para entender cómo está construido y cómo funciona este
> proyecto. Consúltala antes de tocar código: aquí viven las tecnologías,
> la arquitectura, los patrones de diseño y las decisiones que ya se tomaron.

---

## 1. ¿Qué es?

Aplicación web para gestionar el **presupuesto común de un hogar** (Colombia):

- Cada persona registra su **salario mensual**; todos los ingresos se suman a
  un **fondo común** del hogar.
- Los **gastos** se descuentan de ese fondo, clasificados por **categoría**.
- **Servicios/gastos fijos** (renta, luz, internet…) con frecuencia
  configurable y estado pagado/pendiente.
- **Calendario mensual**, **presupuestos por categoría**, **saldos entre
  miembros** (quién debe a quién), **metas de ahorro** y **escaneo de
  facturas con IA** (Gemini) para crear gastos desde una foto.
- Moneda: **COP (pesos colombianos)**. Formato de entrada "450.000" = 450 mil.

---

## 2. Stack y tecnologías

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Frontend | React 19 + TypeScript | `verbatimModuleSyntax`, sin `baseUrl` (paths relativos en tsconfig) |
| Build | Vite 8 | Plugin `@tailwindcss/vite`; alias `@/` → `src/` |
| Estilos | Tailwind CSS v4 | Tokens en `@theme` de `src/index.css` |
| Router | React Router v7 | Guards declarativos (`RequireAuth`, `RequireGuest`, …) |
| Datos | TanStack Query + `@supabase/supabase-js` | `staleTime: 30s`, `retry: 1` |
| Iconos | lucide-react | |
| Fonts | @fontsource-variable (Sora + Inter) | Auto-alojadas, sin CDN |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, RLS) | Proyecto `xqfemqgokoedpenmqsmq` |
| Testing | Playwright (Firefox) | Suite e2e en `tests/e2e-flow.mjs` |

---

## 3. Estructura de carpetas

```
├── .env.example             # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
├── supabase/
│   ├── schema.sql           # Esquema completo (idempotente, para instalación fresca)
│   └── functions/
│       └── analyze-receipt/index.ts   # Edge Function (Deno) → Gemini
├── src/
│   ├── main.tsx             # Providers: QueryClient + AuthProvider + ToastProvider
│   ├── App.tsx              # Rutas y guards
│   ├── index.css            # Tailwind @theme: tokens, keyframes, .card
│   ├── lib/
│   │   ├── supabase.ts      # Cliente Supabase
│   │   ├── types.ts         # Tipos de las entidades (coinciden con el esquema)
│   │   ├── money.ts         # formatCurrency, parseMoneyInput, formatMoneyInput
│   │   ├── dates.ts         # monthKey, shiftMonth, todayISO… (TZ-seguros)
│   │   ├── images.ts        # compressImage (canvas, máx 1600px, JPEG 85%)
│   │   ├── constants.ts     # FREQUENCIAS, CATEGORY_ICONS, COLORS, WEEKDAYS
│   │   └── utils.ts         # cn() y errorMessage()
│   ├── hooks/               # 1 archivo por dominio (ver §6)
│   ├── components/         # Agrupados por apartado:
│   │   ├── layout/         #   Layout (sidebar + header móvil)
│   │   ├── ui/             #   Base: Modal, ConfirmDialog, Toast, Loading, QueryError,
│   │   │                   #   MoneyInput, SelectInput, DateInput, MonthPicker,
│   │   │                   #   CategoryBadge, StatCard, AppLogo, ThemeToggle, SessionSync
│   │   ├── expenses/       #   Gastos: ExpenseForm + ReceiptCapture/Result/Viewer (facturas)
│   │   ├── services/       #   ServiceForm (gastos fijos)
│   │   ├── savings/        #   GoalForm + AdjustGoalModal (metas de ahorro)
│   │   └── categories/     #   BudgetModal (presupuestos por categoría)
│   └── pages/              # 1 página por ruta
├── tests/
│   ├── e2e-flow.mjs         # Suite e2e de 39 pasos (navegación SPA)
│   ├── e2e-realtime.mjs     # Sincronización en tiempo real entre 2 miembros
│   ├── check-mobile.mjs     # Verificación móvil (375px, sin overflow)
│   ├── reset-sandbox.sh     # Reinicia el usuario sandbox (requiere SUPABASE_SERVICE_ROLE)
│   ├── screenshots.mjs      # Capturas de las páginas (dev)
│   └── fixtures/factura.jpg # Factura de prueba para el escaneo
└── .agents/skills/          # Skills de opencode del proyecto
```

---

## 4. Modelo de datos (Supabase/Postgres)

```
households          id, name, invite_code (único), created_at
profiles            id (= auth.users.id), household_id → households, full_name,
                    payday (1-31, default 1)  → día de pago de la persona
salaries            household_id, profile_id, amount (>0), month (YYYY-MM-01),
                    pay_date (fecha real de la nómina de esa fila; default = día 1)
                    UNIQUE(profile_id, month)   → 1 salario por persona y mes
categories          household_id, name, color, icon
category_budgets    household_id, category_id, month, amount (>0)
                    UNIQUE(category_id, month)  → límite mensual por categoría
expenses            household_id, category_id, paid_by, recurring_id (servicio),
                    receipt_id (factura), amount, description, expense_date
recurring_expenses  household_id, category_id, paid_by, amount, description,
                    frequency (monthly|bimonthly|quarterly|yearly),
                    next_due_date, is_active
savings_goals       household_id, name, target_amount (>0), saved_amount (>=0),
                    target_date (opcional)
receipts            household_id, storage_path, uploaded_by, parsed_data (jsonb)
```

- **Fondo común:** ingreso del mes = `SUM(salaries.amount)` del hogar
  (salarios efectivos: fila del mes o heredado); saldo = ingresos − gastos
  del mes.
- **Salario efectivo del mes** (`src/lib/salaries.ts`): si existe la fila de
  ese mes se usa su `amount`; si no, se **hereda** el último salario registrado
  en un mes anterior (badge "Heredado de {mes}"). Su `pay_date` efectiva se
  calcula con `payDateForMonth(payday, month)`: el día de pago de la persona
  recortado al último día del mes (p. ej. día 31 en febrero → 28).
- **Saldo disponible (Dashboard):** RPC `get_running_balance(p_date)` = `SUM`
  salarios con `pay_date <= p_date` − `SUM` gastos con `expense_date <=
  p_date`. En el mes actual se calcula hasta hoy (la nómina del mes solo
  cuenta desde su día de pago); en meses pasados, hasta fin de mes. Así el
  sobrante de meses anteriores se arrastra al mes siguiente.
- **Sobrantes por mes (Dashboard + `/historial`):** RPC
  `get_monthly_surpluses()` devuelve una fila por mes desde el primer mes con
  actividad hasta el actual: `(month, income, expenses, surplus)`, donde
  sobrante de M = Σ salarios con `pay_date` en M − Σ gastos con
  `expense_date` en M. La suma acumulada de los sobrantes = `get_running_balance`
  (el saldo disponible es el sobrante acumulado). Tarjeta en Dashboard
  (últimos 6 meses, % de ahorro sobre ingresos, delta vs mes anterior) y
  tabla completa en `/historial` con columna Acumulado (suma corrida).
- **Fechas de mes** siempre como `YYYY-MM-01` (primer día).

---

## 5. Seguridad

### Row Level Security (RLS)
Habilitada en todas las tablas. Patrón único: **pertenencia al hogar** mediante
la función `is_household_member(household_id)` (security definer — evita
recursión infinita en políticas).

- `profiles`: ver/editar el propio; ver compañeros de hogar.
- `salaries`: ver del hogar; **insertar/editar/eliminar solo el propio**
  (`profile_id = auth.uid()`).
- Resto: CRUD solo para miembros del hogar.
- Autorización basada en `auth.uid()` — nunca en `user_metadata`.

### RPCs (funciones security definer)
| RPC | Propósito |
|-----|-----------|
| `create_household(p_name)` | Crea hogar + código + perfil + 7 categorías por defecto, atómico. Evita `INSERT…RETURNING` (la RLS filtra antes de ser miembro → 403 PGRST106). |
| `get_household_by_code(p_code)` | Busca hogar por código (solo con sesión). |
| `apply_recurring_expense(p_recurring_id, p_month)` | Aplica **un** servicio vencido a `expenses` (con guarda anti-duplicados por mes) y avanza su `next_due_date` según `frequency` (1/2/3/12 meses). Se llama por servicio desde el wizard de "Aplicar al mes". |
| `get_running_balance(p_date)` | Saldo acumulado del hogar a una fecha: Σ salarios (`pay_date <= p_date`) − Σ gastos (`expense_date <= p_date`). Security definer con `auth.uid()`. |
| `get_monthly_surpluses()` | Sobrantes por mes desde el primer mes con actividad hasta el actual: `(month, income, expenses, surplus)` (pay_date/expense_date agrupados por mes). Suma acumulada = saldo disponible. |

### Edge Function `analyze-receipt`
- Deno + `@supabase/supabase-js`. Valida JWT y pertenencia al hogar del path.
- Descarga la imagen del bucket `receipts` → **Gemini Flash**
  (`gemini-flash-latest`; modelo `gemini-2.0-flash` tiene cuota 0 con la key
  actual) → JSON `{comercio, fecha, items[], total}`.
- CORS habilitado explícitamente (`Access-Control-Allow-Origin: *`).
- La `GEMINI_API_KEY` vive **solo en los secrets** del Edge Function.
- Deploy: `SUPABASE_ACCESS_TOKEN=<pat> supabase functions deploy analyze-receipt`.

### Storage
Bucket privado `receipts`, rutas `{household_id}/{uuid}.jpg` con políticas
de subida/lectura por hogar.

---

## 6. Patrones de diseño (frontend)

### Hooks por dominio
Un archivo por dominio en `src/hooks/` — **no volver a crear un god-file**:

| Hook | Dominio |
|------|---------|
| `useAuth.tsx` | Sesión + perfil (contexto) |
| `useHousehold.ts` | Hogar (crear/unirse vía RPCs) |
| `useMembers.ts` | Miembros + salarios |
| `useCategories.ts` | Categorías + presupuestos |
| `useExpenses.ts` | Gastos + resumen del mes |
| `useRecurring.ts` | Servicios + aplicar + pendientes |
| `useSavings.ts` | Metas de ahorro |
| `useReceipts.ts` | Facturas (subida, análisis, signed URLs) |

Convención: cada hook = `useQuery`/`useMutation` con `queryKey` por dominio
y `invalidateQueries` de su propia clave en `onSuccess`.

### Guards de rutas (App.tsx)
Guards declarativos que renderizan `<Outlet/>` tras pasar — **nunca navegar
manualmente desde formularios**:

1. `RequireGuest` — `/login` solo sin sesión (evita carreras del login).
2. `RequireAuth` — espera `loading` (sesión resuelta).
3. `RequireSetup` / `RequireHousehold` — esperan `profileLoaded`
   (`loading`/`profileLoading`/`!profileLoaded` → `Loading`; **nunca** navegar
   mientras el perfil no exista: causaba cascadas `/gastos → /setup → /`).

### Manejo de errores y feedback
- Mutaciones: `try/catch` + `toast.error(errorMessage(err))` — nunca dejar
  rejection silenciosa ni modal abierto sin mensaje.
- Queries: estado `error` renderizado con `<QueryError/>`.
- Modales con datos: `requestClose` pregunta "¿Descartar cambios?" si hay
  campos sin guardar (ExpenseForm).

### Montos en COP
Siempre por `MoneyInput` (texto con `inputMode="decimal"`): acepta
`450.000`, `2.500.000,50` o `450000`; puntos = miles, coma = decimales.
- **Formato en vivo** con puntos de miles mientras se teclea (solo con el
  cursor al final; con separadores se normaliza al salir).
- Prefijo "$" fijo, dígitos tabulares (`tabular-nums`) y **16px** (los
  inputs menores a 16px provocan zoom automático de iOS al enfocar).
- Parseo con `parseMoneyInput` al guardar.

### Selects y fechas
- `SelectInput`: select nativo con `appearance-none` + chevron visible en
  todas las plataformas y misma altura que los inputs (16px, `py-3`).
- `DateInput`: `type="date"` con icono de calendario y estilos consistentes.

### Fechas y meses (TZ-seguras)
Todas las utilidades de mes construyen fechas al **mediodía local**
(`new Date(y, m, 15, 12)`) — un `Date.UTC` leído con getters locales daba
rangos vacíos en UTC−5 (bug histórico: "los gastos no se registraban").

### Sistema de diseño (Tailwind v4)
- Paleta "billete" en `@theme`: `pine` (verde), `gold`, `coral`, `cream`, `ink`.
- Fuentes: `font-display` (Sora) para títulos y cifras; Inter para texto.
- Clase `.card` + `.card-hover` (elevación al hover).
- Animaciones (`--animate-*`): `fade-up`, `scale-in`, `slide-in`, `grow-bar`,
  `scan-sweep` (facturas), `dot` — todas respetan `prefers-reduced-motion`.
- Count-up de montos con `useCountUp` — **hooks siempre antes de cualquier
  `return` condicional** (regla de hooks).

### Diseño mobile (mobile-first, 375px)
Skill de referencia: `mobile-app-ui-design` (`.agents/skills/`).
- **Navegación inferior** (`Layout.tsx`): barra fija con 4 accesos principales
  (Inicio, Gastos, Ahorros, Servicios) + botón "Más" que abre un **sheet**
  inferior (Calendario, Miembros, Categorías, Cerrar sesión). El sidebar de
  desktop permanece intacto (la barra inferior usa `role="navigation"`, no
  `<nav>`, para no colisionar con los selectores del test e2e).
- **Login/Registro**: split en desktop (panel de marca en gradiente pine con
  features) y móvil centrado; segmented control, toggle de mostrar/ocultar
  contraseña, inputs y CTAs con `min-h-12` (44px+ de área táctil).
- **Touch targets**: botones de icono en filas `p-2` mínimo; CTAs `min-h-12`.
- **Safe area**: `pb-[env(safe-area-inset-bottom)]` en la barra inferior y
  contenido con `pb-28 lg:pb-6` para que nada quede oculto.
- Regla de oro: **sin overflow horizontal a 375px** (verificado por
  `tests/check-mobile.mjs`).

### Modo oscuro
- Tokens temáticos como variables CSS (`@theme inline`): `cream`, `ink`,
  `surface`, escala `slate` y tintes `pine/gold/coral` se invierten con la
  clase `.dark` en `<html>` (variante `@custom-variant dark`). Las superficies
  blancas usan `bg-surface` (token) — **no** `bg-white` (reservado para texto).
- `useTheme` (hook) + `ThemeToggle` (sidebar, header móvil y sheet "Más");
  persiste en `localStorage('theme')` y respeta `prefers-color-scheme`.
  `main.tsx` aplica el tema antes del primer render (evita parpadeo).

### Perfil y Hogar (`/perfil`)
- Cambiar nombre (`useUpdateProfile`), salir del hogar (`useLeaveHousehold`),
  **eliminar hogar** (`useDeleteHousehold`, requiere política DELETE en
  `households`) y cerrar sesión. Tras salir/eliminar, los guards redirigen a
  `/setup`.

### Quick-add
- Botón "+" en el Dashboard que abre `ExpenseForm` para registrar un gasto
  sin navegar a la página de Gastos.

### Sincronización en tiempo real
- **Supabase Realtime** (`useRealtimeSync` en Layout): un canal por hogar
  (`postgres_changes` en las 9 tablas del hogar, filtrado por
  `household_id`) que invalida las queries de React Query correspondientes
  al recibir cualquier cambio. Si un miembro registra un gasto, salario o
  edita algo, **los demás lo ven al instante sin recargar** (la publicación
  `supabase_realtime` está habilitada en `schema.sql`).
- Mapa tabla → claves invalidadas (ej. `expenses` → `['expenses'], ['receipts']`;
  `profiles` además refresca el perfil propio).

### Lazy loading y caché
- **Code splitting por ruta** (`React.lazy` + `Suspense` en `App.tsx`): cada
  página se descarga solo al navegar a ella (verificado: chunks separados en
  `dist/assets/`).
- **Caché**: TanStack Query con `staleTime: 30s`, `gcTime: 30min` y
  `refetchOnWindowFocus`; los cambios remotos invalidan por dominio.

---

## 7. Flujos clave

### Autenticación y hogar
`signUp/signIn` → trigger `handle_new_user` crea el perfil → `RequireGuest`
redirige → `/setup` (crear hogar con RPC o unirse con código) → Dashboard.
Los guards deciden todo; Login/Setup **no** llaman `navigate()`.

### Escaneo de facturas
`Escanear factura` → modal con "Tomar foto" (`capture="environment"`, cámara
en móvil / selector en desktop) y "Subir de galería" → compresión (canvas) →
subida al bucket → fila en `receipts` → Edge Function → **réplica visual del
ticket** (comercio, items, TOTAL) → "Crear gasto" crea **1 gasto** con el
total y el nombre de la tienda, vinculado a la factura → el selector de mes
salta al mes de la factura → icono "Ver factura" en la fila muestra la foto +
desglose.

### Servicios (gastos fijos)
Página Servicios: total fijo del mes, % vs ingreso, estado
**Pagado/Pendiente** por servicio (vía `expenses.recurring_id`). El botón
"Aplicar al mes" (también desde el Dashboard como "Aplicar recurrentes") abre
un **wizard modal por servicio**: muestra cada pendiente (vencido y sin gasto
del mes) con "Sí, lo pagué" (RPC `apply_recurring_expense` individual) o
"Saltar" (queda pendiente, no se descuenta ni avanza su fecha).

---

## 8. Comandos

| Comando | Uso |
|---------|-----|
| `pnpm dev` | Dev server (puerto 5173) |
| `pnpm build` | `tsc -b` + Vite build |
| `pnpm lint` | oxlint |
| `node tests/e2e-flow.mjs` | Suite e2e (requiere dev server arriba) |
| `SUPABASE_SERVICE_ROLE=… bash tests/reset-sandbox.sh` | Reinicia usuario sandbox |
| `SUPABASE_ACCESS_TOKEN=… supabase functions deploy analyze-receipt` | Deploy Edge Function |
| `SUPABASE_ACCESS_TOKEN=… supabase secrets set GEMINI_API_KEY=…` | Secret de Gemini |

> **Entorno local (Supabase CLI + Docker):** `supabase start` levanta la pila
> en `127.0.0.1:54321` (API), `54322` (Postgres), `54323` (Studio) y `54324`
> (Mailpit). `.env.local` (gitignored por `*.local`) apunta el dev server al
> local; Vercel usa sus variables del dashboard, por lo que el deploy de
> producción nunca ve el `.env.local`. La anon key del local es un JWT firmado
> con el secret por defecto de `config.toml`. El entorno local se siembra con
> un backup de producción (`supabase db dump --linked -p … --data-only` +
> `psql`) para probar contra datos reales.

> ⚠️ **Trampa operativa:** tras ediciones masivas de archivos, el watcher de
> Vite puede servir transformaciones obsoletas. Si el dev server se comporta
> raro: reiniciarlo con `rm -rf node_modules/.vite`.

---

## 9. Testing

- Suite e2e de 39 pasos (`tests/e2e-flow.mjs`): login, hogar, salarios
  (día de pago + herencia al mes siguiente), gastos, calendario, saldos,
  saldo acumulado, sobrantes por mes (tarjeta Dashboard + `/historial`),
  presupuestos, servicios, metas, escaneo de facturas
  (con fixture + Gemini real).
- Usa **navegación SPA** (clics en el sidebar, no `page.goto` a rutas
  protegidas), esperas por selector y `data-testid="confirm-dialog-confirm"`
  para los diálogos.
- El usuario sandbox se crea/elimina con `reset-sandbox.sh` (la eliminación
  limpia su hogar y datos en cascada).
- Antes de cerrar una fase: `pnpm build` + `pnpm lint` + suite e2e completa.

---

## 10. Historial de bugs corregidos (no reintroducir)

1. **500 al iniciar sesión** — política RLS de `profiles` con subquery
   recursivo (42P17) → sustituida por `is_household_member()`.
2. **Pantalla en blanco** — guard devolvía `null` sin `<Outlet/>`.
3. **403 al crear hogar** — `INSERT…RETURNING` filtrado por RLS → RPC.
4. **Gastos que "no se registraban"** — `shiftMonth` con `Date.UTC` +
   getters locales (TZ) y filtro de categoría inicializado en `''`.
5. **Cascadas de redirección** — guards sin esperar sesión/perfil →
   `RequireGuest` + `profileLoaded` + reintentos del fetch de perfil.
6. **`useCountUp` tras early-return** en Dashboard — violación de reglas de
   hooks → mover hooks arriba.
7. **Vite sirviendo caché vieja** tras seds masivos → `rm -rf node_modules/.vite`.
