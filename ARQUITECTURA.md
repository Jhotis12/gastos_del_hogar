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
  miembros** (quién debe a quién), **metas de ahorro**, **proyección de
  sobrantes**, **lista de deseos con cuotas/interés/corte de tarjeta** y
  **escaneo de facturas con IA** (Gemini) para crear gastos desde una foto.
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
├── .github/
│   ├── workflows/ci.yml     # PR: build + lint
│   ├── workflows/e2e.yml    # PR: Supabase local + suites e2e
│   ├── workflows/supabase-migrations.yml  # master: supabase db push
│   ├── CODEOWNERS           # revisión de @Jhotis12
│   └── pull_request_template.md
├── supabase/
│   ├── schema.sql           # Snapshot histórico: la fuente de verdad son las migraciones
│   ├── migrations/          # Migraciones aplicadas en orden (incl. hardening de seguridad)
│   └── functions/
│       └── analyze-receipt/index.ts   # Edge Function (Deno) → Gemini
├── src/
│   ├── main.tsx             # Providers: QueryClient + AuthProvider + ToastProvider
│   ├── App.tsx              # Rutas y guards (lazy imports desde modules/*)
│   ├── index.css            # Tailwind @theme: tokens, keyframes, .card
│   ├── shared/              # Capa transversal (sin lógica de dominio):
│   │   ├── components/      #   ui/* (base: Modal, MoneyInput, SelectInput, Toast…)
│   │   │                   #   layout/ (Layout: sidebar + header móvil)
│   │   ├── hooks/           #   useAuth, useTheme, useMonthParam, useCountUp,
│   │   │                   #   usePageTitle, useDragToClose, useDialogA11y,
│   │   │                   #   useInstallPrompt, useOffline, useRealtimeSync
│   │   │                   #   (useToast vive en components/ui/Toast.tsx)
│   │   └── lib/             #   supabase, types, money, dates, images, constants,
│   │                        #   utils, palettes, scrollLock, offline/*
│   └── modules/             # 1 módulo por dominio del producto (ver §6):
│       ├── auth/            #   Login+Registro, Recover, AuthConfirm, Setup,
│       │                   #   Terms y Privacy (rutas /terminos y /privacidad)
│       ├── dashboard/       #   Dashboard + components/ForecastWidget
│       ├── calendar/        #   Calendar
│       ├── history/         #   History
│       ├── members/         #   Members + hooks/useMembers(+useIncomes) + components/IncomeSection + lib/salaries
│       ├── expenses/        #   Expenses + hooks/useExpenses(+useReceipts) + components/ExpenseForm, Receipt*
│       ├── services/        #   Recurring + hooks/useRecurring + components/ServiceForm, ApplyRecurringModal
│       ├── savings/         #   Savings + hooks/useSavings + components/GoalForm, AdjustGoalModal
│       ├── categories/      #   Categories + hooks/useCategories + components/BudgetModal
│       ├── profile/         #   Profile + hooks/useHousehold, useSettings
│       ├── forecast/        #   Forecast + hooks/useForecast + lib/forecast (proyección)
│       └── wishlist/        #   Wishlist ("Quiero comprar") + hooks/useWishlist + components/WishlistItemForm + lib/installments
├── backups/                 # Dumps de BD (gitignored — datos sensibles)
├── openspec/                # Cambios spec-driven (proposal → specs → design → tasks)
│   ├── config.yaml          # contexto + reglas (rama + PR + CI) para los agentes
│   ├── changes/             # changes activos y archive/
│   └── specs/               # capacidades principales
├── tools/
│   ├── seed-local/          # .env + script + tutorial: datos de producción al local
│   └── db/                  # repair-history.sh + README (historial de migraciones)
├── tests/
│   ├── e2e-flow.mjs         # Suite e2e de 47 pasos (navegación SPA)
│   ├── e2e-mobile.mjs       # Suite e2e móvil: 9 pasos táctiles (drag-to-close, sheets)
│   ├── e2e-realtime.mjs     # Sincronización en tiempo real entre 2 miembros
│   ├── check-mobile.mjs     # Verificación móvil 375/320px: 11 rutas + modales sin overflow
│   ├── reset-sandbox.sh     # Reinicia el usuario sandbox (requiere SUPABASE_SERVICE_ROLE)
│   ├── screenshots.mjs      # Capturas de las páginas (dev)
│   └── fixtures/factura.jpg # Factura de prueba para el escaneo
└── .agents/skills/          # Skills de opencode del proyecto (incl. pull-request-workflow)
```

## 4. Modelo de datos (Supabase/Postgres)

```
households          id, name, invite_code (único), created_at
profiles            id (= auth.users.id), household_id → households, full_name,
                    avatar_path (foto en el bucket avatars),
                    payday (1-31, default 1)  → día de pago de la persona
