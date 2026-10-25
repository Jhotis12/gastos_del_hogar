# Tasks

## 1. Cierre del change anterior y preparación

- [x] 1.1 Cerrar `fix-datos-y-seguridad` como no aplicable: archivado en `openspec/changes/archive/2026-10-24-fix-datos-y-seguridad` con `openspec archive fix-datos-y-seguridad --skip-specs -y --no-validate`; verificar con `openspec list --json` que ya no aparece como change activo
- [x] 1.2 Volver a `master`, confirmar árbol limpio y crear la rama `feat/v2-finanzas-personales`; verificar con `git status --short --branch` y `git branch --show-current`
- [x] 1.3 Sembrar datos de producción en local con `bash tools/seed-local/seed-local.sh -y`; verificar que la app local carga el hogar y los datos sin errores
- [x] 1.4 Guardar la auditoría pre-migración en `/tmp/opencode/v2-audit-pre.txt` con counts y sumas de `expenses`, `salaries`, `incomes` y `savings_goals`, más counts de `paid_by`/`member_id` nulos; verificar que el archivo existe y que las consultas corren en local
- [x] 1.5 Correr la línea base en `master` (`pnpm build`, `pnpm lint`, `node tests/e2e-flow.mjs`) y anotar el resultado; verificar que los comandos terminan sin errores antes de cambiar código

## 2. Migración 1: integridad del ledger

- [x] 2.1 Crear la migración de RLS de `expenses` para exigir pagador no nulo del mismo hogar en INSERT/UPDATE; verificar en SQL que un gasto con `paid_by = null` falla, uno con perfil de otro hogar falla y uno con miembro del hogar pasa
- [x] 2.2 Crear la migración de integridad para `incomes.member_id` y `recurring_expenses.paid_by` (nulo permitido solo como `Hogar`/legado, no nulo debe ser del mismo hogar); verificar con inserts válidos, nulos y cruzados entre dos hogares
- [x] 2.3 Agregar índices `expenses(household_id, paid_by, expense_date)`, `incomes(household_id, member_id, income_date)` y `salaries(profile_id, pay_date desc)`; verificar con `\di` que existen
- [x] 2.4 Probar el borrado de un perfil con gastos y ajustar la FK si el `SET NULL` choca con la nueva política; verificar el comportamiento elegido con un usuario de prueba y documentarlo en `design.md`
- [x] 2.5 Crear `tests/db/ledger-integrity.sql` con dos hogares y dos miembros que pruebe pagador nulo, pagador cruzado, ingreso cruzado y servicio sin responsable; verificar que el script pasa con `psql` contra Supabase local
- [x] 2.6 Repetir la auditoría post-migración y comparar con `/tmp/opencode/v2-audit-pre.txt`; verificar que counts y sumas de las tablas existentes no cambian
- [x] 2.7 Ejecutar `supabase db reset --local` y `supabase migration up --local`; verificar que las migraciones aplican en orden y la app local arranca

## 3. Migración 2: ahorro con movimientos

- [x] 3.1 Crear `savings_movements` y `savings_plans`, agregar `savings_goals.owner_id` y `savings_goals.archived_at`, con checks, FKs e índices; verificar con `\d savings_movements`, `\d savings_plans` y `\d savings_goals`
- [x] 3.2 Backfillear un movimiento `opening` por cada meta con `saved_amount > 0`, con fecha de migración y `member_id = null`, de forma idempotente; verificar que `sum(movements.amount) = saved_amount` para todas las metas y que una segunda ejecución no duplica
- [x] 3.3 Crear el trigger que recalcula `savings_goals.saved_amount` desde los movimientos en INSERT/UPDATE/DELETE; verificar depositando, retirando y borrando un movimiento de prueba
- [x] 3.4 Crear las políticas RLS de metas personales (`owner_id`), metas compartidas (`owner_id = null`), movimientos y planes; verificar con A y B que A no lee la meta personal de B y que ambos ven una meta compartida
- [x] 3.5 Agregar `savings_movements` y `savings_plans` a la publicación `supabase_realtime`; verificar con `select * from pg_publication_tables where pubname='supabase_realtime'`
- [x] 3.6 Crear `tests/db/savings.sql` con backfill, trigger, límite de retiro por aporte, meta personal privada y meta compartida; verificar que pasa en local
- [x] 3.7 Repetir la auditoría de ahorro antes/después y comparar `saved_amount` y suma de movimientos; verificar que no se perdió ningún saldo ni movimiento

