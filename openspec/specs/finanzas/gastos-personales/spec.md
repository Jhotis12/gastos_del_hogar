# finanzas/gastos-personales Specification

## Purpose
Permite que cada persona vea y controle sus propios gastos, con ventanas de mes
en curso y desde su último pago, sin perder que cada gasto sigue siendo parte
del hogar.

## Requirements

### Requirement: Pagador obligatorio y del mismo hogar

Todo gasto nuevo o editado SHALL tener un `paid_by` que sea miembro del mismo
hogar del gasto. El usuario SHALL poder elegir a otro miembro como pagador, pero
SHALL NOT poder guardar un gasto sin pagador ni asignarlo a un perfil de otro
hogar.

#### Scenario: Gasto pagado por el usuario actual

- **WHEN** el usuario registra un gasto sin cambiar el pagador por defecto
- **THEN** el gasto queda con `paid_by = auth.uid()` y aparece en sus gastos personales

#### Scenario: Gasto pagado por otro miembro

- **WHEN** el usuario registra un gasto y elige a otro miembro del hogar como pagador
- **THEN** el gasto queda con el `paid_by` elegido, aparece en los gastos de ese miembro y no en los del usuario que lo registró

#### Scenario: Gasto sin pagador rechazado

- **WHEN** el cliente intenta insertar o actualizar un gasto con `paid_by = null`
- **THEN** la operación falla por la política RLS y la UI muestra un error claro, sin guardar el gasto

#### Scenario: Pagador de otro hogar rechazado

- **WHEN** el cliente intenta asignar como pagador un perfil que no pertenece al hogar del gasto
- **THEN** la operación falla y no se crea ni se modifica la fila

### Requirement: Vista personal de gastos

La vista personal SHALL filtrar los gastos por `paid_by = auth.uid()` y SHALL
mostrar el detalle y los totales de esa persona. Un gasto pagado por otro
miembro SHALL NOT sumar en los totales personales del usuario actual.

#### Scenario: Mis gastos incluyen solo los que pagué

- **WHEN** el usuario abre `Mis gastos` y existen gastos pagados por él y por otro miembro
- **THEN** la lista y los totales muestran solo los gastos con `paid_by = auth.uid()`

#### Scenario: Cambiar el pagador mueve el gasto

- **WHEN** un gasto pasa de pagado por A a pagado por B
- **THEN** deja de sumar en los totales personales de A y empieza a sumar en los de B, sin duplicarse en el total del hogar

### Requirement: Dos ventanas de gasto personal

La vista personal SHALL ofrecer dos ventanas: **mes en curso** (desde el primer
día del mes calendario hasta la fecha de consulta) y **desde mi último pago**
(desde el último día de pago real o configurado hasta la fecha de consulta).
Ambas ventanas SHALL estar visibles y etiquetadas con sus fechas.

#### Scenario: Mes en curso

- **WHEN** hoy es 24 de octubre y el usuario consulta `Este mes`
- **THEN** el total incluye sus gastos con `expense_date` entre el 1 y el 24 de octubre

#### Scenario: Desde mi último pago

- **WHEN** el último pago fue el 30 de septiembre y hoy es 2 de octubre
- **THEN** la ventana `Desde mi último pago` incluye sus gastos del 30 de septiembre al 2 de octubre

#### Scenario: Gasto anterior al pago no entra en el ciclo

- **WHEN** el usuario pagó un gasto el 29 de septiembre y su último pago fue el 30 de septiembre
- **THEN** el gasto aparece en el mes calendario de septiembre, pero no en la ventana `Desde mi último pago`

#### Scenario: Gasto posterior al pago entra en el ciclo

- **WHEN** el usuario pagó un gasto el 1 de octubre y su último pago fue el 30 de septiembre
- **THEN** el gasto aparece en la ventana `Desde mi último pago` y también en el mes calendario de octubre

### Requirement: Inicio de la ventana sin depender del monto del salario

La fecha de inicio de `Desde mi último pago` SHALL calcularse con el último
`salaries.pay_date` real de la persona que sea menor o igual a la fecha de
consulta. Si no hay ninguna nómina registrada, SHALL usarse el `profiles.payday`
configurado. El monto del salario SHALL NOT ser necesario para mostrar la
ventana ni para calcular el total gastado.

#### Scenario: Nómina real registrada

- **WHEN** la persona tiene una nómina con `pay_date = 2026-09-30` y hoy es 2026-10-02
- **THEN** la ventana empieza el 2026-09-30

#### Scenario: Nómina atrasada

- **WHEN** la nómina de septiembre llegó el 1 de octubre y hoy es 3 de octubre
- **THEN** la ventana empieza el 1 de octubre, no el 30 de septiembre

