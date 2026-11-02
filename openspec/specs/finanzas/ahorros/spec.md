# finanzas/ahorros Specification

## Purpose
Permite ahorrar de forma personal o compartida con movimientos auditables,
mantiene el ahorro separado del disponible y automatiza aportes mensuales sin
perder historial ni atribuir dinero a quien no corresponde.

## Requirements

### Requirement: Metas personales y compartidas

Una meta de ahorro SHALL tener un dueño (`owner_id`) o ser compartida
(`owner_id = null`). Las metas personales SHALL ser visibles y administrables
solo por su dueño. Las metas compartidas SHALL ser visibles para todos los
miembros del hogar. Las metas existentes SHALL conservarse como compartidas.

#### Scenario: Meta personal privada

- **WHEN** A crea una meta personal
- **THEN** A puede verla y administrarla, y B no la ve en su lista ni en la vista del hogar

#### Scenario: Meta compartida

- **WHEN** A crea una meta compartida
- **THEN** A y B la ven, pueden aportar y ven el progreso conjunto

#### Scenario: Meta existente

- **WHEN** la migración encuentra una meta creada antes de la v2.0
- **THEN** la meta queda como compartida con `owner_id = null` y conserva su saldo

#### Scenario: Acceso indebido

- **WHEN** B intenta leer o modificar una meta personal de A por API
- **THEN** RLS rechaza la operación y no se expone el saldo

### Requirement: Movimientos de ahorro como fuente de verdad

Cada depósito, retiro, apertura o aporte automático SHALL registrarse como un
movimiento con meta, miembro, monto, fecha y tipo. El saldo de la meta SHALL
calcularse como la suma de sus movimientos. La edición directa de
`savings_goals.saved_amount` SHALL NOT ser la vía de la UI ni del cliente.

#### Scenario: Depósito

- **WHEN** A deposita 200.000 en una meta
- **THEN** se crea un movimiento de depósito de 200.000 y el saldo de la meta sube 200.000

#### Scenario: Retiro

- **WHEN** A retira 50.000 de una meta con saldo suficiente
- **THEN** se crea un movimiento de retiro de 50.000 y el saldo de la meta baja 50.000

#### Scenario: Suma de movimientos

- **WHEN** una meta tiene un depósito de 300.000 y un retiro de 100.000
- **THEN** el saldo mostrado es 200.000 y coincide con la suma de movimientos

#### Scenario: Edición directa rechazada

- **WHEN** el cliente intenta actualizar `saved_amount` directamente sin crear un movimiento
- **THEN** la operación no modifica el saldo de la meta o es rechazada por la política de escritura

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

### Requirement: Eliminar una meta con sus movimientos

El usuario SHALL poder eliminar una meta desde el front, no solo archiviarla.
Eliminar SHALL borrar la meta, sus planes y sus movimientos; el monto SHALL
dejar de contar como ahorro. La confirmación SHALL advertir que, si el dinero ya
se gastó, se registre el gasto para que el total siga real. Las metas personales
SHALL poder eliminarlas solo su dueño; las compartidas, cualquier miembro del
hogar.

#### Scenario: Eliminar meta con movimientos

- **WHEN** A elimina una meta con depósitos y autoahorro
- **THEN** la meta, sus movimientos y sus planes desaparecen y el ahorro del hogar baja

#### Scenario: Meta personal ajena

- **WHEN** A intenta eliminar una meta personal de B
- **THEN** la operación se rechaza sin borrar movimientos

#### Scenario: Meta inexistente

- **WHEN** se intenta eliminar una meta que ya no existe
- **THEN** la operación se rechaza con un mensaje claro

#### Scenario: Sin ingresos registrados

- **WHEN** A no tiene ingresos registrados y deposita 100.000
- **THEN** el ahorro se registra y se muestra, pero la app no inventa un disponible negativo

### Requirement: Retiro limitado al aporte propio en metas compartidas

En una meta compartida, un miembro SHALL poder retirar como máximo su aporte
neto (depósitos menos retiros propios). SHALL NOT poder retirar el dinero
aportado por otro miembro ni dejar el saldo de la meta en negativo.

#### Scenario: Retiro dentro del aporte propio

- **WHEN** A aportó 300.000 y B aportó 200.000, y A retira 250.000
- **THEN** el retiro se permite y el saldo de la meta queda en 250.000

#### Scenario: Retiro superior al aporte propio

- **WHEN** A aportó 300.000 y B aportó 200.000, y A intenta retirar 350.000
- **THEN** el retiro se rechaza y el saldo de la meta no cambia

#### Scenario: Retiro superior al saldo total

- **WHEN** el saldo de la meta es 100.000 y el usuario intenta retirar 150.000
- **THEN** el retiro se rechaza y se muestra un error claro

### Requirement: Saldo histórico de ahorro migrado

