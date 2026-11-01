# Spec Delta

## MODIFIED Requirements

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
