-- Ahorro v2.0: backfill, trigger, límites de retiro y privacidad RLS.
-- Uso:
--   docker exec -i supabase_db_App-gastos psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < tests/db/savings.sql
-- Corre en una transacción y hace ROLLBACK: no deja datos de prueba.

\set ON_ERROR_STOP on

begin;

-- Un hogar con dos miembros. El trigger handle_new_user crea los perfiles.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-1111-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'savings-a@test.local', now(), now(), now(), '{}', '{"full_name":"Savings A"}'),
  ('bbbbbbbb-2222-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'savings-b@test.local', now(), now(), now(), '{}', '{"full_name":"Savings B"}');

insert into public.households (id, name, invite_code)
values ('aaaaaaaa-1111-4000-8000-00000000000a', 'Hogar Savings', 'SAVINGS-T');

update public.profiles set household_id = 'aaaaaaaa-1111-4000-8000-00000000000a'
where id in ('aaaaaaaa-1111-4000-8000-000000000001', 'bbbbbbbb-2222-4000-8000-000000000002');

-- Metas de prueba. La "legacy" simula una meta con saldo antes de la v2.0.
insert into public.savings_goals (id, household_id, name, target_amount, saved_amount, owner_id, archived_at)
values
  ('cccccccc-3333-4000-8000-000000000003', 'aaaaaaaa-1111-4000-8000-00000000000a', 'Meta legacy', 1000000, 500000, null, null),
  ('cccccccc-3333-4000-8000-000000000004', 'aaaaaaaa-1111-4000-8000-00000000000a', 'Meta compartida', 1000000, 0, null, null),
  ('cccccccc-3333-4000-8000-000000000005', 'aaaaaaaa-1111-4000-8000-00000000000a', 'Meta personal B', 1000000, 0, 'bbbbbbbb-2222-4000-8000-000000000002', null),
  ('cccccccc-3333-4000-8000-000000000006', 'aaaaaaaa-1111-4000-8000-00000000000a', 'Meta archivada', 1000000, 0, null, now()),
  ('cccccccc-3333-4000-8000-000000000007', 'aaaaaaaa-1111-4000-8000-00000000000a', 'Meta trigger', 1000000, 0, null, null);

-- Backfill idempotente: mismo SQL que la migración, ejecutado dos veces.
insert into public.savings_movements (household_id, goal_id, member_id, amount, kind, movement_date, note)
select g.household_id, g.id, null, g.saved_amount, 'opening', current_date, 'Saldo migrado'
from public.savings_goals g
where g.id = 'cccccccc-3333-4000-8000-000000000003'
  and g.saved_amount > 0
  and not exists (
    select 1 from public.savings_movements m
    where m.goal_id = g.id and m.kind = 'opening'
  );

insert into public.savings_movements (household_id, goal_id, member_id, amount, kind, movement_date, note)
select g.household_id, g.id, null, g.saved_amount, 'opening', current_date, 'Saldo migrado'
from public.savings_goals g
where g.id = 'cccccccc-3333-4000-8000-000000000003'
  and g.saved_amount > 0
  and not exists (
    select 1 from public.savings_movements m
    where m.goal_id = g.id and m.kind = 'opening'
  );

do $$
begin
  if (select count(*) from public.savings_movements where goal_id = 'cccccccc-3333-4000-8000-000000000003' and kind = 'opening') <> 1 then
    raise exception 'FALLO: el backfill duplicó o perdió la apertura';
  end if;
  if (select saved_amount from public.savings_goals where id = 'cccccccc-3333-4000-8000-000000000003') <> 500000 then
    raise exception 'FALLO: el backfill cambió el saldo legacy';
  end if;
  raise notice 'PASS: backfill idempotente y saldo legacy intacto';
end $$;

-- Trigger: depósito, retiro y borrado recalculan saved_amount.
insert into public.savings_movements (household_id, goal_id, member_id, amount, kind)
values ('aaaaaaaa-1111-4000-8000-00000000000a', 'cccccccc-3333-4000-8000-000000000007', 'aaaaaaaa-1111-4000-8000-000000000001', 100000, 'deposit');
insert into public.savings_movements (household_id, goal_id, member_id, amount, kind)
values ('aaaaaaaa-1111-4000-8000-00000000000a', 'cccccccc-3333-4000-8000-000000000007', 'aaaaaaaa-1111-4000-8000-000000000001', -50000, 'withdrawal');

do $$
begin
  if (select saved_amount from public.savings_goals where id = 'cccccccc-3333-4000-8000-000000000007') <> 50000 then
    raise exception 'FALLO: el trigger no reflejó depósito y retiro';
  end if;
  raise notice 'PASS: trigger suma depósito y retiro';
end $$;

delete from public.savings_movements
where goal_id = 'cccccccc-3333-4000-8000-000000000007' and kind = 'withdrawal';

do $$
begin
  if (select saved_amount from public.savings_goals where id = 'cccccccc-3333-4000-8000-000000000007') <> 100000 then
    raise exception 'FALLO: el trigger no revirtió el retiro borrado';
  end if;
  raise notice 'PASS: trigger revierte el movimiento borrado';
end $$;

-- Movimiento de la meta personal de B para probar que A no lo ve.
insert into public.savings_movements (household_id, goal_id, member_id, amount, kind)
values ('aaaaaaaa-1111-4000-8000-00000000000a', 'cccccccc-3333-4000-8000-000000000005', 'bbbbbbbb-2222-4000-8000-000000000002', 20000, 'deposit');

-- A partir de aquí todo corre con la sesión de A y RLS activo.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.savings_goals where id = 'cccccccc-3333-4000-8000-000000000004') <> 1 then
    raise exception 'FALLO: A no ve la meta compartida';
  end if;
  if (select count(*) from public.savings_goals where id = 'cccccccc-3333-4000-8000-000000000005') <> 0 then
    raise exception 'FALLO: A ve la meta personal de B';
  end if;
  if (select count(*) from public.savings_movements where goal_id = 'cccccccc-3333-4000-8000-000000000005') <> 0 then
    raise exception 'FALLO: A ve movimientos de la meta personal de B';
  end if;
  raise notice 'PASS: A ve la compartida y no la personal de B';