## 4. Migración 3: RPCs, permisos y compatibilidad

- [x] 4.1 Implementar `get_member_available(p_as_of date)` con ingresos, gastos pagados y ahorro neto, devolviendo `available` nullable, `income_basis` y último `pay_date`; verificar con un miembro con ingresos, uno sin ingresos y uno con ahorro
- [x] 4.2 Implementar `get_personal_monthly_history()` con meses, ingresos, gastos, ahorro, libre y acumulado; verificar que el último acumulado coincide con el disponible del RPC 4.1 a la misma fecha
- [x] 4.3 Implementar `get_household_monthly_history()` con las mismas columnas para el hogar, incluyendo el ahorro compartido; verificar que la suma de filas personales más el legado reconcilia con el hogar
- [x] 4.4 Implementar `create_savings_movement(p_goal_id, p_amount, p_kind, p_movement_date)` con validación de dueño, meta compartida, aporte propio, saldo no negativo y meta archivada; verificar depósito, retiro válido y retiro excesivo
- [x] 4.5 Implementar `run_due_savings()` idempotente, con catch-up de hasta 12 meses, recorte de día, omisión por saldo insuficiente y pausa por meta alcanzada; verificar con dos ejecuciones y un plan vencido
- [x] 4.6 Revisar `security definer`, `search_path`, grants y permisos de los RPCs nuevos; verificar que `anon` no puede ejecutarlos y que un miembro de otro hogar no obtiene datos
- [x] 4.7 Crear `tests/db/finance-rpcs.sql` con disponible, historiales, movimientos y autoahorro; verificar que pasa contra local
- [x] 4.8 Ejecutar `supabase db reset --local` y `supabase db push --dry-run`; verificar que solo aparecen las migraciones nuevas y que ninguna operación es destructiva
- [x] 4.9 Documentar en `ARQUITECTURA.md` §4/§5 las tablas, RPCs, RLS y la semántica de `saved_amount` caché; verificar que las secciones existen y que `openspec validate` no reporta referencias rotas

## 5. Utilidades de periodos y ledger

- [x] 5.1 Crear `src/shared/lib/periods.ts` con `monthToDateWindow`, `sincePaydayWindow`, `lastPaydayDate` y `clampPayday`; verificar con `node --test tests/unit/periods.test.ts`
- [x] 5.2 Cubrir en las pruebas unitarias día 31 en febrero, año bisiesto, abril, nómina atrasada, nómina futura, dos nóminas en el mismo mes y ausencia de nómina; verificar que todos los casos pasan
- [x] 5.3 Agregar etiquetas de rango legibles en español de Colombia y probar ventanas dentro del mes y que cruzan meses; verificar con pruebas unitarias y con `formatDate`/`monthLabel`
- [x] 5.4 Crear selectores puros de totales personales, del hogar, por categoría y reconciliación (`sum(perPerson) + unassigned = total`); verificar con `node --test tests/unit/ledger.test.ts`
- [x] 5.5 Agregar el script `pnpm test` con `node --test` y actualizar `.github/workflows/ci.yml` o `e2e.yml` para correrlo; verificar en local y con la sintaxis del workflow
- [x] 5.6 Actualizar `ARQUITECTURA.md` §6/§9 con las utilidades de periodos y la ubicación de las pruebas unitarias; verificar que la sección existe y que `pnpm test` aparece documentado

