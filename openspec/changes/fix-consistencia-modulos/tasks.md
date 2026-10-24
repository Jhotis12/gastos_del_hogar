# Tasks

## 1. Errores visibles en los módulos

- [x] 1.1 Envolver los 3 botones de estado de `Wishlist.tsx` (`:309`, `:316`, `:326`) en `try/catch` con `toast.error(errorMessage(err))` y verificar sin red que al pulsar "Compré"/"Descartar"/"Volver a pendiente" aparece el toast "Sin conexión…" y la consola no registra rechazos sin manejar
- [x] 1.2 Envolver `leaveHousehold` y `deleteHousehold` en `Profile.tsx` (`:547`, `:567`) con `try/catch` + toast, dejando el diálogo abierto al fallar, y verificar con la mutación fallando (offline) que se ve el toast y el diálogo sigue ahí para reintentar
- [x] 1.3 Renderizar `<QueryError/>` con reintento en `IncomeSection.tsx`, `ForecastWidget.tsx` (hoy `return null`) y en el `useHousehold` de `Profile.tsx` (hoy "Sin hogar — ve a /setup") y verificar cada caso forzando el error (sin red y sin caché) que se ve el error con botón de reintento y no el texto anterior
- [x] 1.4 Quitar `useToast` de `useUpdatePayday` (`useMembers.ts`) y emitir el toast de día de pago desde `Members.tsx`, y verificar que `grep -n useToast src/modules/members/hooks/useMembers.ts` no devuelve nada y que cambiar el día de pago sigue avisando
- [x] 1.5 En `BudgetModal.tsx`, avisar con `toast.error('Ingresa un monto válido…')` cuando `parseMoneyInput` devuelve `null` (hoy retorno silencioso) y pedir confirmación con `ConfirmDialog` para "Quitar presupuesto"; verificar que un monto ilegible avisa sin cerrar el modal y que quitar un presupuesto pide confirmación antes de borrar
- [x] 1.6 Quitar la llamada `navigate('/', { replace: true })` de `Recover.tsx:57` y verificar con el enlace de recuperación (Mailpit local) que tras guardar la contraseña el guard lleva al destino correcto (`/` con hogar, `/setup` sin él) y que `grep -n "navigate('/" src/modules/auth/Recover.tsx` no devuelve la redirección post-guardado

## 2. Montos y fechas

- [x] 2.1 En `ReceiptResult.tsx:126,129` interpretar el total con `parseMoneyInput` (y comparar en número contra `itemsTotal`), y verificar con una réplica de total `"20.500"` e items que suman `20500` que el TOTAL dice `$20.500` y no aparece el aviso "Suma de items"
- [x] 2.2 Cambiar `formatDate` a locale `es-CO` (`dates.ts:38`) y usar la utilidad en `Savings.tsx:137` y `ApplyRecurringModal.tsx:88`; verificar que una meta con `target_date = 2026-11-30` muestra "30 nov", que el wizard muestra la fecha en español y que `pnpm build` sigue sin errores

## 3. Accesibilidad y consistencia visual

- [x] 3.1 Asociar etiqueta al nombre de registro en `Login.tsx:278` (`id` + `htmlFor` real), a `MoneyInput` (prop de etiqueta accesible usada por sus formularios), a los campos de `ExpenseForm.tsx` y al buscador de `Expenses.tsx`; verificar en el panel de accesibilidad del navegador que cada campo tiene nombre y que no queda ningún `htmlFor` apuntando a un `id` inexistente
- [x] 3.2 Subir a contraste AA los textos señalados por la auditoría: `EmptyState.tsx:27-28`, `Members.tsx:192` ("Sin salario") y el texto de `CategoryBadge.tsx` (token del tema sobre el tinte, no el hex de la categoría); verificar el ratio ≥4.5:1 calculado sobre los tokens en ambos temas (dejar el cálculo en la PR) y revisar visualmente las pantallas tocadas
- [x] 3.3 Subir a `min-h-11` (44px) las acciones con `min-h-8/9/10` (`Categories.tsx:131`, `Expenses.tsx:191`, `Savings.tsx:186`, `Wishlist.tsx:310`, `Members.tsx:197` y chips de filtro) y verificar con `node tests/check-mobile.mjs` sin desbordes y midiendo en DevTools un área táctil ≥44px
- [x] 3.4 Dar `role="dialog"`, `aria-modal`, `Escape` y foco al abrir/cerrar a los overlays propios (`Expenses.tsx:347`, `Layout.tsx:245` sheet "Más"); verificar con teclado que `Escape` cierra y el foco vuelve al botón que abrió, y que `check-mobile.mjs` + `e2e-mobile.mjs` siguen verdes
- [x] 3.5 Agregar el FAB de gasto al Dashboard móvil reutilizando `Fab` y el `ExpenseForm` de quick-add, con `aria-label` distinto al del botón de header (`"Agregar gasto rápido"` no: ese selector lo usa `e2e-flow.mjs:517`); verificar a 375px que el FAB abre el formulario, que `check-mobile.mjs` no reporta desbordes y que el paso de quick-add del e2e sigue pasando
- [x] 3.6 Extraer `fieldClass` a `src/shared/components/ui/fieldClass.ts` y reemplazar las 8 copias (`Setup.tsx:6`, `ExpenseForm.tsx:28`, `ReceiptResult.tsx:15`, `IncomeSection.tsx:21`, `Profile.tsx:43`, `GoalForm.tsx:11`, `ServiceForm.tsx:16`, `WishlistItemForm.tsx:17`) más el campo del modal de `Categories.tsx:168`; verificar con `grep -rn "w-full rounded-xl border border-slate-200" src/` que solo queda la definición compartida y que los formularios se ven igual en claro y oscuro

