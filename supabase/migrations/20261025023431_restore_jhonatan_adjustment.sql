-- Restaura el ajuste de Jhonatan si falta, para que su total real quede en
-- 6.450 como se acordó. La normalización anterior dejó el estado base; este
-- ajuste es idempotente y no hace nada en entornos sin ese estado.

do $$
declare
  v_household uuid := 'd46d7f64-957e-41ca-9fc6-b2fc4d8ae288';
  v_jhonatan uuid := '89d6a0a9-4ab7-4c79-b011-f0a41da35f94';
  v_category uuid;
  v_total numeric;
  v_adjust numeric;
begin
  if not exists (select 1 from public.profiles where id = v_jhonatan) then
    return;
  end if;

  -- Solo si la normalización histórica ya se aplicó en este entorno.
  if not exists (
    select 1 from public.expenses
    where id = 'a0000000-0000-4000-8000-00000000c001'
  ) then
    return;
  end if;

  select id into v_category
  from public.categories
  where household_id = v_household and name = 'Otros'
  limit 1;

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
    coalesce((select sum(amount) from public.salaries where profile_id = v_jhonatan), 0)
    + coalesce((select sum(amount) from public.incomes where member_id = v_jhonatan), 0)
    - coalesce((select sum(amount) from public.expenses where paid_by = v_jhonatan), 0)
  into v_total;

  if v_total <> 6450 then
    raise exception 'FALLO: total de Jhonatan = %, esperado 6450', v_total;
  end if;

  raise notice 'Ajuste de Jhonatan restaurado: total 6450';
end $$;
