# Spec Delta

## ADDED Requirements

### Requirement: Gastos offline con pagador obligatorio

Los gastos encolados offline SHALL incluir un `paid_by` válido del hogar. La
actualización optimista SHALL conservar el pagador y resolver su nombre desde la
caché de miembros; SHALL NOT mostrar el gasto como `Sin asignar`. El replay
SHALL rechazar un gasto con pagador nulo o de otro hogar y SHALL avisar al
usuario para que lo corrija.

#### Scenario: Gasto offline con pagador

- **WHEN** el usuario registra un gasto sin red y elige a un miembro como pagador
- **THEN** la fila optimista aparece con el pagador y su nombre, y el total personal del pagador se actualiza en la caché

#### Scenario: Replay con pagador válido

- **WHEN** el gasto encolado se sincroniza con un `paid_by` del mismo hogar
- **THEN** se inserta una sola vez y los totales personal y del hogar convergen con el servidor

#### Scenario: Replay con pagador inválido

- **WHEN** un gasto encolado por una versión anterior tiene `paid_by = null`
- **THEN** el replay no lo inserta, lo marca como error y muestra un aviso para asignarle un pagador

#### Scenario: Nombre del pagador no disponible en caché

- **WHEN** el pagador no está en la caché de miembros
- **THEN** la fila optimista muestra un nombre genérico o “Miembro” y no se rompe el render

### Requirement: Ahorro y autoahorro al reconectar

Las mutaciones de ahorro SHALL seguir requiriendo red y SHALL NOT encolarse. El
autoahorro SHALL ejecutarse al recuperar la conexión y SHALL ser idempotente:
un plan no SHALL generar dos movimientos para el mismo mes. Un fallo de
autoahorro SHALL NOT bloquear el resto de la sincronización.

#### Scenario: Depósito sin red

- **WHEN** el usuario intenta depositar en una meta sin conexión
- **THEN** la app muestra el aviso de que el ahorro requiere red y no encola la operación

#### Scenario: Autoahorro al reconectar

- **WHEN** el usuario vuelve a estar online con un plan de autoahorro vencido
- **THEN** se ejecuta el plan, se crea el movimiento una sola vez y se actualizan los saldos

#### Scenario: Fallo de autoahorro no bloquea la cola

- **WHEN** el autoahorro falla por cuota o validación
- **THEN** la cola de gastos se drena igual y el error de ahorro se informa por separado

### Requirement: Invalidación de disponible, historiales y ahorro

Las mutaciones de gastos, ingresos, salarios y ahorro SHALL invalidar las
claves de disponible personal, historiales, ahorro y movimientos, además de las
claves existentes de gastos e ingresos. Los totales de mes/ciclo/hogar se
derivan de las filas de gastos, así que la invalidación de `expenses` es la que
los refresca. Sin red, la invalidación SHALL omitirse y la UI SHALL sostenerse
con la caché optimista.

#### Scenario: Gasto online

- **WHEN** se guarda un gasto con red
- **THEN** se invalidan `expenses`, `member-available`, `personal-history` y `household-history` según corresponda

#### Scenario: Ahorro online

- **WHEN** se registra un depósito o retiro con red
- **THEN** se invalidan `savings`, `savings-movements`, `member-available`, `personal-history` y `household-history`

#### Scenario: Sin red

- **WHEN** se guarda un gasto offline
- **THEN** no se disparan invalidaciones y la caché optimista mantiene los totales de las filas coherentes hasta el sync
