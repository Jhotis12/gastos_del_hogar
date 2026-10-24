-- =============================================================
-- Corrección de datos: nómina de octubre de Charith.
-- Charith tiene payday 24; el salario de septiembre fue 1.859.800 y
-- octubre aún no estaba registrado. Se inserta solo si falta.
-- =============================================================

do $$
declare
  v_household uuid;
  v_charith uuid;
  v_amount numeric;
begin
  select household_id into v_household
  from public.profiles
  where id = (select id from auth.users where email = 'jhotis12@gmail.com');

  if v_household is null then
    raise notice 'charith_october_salary: hogar no encontrado, no-op';
    return;
  end if;

  select id into v_charith
  from public.profiles
  where household_id = v_household and full_name = 'Charith';

  if v_charith is null then
    raise notice 'charith_october_salary: Charith no encontrada, no-op';
    return;
  end if;

  select amount into v_amount
  from public.salaries
  where profile_id = v_charith and month = '2026-09-01';

  v_amount := coalesce(v_amount, 1859800);

  insert into public.salaries (household_id, profile_id, amount, month, pay_date)
  select v_household, v_charith, v_amount, '2026-10-01', '2026-10-24'
  where not exists (
    select 1 from public.salaries
    where profile_id = v_charith and month = '2026-10-01'
  );

  raise notice 'charith_october_salary: salario=%, fecha=2026-10-24', v_amount;
end $$;
