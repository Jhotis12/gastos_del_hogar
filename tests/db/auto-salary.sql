-- Nómina automática opt-in: crea la fila del mes en el payday, solo si
-- el miembro tiene historial y la fila no existe. Idempotente.
-- Uso:
--   docker exec -i supabase_db_App-gastos psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < tests/db/auto-salary.sql

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-7777-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-a@test.local', now(), now(), now(), '{}', '{"full_name":"Auto A"}'),
  ('bbbbbbbb-7777-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-b@test.local', now(), now(), now(), '{}', '{"full_name":"Auto B"}'),
  ('cccccccc-7777-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto-c@test.local', now(), now(), now(), '{}', '{"full_name":"Auto C"}');

insert into public.households (id, name, invite_code)
values ('aaaaaaaa-7777-4000-8000-00000000000a', 'Hogar Auto Salary', 'AUTO-SAL-T');

update public.profiles
set household_id = 'aaaaaaaa-7777-4000-8000-00000000000a',
    payday = extract(day from current_date)::int,
    auto_salary = true
where id = 'aaaaaaaa-7777-4000-8000-000000000001';

update public.profiles
set household_id = 'aaaaaaaa-7777-4000-8000-00000000000a',
    payday = extract(day from current_date)::int,
    auto_salary = false
where id = 'bbbbbbbb-7777-4000-8000-000000000002';

update public.profiles
set household_id = 'aaaaaaaa-7777-4000-8000-00000000000a',
    payday = extract(day from current_date)::int,
    auto_salary = true
where id = 'cccccccc-7777-4000-8000-000000000003';

insert into public.salaries (household_id, profile_id, amount, month, pay_date)
values
  ('aaaaaaaa-7777-4000-8000-00000000000a', 'aaaaaaaa-7777-4000-8000-000000000001', 100000,
   (date_trunc('month', current_date) - interval '1 month')::date,
   (date_trunc('month', current_date) - interval '1 month')::date),
  ('aaaaaaaa-7777-4000-8000-00000000000a', 'bbbbbbbb-7777-4000-8000-000000000002', 200000,
   (date_trunc('month', current_date) - interval '1 month')::date,
   (date_trunc('month', current_date) - interval '1 month')::date);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-7777-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare
  v_created int;
  v_skipped int;
begin
  select created, skipped into v_created, v_skipped from public.run_due_salaries();
  if v_created <> 1 or v_skipped <> 1 then
    raise exception 'FALLO: primera corrida creados=% omitidos=%', v_created, v_skipped;
  end if;

  if not exists (
    select 1 from public.salaries
    where profile_id = 'aaaaaaaa-7777-4000-8000-000000000001'
      and month = date_trunc('month', current_date)::date
      and amount = 100000
  ) then
    raise exception 'FALLO: no se creó la nómina de A';
  end if;
  if exists (
    select 1 from public.salaries
    where profile_id = 'bbbbbbbb-7777-4000-8000-000000000002'
      and month = date_trunc('month', current_date)::date
  ) then
    raise exception 'FALLO: se creó nómina para B (auto desactivado)';
  end if;
  if exists (
    select 1 from public.salaries
    where profile_id = 'cccccccc-7777-4000-8000-000000000003'
      and month = date_trunc('month', current_date)::date
  ) then
    raise exception 'FALLO: se creó nómina para C sin historial';
  end if;
  raise notice 'PASS: nómina automática creada solo para A';

  select created, skipped into v_created, v_skipped from public.run_due_salaries();
  if v_created <> 0 then
    raise exception 'FALLO: segunda corrida duplicó (%)', v_created;
  end if;
  raise notice 'PASS: segunda corrida idempotente';
end $$;

rollback;
