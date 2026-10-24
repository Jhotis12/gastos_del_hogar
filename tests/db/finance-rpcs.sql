-- RPCs de finanzas v2.0: disponible, historiales, movimientos y autoahorro.
-- Uso:
--   docker exec -i supabase_db_App-gastos psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < tests/db/finance-rpcs.sql
-- Corre en una transacción y hace ROLLBACK: no deja datos de prueba.

\set ON_ERROR_STOP on

begin;

-- Dos hogares. A y B comparten H1; C vive en H2.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-5555-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-a@test.local', now(), now(), now(), '{}', '{"full_name":"Fin A"}'),
  ('bbbbbbbb-5555-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-b@test.local', now(), now(), now(), '{}', '{"full_name":"Fin B"}'),
  ('cccccccc-5555-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-c@test.local', now(), now(), now(), '{}', '{"full_name":"Fin C"}'),
  ('dddddddd-5555-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-d@test.local', now(), now(), now(), '{}', '{"full_name":"Fin D"}'),
  ('eeeeeeee-5555-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fin-e@test.local', now(), now(), now(), '{}', '{"full_name":"Fin E"}');

insert into public.households (id, name, invite_code)
values
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'Hogar Fin 1', 'FIN-1'),
  ('cccccccc-5555-4000-8000-00000000000b', 'Hogar Fin 2', 'FIN-2');

update public.profiles set household_id = 'aaaaaaaa-5555-4000-8000-00000000000a'
where id in ('aaaaaaaa-5555-4000-8000-000000000001', 'bbbbbbbb-5555-4000-8000-000000000002',
             'dddddddd-5555-4000-8000-000000000004', 'eeeeeeee-5555-4000-8000-000000000005');
update public.profiles set household_id = 'cccccccc-5555-4000-8000-00000000000b'
where id = 'cccccccc-5555-4000-8000-000000000003';

-- Datos base de A y B en el mes actual y el anterior.
insert into public.salaries (household_id, profile_id, amount, pay_date, month) values
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'aaaaaaaa-5555-4000-8000-000000000001', 3000000,
   (date_trunc('month', current_date) - interval '1 month')::date,
   (date_trunc('month', current_date) - interval '1 month')::date),
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'aaaaaaaa-5555-4000-8000-000000000001', 3100000,
   date_trunc('month', current_date)::date, date_trunc('month', current_date)::date),
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'bbbbbbbb-5555-4000-8000-000000000002', 2000000,
   date_trunc('month', current_date)::date, date_trunc('month', current_date)::date);

insert into public.incomes (household_id, member_id, amount, income_date) values
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'aaaaaaaa-5555-4000-8000-000000000001', 500000, date_trunc('month', current_date)::date),
  ('aaaaaaaa-5555-4000-8000-00000000000a', null, 100000, date_trunc('month', current_date)::date);

insert into public.expenses (household_id, paid_by, amount, expense_date) values
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'aaaaaaaa-5555-4000-8000-000000000001', 1200000, date_trunc('month', current_date)::date),
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'bbbbbbbb-5555-4000-8000-000000000002', 300000, date_trunc('month', current_date)::date),
  ('aaaaaaaa-5555-4000-8000-00000000000a', null, 50000, date_trunc('month', current_date)::date);

insert into public.savings_goals (id, household_id, name, target_amount, owner_id) values
  ('a1111111-5555-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-00000000000a', 'Compartida fin', 10000000, null),
  ('a2222222-5555-4000-8000-000000000002', 'aaaaaaaa-5555-4000-8000-00000000000a', 'Personal A fin', 10000000, 'aaaaaaaa-5555-4000-8000-000000000001'),
  ('a3333333-5555-4000-8000-000000000003', 'aaaaaaaa-5555-4000-8000-00000000000a', 'Personal B fin', 10000000, 'bbbbbbbb-5555-4000-8000-000000000002'),
  ('a4444444-5555-4000-8000-000000000004', 'aaaaaaaa-5555-4000-8000-00000000000a', 'Archivada fin', 1000000, null);

update public.savings_goals set archived_at = now() where id = 'a4444444-5555-4000-8000-000000000004';