## 6. Hooks de finanzas, ahorro y datos

- [x] 6.1 Crear `src/modules/finance/hooks/useMemberAvailable.ts` con la query del RPC y su clave `['member-available', householdId, memberId, asOf]`; verificar con `pnpm build` y un mock de Supabase en pruebas
- [x] 6.2 Crear `usePersonalMonthlyHistory` y `useHouseholdMonthlyHistory` con sus claves y estados de carga/error; verificar con `pnpm build` y pruebas de query key
- [x] 6.3 Crear un hook de ventana financiera que calcule la unión `[min(monthStart, cycleStart), asOf]` y cargue gastos e ingresos de esa ventana; verificar que una ventana que cruza meses trae las filas de ambos meses
- [x] 6.4 Crear los hooks de ahorro para metas, movimientos y planes, incluyendo mutaciones de depósito, retiro, archivo y ejecución de autoahorro; verificar con `pnpm build` y pruebas de mutación con mock
- [x] 6.5 Agregar invalidaciones de `member-available`, historiales, `savings`, `savings-movements` y `savings-plans` en las mutaciones correspondientes; verificar con una prueba de `queryClient.invalidateQueries` espiado
- [x] 6.6 Reemplazar el uso de `useRunningBalance` y `useMonthlySurpluses` en el frontend por los hooks nuevos; verificar con `pnpm build` y una búsqueda de referencias que no queden usos
- [x] 6.7 Actualizar `ARQUITECTURA.md` §6 con el módulo `finance` y los hooks de ahorro; verificar que la tabla de hooks coincide con los archivos reales

## 7. Inicio y Gastos

- [x] 7.1 Rehacer Inicio con el hero personal (`Mi mes`, `Desde mi último pago`, `Mi ahorro`, `Disponible` solo con base) y la lista reciente con pagador; verificar visualmente y con `node tests/e2e-money.mjs`
- [x] 7.2 Agregar la sección `Hogar` en Inicio con total del mes, desglose por persona y `Sin asignar`; verificar que la suma reconcilia en la UI y en la prueba e2e
- [x] 7.3 Quitar de Inicio las tarjetas duplicadas de sobrantes, salarios y el widget de proyección; verificar con búsqueda de texto y `pnpm build`
- [x] 7.4 Agregar tabs `Hogar` / `Mis gastos` en `/gastos`, con toggle `Este mes` / `Desde mi último pago` en la vista personal; verificar con e2e y con `check-mobile`
- [x] 7.5 Hacer obligatorio el pagador en `ExpenseForm`, con el usuario actual por defecto y selector de otros miembros; verificar que no existe la opción `Sin asignar` y que el insert sin pagador falla
- [x] 7.6 Conectar el pagador obligatorio en gasto rápido, calendario, factura escaneada y servicios recurrentes; verificar cada flujo con e2e o prueba manual documentada
- [x] 7.7 Crear la UI de limpieza de gastos legados sin pagador (individual y masiva); verificar con un gasto nulo sembrado que sale de `Sin asignar` y entra en el total del pagador
- [x] 7.8 Agregar el desglose personal por categoría y el CSV con pagador; verificar que la suma de categorías coincide con el total personal y que el CSV respeta filtros
- [x] 7.9 Revisar Inicio y Gastos a 375px y 320px, con modo oscuro y estados vacío/carga/error; verificar con `node tests/check-mobile.mjs` y capturas manuales
- [x] 7.10 Actualizar `README.md` y `ARQUITECTURA.md` con la nueva estructura de Inicio/Gastos y la limpieza del legado; verificar que los textos no mencionan `fondo común` como opción vigente

## 8. Miembros, ingresos e historial

