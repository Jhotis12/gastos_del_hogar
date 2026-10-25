# Spec Delta

## Purpose

Organiza la app alrededor del gasto personal y el ahorro, con una sección de
hogar clara, sin opciones duplicadas ni lenguaje ambiguo.

## ADDED Requirements

### Requirement: Inicio con foco personal

La pantalla de entrada SHALL priorizar los gastos y ahorros personales. SHALL
mostrar como mínimo el gasto del mes en curso, el gasto desde el último pago, el
ahorro personal y el disponible personal desde el último pago. SHALL mostrar
también el disponible del hogar como suma de los disponibles personales, sin
incluir el ahorro. El monto del salario SHALL NOT ser la cifra principal ni el
titular de la pantalla.

#### Scenario: Primer vistazo

- **WHEN** el usuario entra a la app
- **THEN** ve sus gastos y su ahorro antes que cualquier resumen del hogar o de ingresos

#### Scenario: Sin ingresos registrados

- **WHEN** el usuario no tiene ingresos registrados
- **THEN** Inicio sigue mostrando sus gastos y ahorro sin un saldo inventado

#### Scenario: Acceso al hogar

- **WHEN** el usuario quiere ver el gasto conjunto
- **THEN** encuentra un acceso visible a `Hogar` sin perder el foco personal

### Requirement: Navegación consolidada

La navegación SHALL mantener los accesos actuales sin agregar ítems nuevos.
Las tarjetas y pantallas duplicadas SHALL consolidarse en un único lugar:
`Sobrantes por mes` en Historial, `Salarios del mes` en Miembros/Ingresos y la
proyección en su propia pantalla. La barra inferior móvil SHALL conservar
cuatro accesos principales y el sheet `Más`.

#### Scenario: Menú sin ítems nuevos

- **WHEN** se compara la navegación de la v2.0 con la de la v1.x
- **THEN** no hay una ruta nueva agregada solo para este cambio

#### Scenario: Sin duplicados en Inicio

- **WHEN** el usuario revisa Inicio
- **THEN** no encuentra la tarjeta de sobrantes, la lista de salarios ni el widget de proyección duplicados

#### Scenario: Barra móvil

- **WHEN** la app se abre a 375px
- **THEN** la barra inferior conserva cuatro accesos y el botón `Más` con el resto del menú

### Requirement: Eliminación de opciones confusas

La UI SHALL eliminar la opción `Sin asignar` de los gastos nuevos, la edición
directa del ahorrado, el lenguaje de `fondo común` y `A favor / Debe`, y el
término `Ingreso unificado`. Los gastos legados sin pagador SHALL seguir
visibles en una bolsa histórica, no como una opción de creación.

#### Scenario: Formulario de gasto

- **WHEN** el usuario abre el formulario de un gasto nuevo
- **THEN** el pagador es obligatorio y no existe la opción `Sin asignar`

#### Scenario: Ahorro

- **WHEN** el usuario abre una meta de ahorro
- **THEN** no encuentra un campo editable de “ahorrado” ni un botón que cambie el saldo sin registrar un movimiento

#### Scenario: Lenguaje

- **WHEN** el usuario recorre Inicio, Gastos, Miembros y Ahorros
- **THEN** no aparecen `fondo común`, `A favor`, `Debe` ni `Ingreso unificado` como etiquetas de la interfaz

### Requirement: Terminología consistente

La interfaz SHALL usar los mismos términos en todas las pantallas:
`Mi mes`, `Gastos desde mi último pago`, `Disponible desde mi último pago`,
`Disponible del hogar`, `Hogar`, `Ahorro` y `Libre después del ahorro`. Las
fechas de las ventanas SHALL mostrarse en español de Colombia.

#### Scenario: Misma ventana, mismo nombre

- **WHEN** el usuario ve la ventana de gasto desde su pago en Inicio, Gastos e Historial
- **THEN** todas usan el mismo nombre y el mismo rango de fechas

#### Scenario: Libre después del ahorro

- **WHEN** la app muestra el dinero que queda del mes
- **THEN** la etiqueta aclara que ya se descontó el ahorro y no se confunde con el gasto

### Requirement: Estados vacíos, de carga y de error

Cada vista nueva o modificada SHALL tener estados explícitos de carga, vacío y
error. Un fallo de datos SHALL mostrar `QueryError` con reintento, no una
sección vacía ni un skeleton infinito. Un estado vacío SHALL ofrecer la acción
siguiente.

