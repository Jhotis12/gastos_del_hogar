-- Normaliza los saldos reales del hogar de producción.
--
-- Ahorros:
-- - Borra solo la apertura de 300.000 de la meta archivada "Ahorro charith".
-- - Mantiene la apertura de 200.000 de "Ahorro jhonatan".
-- - Reasigna a Charith el depósito de 200.000 de la meta nueva "Ahorro charith".
--   Resultado: Charith 200.000, Jhonatan 400.000, hogar 600.000.
--
-- Totales reales (ingresos - gastos, incluyendo ahorros):
-- - Charith: 12.900 antes de la nómina del 24-oct; 1.872.700 después.
-- - Jhonatan: 6.450.
-- - Los 3 gastos legacy se asignan: Spotify a Charith; Transporte y Cosos a
--   Jhonatan. El resto se ajusta con un gasto/ingreso de normalización.
--
-- Es idempotente y no hace nada en entornos donde no existe el estado de
-- producción (por ejemplo, el Supabase local de CI).

do $$
declare
  v_household uuid := 'd46d7f64-957e-41ca-9fc6-b2fc4d8ae288';
  v_charith uuid := '5436400b-7d44-4ca2-bac1-ee18b8639cc6';
  v_jhonatan uuid := '89d6a0a9-4ab7-4c79-b011-f0a41da35f94';
  v_category uuid;
  v_total numeric;
  v_adjust numeric;
begin
  if not exists (select 1 from public.profiles where id = v_charith)
     or not exists (select 1 from public.profiles where id = v_jhonatan) then
    return;
  end if;

  -- Solo normalizar si existe el estado exacto de producción que se revisó.
  if not exists (
    select 1 from public.savings_movements
    where id = '7c513845-8cfd-4bf8-8037-f5d23b0216be' and kind = 'opening'
  ) or not exists (
    select 1 from public.savings_movements
    where id = 'bdf503da-0727-410c-9ce3-3829e6969505' and kind = 'deposit'
  ) then
    return;
  end if;

  delete from public.savings_movements
  where id = '7c513845-8cfd-4bf8-8037-f5d23b0216be'
    and kind = 'opening';

  update public.savings_movements
  set member_id = v_charith
  where id = 'bdf503da-0727-410c-9ce3-3829e6969505'
    and kind = 'deposit';

  update public.expenses
  set paid_by = v_charith
  where id = 'fd800cd2-6ef6-4deb-84a2-7b2f6f9c1bcc'
    and paid_by is null;

  update public.expenses
  set paid_by = v_jhonatan
  where id in (
    '547ddc4d-d5cb-41b5-b471-397351927cc7',
    '44f4f3ad-d739-41c4-8f8f-a212660b9f6f'
  )
    and paid_by is null;

  select id into v_category
  from public.categories
  where household_id = v_household and name = 'Otros'
  limit 1;

  -- Charith: 1.872.700 = 12.900 antes de la nómina + 1.859.800.
  if exists (
    select 1 from public.salaries
    where profile_id = v_charith and pay_date = '2026-10-24'
  ) then
    select
      coalesce((select sum(amount) from public.salaries where profile_id = v_charith), 0)
      + coalesce((select sum(amount) from public.incomes where member_id = v_charith), 0)
      - coalesce((select sum(amount) from public.expenses where paid_by = v_charith), 0)
    into v_total;

    v_adjust := v_total - 1872700;
    if v_adjust > 0 then
      insert into public.expenses (
        id, household_id, paid_by, amount, description, expense_date, category_id
      ) values (
        'a0000000-0000-4000-8000-00000000c001',
        v_household,
        v_charith,
        v_adjust,
        'Ajuste de saldo histórico',
        '2026-10-23',
        v_category
      )
      on conflict (id) do nothing;
    elsif v_adjust < 0 then
      insert into public.incomes (
        id, household_id, member_id, amount, description, income_date
      ) values (
        'a0000000-0000-4000-8000-00000000c003',
        v_household,
        v_charith,
        -v_adjust,
        'Ajuste de saldo histórico',
        '2026-10-23'
      )
      on conflict (id) do nothing;
    end if;
  end if;

  -- Jhonatan: 6.450.
  select
    coalesce((select sum(amount) from public.salaries where profile_id = v_jhonatan), 0)
    + coalesce((select sum(amount) from public.incomes where member_id = v_jhonatan), 0)
    - coalesce((select sum(amount) from public.expenses where paid_by = v_jhonatan), 0)
  into v_total;

  v_adjust := v_total - 6450;
  if v_adjust > 0 then
    insert into public.expenses (
      id, household_id, paid_by, amount, description, expense_date, category_id
    ) values (
      'a0000000-0000-4000-8000-00000000c002',
      v_household,
      v_jhonatan,
      v_adjust,
      'Ajuste de saldo histórico',
      '2026-10-24',
      v_category
    )
    on conflict (id) do nothing;
  elsif v_adjust < 0 then
    insert into public.incomes (
      id, household_id, member_id, amount, description, income_date
    ) values (
      'a0000000-0000-4000-8000-00000000c004',
      v_household,
      v_jhonatan,
      -v_adjust,
      'Ajuste de saldo histórico',
      '2026-10-24'
    )
    on conflict (id) do nothing;
  end if;

  select
    coalesce((select sum(amount) from public.salaries where profile_id = v_charith), 0)
    + coalesce((select sum(amount) from public.incomes where member_id = v_charith), 0)
    - coalesce((select sum(amount) from public.expenses where paid_by = v_charith), 0)
  into v_total;
  if v_total <> 1872700 then
    raise exception 'FALLO: total de Charith = %, esperado 1872700', v_total;
  end if;

  select
    coalesce((select sum(amount) from public.salaries where profile_id = v_jhonatan), 0)
    + coalesce((select sum(amount) from public.incomes where member_id = v_jhonatan), 0)
    - coalesce((select sum(amount) from public.expenses where paid_by = v_jhonatan), 0)
  into v_total;
  if v_total <> 6450 then
    raise exception 'FALLO: total de Jhonatan = %, esperado 6450', v_total;
  end if;

  if (
    select coalesce(sum(amount), 0)
    from public.savings_movements
    where household_id = v_household
  ) <> 600000 then
    raise exception 'FALLO: ahorro del hogar distinto de 600000';
  end if;

  raise notice 'Saldos normalizados: Charith 1872700, Jhonatan 6450, ahorro 600000';
end $$;