- [x] 8.1 Reestructurar Miembros: personas, día de pago, invitación e ingresos como sección secundaria; quitar la tarjeta `Saldos del mes`; verificar con e2e y búsqueda de texto
- [x] 8.2 Conectar el `payday` con la ventana `Desde mi último pago` y permitir editar el día propio; verificar con dos miembros de días distintos y una prueba e2e
- [x] 8.3 Etiquetar el salario heredado como `Estimado` con su origen y dejar claro que el monto no es obligatorio para ver la ventana; verificar con un mes sin fila de salario
- [x] 8.4 Implementar Historial con tabs `Hogar` / `Mis meses` y columnas Ingresos, Gastos, Ahorro, Libre y Acumulado; verificar que `Mis meses` solo muestra al usuario y que `Hogar` reconcilia
- [x] 8.5 Quitar la tarjeta de sobrantes del Inicio y cualquier duplicado de salarios; verificar con `pnpm build` y búsqueda de referencias
- [x] 8.6 Actualizar `README.md` y `ARQUITECTURA.md` con Miembros, Ingresos e Historial; verificar que las rutas y hooks documentados existen

## 9. Ahorros

- [x] 9.1 Rehacer `/ahorros` con tabs `Mis metas` / `Compartidas`, tarjetas de progreso y dueño visible; verificar que una meta personal no aparece para el otro miembro
- [x] 9.2 Implementar depósito y retiro como movimientos, con modal de monto, fecha y confirmación; verificar que el saldo y el disponible cambian y que el historial muestra el movimiento
- [x] 9.3 Implementar la creación de meta con depósito inicial como movimiento atribuido al dueño; verificar que el saldo inicial coincide y que el disponible baja si hay base
- [x] 9.4 Implementar la configuración de autoahorro (monto, día, activo) y la ejecución al cargar/reconectar; verificar con un plan vencido, doble ejecución y meta alcanzada
- [x] 9.5 Implementar archivo de metas con movimientos y eliminación solo de metas vacías; verificar que archivar no devuelve el dinero y que retirar antes sí
- [x] 9.6 Mostrar el límite de retiro propio en metas compartidas y el error cuando se intenta retirar de más; verificar con dos miembros y aportes distintos
- [x] 9.7 Revisar Ahorros a 375px/320px, teclado, foco y modo oscuro; verificar con `check-mobile` y una prueba manual de accesibilidad
- [x] 9.8 Actualizar `README.md` y `ARQUITECTURA.md` con metas personales/compartidas, movimientos y autoahorro; verificar que la sección de ahorro coincide con el comportamiento

## 10. Proyección, Quiero comprar, Calendario, Servicios y Categorías

- [x] 10.1 Convertir Proyección en `Mi proyección` usando el disponible, ingresos, gastos y ahorro personales; verificar que no usa el saldo del hogar y que muestra un estado claro sin historial
- [x] 10.2 Conectar Quiero comprar con el disponible y el sobrante personal; verificar que no muestra el saldo del hogar y que calcula “me quedaría” correctamente
- [x] 10.3 Agregar el filtro `Todos / Mis gastos` y el pagador visible en Calendario; verificar totales y responsive
- [x] 10.4 Hacer obligatorio el pagador en Servicios y bloquear la aplicación de un servicio legado sin responsable; verificar con un servicio nulo y un servicio válido
- [x] 10.5 Agregar el desglose por persona en el detalle de Categorías y mantener el presupuesto del hogar; verificar que la suma por persona coincide con el gasto de la categoría
- [x] 10.6 Eliminar el código de la proyección del hogar y del saldo del hogar en wishlist que quede sin uso; verificar con `pnpm build` y búsqueda de referencias
- [x] 10.7 Actualizar `README.md` y `ARQUITECTURA.md` con el alcance personal de Proyección/Quiero comprar y los filtros de Calendario/Servicios/Categorías; verificar que las descripciones coinciden

## 11. Offline, caché y Realtime

