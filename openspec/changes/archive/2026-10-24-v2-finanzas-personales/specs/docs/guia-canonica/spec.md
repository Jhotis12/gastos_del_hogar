# Spec Delta

## MODIFIED Requirements

### Requirement: ARQUITECTURA.md documenta datos y seguridad vigentes

`ARQUITECTURA.md` SHALL documentar el modelo de datos vigente (incluidas las
tablas y columnas de la v2.0: `savings_movements`, `savings_plans`,
`savings_goals.owner_id`, `savings_goals.archived_at`, `expenses.paid_by`,
`salaries.pay_date` e `incomes.member_id`) y la seguridad (RLS por tabla, RPCs
`security definer`, bucket `receipts`, Edge Functions, headers de
`vercel.json`), y toda referencia interna (“ver §N”) SHALL apuntar a una sección
que exista.

#### Scenario: Secciones presentes y numeradas

- **WHEN** se leen los encabezados de `ARQUITECTURA.md`
- **THEN** existen las secciones 4 (modelo de datos) y 5 (seguridad), y ninguna referencia del texto apunta a una sección inexistente

#### Scenario: Modelo de datos al día

- **WHEN** se compara la sección de modelo de datos con `supabase/migrations/`
- **THEN** aparecen todas las tablas y columnas que el código usa (por ejemplo `savings_movements`, `savings_plans`, `savings_goals.owner_id`, `salaries.pay_date` y `incomes.member_id`) y ninguna que ya no exista

#### Scenario: Ahorro y ledger personal documentados

- **WHEN** se lee la sección de modelo de datos
- **THEN** se explica que `savings_movements` es la fuente de verdad del ahorro, que `saved_amount` es una caché y que los gastos con `paid_by` nulo son legado visible en `Sin asignar`

## ADDED Requirements

### Requirement: README y versión 2.0

`README.md` SHALL describir el enfoque personal de la v2.0, la sección del
hogar, el pagador obligatorio, el ahorro por movimientos, la migración sin
pérdida y la captura por voz con su bandera. `package.json` SHALL declarar la
versión `2.0.0`.

#### Scenario: Versión

- **WHEN** se lee `package.json`
- **THEN** la versión es `2.0.0`

#### Scenario: README actualizado

- **WHEN** se lee el README
- **THEN** explica que el foco es el gasto personal, cómo se ve el hogar y cómo funciona el ahorro

#### Scenario: Migración sin pérdida

- **WHEN** se lee la sección de migración del README
- **THEN** explica que la migración es aditiva, cómo se prueban los datos y que producción solo se actualiza por el workflow

### Requirement: Diagrama de la v2.0

La raíz del repositorio SHALL incluir
`DIAGRAMA-REFACTOR-DINERO.html`, un diagrama autocontenido (HTML + SVG) que
explique los datos que se conservan, la capa nueva y las vistas personales y
del hogar. La skill `diagram-design` SHALL estar instalada y registrada en
`AGENTS.md` si se usa para generar el diagrama.

#### Scenario: Archivo presente

- **WHEN** se busca `DIAGRAMA-REFACTOR-DINERO.html` en la raíz
- **THEN** el archivo existe y abre en un navegador sin dependencias externas distintas de las fuentes

#### Scenario: Contenido coherente

- **WHEN** se compara el diagrama con `proposal.md`
- **THEN** muestra los datos existentes, la capa nueva y las vistas personales/hogar sin contradecir el alcance

#### Scenario: Skill registrada

- **WHEN** se compara `.agents/skills/` con la lista de `AGENTS.md`
- **THEN** `diagram-design` aparece en la lista si está instalada

### Requirement: Sin documentación obsoleta

La documentación SHALL NOT describir opciones o pantallas eliminadas en la
v2.0, como `Sin asignar` en gastos nuevos, la edición directa del ahorro, el
`Ingreso unificado` o el lenguaje de `fondo común` y `A favor / Debe`, salvo
cuando explique el legado o la migración.

#### Scenario: Búsqueda de términos retirados

- **WHEN** se buscan los términos retirados en `ARQUITECTURA.md` y `README.md`
- **THEN** solo aparecen en contexto de legado o migración, nunca como una opción vigente

#### Scenario: Referencias a rutas

- **WHEN** la guía nombra una ruta o pantalla
- **THEN** la ruta existe en `src/App.tsx` y la descripción coincide con la UI de la v2.0

### Requirement: Documentación de la captura por voz

La documentación SHALL explicar que la captura por voz es una función con
bandera, que requiere red, que el audio se procesa con IA, que no se almacena
de forma permanente y que el gasto se crea solo después de la confirmación.

#### Scenario: Privacidad

- **WHEN** se lee la sección de la captura por voz
- **THEN** explica el consentimiento, el límite de uso y el descarte del audio

#### Scenario: Operación

- **WHEN** se lee la sección de la captura por voz
- **THEN** explica cómo activar la bandera, qué hacer si falla la IA y cómo se prueba con el fixture
