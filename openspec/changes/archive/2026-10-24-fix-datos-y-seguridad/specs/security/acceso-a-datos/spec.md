# Spec Delta

## Purpose

Define quién puede crear un hogar, quién puede entrar a uno y con qué prueba, y
qué privilegios tiene cada rol (`anon`, `authenticated`) sobre las tablas y
funciones del esquema público, de modo que los permisos vivan en migraciones y
no en cambios manuales del dashboard.

## ADDED Requirements

### Requirement: Crear hogar solo como usuario autenticado

La política INSERT de `households` SHALL aplicar solo a `authenticated`, y el
rol `anon` SHALL NOT tener privilegios de escritura (`insert`, `update`,
`delete`) sobre las tablas del esquema público: solo `select`, sujeto a RLS. El
camino previsto para crear un hogar SHALL ser el RPC `create_household`.

#### Scenario: Anónimo intenta crear un hogar

- **WHEN** con la anon key se ejecuta `insert into public.households(name, invite_code)` como rol `anon`
- **THEN** la operación falla por permisos (42501) y no queda ninguna fila nueva

#### Scenario: Usuario autenticado crea su hogar

- **WHEN** un usuario autenticado llama `create_household('Casa')`
- **THEN** el hogar se crea, el usuario queda vinculado en `profiles.household_id` y se insertan sus categorías por defecto

#### Scenario: Anónimo no escribe en ninguna tabla

- **WHEN** se recorre el esquema público como rol `anon`
- **THEN** solo tiene `select` (y `execute` únicamente en lo que el proyecto decida exponer), sin `insert`, `update`, `delete` ni `truncate`

### Requirement: Unirse a un hogar exige un código válido

`profiles.household_id` SHALL cambiar solo por un RPC `security definer` que
valide el código de invitación y consuma su rate limit (10 intentos por usuario
cada 10 minutos, ventana compartida con `get_household_by_code`); el cliente
SHALL NOT poder cambiar `household_id` con un UPDATE directo sobre `profiles`.

#### Scenario: UPDATE directo para entrar a otro hogar

- **WHEN** un usuario autenticado intenta `update public.profiles set household_id = '<uuid de otro hogar>' where id = auth.uid()`
- **THEN** la operación falla por permisos de columna (42501) y el perfil conserva su hogar

#### Scenario: Unión con código válido

- **WHEN** un usuario autenticado llama `join_household_by_code('<código del hogar>')`
- **THEN** su `profiles.household_id` queda en ese hogar y el intento queda contado en `invite_lookup_attempts`

#### Scenario: Código inexistente o límite superado

- **WHEN** el código no existe o el usuario supera 10 intentos en 10 minutos
- **THEN** el RPC no cambia el hogar y devuelve el mensaje de código inválido o de demasiados intentos, sin revelar si el hogar existe

#### Scenario: Ex-miembro que conoce el UUID

- **WHEN** alguien que conoce el UUID del hogar (ex-miembro, captura de pantalla, dump) intenta re-entrar sin código
- **THEN** no logra vincularse: no hay camino de escritura de `household_id` que no pase por la validación del código

### Requirement: Alcance de eliminar un hogar

Eliminar el hogar SHALL seguir siendo una acción de cualquier miembro actual
(el modelo no tiene propietario) y SHALL borrar en cascada gastos, salarios,
categorías, metas, servicios y facturas, dejando a los demás miembros sin hogar
para crear uno nuevo o unirse con otro código.

#### Scenario: Un miembro elimina el hogar

- **WHEN** un miembro actual confirma "Eliminar hogar"
- **THEN** los datos del hogar desaparecen en cascada y los guardas llevan a los demás miembros a `/setup`
