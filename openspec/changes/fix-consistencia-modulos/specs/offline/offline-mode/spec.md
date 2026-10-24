# Spec Delta

## ADDED Requirements

### Requirement: Aviso offline sin duplicar

Cuando una mutación de `expenses`, `incomes` o `salaries` se resuelve por la
vía offline (encolada en el outbox), el sistema SHALL mostrar únicamente el
aviso "Guardado sin conexión" emitido por la capa offline; la página SHALL NOT
mostrar además su propia confirmación de éxito.

#### Scenario: Gasto creado sin red

- **WHEN** el usuario registra un gasto sin conexión desde Gastos o Dashboard
- **THEN** aparece "Guardado sin conexión" y NO aparece además "Gasto registrado"

#### Scenario: Dinero extra creado sin red

- **WHEN** el usuario registra dinero extra sin conexión
- **THEN** aparece "Guardado sin conexión" y NO aparece además "Dinero extra registrado"

## MODIFIED Requirements

### Requirement: Alcance offline y conflictos

Solo `expenses`, `incomes` y `salaries` SHALL ser operables offline
(crear/editar/eliminar). Facturas, metas, presupuestos, categorías, servicios y
la lista de deseos (`wishlist_items`) requieren red: sus mutaciones SHALL fallar
de inmediato con un mensaje claro para el usuario ("Sin conexión: vuelve a
intentarlo cuando estés en línea") y SHALL NOT encolarse. Ante conflicto
multi-dispositivo SHALL aplicar último en escribir gana (last-write-wins), sin
merge.

#### Scenario: Editar gasto offline y online concurrente

- **WHEN** dos dispositivos editan el mismo gasto offline y ambos sincronizan
- **THEN** el último `update` en llegar al servidor prevalece; no se muestra error de conflicto

#### Scenario: Acción de wishlist sin red

- **WHEN** el usuario crea un deseo, lo edita o cambia su estado sin conexión
- **THEN** no se encola ninguna operación, se muestra el mensaje de sin conexión y no queda una promesa rechazada sin manejar