salaries            household_id, profile_id, amount (>0), month (YYYY-MM-01),
                    pay_date (fecha real de la nómina de esa fila; default = día 1)
                    UNIQUE(profile_id, month)   → 1 salario por persona y mes
categories          household_id, name, color, icon
category_budgets    household_id, category_id, month, amount (>0)
                    UNIQUE(category_id, month)  → límite mensual por categoría
expenses            household_id, category_id, paid_by, recurring_id (servicio),
                    receipt_id (factura), amount, description, expense_date,
                    splits (uuid[], sin uso desde el frontend)
incomes             household_id, member_id (opcional), amount (>0), description,
                    income_date → dinero extra fuera de nómina (venta, regalo,
                    reembolso…); se suma al fondo común como ingreso
recurring_expenses  household_id, category_id, paid_by, amount, description,
                    frequency (monthly|bimonthly|quarterly|yearly),
                    next_due_date, is_active
savings_goals       household_id, name, target_amount (>0), saved_amount (>=0),
                    target_date (opcional)
wishlist_items      household_id, created_by, name, price (>0), priority
                    (necesidad|deseo|regalo), status (pendiente|comprado|descartado),
                    payment_method (contado|cuotas), installments_count (1-60),
                    interest_rate, cutoff_day, purchase_date, initial_payment
                    (>=0 y <= price), bought_at
receipts            household_id, storage_path, uploaded_by,
                    parsed_data (jsonb, not null default '{}'), created_at
invite_lookup_attempts  user_id (= auth.users.id), attempts, window_start
                    → rate limit (10 intentos/10 min) de get_household_by_code
