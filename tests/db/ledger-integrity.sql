-- Integridad del ledger v2.0: pagador/miembro obligatorio y del mismo hogar.
-- Uso:
--   docker exec -i supabase_db_App-gastos psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < tests/db/ledger-integrity.sql
-- Corre en una transacción y hace ROLLBACK: no deja datos de prueba.

\set ON_ERROR_STOP on

begin;

-- Dos hogares y un miembro en cada uno. El trigger handle_new_user crea
-- el perfil; después se le asigna el hogar.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ledger-a@test.local', now(), now(), now(), '{}', '{"full_name":"Ledger A"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ledger-b@test.local', now(), now(), now(), '{}', '{"full_name":"Ledger B"}');

insert into public.households (id, name, invite_code)
values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'Hogar Ledger A', 'LEDGER-A'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'Hogar Ledger B', 'LEDGER-B');

update public.profiles set household_id = 'aaaaaaaa-0000-4000-8000-00000000000a'
where id = 'aaaaaaaa-0000-4000-8000-000000000001';
update public.profiles set household_id = 'bbbbbbbb-0000-4000-8000-00000000000b'
where id = 'bbbbbbbb-0000-4000-8000-000000000002';

-- A partir de aquí todo corre con la sesión del miembro A y RLS activo.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare
  v_id uuid;
begin
  -- expenses: pagador nulo y de otro hogar deben fallar.
  begin
    insert into public.expenses (household_id, paid_by, amount, description)
    values ('aaaaaaaa-0000-4000-8000-00000000000a', null, 1000, 'ledger nulo');
    raise exception 'FALLO: gasto con paid_by nulo aceptado';
  exception when insufficient_privilege then
    raise notice 'PASS: gasto con pagador nulo rechazado';
  end;

  begin
    insert into public.expenses (household_id, paid_by, amount, description)
    values ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-000000000002', 1000, 'ledger cruzado');
    raise exception 'FALLO: gasto con pagador de otro hogar aceptado';
  exception when insufficient_privilege then
    raise notice 'PASS: gasto con pagador de otro hogar rechazado';
  end;

  insert into public.expenses (household_id, paid_by, amount, description)
  values ('aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001', 1000, 'ledger valido')
  returning id into v_id;
  raise notice 'PASS: gasto con pagador del mismo hogar aceptado';

  -- incomes: nulo es ingreso del hogar; un miembro ajeno debe fallar.
  insert into public.incomes (household_id, member_id, amount, description)
  values ('aaaaaaaa-0000-4000-8000-00000000000a', null, 1000, 'ledger hogar');
  raise notice 'PASS: ingreso sin miembro (hogar) aceptado';

  begin
    insert into public.incomes (household_id, member_id, amount, description)
    values ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-000000000002', 1000, 'ledger cruzado');
    raise exception 'FALLO: ingreso con miembro de otro hogar aceptado';
  exception when insufficient_privilege then
    raise notice 'PASS: ingreso con miembro de otro hogar rechazado';
  end;

  -- recurring_expenses: nulo se conserva como legado; uno ajeno falla.
  insert into public.recurring_expenses (household_id, paid_by, amount, next_due_date)
  values ('aaaaaaaa-0000-4000-8000-00000000000a', null, 1000, '2026-11-01');
  raise notice 'PASS: servicio legado sin responsable aceptado';

  begin
    insert into public.recurring_expenses (household_id, paid_by, amount, next_due_date)
    values ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-000000000002', 1000, '2026-11-01');
    raise exception 'FALLO: servicio con responsable de otro hogar aceptado';
  exception when insufficient_privilege then
    raise notice 'PASS: servicio con responsable de otro hogar rechazado';
  end;
end $$;

rollback;