El `saved_amount` existente de cada meta SHALL convertirse en un movimiento de
apertura con fecha del día de la migración, `member_id = null` y una nota de
saldo migrado. El saldo de la meta SHALL NOT cambiar. La migración SHALL NOT
inventar la fecha ni el dueño original del ahorro.

#### Scenario: Meta con saldo previo

- **WHEN** una meta existente tiene `saved_amount = 500.000`
- **THEN** la migración crea un movimiento de apertura de 500.000 y la meta sigue mostrando 500.000

#### Scenario: Saldo migrado visible

- **WHEN** el usuario abre el historial de una meta migrada
- **THEN** ve el movimiento de apertura identificado como “Saldo migrado”

#### Scenario: Sin doble conteo

- **WHEN** se ejecuta la migración dos veces en local
- **THEN** no se duplica el movimiento de apertura ni cambia el saldo de la meta

### Requirement: Autoahorro mensual configurable

Un plan de autoahorro SHALL definir meta, miembro, monto, día del mes y estado.
SHALL ejecutarse como máximo una vez por mes y por plan, con un movimiento
fechado en el día configurado. SHALL ejecutarse al abrir la app o al reconectar
y SHALL recuperar hasta 12 meses pendientes. Si no hay saldo suficiente, SHALL
omitir ese mes y avisar; si la meta alcanza su objetivo, SHALL pausarse.

#### Scenario: Plan vencido

- **WHEN** hoy es 5 de octubre, el plan es de 100.000 el día 1 y está activo
- **THEN** se crea un movimiento de 100.000 fechado el 1 de octubre y el disponible baja

#### Scenario: Ejecución repetida

- **WHEN** el RPC de autoahorro se ejecuta dos veces el mismo día
- **THEN** el segundo intento no crea otro movimiento para el mismo plan y mes

#### Scenario: Meses pendientes

- **WHEN** el usuario no abrió la app en agosto y septiembre y el plan estaba activo
- **THEN** al volver se crean los movimientos de agosto y septiembre, fechados en sus días configurados, y se informa cuántos se registraron

#### Scenario: Sin saldo suficiente

- **WHEN** el plan vence y el miembro no tiene disponible suficiente
- **THEN** ese mes se omite, no se crea un movimiento y se muestra un aviso

#### Scenario: Meta alcanzada

- **WHEN** el saldo de la meta alcanza el objetivo
- **THEN** el plan se pausa y no se crean más movimientos automáticos

#### Scenario: Día 31 en febrero

- **WHEN** el plan es el día 31 y el mes es febrero
- **THEN** el movimiento se fecha el último día de febrero

#### Scenario: Plan de otro miembro

- **WHEN** B intenta ejecutar o modificar un plan personal de A
- **THEN** RLS rechaza la operación

### Requirement: Archivar sin perder el ahorro

Una meta con movimientos SHALL archivarse en lugar de borrarse. El dinero
ahorrado SHALL seguir descontado del disponible y el historial SHALL
conservarse. Para devolver el dinero, el usuario SHALL retirarlo antes de
archivar. Una meta sin movimientos SHALL poder eliminarse.

#### Scenario: Archivar meta con saldo

- **WHEN** A archiva una meta con 300.000 ahorrados
- **THEN** la meta deja de aparecer en la lista activa, el historial se conserva y el disponible no sube por arte de magia

#### Scenario: Devolver el dinero

- **WHEN** A retira 300.000 y luego archiva la meta
- **THEN** el disponible sube 300.000 por el retiro y la meta queda archivada con saldo 0

#### Scenario: Eliminar meta vacía

- **WHEN** una meta no tiene movimientos
- **THEN** se puede eliminar sin afectar el disponible

### Requirement: Historial y deshacer movimientos

El historial de una meta SHALL mostrar fecha, tipo, miembro, monto y origen
(manual o automático). Un movimiento manual SHALL poder deshacerse con
confirmación y el saldo y el disponible SHALL recalcularse. Los movimientos
automáticos SHALL identificarse como tales.

#### Scenario: Historial de la meta

- **WHEN** el usuario abre el historial de una meta
- **THEN** ve los movimientos en orden y distingue apertura, depósito, retiro y automático

#### Scenario: Deshacer un depósito

- **WHEN** el usuario elimina un depósito manual con confirmación
- **THEN** el saldo de la meta baja y el disponible sube por el mismo monto

#### Scenario: Movimiento automático

- **WHEN** el historial muestra un aporte automático
- **THEN** el usuario puede identificar el plan y el mes que lo generó

### Requirement: Sincronización de ahorros entre miembros

Los cambios en metas compartidas y movimientos SHALL propagarse a los demás
miembros sin recargar. Las metas personales SHALL NOT propagarse a miembros que
no son su dueño.

#### Scenario: Aporte compartido en tiempo real

- **WHEN** A deposita en una meta compartida
- **THEN** B ve el nuevo saldo y el aporte de A sin recargar la página

#### Scenario: Meta personal no se filtra

- **WHEN** A modifica su meta personal
- **THEN** B no recibe el cambio ni puede consultar su saldo
