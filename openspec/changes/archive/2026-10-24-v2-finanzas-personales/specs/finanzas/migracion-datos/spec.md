# Spec Delta

## Purpose

Garantiza que la v2.0 se despliegue sobre los datos existentes sin pérdida, con
reglas de integridad, índices y un backfill explícito del ahorro histórico.

## ADDED Requirements

### Requirement: Migración aditiva sin pérdida de datos

La migración SHALL ser aditiva: SHALL NOT recrear, vaciar ni eliminar
`expenses`, `salaries`, `incomes`, `savings_goals` ni sus columnas existentes.
Los counts y las sumas de las tablas existentes SHALL ser iguales antes y
después de aplicar la migración.

#### Scenario: Auditoría antes y después

- **WHEN** se ejecuta la migración sobre una copia local de producción
- **THEN** los counts y las sumas de gastos, salarios, ingresos y metas de ahorro coinciden exactamente antes y después

#### Scenario: Sin borrados

- **WHEN** la migración termina
- **THEN** no se eliminó ninguna fila de las tablas existentes y `expenses.splits` se conserva

#### Scenario: Entorno limpio

- **WHEN** se ejecuta `supabase db reset --local`
- **THEN** todas las migraciones aplican en orden sin errores y el esquema queda listo para la app

### Requirement: Pagador obligatorio sin romper el historial

Las escrituras nuevas y las ediciones de gastos SHALL exigir un `paid_by` del
mismo hogar. Los gastos históricos con `paid_by = null` SHALL conservarse y
SHALL quedar visibles en `Sin asignar`. La migración SHALL NOT llenar
automáticamente esos nulos con un miembro supuesto.

#### Scenario: Alta sin pagador

- **WHEN** un usuario autenticado intenta insertar un gasto con `paid_by = null`
- **THEN** RLS rechaza la inserción

#### Scenario: Edición de un gasto legado

- **WHEN** un usuario edita un gasto histórico sin pagador
- **THEN** la edición exige asignar un pagador antes de guardar y, mientras tanto, el gasto sigue visible en `Sin asignar`

#### Scenario: Borrado de un perfil

- **WHEN** se elimina un perfil que tiene gastos asociados
- **THEN** la política y la clave foránea permiten el borrado sin dejar la base en un estado inconsistente; los gastos que queden sin pagador se tratan como legado

#### Scenario: Pagador de otro hogar

- **WHEN** se intenta asignar como pagador un perfil de otro hogar
- **THEN** la operación se rechaza en la base de datos

### Requirement: Integridad de ingresos y servicios

Los ingresos extra SHALL aceptar `member_id = null` como `Hogar`, pero un
`member_id` no nulo SHALL pertenecer al mismo hogar. Los servicios recurrentes
SHALL exigir un `paid_by` del mismo hogar para las nuevas filas y para las
ediciones; los servicios legados sin responsable SHALL bloquear su aplicación
hasta que se les asigne uno.

#### Scenario: Ingreso con dueño de otro hogar

- **WHEN** se intenta guardar un ingreso con `member_id` de otro hogar
- **THEN** la operación se rechaza

#### Scenario: Ingreso sin dueño

- **WHEN** se registra un ingreso sin miembro
- **THEN** se guarda como ingreso del hogar y no aparece en los totales personales

#### Scenario: Servicio legado sin responsable

- **WHEN** el usuario intenta aplicar al mes un servicio con `paid_by = null`
- **THEN** la aplicación se bloquea con un mensaje que pide asignar un responsable y no se crea el gasto

### Requirement: Backfill del saldo de ahorro

La migración SHALL crear un movimiento de apertura por cada meta con
`saved_amount > 0`, con fecha de migración, `member_id = null` y el monto del
saldo existente. La suma de movimientos de cada meta SHALL ser igual a su
`saved_amount` después del backfill y la migración SHALL ser idempotente.

#### Scenario: Meta con saldo

- **WHEN** la migración procesa una meta con 500.000 ahorrados
- **THEN** crea un movimiento de apertura de 500.000 y el saldo de la meta no cambia

#### Scenario: Meta en cero

- **WHEN** la migración procesa una meta con `saved_amount = 0`
- **THEN** no crea un movimiento de apertura para esa meta

#### Scenario: Reejecución

- **WHEN** se vuelve a aplicar el backfill en local
- **THEN** no se crea un segundo movimiento de apertura para la misma meta

#### Scenario: Suma de movimientos

