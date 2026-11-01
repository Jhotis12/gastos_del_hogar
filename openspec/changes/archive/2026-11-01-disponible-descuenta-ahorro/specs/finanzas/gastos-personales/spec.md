# Spec Delta

## REMOVED Requirements

### Requirement: Disponible personal desde el último pago

**Reason**: Su texto prohibía descontar el ahorro del disponible ("El ahorro
SHALL NOT descontarse"), así el número de Inicio seguía contando como gastable
el dinero ya movido a metas y contradecía a `finanzas/ahorros`.

**Migration**: Lo reemplaza el requisito ADDED "Disponible personal neto de
ahorro": el disponible pasa a descontar el ahorro neto propio de la misma
ventana.

## ADDED Requirements

### Requirement: Disponible personal neto de ahorro

Cuando exista ingreso registrado, el sistema SHALL mostrar un disponible
calculado con los ingresos recibidos desde su último pago (real o configurado)
menos los gastos pagados y menos su ahorro neto propio (aportes menos retiros)
en esa misma ventana. Los aportes de otros miembros y las aperturas sin dueño
SHALL NOT afectarlo. Sin ingreso registrado, SHALL mostrar solo gasto y ahorro,
sin inventar un disponible; el salario SHALL NOT ser la cifra principal.

#### Scenario: Con ingreso registrado y ahorro

- **WHEN** la persona tiene una nómina de 3.000.000 recibida el día 30, gastos de 1.200.000 y ahorro propio neto de 300.000 desde ese pago
- **THEN** el disponible muestra 1.500.000 y el detalle aclara que descuenta el ahorro

#### Scenario: El retiro devuelve el dinero

- **WHEN** la persona retira 50.000 de una meta de ahorro dentro del ciclo
- **THEN** su disponible sube 50.000

#### Scenario: Aporte de otro miembro

- **WHEN** otro miembro deposita 200.000 en una meta compartida
- **THEN** el disponible de la persona no cambia

#### Scenario: Apertura migrada

- **WHEN** una meta migrada tiene una apertura de 500.000 sin miembro
- **THEN** el disponible de la persona no baja por esa apertura

#### Scenario: Sin ingreso registrado

- **WHEN** la persona no tiene salarios ni ingresos extra registrados
- **THEN** la vista muestra gasto y ahorro, no muestra un disponible inventado y no bloquea el registro de gastos

#### Scenario: El salario no es el titular de Inicio

- **WHEN** la persona tiene un salario registrado
- **THEN** Inicio no muestra "Me pagaron" ni el monto del salario como cifra principal; el foco sigue siendo el gasto personal