insert into public.savings_movements (household_id, goal_id, member_id, amount, kind, movement_date) values
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'a1111111-5555-4000-8000-000000000001', null, 100000, 'opening', date_trunc('month', current_date)::date),
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'a1111111-5555-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-000000000001', 300000, 'deposit', date_trunc('month', current_date)::date),
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'a1111111-5555-4000-8000-000000000001', 'bbbbbbbb-5555-4000-8000-000000000002', 200000, 'deposit', date_trunc('month', current_date)::date),
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'a2222222-5555-4000-8000-000000000002', 'aaaaaaaa-5555-4000-8000-000000000001', 150000, 'deposit', date_trunc('month', current_date)::date),
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'a3333333-5555-4000-8000-000000000003', 'bbbbbbbb-5555-4000-8000-000000000002', 400000, 'deposit', date_trunc('month', current_date)::date);

-- Disponible e historiales como A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-5555-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare
  v_available numeric;
  v_income numeric;
  v_expenses numeric;
  v_savings numeric;
  v_free numeric;
  v_accumulated numeric;
begin
  select available into v_available from public.get_member_available(current_date);
  if v_available <> 4950000 then
    raise exception 'FALLO: disponible de A = %, esperado 4950000', v_available;
  end if;

  select income, expenses, savings, free, accumulated
  into v_income, v_expenses, v_savings, v_free, v_accumulated
  from public.get_personal_monthly_history()
  where month = date_trunc('month', current_date)::date;

  if v_income <> 3600000 or v_expenses <> 1200000 or v_savings <> 450000
     or v_free <> 1950000 or v_accumulated <> 4950000 then
    raise exception 'FALLO: historial personal de A (%, %, %, %, %)',
      v_income, v_expenses, v_savings, v_free, v_accumulated;
  end if;
  raise notice 'PASS: disponible e historial personal de A';
end $$;