- [x] 11.1 Incluir `paid_by` en el payload de la cola offline y resolver el nombre del pagador en la fila optimista; verificar con un gasto offline que la fila muestra el pagador y no `Sin asignar`
- [x] 11.2 Manejar el replay de un gasto con pagador nulo o de otro hogar: no insertar, marcar error y ofrecer corregir; verificar con una operación encolada inválida
- [x] 11.3 Invalidar `member-available`, historiales, ahorro y movimientos en las mutaciones online; verificar con una prueba de invalidación y con la UI sin recargar
- [x] 11.4 Mantener el ahorro como online-only y mostrar el aviso correspondiente; verificar que un depósito sin red no se encola y no queda promesa rechazada
- [x] 11.5 Ejecutar `run_due_savings` al reconectar sin bloquear el drenado de la cola; verificar con un plan vencido y un gasto pendiente
- [x] 11.6 Agregar `savings_movements` y `savings_plans` al mapa de Realtime e invalidar las claves nuevas; verificar con `e2e-realtime` que B ve el cambio de A sin recargar
- [x] 11.7 Verificar totales personales y del hogar con un gasto optimista y luego del sync; verificar que no hay doble conteo ni saltos
- [x] 11.8 Actualizar `README.md`/`ARQUITECTURA.md` §6 (offline) con el pagador obligatorio y el autoahorro al reconectar; verificar que la sección coincide con las pruebas

## 12. IA: captura de gastos por voz

- [x] 12.1 Agregar la bandera `VITE_FEATURE_VOICE_EXPENSE` y la política `microphone=(self)` en `vercel.json`; verificar que con la bandera apagada no aparece el micrófono y que el build pasa
- [x] 12.2 Crear la tabla de intentos de análisis de audio con RLS sin políticas, índice por usuario/fecha y limpieza de intentos viejos; verificar con `\d` y una prueba de conteo
- [x] 12.3 Crear la Edge Function `analyze-expense-audio` con validación de JWT, hogar y rate limit; verificar 401 sin token, 403 con otro hogar y 429 al superar el límite
- [x] 12.4 Integrar Gemini con un prompt estructurado en español/COP y un esquema de respuesta validado; verificar con un mock de Gemini y un audio fixture
- [x] 12.5 Implementar la grabación en la app con permiso, inicio, detención, cancelación, límite de duración y consentimiento; verificar en móvil y con teclado
- [x] 12.6 Implementar el borrador editable (monto, descripción, fecha, categoría, pagador) y la creación solo al confirmar; verificar que cancelar no crea nada y que editar usa los valores corregidos
- [x] 12.7 Implementar errores y fallback manual para audio vacío, timeout, cuota, red y respuesta inválida; verificar que no queda un gasto a medias
- [x] 12.8 Crear `tests/fixtures/gasto-voz.webm` y `tests/e2e-voice.mjs` con Gemini mockeado; verificar que el fixture produce un borrador y un solo gasto al confirmar
- [x] 12.9 Verificar privacidad: el audio no queda en Storage, los logs no contienen transcripciones y el consentimiento se muestra la primera vez; documentar la evidencia
- [x] 12.10 Probar manualmente con Gemini real y un audio grabado desde la app; resultado: la función v3 acepta `audio/webm;codecs=opus` y el data URL, la prueba directa con el mismo formato devolvió borrador, y dos intentos desde la app recibieron Gemini 503 (demanda alta); documentado en `README.md`/`ARQUITECTURA.md` con el fallback manual
- [x] 12.11 Actualizar `README.md`/`ARQUITECTURA.md` con la bandera, el flujo, la privacidad, el rate limit y el fixture; verificar que la sección coincide con la implementación

## 13. Consolidación, copy, versión y documentación