#### Scenario: Sin nómina registrada

- **WHEN** la persona no tiene filas en `salaries` y su `payday` es 15, y hoy es 20 de octubre
- **THEN** la ventana empieza el 15 de octubre y el usuario ve sus gastos desde esa fecha

#### Scenario: Día de pago 31 en febrero

- **WHEN** el `payday` configurado es 31 y el mes en curso es febrero
- **THEN** la fecha de pago se recorta al último día de febrero y la ventana se calcula con esa fecha

### Requirement: Disponible personal desde el último pago

Cuando exista ingreso registrado para la persona, el sistema SHALL mostrar un
disponible calculado con los ingresos recibidos desde su último pago (real o la
fecha configurada de pago) menos los gastos pagados por la persona en esa misma
ventana. El ahorro SHALL NOT descontarse del disponible; se muestra en su propia
sección. Si no hay ingreso registrado, SHALL mostrar solo gasto y ahorro, SHALL
NOT inventar un disponible y SHALL NOT mostrar el monto del salario como
protagonista.

#### Scenario: Con ingreso registrado

- **WHEN** la persona tiene una nómina de 3.000.000 recibida el día 30 y gastos de 1.200.000 desde ese pago
- **THEN** el disponible muestra 1.800.000 y el detalle aclara que es desde el último pago

#### Scenario: El ahorro no reduce el disponible

- **WHEN** la persona movió 300.000 a una meta de ahorro después de su pago
- **THEN** el disponible sigue siendo ingresos menos gastos y el ahorro aparece en su propia sección

#### Scenario: Sin ingreso registrado

- **WHEN** la persona no tiene salarios ni ingresos extra registrados
- **THEN** la vista muestra gasto y ahorro, no muestra un disponible inventado y no bloquea el registro de gastos

#### Scenario: El salario no es el titular de Inicio

- **WHEN** la persona tiene un salario registrado
- **THEN** Inicio no muestra “Me pagaron” ni el monto del salario como cifra principal; el foco sigue siendo el gasto personal

### Requirement: Gasto personal contado una vez en el hogar

Todo gasto personal SHALL seguir siendo un gasto del hogar. El total del mes del
hogar SHALL incluir el gasto una sola vez, y el desglose por persona SHALL
asignarlo al pagador.

#### Scenario: Gasto personal en el total del hogar

- **WHEN** A paga un gasto de 100.000
- **THEN** el total del hogar del mes sube 100.000 y el desglose por persona suma 100.000 a A

#### Scenario: Edición y eliminación

- **WHEN** A edita el monto o elimina el gasto
- **THEN** el total personal de A y el total del hogar se actualizan de forma consistente

### Requirement: Legado sin pagador fuera de los totales personales

Los gastos históricos con `paid_by = null` SHALL conservarse, SHALL aparecer en
la bolsa `Sin asignar (histórico)` y SHALL NOT sumar en los totales personales
de ningún miembro hasta que se les asigne un pagador.

#### Scenario: Gasto legado visible pero no personal

- **WHEN** existe un gasto histórico sin pagador
- **THEN** aparece en `Sin asignar` y en el total del hogar, pero no en `Mis gastos` ni en el total personal de ningún miembro

#### Scenario: Limpieza del legado

- **WHEN** el usuario asigna un pagador a un gasto histórico
- **THEN** el gasto sale de `Sin asignar`, entra en los totales personales del pagador y el total del hogar no cambia

### Requirement: Desglose personal por categoría

La vista personal SHALL agrupar los gastos de la ventana seleccionada por
categoría y SHALL mostrar el monto y la participación de cada categoría.

#### Scenario: Categorías de mi mes

- **WHEN** el usuario consulta `Este mes` y tiene gastos en Comida y Transporte
- **THEN** ve el total de cada categoría y la suma coincide con su total personal de la ventana

### Requirement: Proyección y Quiero comprar usan el dinero personal

La proyección y la lista de deseos SHALL usar el disponible y el sobrante
personal del usuario, no el saldo del hogar. Si no hay base suficiente para
calcular un disponible, SHALL mostrar un estado claro y SHALL NOT usar el saldo
de otras personas.

#### Scenario: Proyección personal

- **WHEN** el usuario abre Proyección
- **THEN** los ingresos, gastos, ahorro y saldo base son los de su ledger personal, no los del hogar

#### Scenario: Quiero comprar con mi disponible

- **WHEN** el usuario registra un deseo y existe un disponible personal
- **THEN** la lista muestra “Mi disponible” y calcula cuánto le quedaría después del abono o la cuota

#### Scenario: Sin disponible personal

- **WHEN** el usuario no tiene ingresos registrados para calcular un disponible
- **THEN** Quiero comprar no muestra un saldo del hogar como si fuera suyo y explica que falta registrar ingresos o presupuesto

