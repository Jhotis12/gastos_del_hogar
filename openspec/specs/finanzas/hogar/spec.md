# finanzas/hogar Specification

## Purpose
Mantiene la vista conjunta del hogar: cuánto se gastó en el mes, cuánto gastó
cada persona y qué quedó sin asignar, para que lo personal no oculte lo
compartido.

## Requirements

### Requirement: Total mensual del hogar

El hogar SHALL mostrar el total de gastos del mes calendario seleccionado,
sumando todos los gastos del hogar sin importar el pagador. El ahorro SHALL
mostrarse como línea separada y SHALL NOT sumarse a los gastos.

#### Scenario: Total con varios pagadores

- **WHEN** en octubre A pagó 100.000 y B pagó 250.000
- **THEN** el total de gastos del hogar de octubre es 350.000

#### Scenario: El ahorro no es gasto

- **WHEN** A depositó 50.000 en una meta de ahorro durante octubre
- **THEN** el total de gastos del hogar no incluye esos 50.000 y el ahorro aparece en su propia línea

#### Scenario: Mes sin gastos

- **WHEN** el mes seleccionado no tiene gastos
- **THEN** el total es 0 y la vista muestra un estado vacío con acceso a registrar un gasto

### Requirement: Desglose por persona que reconcilia con el total

El desglose por persona SHALL agrupar los gastos del mes por `paid_by`. La suma
de los montos por persona más la bolsa `Sin asignar` SHALL ser igual al total
del hogar del mes, sin contar ningún gasto dos veces.

#### Scenario: Dos miembros

- **WHEN** A pagó 100.000 y B pagó 250.000 en el mes
- **THEN** el desglose muestra A=100.000, B=250.000 y la suma coincide con el total de 350.000

#### Scenario: Cambio de pagador

- **WHEN** un gasto de 40.000 pasa de A a B
- **THEN** A baja 40.000, B sube 40.000 y el total del hogar no cambia

#### Scenario: Gasto legado

- **WHEN** el mes tiene un gasto de 25.000 sin pagador
- **THEN** aparece en `Sin asignar` y la suma de A + B + Sin asignar sigue siendo el total del hogar

### Requirement: Bolsa histórica sin pagador

Los gastos con `paid_by = null` SHALL mostrarse en una bolsa
`Sin asignar (histórico)` con su monto y su detalle. El sistema SHALL NOT
asignarles un pagador automáticamente. La bolsa SHALL permitir asignar un
pagador de forma individual o masiva.

#### Scenario: Ver los gastos sin pagador

- **WHEN** existen gastos históricos sin pagador
- **THEN** la vista del hogar muestra cuántos son y cuánto suman en `Sin asignar`

#### Scenario: Asignación individual

- **WHEN** el usuario asigna un pagador a un gasto de la bolsa
- **THEN** el gasto sale de la bolsa y el total del hogar se mantiene igual

#### Scenario: Asignación masiva

- **WHEN** el usuario elige varios gastos sin pagador y les asigna el mismo miembro
- **THEN** todos salen de la bolsa y los totales por persona y del hogar quedan reconciliados

### Requirement: Pagadores que ya no están en el hogar

Los gastos pagados por un perfil que ya no pertenece al hogar SHALL seguir
sumando en el total del hogar y SHALL agruparse en una bolsa
`Miembros anteriores` o equivalente. Esa bolsa SHALL NOT exponer datos de otros
hogares ni permitir editar el perfil del miembro anterior.

#### Scenario: Gasto de un exmiembro

- **WHEN** un exmiembro pagó un gasto antes de salir del hogar
- **THEN** el gasto sigue en el total del mes y aparece en `Miembros anteriores`, no en la lista de miembros actuales

#### Scenario: Aislamiento entre hogares

- **WHEN** un miembro anterior pertenece ahora a otro hogar
- **THEN** el hogar original solo ve el gasto histórico y no puede leer ni modificar los datos del nuevo hogar

### Requirement: Disponible del hogar en Inicio

