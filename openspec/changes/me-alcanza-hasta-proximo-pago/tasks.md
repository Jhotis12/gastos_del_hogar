# Tasks

## 1. Fechas y motor puro

- [x] 1.1 Agregar `nextPaydayDate` y `daysBetween` a `src/shared/lib/periods.ts`; cubrir nómina real, sin nómina, hoy día de pago, fin de mes y bisiesto en `tests/unit/periods.test.ts`; verificar con `pnpm test`
- [x] 1.2 Agregar en `src/modules/forecast/lib/forecast.ts` las funciones puras `variableRangeFromMonths`, `scaleRangeToDays`, `fixedCommitmentsUntil`, `savingsCommitmentsUntil`, `projectCycle` y `dailyBudget`; verificar con `pnpm build`
- [x] 1.3 Escribir `tests/unit/forecast.test.ts` con fórmula, veredicto alcanza/no alcanza/ajustado, rango, meses en cero y menos de 2 meses; verificar con `pnpm test`
- [x] 1.4 Agregar el caso de servicio convertido a recurrente (exclusión del baseline variable) en `tests/unit/forecast.test.ts`; verificar con `pnpm test`
- [x] 1.5 Eliminar de `forecast.ts` las funciones y tipos que ya no se usan (`fixedExpensesForMonth`, `monthlySurplusProjection`, `savingsInMonths`, `averageFromSurpluses`, `MonthlySurplus` y `FixedExpenseItem` si no se reutilizan); verificar con `pnpm build` y `rg` de que no quedan imports

## 2. Datos y hook

- [x] 2.1 Ampliar `useVariableHistory` para seleccionar `description` y `category_id`, construir la ventana completa de meses con ceros y excluir los gastos que coinciden con servicios recurrentes; verificar con `pnpm test` las funciones puras y con `pnpm dev` que `/proyeccion` carga sin errores
- [x] 2.2 Agregar `useFutureIncomesUntil(from, to)` en `useForecast.ts` con clave `['incomes', 'future', ...]`; verificar con `pnpm build` y que el request aparece en la pestaña Network al abrir `/proyeccion`
- [x] 2.3 Reescribir `useForecast` para usar `useMemberAvailable`, `useRecurringExpenses`, `useSavingsPlans`, `useSavingsGoals`, `useSalaries` (mes actual y siguiente), `useVariableHistory` y `useFutureIncomesUntil`; eliminar `usePersonalMonthlyHistory` y `useExtraIncomeHistory`; verificar con `pnpm build` y `/proyeccion` local
- [x] 2.4 Calcular en `useForecast` el próximo pago, días restantes, compromisos, rango variable y veredicto usando las funciones puras; verificar con `pnpm test` y una inspección manual de los valores en local
- [x] 2.5 Cambiar `useApplyRecurringOne` para invalidar `LEDGER_INVALIDATION.expenses` más `['recurring']`; verificar aplicando un servicio en local y comprobando que el hero de Inicio y `/proyeccion` se actualizan sin recargar

## 3. UI

- [x] 3.1 Reemplazar el header y el hero de `Forecast.tsx` por "¿Me alcanza?" / "Hasta tu próximo pago · [fecha]", veredicto textual, saldo o faltante, rango y gasto diario; verificar en `/proyeccion` con datos locales y `pnpm build`
- [x] 3.2 Agregar la tarjeta de desglose (disponible, ingresos antes del pago, servicios, autoahorro y variables); verificar que la suma de las líneas coincide con el saldo esperado del hero
- [x] 3.3 Agregar la tarjeta de compromisos (servicios con fecha, monto y aviso de vencido; planes de autoahorro con meta y día) y la línea de "ahorro ya apartado"; verificar con un servicio y un plan creados en local
- [x] 3.4 Implementar los estados sin base de ingresos, preliminar, ajustado, sin compromisos y error/carga; verificar cada estado con datos locales o mocks y que ninguno muestra un `$0` engañoso
- [x] 3.5 Retirar el selector 1/3/6, la tarjeta de promedio, el gráfico y las tarjetas de fijos/ingresos del mes siguiente; verificar que no aparecen en `/proyeccion` y que el promedio sigue en Historial
- [x] 3.6 Revisar accesibilidad y mobile del nuevo contenido (texto del veredicto, `aria-label`, foco, `min-h-11`, sin overflow a 320/375); verificar con `node tests/check-mobile.mjs`
- [x] 3.7 Agregar un paso a `tests/e2e-flow.mjs` que abra "Mi proyección" y verifique el hero, el desglose y la ausencia del selector 1/3/6; verificar con `node tests/e2e-flow.mjs`
- [x] 3.8 Actualizar el comentario de `tests/check-mobile.mjs` que menciona el selector de horizonte de Proyección; verificar con `node tests/check-mobile.mjs`
- [x] 3.9 Actualizar `ARQUITECTURA.md` (descripción del módulo forecast y de la pantalla de Proyección); verificar el diff y que la descripción coincide con la nueva pantalla

## 4. Integración y aceptación

- [x] 4.1 Correr la suite local completa con Supabase local, dev server y sandbox reseteados: `pnpm build`, `pnpm lint`, `pnpm test`, `node tests/e2e-flow.mjs` y `node tests/check-mobile.mjs`; verificar todo en verde
- [x] 4.2 Recorrer el checklist manual de aceptación: con nómina, sin nómina, hoy día de pago, servicio vencido, servicio ya aplicado, plan ejecutado y pendiente, menos de 2 meses de variables y disponible negativo; verificar que cada estado muestra el mensaje y los números esperados

## 5. Git y PR

- [x] 5.1 Crear la rama `feat/me-alcanza-hasta-proximo-pago` desde `master`; verificar con `git branch --show-current`
- [x] 5.2 Hacer commits por bloques lógicos con la convención del repo (`feat`, `fix`, `test`, `docs`); verificar con `git log --oneline -5`
- [x] 5.3 Hacer push de la rama; verificar con `git push -u origin feat/me-alcanza-hasta-proximo-pago`
- [x] 5.4 Abrir la PR con `gh pr create --base master --fill`; verificar la URL y que la PR tenga los checks `CI` y `E2E`
- [x] 5.5 Si CI falla, corregir y volver a pushear; verificar que `CI` y `E2E` queden en verde

## Workflow follow-up

- Jhotis12 revisa, aprueba y mergea la PR; el agente no mergea.
- Después del merge, archivar en una rama nueva `chore/archive-me-alcanza-hasta-proximo-pago` desde `master`, ejecutar `openspec archive me-alcanza-hasta-proximo-pago`, verificar specs sincronizadas y el move a `openspec/changes/archive/`, y abrir PR; esperar el merge de Jhotis12.
- No hay migraciones que aplicar a producción; si apareciera alguna, se aplica solo por el workflow al mergear a master.
- Si algún test no se pudo correr en local, decirlo explícitamente en la PR.
