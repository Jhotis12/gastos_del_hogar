-- Disponible personal y del hogar netos de ahorro: además de ingresos y
-- gastos, se descuentan los movimientos de ahorro propios (con signo) dentro
-- de la ventana del ciclo desde el último pago. Las aperturas migradas
-- (member_id null) y los aportes de otros miembros no descuentan a nadie;
-- sin ingresos registrados el disponible sigue siendo null.

create or replace function public.get_member_available(p_as_of date)
returns table(available numeric, income_basis numeric, last_pay_date date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_start date;
  v_income numeric;
  v_expenses numeric;
  v_savings numeric;
  v_last_pay date;
  v_has_base boolean;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select max(s.pay_date) into v_last_pay
  from public.salaries s
  where s.profile_id = v_uid and s.pay_date <= p_as_of;

  v_start := public.member_cycle_start(v_uid, p_as_of);
  if v_start is null then
    v_start := p_as_of;
  end if;

  select coalesce(sum(t.amount), 0) into v_income
  from (
    select s.amount
    from public.salaries s
    where s.profile_id = v_uid
      and s.pay_date >= v_start
      and s.pay_date <= p_as_of
    union all
    select i.amount
    from public.incomes i
    where i.member_id = v_uid
      and i.income_date >= v_start
      and i.income_date <= p_as_of
  ) t;

  select coalesce(sum(e.amount), 0) into v_expenses
  from public.expenses e
  where e.paid_by = v_uid
    and e.expense_date >= v_start
    and e.expense_date <= p_as_of;

  select coalesce(sum(m.amount), 0) into v_savings
  from public.savings_movements m
  where m.member_id = v_uid
    and m.movement_date >= v_start
    and m.movement_date <= p_as_of;

  select exists (
    select 1 from public.salaries s
    where s.profile_id = v_uid and s.pay_date <= p_as_of
  ) or exists (
    select 1 from public.incomes i
    where i.member_id = v_uid and i.income_date <= p_as_of
  ) into v_has_base;

  return query
  select
    case when v_has_base then v_income - v_expenses - v_savings else null end,
    v_income,
    v_last_pay;
end;
$$;

create or replace function public.get_household_available(p_as_of date)
returns table(available numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
  v_total numeric := 0;
  r record;
  v_start date;
  v_income numeric;
  v_expenses numeric;
  v_savings numeric;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select p.household_id into v_household
  from public.profiles p
  where p.id = v_uid;

  if v_household is null then
    return query select null::numeric;
    return;
  end if;

  for r in
    select p.id from public.profiles p where p.household_id = v_household
  loop
    v_start := public.member_cycle_start(r.id, p_as_of);
    if v_start is null then
      v_start := p_as_of;
    end if;

    select coalesce(sum(t.amount), 0) into v_income
    from (
      select s.amount
      from public.salaries s
      where s.profile_id = r.id
        and s.pay_date >= v_start
        and s.pay_date <= p_as_of
      union all
      select i.amount
      from public.incomes i
      where i.member_id = r.id
        and i.income_date >= v_start
        and i.income_date <= p_as_of
    ) t;

    select coalesce(sum(e.amount), 0) into v_expenses
    from public.expenses e
    where e.paid_by = r.id
      and e.expense_date >= v_start
      and e.expense_date <= p_as_of;

    select coalesce(sum(m.amount), 0) into v_savings
    from public.savings_movements m
    where m.member_id = r.id
      and m.movement_date >= v_start
      and m.movement_date <= p_as_of;

    v_total := v_total + v_income - v_expenses - v_savings;
  end loop;

  return query select v_total;
end;
$$;

revoke all on function public.get_member_available(date) from public, anon;
grant execute on function public.get_member_available(date) to authenticated;
grant execute on function public.get_member_available(date) to service_role;

revoke all on function public.get_household_available(date) from public, anon;
grant execute on function public.get_household_available(date) to authenticated;
grant execute on function public.get_household_available(date) to service_role;