```

- **Fondo común:** ingreso del mes = `SUM(salaries.amount)` + `SUM(incomes.amount)`
  del hogar (salarios efectivos: fila del mes o heredado); saldo = ingresos −
  gastos del mes. El dinero extra (`incomes`) es la única vía de ingreso que no
  es nómina: se registra desde la sección "Otros ingresos del mes" en Miembros
  (monto, descripción, fecha y, opcionalmente, quién recibió — si tiene dueño
  suma en su "Aportado" de los saldos del mes).
- **Salario efectivo del mes** (`src/modules/members/lib/salaries.ts`): toda
  fila cuyo `pay_date` (fecha REAL de llegada del dinero) cae dentro del mes —
  puede haber varias por persona si un pago atrasado de otro mes llegó aquí.
  Para personas sin fila en el mes se **hereda** el último salario registrado
  en un mes anterior (badge "Heredado de {mes}"), con `pay_date` calculada con
  `payDateForMonth(payday, month)`: el día de pago de la persona recortado
  al último día del mes (p. ej. día 31 en febrero → 28). `pay_date` es la
  **fuente de verdad** del dinero: al registrar un salario se puede editar
  la fecha real de llegada (nóminas atrasadas, cambios de día).
- **Saldo disponible (Dashboard):** RPC `get_running_balance(p_date)` = `SUM`
  salarios con `pay_date <= p_date` − `SUM` gastos con `expense_date <=
  p_date`. El frontend la llama con `min(hoy, fin de mes)` — **cash basis**:
  solo cuenta el dinero realmente recibido; una nómina con `pay_date` futuro
  (aún no pagada) NO infla el saldo. El hero muestra debajo "Por llegar:
  $X (nombre, fecha)" por cada salario con `pay_date > hoy` para explicar la
  diferencia con los ingresos del mes. (Nota: el sobrante acumulado de los
  meses cerrados coincide con el saldo; durante el mes actual difieren
  cuando hay nóminas aún no pagadas.)
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
- Resto (`categories`, `category_budgets`, `expenses`, `incomes`,
  `recurring_expenses`, `savings_goals`, `wishlist_items`, `receipts`):
  CRUD solo para miembros del hogar.
- Todas las políticas UPDATE replican su `USING` en el `WITH CHECK` (una fila
  no puede moverse a otro hogar al editarla).
- `invite_lookup_attempts` tiene RLS **sin políticas**: solo la usa
  `get_household_by_code` (security definer).
- Autorización basada en `auth.uid()` — nunca en `user_metadata`.

### Códigos de invitación
- Generados con `generate_invite_code()`: **10 hex mayúsculas (40 bits)**,
  derivadas de `gen_random_uuid()` (sin dependencia de pgcrypto). El código
  anterior (6 hex = 16.7M) era enumerable por fuerza bruta.
- `get_household_by_code` tiene **rate limit por usuario: 10 búsquedas cada
  10 minutos** (tabla `invite_lookup_attempts`, RLS sin políticas); al
  superarlo lanza excepción que la UI muestra tal cual.
- Al aplicar la migración de hardening se **regeneraron todos los códigos**
  existentes (los impresos/compartidos quedaron inválidos).

### RPCs (funciones security definer)
| RPC | Propósito |
|-----|-----------|
| `create_household(p_name)` | Crea hogar + código + perfil + 7 categorías por defecto, atómico. Evita `INSERT…RETURNING` (la RLS filtra antes de ser miembro → 403 PGRST106). |
| `get_household_by_code(p_code)` | Busca hogar por código (solo con sesión, con rate limit de 10 intentos/10 min por usuario). |
| `apply_recurring_expense(p_recurring_id, p_month)` | Aplica **un** servicio vencido a `expenses` (con guarda anti-duplicados por mes) y avanza su `next_due_date` según `frequency` (1/2/3/12 meses). Se llama por servicio desde el wizard de "Aplicar al mes". |
| `get_running_balance(p_date)` | Saldo acumulado del hogar a una fecha: Σ salarios (`pay_date <= p_date`) + Σ incomes (`income_date <= p_date`) − Σ gastos (`expense_date <= p_date`). Security definer con `auth.uid()`. |
| `get_monthly_surpluses()` | Sobrantes por mes desde el primer mes con actividad hasta el actual: `(month, income, expenses, surplus)` — ingreso del mes = salarios + dinero extra (agrupados por pay_date/income_date/expense_date). Suma acumulada = saldo disponible. |

Todas las funciones `security definer` fijan `search_path = public` y validan
`auth.uid()` / pertenencia al hogar server-side.

### Edge Function `analyze-receipt`
- Deno + `@supabase/supabase-js`. Valida JWT, pertenencia al hogar del path
  **y que el `path` viva dentro de la carpeta `{household_id}/`** del usuario
  (la descarga usa service_role, que ignora RLS).
- Descarga la imagen del bucket `receipts` → **Gemini Flash**
  (`gemini-flash-latest`; modelo `gemini-2.0-flash` tiene cuota 0 con la key
  actual) → JSON `{comercio, fecha, items[], total}`.
- CORS habilitado explícitamente (`Access-Control-Allow-Origin: *`).
- Los errores internos se registran en los logs de la función; al cliente
  solo llega un mensaje genérico.
- La `GEMINI_API_KEY` vive **solo en los secrets** del Edge Function.
- Deploy: `SUPABASE_ACCESS_TOKEN=<pat> supabase functions deploy analyze-receipt`.

### Storage
Bucket privado `receipts` (límite 8MB, solo jpeg/png/webp), rutas
`{household_id}/{uuid}.jpg` con políticas de subida/lectura por hogar.

### Headers de seguridad (vercel.json)
- **CSP** por hash del script inline del tema (`sha256-CXcr/…` verificado
  contra `dist/index.html`): `default-src 'self'`, `connect-src` solo a
  `*.supabase.co` (REST/storage/Edge Function + `wss://` de Realtime),
  `script-src 'self' + hash` (sin `unsafe-inline`), `style-src` con
  `unsafe-inline` (Tailwind runtime + acentos por atributo), `img-src` con
  `blob:`/`data:`/supabase, `frame-ancestors 'none'`, `object-src 'none'`.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, HSTS
  (`max-age=31536000; includeSubDomains; preload`),
  `Permissions-Policy: camera=(self)…` (la cámara solo para el escaneo de
  facturas) y `Cross-Origin-Opener/Resource-Policy: same-origin`.
- ⚠️ Si cambia el script inline de `index.html`, hay que recalcular el hash
  (`node -e` con `crypto.createHash('sha256')`) y actualizarlo en `vercel.json`.

### Autenticación
- `minimum_password_length = 8` (config.toml local; en producción se cambia
  desde el dashboard de Supabase → Auth) y validación ≥8 en el registro
  (Login.tsx).

### Pendientes conocidos (no reintroducir ni olvidar)
Hallazgos de la auditoría que producción tiene hoy y que **no** están
reproducidos en migraciones (un entorno recreado desde cero se comporta
distinto):

- El bucket `receipts` y sus políticas existen en producción creados a mano (y
  en el snapshot `supabase/schema.sql`), pero **ninguna migración los crea**:
  un `supabase db reset` local deja el bucket sin políticas.
- Los índices `expenses (receipt_id)`, `receipts (household_id)` y
  `wishlist_items (household_id)` no están en migraciones, y
  `receipts.parsed_data` es `not null default '{}'` solo en producción.
- La política INSERT de `households` es `with check (true)` sin restringir rol
  y en producción `anon` conserva los `GRANT ALL` que aplicó el dashboard
  (las migraciones solo otorgan `select` a `anon`).
