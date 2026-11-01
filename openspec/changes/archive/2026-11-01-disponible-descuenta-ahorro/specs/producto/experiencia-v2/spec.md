# Spec Delta

## MODIFIED Requirements

### Requirement: Inicio con foco personal

La pantalla de entrada SHALL priorizar los gastos y ahorros personales. SHALL
mostrar como mínimo el gasto del mes en curso, el gasto desde el último pago, el
ahorro personal desde el último pago y el disponible personal desde el último
pago ya descontando ese ahorro. SHALL mostrar también el disponible del hogar
como suma de los disponibles personales (ya netos de su ahorro propio), sin
sumar los saldos de las metas. El monto del salario SHALL NOT ser la cifra
principal ni el titular de la pantalla.

#### Scenario: Primer vistazo

- **WHEN** el usuario entra a la app
- **THEN** ve sus gastos y su ahorro antes que cualquier resumen del hogar o de ingresos

#### Scenario: El disponible descuenta el ahorro

- **WHEN** la persona ve el hero de Inicio con ahorro propio en el ciclo
- **THEN** el disponible es ingresos − gastos − el neto que muestra la tarjeta "Mi ahorro", en la misma ventana

#### Scenario: Sin ingresos registrados

- **WHEN** el usuario no tiene ingresos registrados
- **THEN** Inicio sigue mostrando sus gastos y ahorro sin un saldo inventado

#### Scenario: Acceso al hogar

- **WHEN** el usuario quiere ver el gasto conjunto
- **THEN** encuentra un acceso visible a `Hogar` sin perder el foco personal
