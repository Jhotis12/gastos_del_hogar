-- 1) Insert July 2026 salaries that were never registered in prod
INSERT INTO public.salaries (household_id, profile_id, amount, month, pay_date)
VALUES 
  ('d46d7f64-957e-41ca-9fc6-b2fc4d8ae288'::uuid, '5436400b-7d44-4ca2-bac1-ee18b8639cc6'::uuid, 991918, '2026-07-01', '2026-07-24'),
  ('d46d7f64-957e-41ca-9fc6-b2fc4d8ae288'::uuid, '89d6a0a9-4ab7-4c79-b011-f0a41da35f94'::uuid, 1859800, '2026-07-01', '2026-07-31')
ON CONFLICT (profile_id, month) DO NOTHING;

-- 2) Fix August salaries that had wrong pay_date (still in July instead of August)
UPDATE public.salaries
SET pay_date = '2026-08-24'
WHERE profile_id = '5436400b-7d44-4ca2-bac1-ee18b8639cc6'::uuid AND month = '2026-08-01' AND pay_date = '2026-07-24';

UPDATE public.salaries
SET pay_date = '2026-08-31'
WHERE profile_id = '89d6a0a9-4ab7-4c79-b011-f0a41da35f94'::uuid AND month = '2026-08-01' AND pay_date = '2026-07-31';

-- 3) Insert Spotify expense from August 12, 2026 that was never applied to prod
INSERT INTO public.expenses (household_id, category_id, paid_by, amount, description, expense_date, recurring_id)
SELECT 
  'd46d7f64-957e-41ca-9fc6-b2fc4d8ae288'::uuid AS household_id,
  '422e37cf-72bf-4fb8-9c4d-fe50e7e8eed1'::uuid AS category_id,
  NULL AS paid_by,
  10400 AS amount,
  'spotify' AS description,
  '2026-08-12'::date AS expense_date,
  NULL::uuid AS recurring_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.expenses 
  WHERE household_id = 'd46d7f64-957e-41ca-9fc6-b2fc4d8ae288'::uuid 
    AND expense_date = '2026-08-12'::date
    AND amount = 10400
);