- Unirse a un hogar escribe `profiles.household_id` con un UPDATE directo
  (la política solo exige `auth.uid() = id`), así que el código de invitación y
  su rate limit se pueden eludir conociendo el UUID del hogar.
- `analyze-receipt` no tiene rate limit por usuario.

---


## 6. Patrones de diseño (frontend)

### Módulos por dominio
Cada dominio vive en `src/modules/<dominio>/` con su página, hooks,
componentes y libs propios. Lo transversal (infraestructura, UI base,
librerías compartidas) vive en `src/shared/`. Los hooks de datos viven
en su módulo y el resto de módulos importa de ahí.

| Módulo | Hooks (en `modules/<dominio>/hooks/`) |
|--------|----------------------------------------|
| `auth` | — (login/recover/confirm/setup; sesión en `shared/hooks/useAuth`) |
| `members` | `useMembers` (miembros + salarios + perfil) · `useIncomes` |
| `expenses` | `useExpenses` (gastos + resumen + saldo + sobrantes) · `useReceipts` |
| `services` | `useRecurring` (servicios + aplicar + pendientes) |
| `savings` | `useSavings` (metas de ahorro) |
| `categories` | `useCategories` (categorías + presupuestos) |
| `profile` | `useHousehold` (crear/unirse/eliminar hogar) · `useSettings` |
| `forecast` | `useForecast` (proyección; lib `forecast.ts`) |
| `wishlist` | `useWishlist` (deseos + plan de cuotas; lib `installments.ts`) |
| `dashboard` · `calendar` · `history` | — (consumen hooks de los módulos de datos) |

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
  inferior con el resto del menú (`NAV_ITEMS` sin los 4 de la barra: Calendario,
  Historial, Proyección, Quiero comprar, Miembros y Salarios, Servicios,
  Categorías, Perfil y Hogar) más el instalador PWA, el toggle de tema y
  "Cerrar sesión". El sidebar de desktop permanece intacto (la barra inferior
  usa `role="navigation"`, no `<nav>`, para no colisionar con los selectores del
  test e2e).
- **Login/Registro**: split en desktop (panel de marca en gradiente pine con
  features) y móvil centrado; el **login es el apartado principal** y el
  registro se alcanza con un enlace ("Crea una aquí") que alterna la vista con
  animación (`animate-form-in`); validación por campo (nombre sin números,
  correo válido, contraseña ≥8) con `animate-shake` en inválidos; toggle de
  mostrar/ocultar contraseña, inputs y CTAs con `min-h-12` (44px+ de área
  táctil).
- **Formularios = bottom-sheets en móvil**: el `Modal` compartido se ancla
  abajo a ancho completo en móvil (con safe-area y `max-h-[92dvh]`) y queda
  centrado desde `sm:` — un solo punto de cambio para todos los forms.
- **FAB de gasto**: Dashboard y Gastos tienen un botón flotante 56px sobre la
  barra inferior (`lg:hidden`); en Gastos abre un action-sheet (Nuevo gasto /
  Escanear factura). Los CTAs del header quedan solo para desktop (`lg:`).
- **Historial responsive**: cards apiladas por mes en móvil (`md:hidden`), la
  tabla de 6 columnas solo desde `md:` — sin scroll horizontal a 375px.
- **Touch targets**: botones de icono en filas `p-2.5` mínimo (44px); CTAs
  `min-h-11/12`; toggle de servicios 28×48px; chips de filtro `py-2`.
- **Safe area**: `viewport-fit=cover` en el index (sin él, `env(safe-area-*)`
  resuelve a 0), header móvil con `pt-[calc(env(safe-area-inset-top)+…)]`,
  `pb-[env(safe-area-inset-bottom)]` en barra inferior, sheets y modales.
- **Inputs ≥16px**: regla global `input/select/textarea { font-size:
  max(1rem, inherit) }` + `touch-action: manipulation` (evita zoom de iOS).
- Regla de oro: **sin overflow horizontal a 375px** (verificado por
  `tests/check-mobile.mjs`, que recorre las 11 rutas a 375/320px y los
  modales/sheets).

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
  (`postgres_changes` en las tablas del hogar, incluida `wishlist_items`,
  filtrado por
  `household_id`) que invalida las queries de React Query correspondientes
  al recibir cualquier cambio. Si un miembro registra un gasto, salario o
  edita algo, **los demás lo ven al instante sin recargar** (la publicación
  `supabase_realtime` se habilita en las migraciones; `schema.sql` es solo un
  snapshot).
- Mapa tabla → claves invalidadas (ej. `expenses` y `salaries` invalidan
  también `running-balance` y `monthly-surpluses`; `wishlist_items` invalida
  `wishlist`; `profiles` además refresca el perfil propio).