### Requirement: Historial personal por mes

El historial personal SHALL mostrar, por mes calendario, el gasto, el ahorro
neto y el disponible cuando exista base para calcularlo. El ingreso SHALL
mostrarse solo si está registrado y SHALL NOT ser la columna principal.

#### Scenario: Mis meses

- **WHEN** el usuario abre la pestaña `Mis meses`
- **THEN** ve una fila por mes con sus gastos y su ahorro, y el disponible solo en los meses con ingresos registrados

#### Scenario: Mes sin ingresos

- **WHEN** un mes no tiene ingresos registrados
- **THEN** la fila muestra gasto y ahorro, y el disponible aparece como “Sin base” en vez de un cero engañoso

### Requirement: Veredicto de alcance hasta el próximo pago

La pantalla de Proyección SHALL calcular y mostrar si el disponible personal
del usuario alcanza para cubrir los compromisos del ciclo actual, desde hoy
hasta el día anterior a su próximo pago. SHALL mostrar el saldo esperado al
próximo pago o el faltante y SHALL usar tres estados: te alcanza, no te alcanza
o ajustado. SHALL comunicar el veredicto con texto, no solo con color.

#### Scenario: Con saldo suficiente

- **WHEN** el disponible personal es 1.000.000 y los compromisos del ciclo son 700.000
- **THEN** la pantalla muestra "Te alcanza" y un saldo esperado de 300.000

#### Scenario: Sin saldo suficiente

- **WHEN** el disponible personal es 500.000 y los compromisos del ciclo son 800.000
- **THEN** la pantalla muestra "No te alcanza" y un faltante de 300.000

#### Scenario: Resultado ajustado

- **WHEN** el rango pesimista del saldo esperado es negativo y el optimista es positivo
- **THEN** la pantalla muestra "Ajustado" con el rango, sin afirmar que alcanza

#### Scenario: Sin base de ingresos

- **WHEN** el usuario no tiene ingresos registrados y el disponible personal es nulo
- **THEN** la pantalla no inventa un saldo, muestra los compromisos del ciclo y explica que hace falta registrar un ingreso

### Requirement: Ventana del próximo pago

El próximo pago SHALL ser la primera fecha de nómina efectiva posterior a hoy.
Si no hay nómina registrada, SHALL usarse el `payday` configurado del perfil,
recortado al último día del mes. Si hoy es día de pago, el próximo pago SHALL
ser el del mes siguiente. La proyección SHALL cubrir desde hoy hasta el día
anterior a esa fecha.

#### Scenario: Nómina registrada

- **WHEN** la nómina efectiva tiene `pay_date = 2026-10-30` y hoy es 2026-10-24
- **THEN** el próximo pago es el 2026-10-30 y el ciclo termina el 2026-10-29

#### Scenario: Sin nómina registrada

- **WHEN** no hay filas de salario, el `payday` configurado es 15 y hoy es 10 de octubre
- **THEN** el próximo pago es el 15 de octubre

#### Scenario: Hoy es día de pago

- **WHEN** el `payday` es 24 y hoy es 24 de octubre
- **THEN** el próximo pago es el 24 de noviembre

#### Scenario: Día 31 en febrero

- **WHEN** el próximo pago cae en febrero y el `payday` configurado es 31
- **THEN** el próximo pago se recorta al último día de febrero

### Requirement: La nómina del próximo pago reinicia el ciclo

La nómina que llega en el próximo pago SHALL tratarse como el inicio del
siguiente ciclo y SHALL NOT sumarse a los ingresos que cubren los compromisos
anteriores a esa fecha. Solo los ingresos registrados con fecha anterior al
próximo pago SHALL sumar al saldo esperado.

#### Scenario: Salario en la fecha de pago

- **WHEN** el salario de 2.000.000 llega en el próximo pago, el disponible es 300.000 y hay 600.000 de compromisos antes del pago
- **THEN** el veredicto es "No te alcanza" con un faltante de 300.000 y la nómina se muestra como inicio del siguiente ciclo

#### Scenario: Ingreso extra antes del pago

- **WHEN** existe un ingreso registrado de 200.000 con fecha anterior al próximo pago
- **THEN** ese ingreso suma al saldo esperado del ciclo

#### Scenario: Sin ingresos antes del pago

- **WHEN** no hay ingresos registrados antes del próximo pago
- **THEN** el saldo esperado usa solo el disponible de hoy y no inventa ingresos

### Requirement: Compromisos del ciclo

La proyección SHALL restar del disponible los servicios recurrentes activos del
usuario con `next_due_date` menor o igual al próximo pago, incluidos los
vencidos, y los aportes de autoahorro activos que vencen antes del próximo pago.
SHALL mostrar cada compromiso con su descripción o meta, monto y fecha.

