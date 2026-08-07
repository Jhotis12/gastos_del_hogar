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
│   │   ├── hooks/           #   useAuth, useTheme, useToast, useMonthParam, useCountUp,
│   │   │                   #   usePageTitle, useDragToClose, useInstallPrompt,
│   │   │                   #   useOffline, useRealtimeSync
│   │   └── lib/             #   supabase, types, money, dates, images, constants,
│   │                        #   utils, palettes, scrollLock, offline/*
│   └── modules/             # 1 módulo por dominio del producto (ver §6):
│       ├── auth/            #   Login+Registro, Recover, AuthConfirm, Setup
│       ├── dashboard/       #   Dashboard + components/ForecastWidget
│       ├── calendar/        #   Calendar
│       ├── history/         #   History
│       ├── members/         #   Members + hooks/useMembers(+useIncomes) + components/IncomeSection + lib/salaries
│       ├── expenses/        #   Expenses + hooks/useExpenses(+useReceipts) + components/ExpenseForm, Receipt*
│       ├── services/        #   Recurring + hooks/useRecurring + components/ServiceForm, ApplyRecurringModal
│       ├── savings/         #   Savings + hooks/useSavings + components/GoalForm, AdjustGoalModal
│       ├── categories/      #   Categories + hooks/useCategories + components/BudgetModal
│       ├── profile/         #   Profile + hooks/useHousehold, useSettings
│       └── forecast/        #   Forecast + hooks/useForecast + lib/forecast (proyección)
├── backups/                 # Dumps de BD (gitignored — datos sensibles)
├── tests/
│   ├── e2e-flow.mjs         # Suite e2e de 43 pasos (navegación SPA)
│   ├── e2e-mobile.mjs       # Suite e2e móvil: 9 pasos táctiles (drag-to-close, sheets)
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
incomes             household_id, member_id (opcional), amount (>0), description,
                    income_date → dinero extra fuera de nómina (venta, regalo,
                    reembolso…); se suma al fondo común como ingreso
recurring_expenses  household_id, category_id, paid_by, amount, description,
                    frequency (monthly|bimonthly|quarterly|yearly),
                    next_due_date, is_active
savings_goals       household_id, name, target_amount (>0), saved_amount (>=0),
                    target_date (opcional)
receipts            household_id, storage_path, uploaded_by, parsed_data (jsonb)
invite_lookup_attempts  user_id (= auth.users.id), attempts, window_start
                    → rate limit (10 intentos/10 min) de get_household_by_code
```

- **Fondo común:** ingreso del mes = `SUM(salaries.amount)` + `SUM(incomes.amount)`
  del hogar (salarios efectivos: fila del mes o heredado); saldo = ingresos −
  gastos del mes. El dinero extra (`incomes`) es la única vía de ingreso que no
  es nómina: se registra desde la sección "Otros ingresos del mes" en Miembros
  (monto, descripción, fecha y, opcionalmente, quién recibió — si tiene dueño
  suma en su "Aportado" de los saldos del mes).
- **Salario efectivo del mes** (`src/lib/salaries.ts`): toda fila cuyo
  `pay_date` (fecha REAL de llegada del dinero) cae dentro del mes — puede
  haber varias por persona si un pago atrasado de otro mes llegó aquí. Para
  personas sin fila en el mes se **hereda** el último salario registrado en
  un mes anterior (badge "Heredado de {mes}"), con `pay_date` calculada con
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
- Resto: CRUD solo para miembros del hogar.
- Autorización basada en `auth.uid()` — nunca en `user_metadata`.
- **Todas las políticas UPDATE llevan `WITH CHECK`** que replica el `USING`
  (migración `20260806120000_hardening_security`): un miembro no puede mover
  filas a otro hogar ni reasignar ownership (`salaries.profile_id`).

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

---

## 6. Patrones de diseño (frontend)

### Hooks por dominio