-- Disponible sin ingresos: D solo tiene un ahorro.
select set_config('request.jwt.claims', '{"sub":"dddddddd-5555-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare v_available numeric; v_basis numeric;
begin
  select available, income_basis into v_available, v_basis
  from public.get_member_available(current_date);
  if v_available is not null or v_basis <> 0 then
    raise exception 'FALLO: D sin ingresos mostró disponible % / base %', v_available, v_basis;
  end if;
  raise notice 'PASS: disponible null sin ingresos';
end $$;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-5555-4000-8000-000000000001","role":"authenticated"}', true);

-- Historial del hogar: excluye el ahorro personal de A y B.
do $$
declare v_income numeric; v_expenses numeric; v_savings numeric; v_free numeric;
begin
  select income, expenses, savings, free
  into v_income, v_expenses, v_savings, v_free
  from public.get_household_monthly_history()
  where month = date_trunc('month', current_date)::date;

  if v_income <> 5700000 or v_expenses <> 1550000 or v_savings <> 600000 or v_free <> 3550000 then
    raise exception 'FALLO: historial del hogar (%, %, %, %)', v_income, v_expenses, v_savings, v_free;
  end if;
  raise notice 'PASS: historial del hogar excluye ahorro personal';
end $$;

-- Movimientos: depósito y retiro válidos, exceso, meta ajena y archivada.
select public.create_savings_movement('a1111111-5555-4000-8000-000000000001', 200000, 'deposit', current_date);
select public.create_savings_movement('a1111111-5555-4000-8000-000000000001', 100000, 'withdrawal', current_date);

do $$
begin
  begin
    perform public.create_savings_movement('a1111111-5555-4000-8000-000000000001', 500000, 'withdrawal', current_date);
    raise exception 'FALLO: retiro excesivo aceptado';
  exception when sqlstate '22023' then
    raise notice 'PASS: retiro excesivo rechazado';
  end;

  begin
    perform public.create_savings_movement('a3333333-5555-4000-8000-000000000003', 1000, 'deposit', current_date);
    raise exception 'FALLO: depósito en meta personal de B aceptado';
  exception when sqlstate '42501' then
    raise notice 'PASS: meta personal de B protegida';
  end;

  begin
    perform public.create_savings_movement('a4444444-5555-4000-8000-000000000004', 1000, 'deposit', current_date);
    raise exception 'FALLO: depósito en meta archivada aceptado';
  exception when sqlstate '22023' then
    raise notice 'PASS: meta archivada rechazada';
  end;
end $$;

-- Planes de autoahorro.
reset role;

insert into public.savings_goals (id, household_id, name, target_amount, owner_id, archived_at) values
  ('b1111111-5555-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-00000000000a', 'Auto A', 10000000, 'aaaaaaaa-5555-4000-8000-000000000001', null),
  ('b2222222-5555-4000-8000-000000000002', 'aaaaaaaa-5555-4000-8000-00000000000a', 'Auto B', 10000000, 'bbbbbbbb-5555-4000-8000-000000000002', null),
  ('b3333333-5555-4000-8000-000000000003', 'aaaaaaaa-5555-4000-8000-00000000000a', 'Auto E insuficiente', 1000000, 'eeeeeeee-5555-4000-8000-000000000005', null),
  ('b4444444-5555-4000-8000-000000000004', 'aaaaaaaa-5555-4000-8000-00000000000a', 'Auto alcanzada', 100000, null, null),
  ('b5555555-5555-4000-8000-000000000005', 'aaaaaaaa-5555-4000-8000-00000000000a', 'Auto archivada', 1000000, null, now()),
  ('b6666666-5555-4000-8000-000000000006', 'cccccccc-5555-4000-8000-00000000000b', 'Auto C', 1000000, 'cccccccc-5555-4000-8000-000000000003', null);

insert into public.salaries (household_id, profile_id, amount, pay_date, month) values
  ('aaaaaaaa-5555-4000-8000-00000000000a', 'eeeeeeee-5555-4000-8000-000000000005', 50000,
   date_trunc('month', current_date)::date, date_trunc('month', current_date)::date),
  ('cccccccc-5555-4000-8000-00000000000b', 'cccccccc-5555-4000-8000-000000000003', 50000,
   date_trunc('month', current_date)::date, date_trunc('month', current_date)::date);

insert into public.savings_movements (household_id, goal_id, member_id, amount, kind, movement_date)
values ('aaaaaaaa-5555-4000-8000-00000000000a', 'b4444444-5555-4000-8000-000000000004', 'aaaaaaaa-5555-4000-8000-000000000001', 100000, 'deposit', date_trunc('month', current_date)::date);

insert into public.savings_plans (id, household_id, goal_id, member_id, amount, day_of_month, start_month) values
  ('c1111111-5555-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-00000000000a', 'b1111111-5555-4000-8000-000000000001', 'aaaaaaaa-5555-4000-8000-000000000001', 100000, 1, (date_trunc('month', current_date) - interval '2 months')::date),
  ('c2222222-5555-4000-8000-000000000002', 'aaaaaaaa-5555-4000-8000-00000000000a', 'b2222222-5555-4000-8000-000000000002', 'bbbbbbbb-5555-4000-8000-000000000002', 50000, 31, (date_trunc('month', current_date) - interval '1 month')::date),
  ('c3333333-5555-4000-8000-000000000003', 'aaaaaaaa-5555-4000-8000-00000000000a', 'b3333333-5555-4000-8000-000000000003', 'eeeeeeee-5555-4000-8000-000000000005', 100000, 1, date_trunc('month', current_date)::date),
  ('c4444444-5555-4000-8000-000000000004', 'aaaaaaaa-5555-4000-8000-00000000000a', 'b4444444-5555-4000-8000-000000000004', 'aaaaaaaa-5555-4000-8000-000000000001', 50000, 1, (date_trunc('month', current_date) - interval '1 month')::date),
  ('c5555555-5555-4000-8000-000000000005', 'aaaaaaaa-5555-4000-8000-00000000000a', 'b5555555-5555-4000-8000-000000000005', 'aaaaaaaa-5555-4000-8000-000000000001', 20000, 1, (date_trunc('month', current_date) - interval '1 month')::date),
  ('c6666666-5555-4000-8000-000000000006', 'cccccccc-5555-4000-8000-00000000000b', 'b6666666-5555-4000-8000-000000000006', 'cccccccc-5555-4000-8000-000000000003', 100000, 1, date_trunc('month', current_date)::date);

-- Corrida como A. Las aserciones van como postgres para ver también los
-- planes y movimientos personales de B y E, que RLS oculta a A.
select 'run A' as paso, * from public.run_due_savings();

reset role;

do $$
begin
  if (select count(*) from public.savings_movements where plan_id = 'c1111111-5555-4000-8000-000000000001') <> 3 then
    raise exception 'FALLO: el plan A no creó 3 movimientos';
  end if;
  if (select movement_date from public.savings_movements
      where plan_id = 'c2222222-5555-4000-8000-000000000002'
      order by period_month limit 1)
     <> ((date_trunc('month', current_date) - interval '1 month') + interval '1 month' - interval '1 day')::date then
    raise exception 'FALLO: el plan B no recortó el día 31';
  end if;
  if (select count(*) from public.savings_movements where plan_id = 'c3333333-5555-4000-8000-000000000003') <> 0 then
    raise exception 'FALLO: el plan E sin saldo creó un movimiento';
  end if;
  if not exists (select 1 from public.savings_plans where id = 'c3333333-5555-4000-8000-000000000003' and is_active and last_run_month = date_trunc('month', current_date)::date) then
    raise exception 'FALLO: el plan E no quedó pendiente del siguiente mes';
  end if;
  if exists (select 1 from public.savings_plans where id = 'c4444444-5555-4000-8000-000000000004' and is_active) then
    raise exception 'FALLO: el plan con meta alcanzada no se pausó';
  end if;
  if exists (select 1 from public.savings_plans where id = 'c5555555-5555-4000-8000-000000000005' and is_active) then
    raise exception 'FALLO: el plan de meta archivada no se pausó';
  end if;
  if exists (select 1 from public.savings_movements where plan_id = 'c6666666-5555-4000-8000-000000000006') then
    raise exception 'FALLO: se ejecutó un plan de otro hogar';
  end if;
  raise notice 'PASS: autoahorro (recuperación, recorte, sin saldo, meta alcanzada y archivada)';
end $$;

-- Segunda corrida: no duplica el plan A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-5555-4000-8000-000000000001","role":"authenticated"}', true);
select 'run A 2' as paso, * from public.run_due_savings();

reset role;

do $$
declare v_count int;
begin
  select count(*) into v_count from public.savings_movements where plan_id = 'c1111111-5555-4000-8000-000000000001';
  if v_count <> 3 then
    raise exception 'FALLO: la segunda corrida duplicó el plan A (%)', v_count;
  end if;
  raise notice 'PASS: segunda corrida idempotente para el plan A';
end $$;

-- C no ve ni opera el hogar de A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-5555-4000-8000-000000000003","role":"authenticated"}', true);

do $$
declare v_available numeric; v_income numeric;
begin
  select available into v_available from public.get_member_available(current_date);
  if v_available <> 50000 then
    raise exception 'FALLO: disponible de C = %, esperado 50000', v_available;
  end if;
  select income into v_income from public.get_household_monthly_history()
  where month = date_trunc('month', current_date)::date;
  if v_income <> 50000 then
    raise exception 'FALLO: historial de C mezcla otro hogar (%)', v_income;
  end if;

  begin
    perform public.create_savings_movement('a1111111-5555-4000-8000-000000000001', 10000, 'deposit', current_date);
    raise exception 'FALLO: C operó una meta de otro hogar';
  exception when sqlstate '42501' then
    raise notice 'PASS: C aislado de H1';
  end;
end $$;

select 'run C' as paso, * from public.run_due_savings();

reset role;

do $$
begin
  if not exists (select 1 from public.savings_plans where id = 'c6666666-5555-4000-8000-000000000006' and is_active and last_run_month = date_trunc('month', current_date)::date) then
    raise exception 'FALLO: el plan de C no quedó pendiente tras omitirse por saldo';
  end if;
  if (select count(*) from public.savings_movements where plan_id = 'c1111111-5555-4000-8000-000000000001') <> 3 then
    raise exception 'FALLO: la corrida de C tocó el plan de H1';
  end if;
  raise notice 'PASS: C ejecuta solo su plan y no toca H1';
end $$;

-- Anon no puede ejecutar los RPCs nuevos.
set local role anon;
do $$
begin
  begin
    perform public.get_member_available(current_date);
    raise exception 'FALLO: anon ejecutó un RPC';
  exception when insufficient_privilege then
    raise notice 'PASS: anon sin permiso de ejecución';
  end;
end $$;
reset role;

rollback;
