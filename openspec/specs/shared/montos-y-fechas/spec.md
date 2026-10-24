# shared/montos-y-fechas Specification

## Purpose
Unifica la lectura y la presentación de dinero y fechas en toda la app: los
montos se interpretan con la convención colombiana (`parseMoneyInput`) y se
muestran con `formatCurrency`, y las fechas se pintan en español de Colombia
(`es-CO`) en lugar de ISO en crudo.

## Requirements

### Requirement: Montos interpretados con la convención colombiana

Todo texto que represente un monto en pesos SHALL interpretarse con
`parseMoneyInput` (puntos = miles, coma = decimales), sin `Number()` ni
`parseFloat` sobre el texto formateado, y SHALL mostrarse con `formatCurrency`.

#### Scenario: Total de factura "20.500"

- **WHEN** la réplica del ticket recibe `total = "20.500"`
- **THEN** el TOTAL se muestra como `$20.500` (no `$21`)

#### Scenario: Total que coincide con la suma de items

- **WHEN** `total = "20.500"` y la suma de items es `20500`
- **THEN** no se muestra el aviso de discrepancia "Suma de items"

#### Scenario: Monto con decimales

- **WHEN** el campo recibe `"2.500.000,50"`
- **THEN** se interpreta como `2500000.5` y se muestra con `formatCurrency` en formato COP

### Requirement: Fechas y meses en español de Colombia

Las fechas y los meses mostrados al usuario SHALL usar las utilidades de
`src/shared/lib/dates.ts` con locale `es-CO` (`formatDate`, `monthLabel`,
`shortMonthLabel`); ninguna pantalla SHALL pintar una fecha ISO (`YYYY-MM-DD`)
en crudo ni usar otro locale (p. ej. `es-MX`).

#### Scenario: Fecha objetivo de una meta

- **WHEN** una meta tiene `target_date = "2026-11-30"`
- **THEN** la tarjeta muestra "30 nov" (formato `es-CO`) y no `2026-11-30`

#### Scenario: Vencimiento de un servicio en el wizard

- **WHEN** el wizard de servicios lista un pendiente con `next_due_date`
- **THEN** la fecha se muestra con `formatDate` en español, no en ISO