### Lazy loading y caché
- **Code splitting por ruta** (`React.lazy` + `Suspense` en `App.tsx`): cada
  página se descarga solo al navegar a ella (verificado: chunks separados en
  `dist/assets/`).
- **Caché**: TanStack Query con `staleTime: 30s`, `gcTime: 30min` y
  `refetchOnWindowFocus`; los cambios remotos invalidan por dominio.

### Modo offline (PWA)
La app funciona sin conexión para **registrar** gastos, dinero extra y
salarios (crear/editar/eliminar) y para **ver los últimos datos** cargados.
Nada de esto requiere cambios en la BD: es todo frontend.

- **Caché de lecturas**: `persister` por query en `main.tsx`
  (`@tanstack/query-persist-client-core` + `idb`, `src/shared/lib/offline/persister.ts`):
  cada query exitosa se guarda en IndexedDB y se sirve en un arranque sin red
  (últimos datos conocidos). `networkMode: 'offlineFirst'` hace que sin red las
  queries sirvan la caché y **se pausen** (no marcan error); al reconectar
  reintentan solas.
- **Cola de escrituras** (`src/shared/lib/offline/queue.ts`): outbox FIFO en
  IndexedDB. Las mutaciones de gastos/incomes/salarios van envueltas en
  `runWithOfflineFallback` (`offlineSafe.ts`): si fallan por error de red,
  se encolan + **actualización optimista** de la caché (la fila aparece al
  instante; Ingresos/Gastos del mes se recalculan solos porque son client-side)
  + toast "Guardado sin conexión". El id de las filas nuevas se genera en el
  cliente (`crypto.randomUUID()`), así el replay no duplica y el realtime
  converge en sitio (mismo id).
- **Sincronización** (`src/shared/lib/offline/sync.ts`): al reconectar se drena la
  cola en orden FIFO y se notifica ("N cambios sincronizados"); el ícono de
  esquina (o un toque sobre él) dispara sync manual + heartbeat cada 15s si
  hay pendientes. Tras un sync exitoso se invalidan todas las queries para
  traer datos frescos. Replay **idempotente** (at-least-once): un insert con
  PK ya aplicada (23505) o un update/delete sin filas se descartan como ya
  sincronizados. Los salarios se rehacen con su upsert por profile+mes.
  Errores reales (RLS/validación) descartan el ítem con aviso.
- **Notificaciones**: sin toast al caer la red (el ícono es suficiente);
  "De vuelta en línea" y "N cambios sincronizados" sí se emiten desde
  `sync.ts` vía `emitToast` (emisor de módulo en `Toast.tsx`; el
  `ToastProvider` se suscribe).
- **Boot sin red** (`useAuth.tsx`): `getSession()` puede colgarse intentando
  refrescar el token → se limita a 2.5s y se cae a la sesión persistida en
  localStorage (`sb-*-auth-token`). El perfil es una query persistida
  (`['profile', userId]`): sin red se sirve el último perfil conocido y los
  guards no se quedan cargando. Primera vez sin red ni datos → pantalla
  `OfflineGate` en vez de skeleton infinito. Al volver en línea, `syncNow()`
  restaura la sesión en memoria antes de drenar.
- **Indicador** (`OfflineBanner.tsx`): ícono discreto (antena wifi roja) en
  la esquina inferior derecha cuando no hay conexión; badge con el conteo si
  hay cambios pendientes y spinner mientras sincroniza. Un toque dispara
  `syncNow()`. Sin red se omiten las invalidaciones de mutaciones
  (`invalidateIfOnline`) y el refetch por foco.
- **Silencio offline**: `supabase.ts` envuelve el fetch global: sin red
  rechaza al instante con `TypeError("Network request failed")` en vez de
  intentar (los intentos bloqueados aparecen como errores CORS en consola y
  disparan backoff de reintentos de postgrest/auth). `useRealtimeSync` se
  desconecta sin red (el socket encadena reconexiones fallidas) y se
  resuscribe al volver. En dev, todas las páginas lazy se pre-cargan al boot
  (no hay SW) para que navegar sin red no falle con "error loading
  dynamically imported module".
- **Alcance**: fotos de facturas (storage + Edge Function), metas,
  presupuestos, categorías, servicios y la lista de deseos («Quiero comprar»)
  siguen requiriendo red: sus acciones fallan con un aviso claro si no hay
  conexión, sin encolarse. Conflictos multi-dispositivo: último en escribir
  gana.
- **El shell ya estaba cubierto**: el SW precachea todos los estáticos y
  `navigateFallback` sirve la app sin internet; faltaba la capa de datos.

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

