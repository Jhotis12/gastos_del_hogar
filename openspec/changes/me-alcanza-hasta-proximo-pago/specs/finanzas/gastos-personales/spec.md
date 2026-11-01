# Spec Delta

## ADDED Requirements

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
