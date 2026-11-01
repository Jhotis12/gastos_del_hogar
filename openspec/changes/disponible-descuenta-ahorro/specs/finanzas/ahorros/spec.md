# Spec Delta

## REMOVED Requirements

### Requirement: El ahorro se muestra separado del disponible

**Reason**: Prohibía descontar el ahorro del disponible, así el número de
Inicio seguía contando como gastable el dinero ya movido a metas; además
contradecía a otros requisitos vigentes de esta capability (archivar, retirar,
deshacer y autoahorro), que ya dan por descontado el ahorro.

**Migration**: Lo reemplaza "El ahorro descuenta el disponible del aportante":
el ahorro propio descuenta el disponible y se sigue mostrando en su propia
sección para que la resta sea visible.

## ADDED Requirements

### Requirement: El ahorro descuenta el disponible del aportante

Cada depósito o aporte automático SHALL reducir el disponible personal del
miembro que lo hace, y cada retiro SHALL devolverle ese dinero, dentro de la
ventana desde su último pago. Los aportes de otros miembros y las aperturas
migradas sin miembro SHALL NOT afectar el disponible de la persona.

#### Scenario: Depósito en meta personal

- **WHEN** A tiene un disponible de 1.000.000 y deposita 200.000 en su meta personal
- **THEN** su disponible pasa a 800.000 y el ahorro de la meta sube 200.000

#### Scenario: Depósito en meta compartida

- **WHEN** A deposita 150.000 en una meta compartida
- **THEN** el disponible de A baja 150.000, el de B no cambia y la meta sube 150.000

#### Scenario: Retiro

- **WHEN** A retira 50.000 de una meta compartida
- **THEN** el saldo de la meta baja 50.000 y el disponible de A sube 50.000

#### Scenario: Aporte de otro miembro

- **WHEN** B aporta 200.000 a una meta compartida
- **THEN** el disponible de A no cambia por ese aporte

#### Scenario: Apertura migrada

- **WHEN** una meta migrada tiene una apertura de 500.000 sin miembro
- **THEN** el disponible de ningún miembro baja por esa apertura

#### Scenario: La resta es visible en Inicio

- **WHEN** la persona ve el hero de Inicio
- **THEN** la tarjeta "Mi ahorro" muestra su neto desde el último pago y el disponible descuenta exactamente ese monto