### Dinero extra (ingresos fuera de nómina)
Miembros → tarjeta "Otros ingresos del mes" → "+ Registrar dinero extra":
monto + descripción + fecha + (opcional) quién recibió. Cada fila crea un
`incomes` del hogar. El dinero extra entra automáticamente a: saldo disponible
(hero), "Ingresos del mes", sobrantes por mes, historial y "Ingreso unificado"
de Miembros (los RPCs suman `incomes` como ingreso). Si tiene dueño, suma en
su "Aportado" de los Saldos del mes. Editar/eliminar inline con ConfirmDialog;
el Realtime propaga el cambio a los demás miembros al instante.

### Servicios (gastos fijos)
Página Servicios: total fijo del mes, % vs ingreso, estado
**Pagado/Pendiente** por servicio (vía `expenses.recurring_id`). El botón
"Aplicar al mes" (también desde el Dashboard como "Aplicar recurrentes") abre
un **wizard modal por servicio**: muestra cada pendiente (vencido y sin gasto
del mes) con "Sí, lo pagué" (RPC `apply_recurring_expense` individual) o
"Saltar" (queda pendiente, no se descuenta ni avanza su fecha).

### Quiero comprar (wishlist)
`/quiero-comprar` registra deseos con precio, prioridad y forma de pago
(contado o cuotas). Para cuotas calcula la **amortización francesa**
(`modules/wishlist/lib/installments.ts`): cuota, interés total, primera cuota
según el **día de corte** de la tarjeta y abono inicial. El resumen muestra
saldo disponible, cuotas que vencen este mes (solo mientras el plan está
activo) y cuántos meses faltan ahorrando el sobrante de la proyección. Los
estados son `pendiente`, `comprado` y `descartado`; Realtime sincroniza la
lista entre miembros.

---

## 8. Comandos

| Comando | Uso |
|---------|-----|
| `pnpm dev` | Dev server (puerto 5173) |
| `pnpm build` | `tsc -b` + Vite build |
| `pnpm lint` | oxlint |
| `node tests/e2e-flow.mjs` | Suite e2e (requiere dev server arriba) |
| `node tests/check-mobile.mjs` | Verificación mobile 375/320px: 11 rutas + modales sin overflow |
| `node tests/e2e-mobile.mjs` | Suite e2e móvil (Chromium touch): sheets, arrastre, flick, acordeón |
| `SUPABASE_SERVICE_ROLE=… bash tests/reset-sandbox.sh` | Reinicia usuario sandbox (proyecto del `.env`) |
| `SUPABASE_URL=http://127.0.0.1:54331 SUPABASE_SERVICE_ROLE=<key local> bash tests/reset-sandbox.sh` | Reinicia el sandbox en el entorno LOCAL (`supabase start`) |
| `supabase migration up --local` | Aplica migraciones pendientes al stack local |
| `supabase db push --dry-run` | Lista las migraciones que se aplicarían a producción (no aplica) |
| `SUPABASE_ACCESS_TOKEN=… supabase db push` | Aplica las migraciones a producción (⚠️ la de hardening regenera los códigos de invitación) |
| `bash tools/db/repair-history.sh` | Pone al día el historial de migraciones aplicadas a mano (solo historial, no re-ejecuta SQL) |
| `SUPABASE_ACCESS_TOKEN=… supabase functions deploy analyze-receipt` | Deploy Edge Function |
| `SUPABASE_ACCESS_TOKEN=… supabase secrets set GEMINI_API_KEY=…` | Secret de Gemini |

> **Flujo de migraciones (canónico):** se crea
> `supabase/migrations/<timestamp>_nombre.sql`, se prueba en local
> (`supabase db reset` / `supabase migration up --local`), se corre
> build+lint+e2e, se hace commit y **push a `master`**; el workflow
> `.github/workflows/supabase-migrations.yml` aplica `supabase db push` contra
> producción (necesita el secret `SUPABASE_ACCESS_TOKEN`; `SUPABASE_DB_PASSWORD`
> es opcional, sin él la CLI crea un rol temporal, y opcionalmente la variable
> `SUPABASE_PROJECT_REF`). **Nunca** se pega SQL a mano en el dashboard de
> Supabase; si por una urgencia pasa, el historial queda desincronizado y se
> repara con `bash tools/db/repair-history.sh -y <version>` (solo escribe el
> historial; no vuelve a ejecutar el SQL). Detalle: `tools/db/README.md`.

> **Cambios con OpenSpec:** las funcionalidades se planifican en
> `openspec/changes/<change>/` (proposal → specs → design → tasks) con el
> schema `spec-driven`. `openspec/config.yaml` inyecta el flujo de este repo
> (rama + PR + CI + merge de Jhotis12) en los artefactos y en las guías de
> apply/archive; el archive va en una PR aparte después del merge. Comandos:
> `openspec list`, `openspec status --change <change>` y
> `openspec validate <change>`.

