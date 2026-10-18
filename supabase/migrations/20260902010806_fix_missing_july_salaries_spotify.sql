-- Fix de datos puntual de producción (julio/agosto 2026).
-- IMPORTANTE: los IDs de hogar/perfiles/categorías son de producción. En una
-- base limpia (local, CI o instalación nueva) este archivo debe ser un no-op:
-- por eso cada INSERT valida que las filas padre existan antes de insertar.

-- 1) Salarios de julio 2026 que nunca se registraron en prod
INSERT INTO public.salaries (household_id, profile_id, amount, month, pay_date)
SELECT v.household_id, v.profile_id, v.amount, v.month, v.pay_date
FROM (VALUES
  ('d46d7f64-957e-41ca-9fc6-b2fc4d8ae288'::uuid, '5436400b-7d44-4ca2-bac1-ee18b8639cc6'::uuid, 991918::numeric, '2026-07-01'::date, '2026-07-24'::date),
  ('d46d7f64-957e-41ca-9fc6-b2fc4d8ae288'::uuid, '89d6a0a9-4ab7-4c79-b011-f0a41da35f94'::uuid, 1859800::numeric, '2026-07-01'::date, '2026-07-31'::date)
) AS v(household_id, profile_id, amount, month, pay_date)
WHERE EXISTS (
    SELECT 1 FROM public.households h WHERE h.id = v.household_id
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v.profile_id
  )
ON CONFLICT (profile_id, month) DO NOTHING;

-- 2) Corregir pay_date de salarios de agosto que quedaron en julio
UPDATE public.salaries
SET pay_date = '2026-08-24'
WHERE profile_id = '5436400b-7d44-4ca2-bac1-ee18b8639cc6'::uuid
  AND month = '2026-08-01'
  AND pay_date = '2026-07-24';

UPDATE public.salaries
SET pay_date = '2026-08-31'
WHERE profile_id = '89d6a0a9-4ab7-4c79-b011-f0a41da35f94'::uuid
  AND month = '2026-08-01'
  AND pay_date = '2026-07-31';

-- 3) Gasto de Spotify de agosto 2026 que nunca se aplicó en prod
INSERT INTO public.expenses (household_id, category_id, paid_by, amount, description, expense_date, recurring_id)
SELECT
  'd46d7f64-957e-41ca-9fc6-b2fc4d8ae288'::uuid,
  '422e37cf-72bf-4fb8-9c4d-fe50e7e8eed1'::uuid,
  NULL,
  10400,
  'spotify',
  '2026-08-12'::date,
  NULL::uuid
WHERE EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = 'd46d7f64-957e-41ca-9fc6-b2fc4d8ae288'::uuid
  )
  AND EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = '422e37cf-72bf-4fb8-9c4d-fe50e7e8eed1'::uuid
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.expenses
    WHERE household_id = 'd46d7f64-957e-41ca-9fc6-b2fc4d8ae288'::uuid
      AND expense_date = '2026-08-12'::date
      AND amount = 10400
  );
