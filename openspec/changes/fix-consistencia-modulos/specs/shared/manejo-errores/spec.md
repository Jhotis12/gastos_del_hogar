# Spec Delta

## Purpose

Garantiza que todo fallo de una mutación o de una consulta sea visible y
explicado al usuario, con el mismo patrón en todos los módulos: sin rechazos
sin manejar, sin acciones que no hacen nada en silencio y con el aviso emitido
en el punto de uso.

## ADDED Requirements

### Requirement: Mutaciones sin rechazos sin manejar

Toda acción de la UI que dispare una mutación SHALL manejar su error con
`try/catch` (o `onError`) y mostrar `toast.error(errorMessage(err))`; ninguna
promesa de mutación SHALL quedar sin `catch` ni producir un rechazo sin
manejar.

#### Scenario: Cambiar el estado de un deseo sin red

- **WHEN** el usuario pulsa "Compré", "Descartar" o "Volver a pendiente" sin conexión
- **THEN** no queda ninguna promesa rechazada sin manejar y se muestra un toast con el mensaje de la causa ("Sin conexión: vuelve a intentarlo cuando estés en línea" u otro)

#### Scenario: Fallo al salir o eliminar el hogar

- **WHEN** `leaveHousehold` o `deleteHousehold` falla (RLS, red o servidor)
- **THEN** el diálogo permanece abierto, se muestra `toast.error(errorMessage(err))` y no queda una promesa rechazada sin manejar

### Requirement: Consultas con error visible

Toda página o tarjeta que consuma una query SHALL renderizar `<QueryError/>`
(con acción de reintento) cuando la query esté en error, en lugar de texto
casero, un `return null` o un mensaje que sugiera una acción equivocada.

#### Scenario: Fallo al cargar los ingresos extra

- **WHEN** `useIncomes` devuelve `error` en la tarjeta "Otros ingresos del mes"
- **THEN** la tarjeta muestra `<QueryError/>` con reintento en vez del párrafo "No se pudieron cargar los otros ingresos"

#### Scenario: Fallo en el widget de proyección

- **WHEN** `useForecast` devuelve `error` dentro de `ForecastWidget`
- **THEN** el widget no desaparece: muestra un estado de error con acción de reintento

#### Scenario: Perfil sin poder leer el hogar

- **WHEN** `useHousehold` falla en la página Perfil
- **THEN** se muestra `<QueryError/>` con reintento y NO el texto "Sin hogar — ve a /setup para crear o unirte"

### Requirement: Aviso en el punto de uso

Los hooks de datos SHALL NOT emitir toasts; el aviso de éxito o error SHALL
emitirlo el componente que usa la mutación, para que el mismo fallo se vea
igual en todos los módulos.

#### Scenario: Día de pago actualizado

- **WHEN** el usuario cambia el día de pago y la mutación tiene éxito o falla
- **THEN** el toast lo emite `Members.tsx` (página) y `useUpdatePayday` no importa ni usa `useToast`

### Requirement: Entrada inválida con mensaje

Cuando un formulario no pueda interpretar el valor ingresado SHALL mostrar un
mensaje (toast o error del campo) y SHALL NOT terminar en silencio sin guardar
ni avisar.

#### Scenario: Presupuesto con monto ilegible

- **WHEN** el usuario confirma un presupuesto cuyo monto no se puede interpretar (`parseMoneyInput` devuelve `null`)
- **THEN** se muestra `toast.error('Ingresa un monto válido…')` (o el error del campo) y el modal no se cierra fingiendo éxito

### Requirement: Borrados con confirmación

Toda acción destructiva de la UI SHALL pedir confirmación con `ConfirmDialog`
antes de ejecutarse, igual que el resto de los borrados del proyecto.

#### Scenario: Quitar un presupuesto

- **WHEN** el usuario pulsa "Quitar presupuesto"
- **THEN** se abre `ConfirmDialog` con el nombre de la categoría y solo al confirmar se ejecuta el borrado

### Requirement: Navegación por guards, no por componentes

Los formularios y pantallas SHALL NOT llamar `navigate()` para cambiar de ruta
tras una acción: la ruta la deciden los guards de `App.tsx` a partir del estado
de sesión y perfil.

#### Scenario: Contraseña restablecida

- **WHEN** el usuario guarda su contraseña nueva en `/recuperar`
- **THEN** se muestra el toast de éxito y el destino lo resuelve el guard correspondiente; `Recover.tsx` no invoca `navigate('/')`