> **Entorno local (Supabase CLI + Docker o Podman rootless):** `supabase start`
> levanta la pila en `127.0.0.1:54331` (API), `54332` (Postgres), `54333`
> (Studio) y `54334` (Mailpit). Los puertos difieren de los por defecto porque
> el proyecto usa una serie propia (54330-54339) para no chocar con otros
> proyectos locales. `.env.local` (gitignored por `*.local`) apunta el dev
> server al local; Vercel usa sus variables del dashboard, por lo que el
> deploy de producción nunca ve el `.env.local`. La anon key del local es un
> JWT firmado con el secret por defecto de `config.toml` (sin `jwt_secret`
> definido, la service role local se deriva del mismo secret: rol
> `service_role`, mismos `iat`/`exp`).
>
> Si no tienes permisos sobre el socket de Docker, el stack también funciona
> con **Podman rootless**:
>
> ```bash
> systemctl --user enable --now podman.socket
> export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock
> supabase start
> ```
>
> El entorno local se siembra con un backup de producción con
> `bash tools/seed-local/seed-local.sh -y` (lee credenciales de
> `tools/seed-local/.env`, gitignored; ver el tutorial
> `tools/seed-local/README.md`). El dump se guarda en `backups/` (gitignored)
> y las imágenes de Storage no vienen incluidas.
>
> **E2e contra local (local == desplegado):** con `.env.local` presente y el
> dev server reiniciado, `node tests/e2e-flow.mjs` corre los 47 pasos contra
> el stack local (`supabase migration up --local` aplica las migraciones
> pendientes; `reset-sandbox.sh` acepta `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE`
> como overrides). La Edge Function `analyze-receipt` no se sirve local sin
> `supabase functions serve`: el paso de facturas detecta el backend local y
> verifica el flujo de error (la subida y el análisis reales se cubren en el
> e2e contra producción).

> ⚠️ **Trampa operativa:** tras ediciones masivas de archivos, el watcher de
> Vite puede servir transformaciones obsoletas. Si el dev server se comporta
> raro: reiniciarlo con `rm -rf node_modules/.vite`.

---

## 9. Testing

- Suite e2e de 47 pasos (`tests/e2e-flow.mjs`): login, hogar, salarios
  (día de pago + herencia al mes siguiente), gastos, calendario, saldos,
  saldo acumulado, sobrantes por mes (tarjeta Dashboard + `/historial`),
  recarga de página con salarios visibles, presupuestos, servicios, metas,
  escaneo de facturas (con fixture + Gemini real), modo offline, modo oscuro,
  lista de deseos (contado/cuotas/estados) y perfil.
- Usa **navegación SPA** (clics en el sidebar, no `page.goto` a rutas
  protegidas), esperas por selector y `data-testid="confirm-dialog-confirm"`
  para los diálogos.
- El usuario sandbox se crea/elimina con `reset-sandbox.sh` (la eliminación
  limpia su hogar y datos en cascada).
- **CI en cada PR a `master`**: `.github/workflows/ci.yml` (build + lint) y
  `.github/workflows/e2e.yml` (Supabase local + `e2e-flow`, `e2e-mobile`,
  `check-mobile` y `e2e-realtime`). No se mergea con checks en rojo; la PR la
  aprueba y mergea Jhotis12. Flujo completo:
  `.agents/skills/pull-request-workflow/SKILL.md`.
- **Al mergear a `master`** con migraciones nuevas,
  `.github/workflows/supabase-migrations.yml` aplica `supabase db push` a
  producción (ver §8, Flujo de migraciones).
- Antes de cerrar una fase: `pnpm build` + `pnpm lint` + suite e2e completa en
  local, y PR con CI en verde.

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
8. **Salarios que "aparecen después de un rato" al recargar la página** —
   `useSalaries` era una query cuyo `queryFn` leía otras dos queries
   (`useAllSalaries` + `useMembers`); al cargar se cacheaba `[]` antes de que
   llegaran y nada la volvía a ejecutar → ahora es una **derivación en
   memoria** (`useMemo` sobre las dos fuentes), con estado `isPending` propio
   para no mostrar "Aún no hay salarios" mientras carga.