El sistema SHALL mostrar el disponible del hogar junto al personal en Inicio.
SHALL calcularlo como la suma de los disponibles personales de todos los
miembros, cada uno desde su último pago y ya descontando su ahorro neto propio;
SHALL NOT sumar los saldos de las metas de ahorro. Si un miembro no tiene
ingresos, sus gastos desde su fecha de pago SHALL reducir el total. El acumulado
histórico y el sobrante mensual SHALL seguir en Historial.

#### Scenario: Miembros con pagos distintos

- **WHEN** A tiene 1.859.800 desde su pago y B tiene 193.267 desde el suyo
- **THEN** el disponible del hogar muestra 2.053.067

#### Scenario: El ahorro no suma al disponible

- **WHEN** el hogar tiene 700.000 en metas compartidas
- **THEN** ese monto no se suma al disponible del hogar y se ve en Ahorros y en el Historial

#### Scenario: El aporte propio baja el total

- **WHEN** A aporta 150.000 a una meta compartida
- **THEN** el disponible del hogar baja 150.000 por el disponible de A, y un aporte de B no baja el disponible de A

#### Scenario: Miembro sin ingresos

- **WHEN** un miembro no tiene ingresos registrados pero pagó gastos desde su fecha de pago
- **THEN** sus gastos reducen el disponible del hogar y su disponible personal sigue mostrándose como sin base

### Requirement: La sección del hogar es secundaria pero accesible

La experiencia por defecto SHALL estar enfocada en los gastos y ahorros
personales. La sección `Hogar` SHALL estar accesible desde la navegación
principal o desde un acceso claramente visible, SHALL mostrar el total gastado
del mes y el desglose por persona, y SHALL NOT requerir ingresos registrados
para funcionar.

#### Scenario: Inicio personal con acceso al hogar

- **WHEN** el usuario entra a la app
- **THEN** ve primero su gasto y ahorro personal, y encuentra un acceso claro a `Hogar`

#### Scenario: Hogar sin ingresos registrados

- **WHEN** ningún miembro tiene ingresos registrados
- **THEN** la sección `Hogar` sigue mostrando el total gastado y el desglose por persona

#### Scenario: Sin salario como titular

- **WHEN** el usuario abre `Hogar`
- **THEN** la cifra principal es el gasto del mes, no el monto de los salarios

### Requirement: Ahorro compartido del hogar

La sección `Hogar` SHALL mostrar el ahorro de las metas compartidas y el total
aportado por cada miembro. Las metas personales SHALL NOT mostrarse en la vista
del hogar.

#### Scenario: Metas compartidas

- **WHEN** existen dos metas compartidas con aportes de A y B
- **THEN** `Hogar` muestra el total ahorrado en metas compartidas y el aporte neto de cada miembro

#### Scenario: Metas personales ocultas

- **WHEN** A tiene una meta personal
- **THEN** B no ve esa meta ni su saldo en la vista del hogar

### Requirement: Navegación mensual del hogar

La vista del hogar SHALL permitir navegar meses calendario anteriores y el mes
actual, y SHALL mostrar el rango de fechas del mes seleccionado. Los gastos
futuros registrados en el mes SHALL incluirse en el total del mes y SHALL
identificarse como futuros cuando corresponda.

#### Scenario: Mes anterior

- **WHEN** el usuario selecciona septiembre
- **THEN** el total y el desglose corresponden a los gastos con `expense_date` de septiembre

#### Scenario: Gasto con fecha futura

- **WHEN** el mes actual tiene un gasto con fecha posterior a hoy
- **THEN** el gasto suma en el total del mes y se distingue visualmente de los gastos ya ocurridos

### Requirement: Detalle y exportación con pagador

El detalle de gastos del hogar y la exportación CSV SHALL incluir fecha,
descripción, categoría, monto y pagador. La exportación SHALL respetar los
filtros activos y SHALL usar la convención colombiana de montos.

#### Scenario: CSV del hogar

- **WHEN** el usuario exporta el mes sin filtros
- **THEN** el CSV incluye todos los gastos del mes con su pagador y el monto en formato interpretable

#### Scenario: CSV filtrado

- **WHEN** el usuario filtra por una persona y exporta
- **THEN** el CSV contiene solo los gastos de esa persona y el total coincide con el filtro