- **WHEN** se comparan `saved_amount` y la suma de movimientos de cada meta
- **THEN** los valores coinciden para todas las metas migradas

### Requirement: Índices y RLS para el nuevo ledger

La migración SHALL crear índices para las consultas por persona y fecha,
SHALL habilitar RLS en las tablas nuevas y SHALL definir políticas de
pertenencia al hogar y de privacidad de las metas personales.

#### Scenario: Índices presentes

- **WHEN** se inspecciona el esquema local
- **THEN** existen índices para gastos por hogar/pagador/fecha, ingresos por hogar/miembro/fecha, salarios por perfil/fecha y movimientos por hogar/miembro/fecha

#### Scenario: RLS en tablas nuevas

- **WHEN** un usuario autenticado consulta `savings_movements` o `savings_plans`
- **THEN** solo ve filas de su hogar y, en metas personales, solo las suyas

#### Scenario: Sin acceso anónimo

- **WHEN** se consulta una tabla nueva con la clave anónima
- **THEN** no se exponen datos y las políticas impiden la escritura

### Requirement: RPCs con pertenencia validada

Los RPCs nuevos SHALL ser `security definer`, SHALL fijar `search_path` y
SHALL validar `auth.uid()` y la pertenencia al hogar antes de devolver datos.
SHALL NOT permitir consultar el disponible o el historial de un miembro de otro
hogar. Los totales visibles de mes/ciclo/hogar se derivan de las filas cargadas
con RLS, no de un RPC duplicado.

#### Scenario: Disponible personal propio

- **WHEN** un miembro pide su disponible a una fecha
- **THEN** recibe el monto o `null` si no tiene base de ingresos, junto con su último pago real

#### Scenario: Disponible de otro hogar

- **WHEN** un usuario intenta pedir el disponible o el historial de un miembro de otro hogar
- **THEN** el RPC devuelve error o cero filas y no expone datos

#### Scenario: Historial personal y del hogar

- **WHEN** un miembro pide su historial mensual o el del hogar
- **THEN** recibe solo filas de su propio hogar y, en el historial personal, solo las de su perfil

### Requirement: Verificación de migración en local

Antes de abrir la PR SHALL ejecutarse una verificación sobre datos sembrados de
producción en local que compare counts, sumas y nulos antes y después, y que
pruebe las políticas nuevas con usuarios de dos hogares distintos.

#### Scenario: Seed local

- **WHEN** se corre `bash tools/seed-local/seed-local.sh -y` y luego la migración
- **THEN** la app local carga los datos y la auditoría no reporta diferencias de counts ni de sumas

#### Scenario: Dos hogares

- **WHEN** se crean dos hogares locales y se prueba el pagador cruzado
- **THEN** ninguna operación cruza datos entre hogares y las pruebas SQL pasan

#### Scenario: Dry run de producción

- **WHEN** se ejecuta `supabase db push --dry-run`
- **THEN** solo aparecen las migraciones nuevas y ninguna operación destructiva

### Requirement: Normalización idempotente de saldos reales

Las correcciones de datos de producción SHALL identificarse por IDs concretos,
SHALL verificar los totales antes de confirmar y SHALL ser no-op en local/CI
cuando no exista el estado de producción. SHALL NOT tocar otros hogares.

#### Scenario: Totales reales

- **WHEN** se aplica la normalización en producción
- **THEN** Charith queda en `1.872.700` después de su nómina (`12.900` antes), Jhonatan en `6.450` y el ahorro del hogar en `600.000`

#### Scenario: Entorno sin estado de producción

- **WHEN** la migración corre en local o CI sin los IDs de producción
- **THEN** no inserta ni modifica filas

#### Scenario: Dry run con rollback

- **WHEN** se prueba la normalización en producción dentro de una transacción con rollback
- **THEN** los totales calculados coinciden con los objetivos y los datos quedan intactos

### Requirement: Cierre del change anterior

El change `fix-datos-y-seguridad` SHALL cerrarse como no aplicable a la v2.0
antes de crear la rama de implementación. Sus tareas SHALL NOT implementarse en
este change y su carpeta no SHALL quedar como un change activo.

#### Scenario: Change anterior cerrado

- **WHEN** se inicia la implementación de la v2.0
- **THEN** `fix-datos-y-seguridad` ya no aparece como change activo y la decisión queda documentada en este change

#### Scenario: Sin arrastre de tareas

- **WHEN** se revisa la rama de la v2.0
- **THEN** no contiene implementación de las tareas de `fix-datos-y-seguridad` que no pertenecen al nuevo alcance
