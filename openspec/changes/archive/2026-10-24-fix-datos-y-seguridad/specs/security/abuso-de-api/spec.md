# Spec Delta

## Purpose

Evita que el análisis de facturas (que descarga imágenes con `service_role` y
consume la cuota de Gemini) se pueda usar sin límite desde una cuenta
autenticada.

## ADDED Requirements

### Requirement: Límite de análisis por usuario

La Edge Function `analyze-receipt` SHALL registrar cada análisis por usuario y
SHALL rechazar con `429` y un mensaje claro cuando el usuario supere **20
análisis en 24 horas**, sin llamar al proveedor de IA en ese caso. El registro
SHALL ser accesible solo con `service_role` (RLS habilitada sin políticas) y
SHALL limpiarse por ventana, sin crecer sin límite.

#### Scenario: Uso normal

- **WHEN** un usuario analiza 3 facturas en un día
- **THEN** las 3 se procesan y quedan registradas a su nombre

#### Scenario: Límite superado

- **WHEN** el usuario supera 20 análisis en 24 horas
- **THEN** la función responde `429` con el mensaje del límite y no invoca a Gemini

#### Scenario: Petición sin sesión válida

- **WHEN** llega una petición sin JWT válido
- **THEN** la función responde `401` como hoy, sin consultar ni escribir el registro de intentos