- [x] 13.1 Renombrar la etiqueta `Dashboard` a `Inicio` y unificar los términos `Mi mes`, `Desde mi último pago`, `Hogar`, `Ahorro`, `Disponible` y `Libre después del ahorro`; verificar con una búsqueda de textos y e2e
- [x] 13.2 Eliminar hooks, componentes, tarjetas y rutas sin uso; verificar con `pnpm build`, `pnpm lint` y búsqueda de referencias
- [x] 13.3 Subir `package.json` a `2.0.0` y actualizar `README.md`/`ARQUITECTURA.md` con el nuevo modelo, la migración y la IA; verificar versión y secciones
- [x] 13.4 Instalar la skill `diagram-design` en `.agents/skills/diagram-design/` y enlazarla en `.opencode/skills/diagram-design`, agregarla a `AGENTS.md`; verificar que `SKILL.md` existe y que la lista de skills coincide con el disco
- [x] 13.5 Generar `DIAGRAMA-REFACTOR-DINERO.html` en la raíz con la skill, en español y con las zonas datos/capa nueva/vistas; verificar con `python3 scripts/self_check.py` y abriéndolo en el navegador
- [x] 13.6 Revisar que `ARQUITECTURA.md` y `README.md` no describan opciones retiradas como vigentes; verificar con una búsqueda de `Sin asignar`, `fondo común`, `A favor`, `Ingreso unificado` y edición directa de ahorro
- [x] 13.7 Verificar que las referencias internas (`§N`) y las rutas documentadas existen; verificar con una búsqueda y con `openspec validate`

## 14. Pruebas integrales y CI

- [x] 14.1 Reescribir `tests/e2e-flow.mjs` para la v2.0 (Inicio personal, tabs, pagador obligatorio, ahorro, historial, offline y dark mode); verificar con `node tests/e2e-flow.mjs` en local
- [x] 14.2 Crear `tests/e2e-money.mjs` con dos miembros, días de pago distintos, gasto pagado por otro, gasto legado sin pagador, salario atrasado, ahorro manual, autoahorro y disponible; verificar con `node tests/e2e-money.mjs`
- [x] 14.3 Actualizar `tests/e2e-mobile.mjs` para las nuevas tabs, ahorro y formulario de gasto; verificar con `node tests/e2e-mobile.mjs`
- [x] 14.4 Actualizar `tests/check-mobile.mjs` con las rutas y modales nuevos a 375/320; verificar con `node tests/check-mobile.mjs`
- [x] 14.5 Actualizar `tests/e2e-realtime.mjs` para gastos pagados por otro, resumen personal, metas compartidas y movimientos; verificar con `node tests/e2e-realtime.mjs`
- [x] 14.6 Agregar el caso offline de pagador obligatorio y autoahorro al reconectar; verificar con el paso e2e correspondiente
- [x] 14.7 Ejecutar todas las pruebas SQL (`ledger-integrity`, `savings`, `finance-rpcs`) contra Supabase local; verificar que pasan y que no dejan datos sucios
- [x] 14.8 Ejecutar todas las pruebas unitarias (`periods`, `ledger`, fechas, autoahorro) con `pnpm test`; verificar que pasan
- [x] 14.9 Ejecutar la auditoría de migración con datos sembrados y comparar counts/sumas; verificar que no hay diferencias
- [x] 14.10 Ejecutar `pnpm build` y `pnpm lint`; verificar que terminan sin errores
- [x] 14.11 Ejecutar `supabase db reset --local` y la suite e2e completa sobre un entorno limpio; verificar que el reset no rompe la app
- [x] 14.12 Actualizar `.github/workflows/e2e.yml` para correr unitarias, SQL, `e2e-flow`, `e2e-money`, `e2e-mobile`, `check-mobile`, `e2e-realtime` y `e2e-voice`; verificar la sintaxis del workflow y que los pasos tienen los secrets necesarios
- [x] 14.13 Revisar los índices nuevos con `EXPLAIN` en consultas de gastos por persona y mes; documentar que no hay sequential scan en tablas grandes
- [x] 14.14 Hacer una pasada manual de accesibilidad (teclado, foco, etiquetas, contraste, modo oscuro) en Inicio, Gastos, Ahorros, Historial y el formulario de voz; documentar los hallazgos y corregirlos
- [x] 14.15 Correr la suite completa en local una última vez y anotar en la PR qué se pudo correr y qué no; verificar que no quede ningún check rojo

