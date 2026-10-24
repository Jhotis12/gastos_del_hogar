# Spec Delta

## ADDED Requirements

### Requirement: Cierre de sesión sin residuos del usuario anterior

Al cerrar sesión, el sistema SHALL vaciar el outbox de IndexedDB (`gastos-offline`)
además de la caché de queries y la caché persistida, de modo que las operaciones
de un usuario SHALL NOT reproducirse con la sesión del siguiente. Si hay
operaciones pendientes, el cierre de sesión SHALL pedir confirmación avisando
que se descartarán, para no perder cambios sin avisar.

#### Scenario: Cierre con cambios pendientes

- **WHEN** el usuario cierra sesión con 2 operaciones encoladas (y sin red)
- **THEN** se muestra una confirmación que avisa que se descartarán; al confirmar, el outbox queda vacío y no se reenvía nada al iniciar sesión con otra cuenta

#### Scenario: Cierre sin pendientes

- **WHEN** el usuario cierra sesión sin operaciones pendientes
- **THEN** no se pide confirmación adicional y la caché (`gastos-query-cache`) y el outbox quedan vacíos

#### Scenario: Otra cuenta en el mismo dispositivo

- **WHEN** un segundo usuario inicia sesión después de un cierre con pendientes
- **THEN** no aparece ningún toast de sincronización ni fila fantasma proveniente de la cola del usuario anterior

### Requirement: Caché optimista visible tras recargar sin red

Las lecturas servidas desde la caché persistida SHALL incluir las operaciones
que siguen en el outbox (proyección del outbox por orden FIFO), de modo que un
cambio guardado sin conexión SHALL seguir visible después de recargar la página
sin red, y SHALL converger con el servidor al sincronizar sin duplicar filas.

#### Scenario: Recarga sin red con un gasto encolado

- **WHEN** el usuario guarda un gasto sin conexión y recarga la página antes de sincronizar
- **THEN** el gasto sigue apareciendo en Gastos y en el total del mes, y el contador de pendientes lo incluye

#### Scenario: Convergencia al sincronizar

- **WHEN** el usuario recupera la red con ese gasto encolado
- **THEN** el replay idempotente lo inserta una sola vez, la proyección desaparece y el servidor es la única fuente

#### Scenario: Operación de otro mes

- **WHEN** el gasto encolado pertenece a un mes distinto del que se está viendo
- **THEN** se proyecta en la clave de su mes (`['expenses', householdId, mes]`) y no contamina el mes visible