end $$;

-- RPC: aportes y límite de retiro por aporte propio en meta compartida.
select public.create_savings_movement('cccccccc-3333-4000-8000-000000000004', 300000, 'deposit', current_date);

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-2222-4000-8000-000000000002","role":"authenticated"}', true);
select public.create_savings_movement('cccccccc-3333-4000-8000-000000000004', 200000, 'deposit', current_date);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}', true);
select public.create_savings_movement('cccccccc-3333-4000-8000-000000000004', 250000, 'withdrawal', current_date);

do $$
begin
  begin
    perform public.create_savings_movement('cccccccc-3333-4000-8000-000000000004', 100000, 'withdrawal', current_date);
    raise exception 'FALLO: A retiró más que su aporte propio';
  exception when sqlstate '22023' then
    raise notice 'PASS: retiro sobre el aporte propio de A rechazado';
  end;

  begin
    perform public.create_savings_movement('cccccccc-3333-4000-8000-000000000005', 1000, 'deposit', current_date);
    raise exception 'FALLO: A depositó en la meta personal de B';
  exception when sqlstate '42501' then
    raise notice 'PASS: A no puede operar la meta personal de B';
  end;

  begin
    perform public.create_savings_movement('cccccccc-3333-4000-8000-000000000006', 1000, 'deposit', current_date);
    raise exception 'FALLO: se depositó en una meta archivada';
  exception when sqlstate '22023' then
    raise notice 'PASS: depósito en meta archivada rechazado';
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-2222-4000-8000-000000000002","role":"authenticated"}', true);

do $$
begin
  begin
    perform public.create_savings_movement('cccccccc-3333-4000-8000-000000000004', 250000, 'withdrawal', current_date);
    raise exception 'FALLO: B retiró más que su aporte propio';
  exception when sqlstate '22023' then
    raise notice 'PASS: retiro sobre el aporte propio de B rechazado';
  end;
end $$;

select public.create_savings_movement('cccccccc-3333-4000-8000-000000000004', 200000, 'withdrawal', current_date);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-4000-8000-000000000001","role":"authenticated"}', true);
select public.create_savings_movement('cccccccc-3333-4000-8000-000000000004', 50000, 'withdrawal', current_date);

do $$
begin
  if (select saved_amount from public.savings_goals where id = 'cccccccc-3333-4000-8000-000000000004') <> 0 then
    raise exception 'FALLO: el saldo final de la meta compartida no es cero';
  end if;
  raise notice 'PASS: depósitos y retiros válidos dejan la meta en cero';
end $$;

rollback;
