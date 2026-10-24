# Spec Delta

## Purpose

Define las condiciones mínimas de accesibilidad y de consistencia visual que
deben cumplir todas las pantallas y componentes compartidos: campos con
etiqueta asociada, contrastes legibles, acciones táctiles de 44px, overlays que
se comportan como modales y una sola definición del estilo de los campos.

## ADDED Requirements

### Requirement: Campos con etiqueta asociada

Todo campo de formulario SHALL tener una etiqueta asociada de forma efectiva:
`<label htmlFor>` apuntando a un `id` existente, el campo envuelto en su
`label`, o `aria-label`/`aria-labelledby` cuando la etiqueta visual no exista.
Un `htmlFor` que apunte a un `id` inexistente SHALL considerarse sin etiqueta.

#### Scenario: Registro de nombre en Login

- **WHEN** el usuario abre la vista de registro
- **THEN** el campo "Nombre" tiene `id` y el `<label htmlFor>` apunta a ese `id`; lo mismo en el resto de campos del formulario

#### Scenario: Monto en formularios de gasto

- **WHEN** se renderiza `MoneyInput` (gasto, ingreso, meta, servicio, deseo)
- **THEN** el campo expone una etiqueta accesible (prop `ariaLabel`/`id` asociado) y no queda como único campo sin nombre

### Requirement: Contraste AA en los textos de los casos señalados

Los textos que la auditoría marcó por debajo de 4.5:1 SHALL alcanzar ese mínimo
sobre su fondo en ambos temas, sin cambiar la escala de grises del resto de la
app: el título y la pista de `EmptyState`, el texto de `CategoryBadge` (que usa
el color de la categoría, dato del usuario) y la etiqueta "Sin salario" de
Miembros. Mejorar el resto del texto secundario (`text-ink/25..60`) es un
rediseño de la escala de grises y queda como cambio aparte.

#### Scenario: Estado vacío en tema claro

- **WHEN** se renderiza `EmptyState` en tema claro
- **THEN** el título y la pista alcanzan 4.5:1 sobre el fondo de la tarjeta

#### Scenario: Badge de categoría

- **WHEN** se pinta un `CategoryBadge` con un color de la paleta (`#f59e0b`, `#10b981`, …)
- **THEN** el texto usa un token con contraste AA sobre el tinte, no el hex de la categoría

#### Scenario: "Sin salario" en tema oscuro

- **WHEN** la fila de Miembros muestra "Sin salario" con el tema oscuro activo
- **THEN** el texto alcanza 4.5:1 sobre la superficie

### Requirement: Acciones táctiles de al menos 44px

Todo elemento interactivo (botón, chip, celda con acción) SHALL ofrecer un área
táctil de al menos 44×44px en móvil, sin depender de `hover`.

#### Scenario: Chips de filtro y botones de fila

- **WHEN** se recorren las listas con chips de filtro (Gastos) y las filas con acción (Miembros, Ahorros, Quiero comprar, Categorías)
- **THEN** cada acción mide ≥44px de alto y `check-mobile.mjs` termina sin desbordes

### Requirement: Overlays propios con comportamiento de modal

Los overlays que no usan el `Modal` compartido SHALL comportarse como un
diálogo accesible: `role="dialog"`, `aria-modal`, cierre con `Escape`, foco al
abrir y restauración del foco al cerrar.

#### Scenario: Action sheet de Gastos

- **WHEN** el usuario abre el action sheet del FAB de Gastos
- **THEN** el overlay declara `role="dialog"` y `aria-modal`, se cierra con `Escape` y devuelve el foco al botón que lo abrió

#### Scenario: Sheet "Más" de la barra inferior

- **WHEN** el usuario abre el sheet "Más"
- **THEN** además de cerrar con `Escape`, declara `role="dialog"` y mueve el foco dentro al abrir

### Requirement: Acción principal de gasto en móvil

El Dashboard SHALL ofrecer en móvil la acción de registrar gasto en la zona del
pulgar, igual que la página de Gastos, tal como documenta `ARQUITECTURA.md`
(FAB 56px sobre la barra inferior).

#### Scenario: Dashboard en móvil

- **WHEN** se abre el Dashboard a 375px de ancho
- **THEN** hay un FAB visible que abre `ExpenseForm` y `check-mobile.mjs` no reporta desbordes

### Requirement: Una sola definición del estilo de campos

Los campos de texto SHALL usar una definición compartida del estilo base
(ancho, radio, borde, padding, tamaño de 16px y anillo de foco) declarada en
`src/shared/`, en lugar de cadenas de clases duplicadas por módulo.

#### Scenario: Formularios de todos los módulos

- **WHEN** se comparan los campos de texto de gasto, ingreso, meta, servicio, deseo, perfil, setup y wizard
- **THEN** todos usan la misma definición compartida (misma altura, radio, padding y foco) y no queda una copia local de `inputClass`
