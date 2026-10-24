# Spec Delta

## ADDED Requirements

### Requirement: Ventana de mes en curso TZ-segura

El sistema SHALL calcular la ventana de mes en curso como el rango inclusivo
desde el primer día del mes calendario hasta la fecha de consulta, usando las
utilidades de `src/shared/lib/dates.ts` con fechas construidas al mediodía
local. SHALL NOT usar `Date.UTC` con getters locales ni comparar fechas ISO en
crudo.

#### Scenario: 24 de octubre

- **WHEN** la fecha de consulta es 2026-10-24
- **THEN** la ventana es 2026-10-01 a 2026-10-24, ambos inclusive

#### Scenario: Cambio de mes

- **WHEN** la fecha de consulta es 2026-11-01
- **THEN** la ventana es 2026-11-01 a 2026-11-01 y no incluye gastos de octubre

#### Scenario: Zona horaria UTC−5

- **WHEN** el navegador está en America/Bogota y la fecha local es 2026-10-01
- **THEN** la ventana incluye los gastos del 1 de octubre y no se corre al 30 de septiembre por UTC

### Requirement: Ventana desde el último pago

El sistema SHALL calcular la ventana desde el último pago como el rango
inclusivo desde la fecha de inicio hasta la fecha de consulta. La fecha de
inicio SHALL ser el último `salaries.pay_date` real menor o igual a la consulta;
si no existe, SHALL ser el `profiles.payday` configurado para el mes de consulta
o el mes anterior si el día aún no llegó.

#### Scenario: Pago real

- **WHEN** el último `pay_date` es 2026-09-30 y la consulta es 2026-10-02
- **THEN** la ventana es 2026-09-30 a 2026-10-02

#### Scenario: Pago configurado

- **WHEN** no hay nóminas registradas, el `payday` es 15 y la consulta es 2026-10-20
- **THEN** la ventana es 2026-10-15 a 2026-10-20

#### Scenario: Pago configurado aún no llega

- **WHEN** no hay nóminas registradas, el `payday` es 25 y la consulta es 2026-10-10
- **THEN** la ventana empieza el 2026-09-25

#### Scenario: Nómina atrasada

- **WHEN** la nómina de septiembre tiene `pay_date = 2026-10-01` y la consulta es 2026-10-03
- **THEN** la ventana empieza el 2026-10-01 y no el 2026-09-30

### Requirement: Recorte del día de pago al fin de mes

Cuando el `payday` configurado sea mayor que el último día del mes, la fecha de
inicio SHALL recortarse al último día del mes. El cálculo SHALL funcionar para
febrero, años bisiestos y meses de 30 o 31 días.

#### Scenario: Día 31 en febrero

- **WHEN** el `payday` es 31 y el mes es febrero de 2026
- **THEN** la fecha de inicio es 2026-02-28

#### Scenario: Día 31 en febrero bisiesto

- **WHEN** el `payday` es 31 y el mes es febrero de 2028
- **THEN** la fecha de inicio es 2028-02-29

#### Scenario: Día 31 en abril

- **WHEN** el `payday` es 31 y el mes es abril de 2026
- **THEN** la fecha de inicio es 2026-04-30

### Requirement: Etiquetas de rango legibles

Las ventanas SHALL mostrarse con etiquetas legibles en español de Colombia y
SHALL incluir las fechas de inicio y fin cuando la ventana cruce dos meses o
cuando el usuario necesite entender el cálculo.

#### Scenario: Ventana dentro del mes

- **WHEN** la ventana es 2026-10-01 a 2026-10-24
- **THEN** la etiqueta puede mostrar “1–24 de octubre” y no una fecha ISO

#### Scenario: Ventana que cruza meses

- **WHEN** la ventana es 2026-09-30 a 2026-10-02
- **THEN** la etiqueta muestra ambas fechas y aclara que cruza septiembre y octubre