## 4. Un solo aviso offline

- [x] 4.1 Exportar `OFFLINE_QUEUED` en `offlineSafe.ts` y hacer que `runWithOfflineFallback` lo resuelva en la vía offline (en vez de `undefined as T`); verificar que `pnpm build` marca cualquier consumidor del resultado que no contemple el sentinel
- [x] 4.2 Condicionar el toast de éxito de las páginas offline-capaces (`Expenses.tsx:91,94`, `Dashboard.tsx:58`, `Calendar.tsx:87`, `IncomeSection.tsx:76,79`, `Members.tsx:71`, `Expenses.tsx:316`) a que el resultado no sea `OFFLINE_QUEUED`; verificar sin red que al crear un gasto solo se ve "Guardado sin conexión" (no "Gasto registrado") y que con red sigue apareciendo la confirmación
- [x] 4.3 Ampliar el paso e2e "registros sin conexión y sincronización al reconectar" (`tests/e2e-flow.mjs:514`) para afirmar que, sin red, tras crear el gasto NO aparece el toast "Gasto registrado"; verificar `node tests/e2e-flow.mjs` verde y que la suite sigue teniendo 47 pasos

## 5. Documentación y specs alineados

- [x] 5.1 Restaurar §4 (modelo de datos) y §5 (seguridad) de `ARQUITECTURA.md` desde `git show 46d5511:ARQUITECTURA.md` y refrescarlas contra `supabase/migrations/` (agregar `wishlist_items`, `incomes`, `salaries.pay_date`, `initial_payment`; quitar lo que ya no exista); verificar que las 10 secciones están numeradas sin huecos y que ningún "ver §N" apunta a una sección inexistente
- [x] 5.2 Corregir las ubicaciones desviadas de `ARQUITECTURA.md` (`useToast` en `components/ui`, sheet "Más" con el menú completo, `Terms.tsx`/`Privacy.tsx` en el módulo `auth`) y agregar wishlist a la lista de dominios que requieren red en §6; verificar cada punto con `grep` contra el código
- [x] 5.3 En `AGENTS.md`, listar las 8 skills de `.agents/skills/` (agregar `mobile-app-ui-design`, `pwa-development` y `supabase-postgres-best-practices`); verificar que la lista del documento coincide con `ls .agents/skills/`
- [x] 5.4 Quitar de `.github/workflows/ci.yml` el comentario que afirma que `master` está protegida y explicar que el flujo se cumple por convención + CI (como `README.md:270`); verificar que `grep -rn "protegida" .github/` no devuelve afirmaciones de branch protection

## 6. Verificación de integración

- [x] 6.1 Resetear el sandbox (`SUPABASE_SERVICE_ROLE=… bash tests/reset-sandbox.sh`) y correr `node tests/e2e-flow.mjs` con el dev server arriba: 47 pasos verdes, sin redirecciones raras ni toasts duplicados
- [x] 6.2 Correr `node tests/check-mobile.mjs` y `node tests/e2e-mobile.mjs` y verificar que no hay desbordes a 375/320px y que sheets/arrastres siguen funcionando
- [x] 6.3 Correr `pnpm build`, `pnpm lint` y `openspec validate fix-consistencia-modulos --strict` y verificar los tres sin errores

## 7. Git y PR

- [x] 7.1 Crear la rama desde master (`git checkout -b fix/consistencia-modulos`) y verificar con `git branch --show-current` que no se trabaja en `master`
- [ ] 7.2 Hacer commits por bloques lógicos con la convención del repo (`fix:`, `docs:`, `chore:`) y verificar con `git log --oneline master..HEAD` que no hay un commit gigante mezclando temas
- [ ] 7.3 Subir la rama con `git push -u origin fix/consistencia-modulos` y verificar que la rama remota existe
- [ ] 7.4 Abrir la PR con `gh pr create --base master --fill` (si `gh` no está autenticado, pasar la URL de compare al usuario) y verificar que la PR queda abierta contra `master`
- [ ] 7.5 Verificar `CI` y `E2E` en verde (`gh pr checks`); si algún test no se pudo correr en local, dejarlo dicho explícitamente en la PR

## Workflow follow-up

- Jhotis12 revisa, aprueba y mergea la PR; el agente no mergea.
- Tras el merge: archivar el change en una rama nueva (`chore/archive-fix-consistencia-modulos`) desde master, con `openspec archive fix-consistencia-modulos` y PR con `gh`.