## 15. Git y PR

- [x] 15.1 Confirmar que la rama `feat/v2-finanzas-personales` parte de `master` actualizado y que `fix-datos-y-seguridad` ya está cerrado; verificar con `git log --oneline -1` y `openspec list --json`
- [x] 15.2 Hacer commits por bloque lógico con la convención del repo (`feat`, `fix`, `test`, `docs`, `chore`); verificar con `git log --oneline`
- [x] 15.3 Hacer `git push -u origin feat/v2-finanzas-personales`; verificar que la rama remota existe
- [x] 15.4 Abrir la PR con `gh pr create --base master --fill` (o pasar la URL de compare si `gh` no está autenticado); verificar que la PR existe y describe el cambio
- [x] 15.5 Verificar que `CI` y `E2E` pasan en la PR; si algún test no se pudo correr en local, documentarlo explícitamente
- [x] 15.6 Adjuntar a la PR la auditoría de migración, el resultado de `supabase db push --dry-run` y el plan de backup/rollback; verificar que el reviewer puede reproducirlo
- [x] 15.7 Atender los comentarios de revisión sin mergear; verificar que los nuevos commits mantienen CI/E2E en verde

## 16. Ajuste post-merge: disponible desde el último pago

- [x] 16.1 Cambiar `get_member_available` para sumar ingresos y restar gastos solo desde el último pago (real o `payday` configurado), sin descontar ahorro; verificar con `tests/db/finance-rpcs.sql`
- [x] 16.2 Agregar `get_household_available` como suma de los disponibles personales del hogar, sin ahorro, y su hook/cliente; verificar con pruebas unitarias y SQL
- [x] 16.3 Actualizar Inicio: `Disponible personal · desde tu último pago`, `Gastos desde mi último pago` y `Disponible del hogar`; verificar con `e2e-flow`
- [x] 16.4 Actualizar `README.md`, `ARQUITECTURA.md`, specs y design; verificar con `openspec validate`
- [x] 16.5 Verificar en producción el disponible desde el último pago (Charith `1.859.800`, Jhonatan `10.501`, hogar `1.870.301`) y que los ahorros no lo alteren
- [x] 16.6 Borrar solo la apertura de `300.000` del Ahorro Charith archivado, mantener la apertura de `200.000` de Jhonatan y pasar el depósito de `200.000` de la meta nueva a Charith; verificar con un dry-run en producción
- [x] 16.7 Verificar los totales reales normalizados en producción con dry-run y rollback: Charith `1.872.700` después de la nómina (`12.900` antes), Jhonatan `6.450`, ahorro `600.000`; el ajuste faltante de Jhonatan se restaura en la migración de cierre
- [x] 16.8 Permitir eliminar una meta con sus planes y movimientos desde el front, con confirmación y pruebas SQL/e2e; verificar con `tests/db/savings.sql` y `e2e-flow`
- [x] 16.9 Simplificar Historial a `Recibido`, `Gastado` y `Quedó` por mes, sin ahorro ni acumulados; verificar con `e2e-flow` y `check-mobile`

## Workflow follow-up

- Jhotis12 revisa, aprueba y mergea la PR; el agente no mergea.
- Tras el merge, verificar que `supabase-migrations.yml` aplicó las migraciones a producción y que la app responde.
- Archivar el change en una rama nueva (`chore/archive-v2-finanzas-personales`) y abrir PR; no archivar antes del merge.
- Retirar `get_running_balance` y `get_monthly_surpluses` en una limpieza posterior, cuando las PWAs cacheadas hayan actualizado.
- Evaluar `pg_cron` para autoahorro si se necesita garantía sin abrir la app.
- Evaluar presupuestos personales por categoría como siguiente iteración.