#### Scenario: Sin gastos personales

- **WHEN** el usuario no tiene gastos en la ventana
- **THEN** ve un estado vacío con un botón para registrar un gasto

#### Scenario: Error de resumen

- **WHEN** falla el RPC del resumen personal o del hogar
- **THEN** la sección muestra el error y un botón de reintento, y el resto de la página sigue usable

#### Scenario: Carga inicial

- **WHEN** la app carga por primera vez
- **THEN** muestra un skeleton coherente y no un saldo en cero antes de tener datos

### Requirement: Mobile, accesibilidad y modo oscuro

Las pantallas modificadas SHALL funcionar a 375px y 320px sin overflow
horizontal, SHALL usar objetivos táctiles de al menos 44px y SHALL mantener
etiquetas accesibles, foco visible y navegación por teclado. El modo oscuro
SHALL conservar contraste y jerarquía.

#### Scenario: 375px

- **WHEN** se recorre Inicio, Gastos, Ahorros e Historial a 375px
- **THEN** no hay scroll horizontal ni contenido cortado

#### Scenario: 320px

- **WHEN** se recorren las mismas rutas a 320px
- **THEN** las tarjetas y tabs se apilan sin desbordar

#### Scenario: Teclado y foco

- **WHEN** el usuario navega el formulario de gasto y el de ahorro con teclado
- **THEN** el foco es visible, el orden es lógico y los diálogos se pueden cerrar con Escape

#### Scenario: Modo oscuro

- **WHEN** el usuario activa el modo oscuro
- **THEN** las nuevas tarjetas, tabs y métricas mantienen contraste y no usan superficies blancas fijas

### Requirement: Cada pantalla conectada al mismo ledger

Las pantallas existentes SHALL consumir el mismo modelo de gasto personal y
hogar: Calendario SHALL permitir filtrar `Todos / Mis gastos` y mostrar el
pagador; Servicios SHALL mostrar y exigir el pagador; Categorías SHALL mostrar
el gasto del hogar y el desglose por persona; Historial SHALL tener `Hogar` y
`Mis meses`; Proyección y Quiero comprar SHALL usar el dinero personal.

#### Scenario: Calendario

- **WHEN** el usuario activa `Mis gastos` en el calendario
- **THEN** solo ve sus gastos y el total del día y del mes se ajusta al filtro

#### Scenario: Servicios

- **WHEN** el usuario crea o aplica un servicio
- **THEN** el gasto resultante tiene pagador y aparece en los totales de esa persona

#### Scenario: Categorías

- **WHEN** el usuario abre una categoría
- **THEN** ve el gasto del hogar y puede distinguir cuánto puso cada persona

#### Scenario: Historial

- **WHEN** el usuario abre Historial
- **THEN** puede alternar entre `Hogar` y `Mis meses` sin perder el mes seleccionado

#### Scenario: Sobrante del mes

- **WHEN** el usuario abre Historial en `Hogar` o `Mis meses`
- **THEN** ve `Total con ahorros` (ingresos − gastos), `Ahorro`, `Libre` (total − ahorro) y `Acumulado` (suma de libre), con una guía de lectura y un acceso directo desde Inicio

### Requirement: Versión 2.0 visible y coherente

La app SHALL declarar la versión 2.0.0 en `package.json` y SHALL mostrar o
documentar la versión en la pantalla de Perfil o en la documentación de la app.
Las referencias a la versión anterior SHALL actualizarse.

#### Scenario: Versión en package.json

- **WHEN** se lee `package.json`
- **THEN** la versión es `2.0.0`

#### Scenario: Referencia visible

- **WHEN** el usuario abre Perfil o la documentación
- **THEN** encuentra la versión 2.0 y una descripción breve del nuevo enfoque personal

### Requirement: Sin código ni opciones muertas

Al terminar la implementación, los hooks, componentes, tarjetas, rutas y
etiquetas que hayan quedado sin uso por la consolidación SHALL eliminarse. La
app SHALL NOT conservar dos formas de hacer lo mismo (por ejemplo, editar el
ahorro directamente y registrar movimientos).

#### Scenario: Búsqueda de referencias

- **WHEN** se busca el hook o componente retirado
- **THEN** no quedan importaciones ni rutas que lo usen

#### Scenario: Build y lint

- **WHEN** se ejecutan `pnpm build` y `pnpm lint`
- **THEN** no hay errores ni advertencias nuevas por código muerto