#### Scenario: Servicio antes del pago

- **WHEN** un servicio activo de 100.000 pagado por el usuario vence antes del próximo pago
- **THEN** aparece en los compromisos y se resta del saldo esperado

#### Scenario: Servicio después del pago

- **WHEN** un servicio vence después del próximo pago
- **THEN** no aparece en los compromisos de este ciclo

#### Scenario: Servicio vencido

- **WHEN** un servicio activo tiene `next_due_date` anterior a hoy
- **THEN** aparece como vencido y se resta del saldo esperado

#### Scenario: Servicio ya aplicado

- **WHEN** aplicar el servicio adelantó su `next_due_date` más allá del próximo pago
- **THEN** no se vuelve a restar en este ciclo

#### Scenario: Autoahorro antes del pago

- **WHEN** un plan activo de 200.000 vence antes del próximo pago y no se ha ejecutado este mes
- **THEN** aparece como compromiso y se resta del saldo esperado

#### Scenario: Autoahorro ya ejecutado

- **WHEN** el plan ya se ejecutó este mes
- **THEN** no se resta otra vez y se muestra como ahorro ya apartado

### Requirement: Estimación variable del ciclo

La estimación de gastos variables SHALL usar la mediana de los gastos
personales no recurrentes de hasta 6 meses completos, incluyendo en cero los
meses sin gasto, y SHALL escalarla solo a los días que faltan del ciclo. SHALL
mostrar un rango p25–p75 cuando haya al menos 2 meses. Con menos historial SHALL
mostrar un estado preliminar sin inventar un gasto.

#### Scenario: Meses en cero

- **WHEN** la ventana tiene 6 meses, 2 sin gasto variable y 4 con montos
- **THEN** la mediana incluye los 2 meses en cero

#### Scenario: Rango disponible

- **WHEN** hay al menos 2 meses de historial variable
- **THEN** la pantalla muestra el rango p25–p75 y lo usa para el veredicto ajustado

#### Scenario: Menos de 2 meses

- **WHEN** solo hay 1 mes de historial variable
- **THEN** la pantalla muestra "Estimación preliminar", no muestra `$0` y explica que faltan meses para estimar los variables

#### Scenario: Solo días restantes

- **WHEN** faltan 10 días para el próximo pago
- **THEN** la estimación variable cubre solo esos 10 días y no el mes completo

#### Scenario: Servicio convertido a recurrente

- **WHEN** un gasto histórico no recurrente coincide con un servicio hoy recurrente
- **THEN** ese gasto no se cuenta otra vez en la estimación variable

### Requirement: Desglose reconstruible y gasto diario

La pantalla SHALL mostrar el desglose del cálculo: disponible de hoy, ingresos
antes del próximo pago, servicios, autoahorro y estimación variable. Cada línea
SHALL ser visible y la suma SHALL explicar el saldo esperado. SHALL mostrar el
monto disponible por día para gastos variables después de los compromisos y
SHALL declarar los supuestos del cálculo.

#### Scenario: Desglose

- **WHEN** el usuario abre la pantalla
- **THEN** ve las líneas del cálculo y su suma coincide con el saldo esperado del hero

#### Scenario: Gasto diario

- **WHEN** después de compromisos quedan 300.000 para 10 días
- **THEN** la pantalla muestra aproximadamente 30.000 por día

#### Scenario: Supuestos

- **WHEN** la pantalla renderiza la estimación
- **THEN** declara que usa la mediana de los últimos 6 meses, el rango p25–p75 y que no incluye ingresos extra no registrados

#### Scenario: Ahorro ya apartado

- **WHEN** el usuario tiene ahorro ya apartado
- **THEN** la pantalla lo muestra por separado y explica que no modifica el disponible personal

### Requirement: La pantalla no muestra la proyección multi-mes

La pantalla de Proyección SHALL NOT mostrar el selector de 1, 3 o 6 meses, el
"ahorro proyectado" multiplicado ni la tarjeta de promedio mensual. El promedio
histórico y los meses anteriores SHALL seguir disponibles en Historial. La
proyección a varios meses queda fuera de este cambio.

#### Scenario: Sin selector de horizontes

- **WHEN** el usuario abre Proyección
- **THEN** no encuentra el selector 1/3/6

#### Scenario: Sin promedio duplicado

- **WHEN** el usuario quiere ver su promedio mensual
- **THEN** la pantalla de Proyección no lo muestra y el dato sigue en Historial

#### Scenario: Hero correcto

- **WHEN** el usuario abre Proyección
- **THEN** el hero es "¿Me alcanza hasta el próximo pago?" y no "Gasto estimado del próximo mes"