9. **"Saldo disponible" no coincidía con lo esperado (dos versiones opuestas)**
   — v1 calculaba "hasta hoy": un salario con `pay_date` futuro (día de pago
   24 registrado el 1) no contaba y el saldo parecía menor a lo esperado. v2
   pasó a fin de mes, pero entonces la nómina no pagada (o atrasada de un mes
   anterior) **inflaba** el saldo con dinero que no había llegado. Solución
   definitiva: **cash basis** — `useRunningBalance` usa `min(hoy, fin de
   mes)` (solo dinero realmente recibido), el `pay_date` se vuelve **editable**
   al registrar el salario (fecha real de llegada, para nóminas atrasadas) y
   el hero muestra "Por llegar: $X (nombre, fecha)" por cada salario con
   `pay_date > hoy`. Los sobrantes/historial ya agrupaban por `pay_date`; la
   tarjeta "Salarios del mes" se alineó a esa misma base.
10. **Auditoría de seguridad (migración `20260806120000_hardening_security`)**
    — hallazgos corregidos y no reintroducir:
    - **Códigos de invitación de 6 hex (16.7M)** eran enumerables por fuerza
      bruta desde `get_household_by_code` (cualquiera con cuenta) → ahora
      `generate_invite_code()`: 10 hex mayúsculas (40 bits) sin pgcrypto.
    - **Unirse sin límites** → rate limit por usuario (10 intentos/10 min,
      tabla `invite_lookup_attempts` con RLS sin políticas); superado →
      excepción que la UI muestra.
    - **UPDATEs sin `WITH CHECK`** permitían mover filas a otro hogar y
      reasignar `salaries.profile_id` → todas las políticas UPDATE replican
      su `USING` en el `WITH CHECK`.
    - **Edge Function descargaba cualquier path del bucket** (service_role
      ignora RLS) → valida que `path` empiece por `{household_id}/` + formato
      UUID; errores internos solo a logs (mensaje genérico al cliente).
    - **Bucket `receipts` sin límites** → 8MB y solo jpeg/png/webp.
    - **Sin headers de seguridad en Vercel** → CSP con hash, HSTS,
      frame-ancestors 'none', etc. (ver §5).
    - **Contraseñas ≥6** → ≥8 (config.toml + validación frontend).
    - React Router 7.18.2 con advisory HIGH (GHSA-qwww-vcr4-c8h2, CSRF en
      modo RSC): **sin parche publicado** (exige 8.3.0) pero no explotable
      aquí (router declarativo, sin RSC/actions) — vigilar `pnpm audit`.
11. **Login apareciendo al guardar un gasto sin red (PWA)** — `useAuth.tsx`
    aceptaba eventos de auth con sesión nula como cierre de sesión:
    - `INITIAL_SESSION` llega con `null` cuando el token expiró y el
      refresh falla sin red, y se emitía DESPUÉS del respaldo
      `readStoredSession()` de `bootSession`, sobrescribiéndolo → login.
    - `SIGNED_OUT` llega cuando auth-js clasifica el fallo de refresh como
      no-reintentable (WiFi "conectado" sin internet, portal cautivo, proxy
      que responde no-JSON/4xx): `_removeSession()` borra localStorage y
      notifica `SIGNED_OUT`; ocurría justo al guardar un gasto (el insert
      dispara `getSession()` → refresh) → login.
    - Fix: el handler de `onAuthStateChange` nunca cierra sesión por un
      evento nulo si existe una sesión conocida (ref `sessionRef` o
      localStorage): sin red restaura y **re-persiste** la sesión en
      localStorage (auth-js pudo borrarla) para que al reconectar el
      refresh la renueve y la cola drene; con red confirma con `getUser()`
      y solo cierra si el servidor rechaza explícitamente. `signOut()`
      explícito marca un flag para no "resucitar" un cierre real.
12. **`supabase db reset` roto en bases limpias** — la migración de datos
    `20260902010806_fix_missing_july_salaries_spotify.sql` insertaba
    hogar/perfiles/categoría con IDs de producción y violaba FKs en un
    entorno local vacío. Ahora cada INSERT valida que las filas padre existan
    (`WHERE EXISTS`): es un no-op fuera de producción.
13. **Duplicados offline con respuesta perdida** — en los `add` de gastos e
    ingresos el UUID se generaba dentro del intento online y el fallback
    generaba otro distinto; si el servidor alcanzaba a guardar pero se perdía
    la respuesta, el replay insertaba una fila duplicada. Ahora el id se
    genera una vez y se comparte entre el intento online y la cola.
14. **Wishlist: botón fantasma, cuotas infinitas y Realtime ausente** — el
    botón “Volver a pendiente” se pintaba siempre (condición imposible),
    `monthlyDue` no se acotaba al número de cuotas (una compra antigua seguía
    sumando al compromiso mensual) y `wishlist_items` no estaba en la
    publicación `supabase_realtime`. Corregidos en
    `installments.ts`, `Wishlist.tsx`, `useRealtimeSync.ts` y la migración
    `20261018120000_wishlist_realtime_hardening.sql`.
