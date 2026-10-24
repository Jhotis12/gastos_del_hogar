# docs/guia-canonica Specification

## Purpose
Mantiene la guía canónica del proyecto (`ARQUITECTURA.md`, `AGENTS.md` y los
comentarios de los workflows) describiendo el código que existe hoy, para que
un agente o una persona pueda seguirla sin "corregir" código que ya es correcto.

## Requirements

### Requirement: ARQUITECTURA.md documenta datos y seguridad vigentes

`ARQUITECTURA.md` SHALL contener una sección de modelo de datos (tablas,
columnas y restricciones actuales, incluidas `wishlist_items`, `incomes`,
`pay_date` y `invite_lookup_attempts`) y una sección de seguridad (RLS por
tabla, RPCs `security definer`, bucket `receipts`, headers de `vercel.json`), y
toda referencia interna ("ver §N") SHALL apuntar a una sección que exista.

#### Scenario: Secciones presentes y numeradas

- **WHEN** se leen los encabezados de `ARQUITECTURA.md`
- **THEN** existen las secciones 4 (modelo de datos) y 5 (seguridad), y ninguna referencia del texto apunta a una sección inexistente

#### Scenario: Modelo de datos al día

- **WHEN** se compara la sección de modelo de datos con `supabase/migrations/`
- **THEN** aparecen todas las tablas y columnas que el código usa (por ejemplo `wishlist_items.household_id`, `salaries.pay_date`, `categories.budget`) y ninguna que ya no exista

### Requirement: La guía ubica cada pieza donde está

La documentación SHALL nombrar cada archivo, hook, ruta y componente en la
ubicación real del repositorio.

#### Scenario: Hook de toasts

- **WHEN** la guía lista los hooks transversales
- **THEN** no ubica `useToast` en `shared/hooks/` (vive en `shared/components/ui/Toast.tsx`)

#### Scenario: Contenido del sheet "Más"

- **WHEN** la guía describe la navegación inferior móvil
- **THEN** el sheet "Más" queda descrito con el menú completo que renderiza (los ítems de `NAV_ITEMS` más ajustes y "Cerrar sesión"), no solo 4 ítems

#### Scenario: Páginas legales

- **WHEN** la guía lista el módulo `auth`
- **THEN** incluye `Terms.tsx` y `Privacy.tsx` (rutas `/terminos` y `/privacidad`)

### Requirement: AGENTS.md lista las skills instaladas

`AGENTS.md` SHALL enumerar todas las skills presentes en `.agents/skills/`
(incluidas `mobile-app-ui-design`, `pwa-development` y
`supabase-postgres-best-practices`), sin nombrar skills inexistentes.

#### Scenario: Comparación con el disco

- **WHEN** se comparan los directorios de `.agents/skills/` con la lista de `AGENTS.md`
- **THEN** ambas listas coinciden

### Requirement: Los comentarios de CI describen la protección real

Los comentarios de `.github/workflows/` SHALL describir el estado real de la
protección de ramas y de los disparadores (PR y push a `master`), sin afirmar
que `master` está protegida en GitHub.

#### Scenario: Comentario de ci.yml

- **WHEN** se lee el encabezado de `ci.yml`
- **THEN** no afirma que la rama `master` esté protegida y explica que los checks se cumplen por convención + CI
