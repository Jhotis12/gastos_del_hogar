# Spec Delta

## Purpose

Cada mutación deja las lecturas derivadas consistentes: invalida su propia clave
y las claves que dependen del dato cambiado, igual que el mapa de Realtime, para
que la caché del cliente no muestre datos viejos hasta la recarga.

## ADDED Requirements

### Requirement: Invalidación de claves dependientes

Toda mutación SHALL invalidar, además de su clave de dominio, las claves cuyas
lecturas derivan del dato cambiado — borrar o renombrar una categoría invalida
`['categories']`, `['expenses']` y `['budgets']`; borrar un presupuesto invalida
`['budgets']` — sin depender de que llegue un evento de Realtime.

#### Scenario: Borrar una categoría con gastos

- **WHEN** el usuario borra una categoría que tiene gastos asociados (el FK deja los gastos sin categoría)
- **THEN** la lista de gastos cacheada deja de mostrar esa categoría sin recargar la página y sin esperar a Realtime

#### Scenario: Quitar un presupuesto

- **WHEN** el usuario quita un presupuesto mensual
- **THEN** la tarjeta de presupuestos de la categoría se actualiza sin recargar
