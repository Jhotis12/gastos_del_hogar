# Spec Delta

## Purpose

Garantiza que un entorno reconstruido desde migraciones (local, CI, disaster
recovery) tenga el mismo esquema, políticas e índices que producción, para que
el CI detecte de verdad las regresiones de la capa de datos.

## ADDED Requirements

### Requirement: Bucket de facturas reproducible desde migraciones

Una migración SHALL crear de forma idempotente el bucket `receipts` (privado,
límite 8 MB, solo `image/jpeg`, `image/png`, `image/webp`) y sus políticas sobre
`storage.objects` — subir y leer, las dos que existen en producción —
restringidas al prefijo `{household_id}/` del hogar del usuario autenticado.

#### Scenario: Base limpia puede subir facturas

- **WHEN** se corre `supabase db reset --local` y un usuario autenticado sube una imagen a `{su household_id}/factura.jpg`
- **THEN** la subida funciona y la Edge Function puede descargarla

#### Scenario: Otra ruta queda bloqueada

- **WHEN** un usuario autenticado intenta subir o leer una ruta cuyo primer segmento no es su `household_id`
- **THEN** la operación falla por RLS

#### Scenario: Reaplicar sobre un entorno existente

- **WHEN** la migración se aplica a producción, donde el bucket y las políticas ya existen
- **THEN** no falla ni duplica políticas, y los límites del bucket quedan con los valores del proyecto

### Requirement: Índices declarados en migraciones

Los índices que usan las consultas del cliente SHALL estar declarados en
migraciones, no solo en producción: `wishlist_items.household_id`,
`expenses.receipt_id` y `receipts.household_id`.

#### Scenario: Paridad de índices

- **WHEN** se recrea la base desde migraciones y se comparan los índices de esas tres tablas con producción
- **THEN** los tres índices existen en ambos entornos

### Requirement: Restricciones alineadas con producción

Las restricciones que producción ya aplica SHALL reproducirse en migraciones;
en particular `receipts.parsed_data` SHALL ser `not null default '{}'` y el
tipo del cliente SHALL reflejarlo.

#### Scenario: Factura recién subida sin análisis

- **WHEN** se inserta una fila en `receipts` sin `parsed_data` (recién subida, antes del análisis)
- **THEN** la fila queda con `'{}'` y el visor de factura no falla al abrirla

#### Scenario: Relleno sin pérdida

- **WHEN** la migración se aplica sobre filas existentes con `parsed_data` nulo (si las hay)
- **THEN** esas filas quedan con `'{}'` y la migración termina sin error
