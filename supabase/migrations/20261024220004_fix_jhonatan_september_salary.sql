-- =============================================================
-- Corrección de datos: salario de septiembre de Jhonatan.
--
-- Evidencia (dump de producción):
--   * salaries de Jhonatan: julio y agosto 1.859.800; septiembre ausente.
--   * incomes: 1.859.000 el 2026-10-01, member_id Jhonatan y descripción
--     vacía. Era la nómina de septiembre registrada por la vía equivocada.
--   * profiles.payday de Jhonatan estaba en 29; su día de pago es 31.
--
-- Se convierte ese ingreso en una fila de salaries (mismo monto que agosto),
-- con pay_date 2026-09-30 (septiembre no tiene 31; el día 31 se recorta) y se
-- elimina el ingreso erróneo. Idempotente: si ya existe la fila o el ingreso
-- ya no está, no hace nada. No toca ahorros ni otras tablas.
-- =============================================================

do $$
declare
  v_user uuid;
  v_amount numeric;
  v_income uuid := '84224b93-b554-4b39-bafb-5578e627f2bc';
  v_deleted integer := 0;
begin
  select id into v_user
  from auth.users
  where email = 'jhotis12@gmail.com';

  if v_user is null then
    raise notice 'fix_jhonatan_september_salary: usuario no encontrado, no-op';
    return;
  end if;

  select amount into v_amount
  from public.salaries
  where profile_id = v_user and month = '2026-08-01';

  v_amount := coalesce(v_amount, 1859800);

  delete from public.incomes
  where id = v_income
    and member_id = v_user
    and amount = 1859000
    and income_date = '2026-10-01'
    and description = '';
  get diagnostics v_deleted = row_count;

  insert into public.salaries (household_id, profile_id, amount, month, pay_date)
  select p.household_id, v_user, v_amount, '2026-09-01', '2026-09-30'
  from public.profiles p
  where p.id = v_user
    and not exists (
      select 1 from public.salaries s
      where s.profile_id = v_user and s.month = '2026-09-01'
    );

  update public.profiles
  set payday = 31
  where id = v_user and payday = 29;

  raise notice 'fix_jhonatan_september_salary: salario=%, ingresos_eliminados=%',
    v_amount, v_deleted;
end $$;
