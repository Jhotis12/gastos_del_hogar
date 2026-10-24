-- =============================================================
-- v2.0 — RPCs de finanzas (1/3): movimientos de ahorro.
-- security definer: valida sesión, hogar, dueño, archivo y saldo
-- antes de insertar; el trigger mantiene saved_amount.
-- =============================================================

create or replace function public.create_savings_movement(
  p_goal_id uuid,
  p_amount numeric,
  p_kind text,
  p_movement_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_goal public.savings_goals%rowtype;
  v_signed numeric;
  v_own_net numeric;
  v_total numeric;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in ('deposit', 'withdrawal') then
    raise exception 'Tipo de movimiento inválido' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor que cero' using errcode = '22023';
  end if;

  select * into v_goal
  from public.savings_goals
  where id = p_goal_id;

  if not found then
    raise exception 'Meta no encontrada' using errcode = '22023';
  end if;

  if not public.is_household_member(v_goal.household_id) then
    raise exception 'No perteneces al hogar de la meta' using errcode = '42501';
  end if;

  if v_goal.owner_id is not null and v_goal.owner_id <> v_uid then
    raise exception 'No tienes acceso a esta meta' using errcode = '42501';
  end if;

  if v_goal.archived_at is not null then
    raise exception 'La meta está archivada' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_total
  from public.savings_movements
  where goal_id = p_goal_id;

  if p_kind = 'withdrawal' then
    if p_amount > v_total then
      raise exception 'Saldo insuficiente en la meta' using errcode = '22023';
    end if;

    -- En metas compartidas solo se retira el aporte neto propio.
    if v_goal.owner_id is null then
      select coalesce(sum(amount), 0) into v_own_net
      from public.savings_movements
      where goal_id = p_goal_id and member_id = v_uid;

      if p_amount > v_own_net then
        raise exception 'El retiro supera tu aporte a la meta compartida' using errcode = '22023';
      end if;
    end if;

    v_signed := -p_amount;
  else
    v_signed := p_amount;
  end if;

  insert into public.savings_movements (
    household_id, goal_id, member_id, amount, kind, movement_date
  )
  values (
    v_goal.household_id, p_goal_id, v_uid, v_signed, p_kind, coalesce(p_movement_date, current_date)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_savings_movement(uuid, numeric, text, date) from public, anon;
grant execute on function public.create_savings_movement(uuid, numeric, text, date) to authenticated;
grant execute on function public.create_savings_movement(uuid, numeric, text, date) to service_role;

-- Disponible personal acumulado a una fecha. Sin ingresos registrados
-- devuelve null (no inventa saldo); no incluye ingresos del hogar sin dueño.
create or replace function public.get_member_available(p_as_of date)
returns table (
  available numeric,
  income_basis numeric,
  last_pay_date date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_income numeric;
  v_expenses numeric;
  v_savings numeric;
  v_last_pay date;
  v_has_base boolean;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select
    coalesce((select sum(s.amount) from public.salaries s
              where s.profile_id = v_uid and s.pay_date <= p_as_of), 0)
    + coalesce((select sum(i.amount) from public.incomes i
                where i.member_id = v_uid and i.income_date <= p_as_of), 0),
    exists (select 1 from public.salaries s
            where s.profile_id = v_uid and s.pay_date <= p_as_of)
    or exists (select 1 from public.incomes i
               where i.member_id = v_uid and i.income_date <= p_as_of),
    (select max(s.pay_date) from public.salaries s
     where s.profile_id = v_uid and s.pay_date <= p_as_of)
  into v_income, v_has_base, v_last_pay;

  select coalesce(sum(e.amount), 0) into v_expenses
  from public.expenses e
  where e.paid_by = v_uid and e.expense_date <= p_as_of;

  select coalesce(sum(m.amount), 0) into v_savings
  from public.savings_movements m
  where m.member_id = v_uid and m.movement_date <= p_as_of;

  return query
  select
    case when v_has_base then v_income - v_expenses - v_savings else null end,
    v_income,
    v_last_pay;
end;
$$;

revoke all on function public.get_member_available(date) from public, anon;
grant execute on function public.get_member_available(date) to authenticated;
grant execute on function public.get_member_available(date) to service_role;

-- Historial personal por mes calendario. Cash basis hasta hoy: el último
-- acumulado coincide con get_member_available(current_date).
create or replace function public.get_personal_monthly_history()
returns table (
  month date,
  income numeric,
  expenses numeric,
  savings numeric,
  free numeric,
  accumulated numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as id
  ),
  bounds as (
    select least(
      (select min(date_trunc('month', s.pay_date)::date) from public.salaries s
       where s.profile_id = (select id from me) and s.pay_date <= current_date),
      (select min(date_trunc('month', i.income_date)::date) from public.incomes i
       where i.member_id = (select id from me) and i.income_date <= current_date),
      (select min(date_trunc('month', e.expense_date)::date) from public.expenses e
       where e.paid_by = (select id from me) and e.expense_date <= current_date),
      (select min(date_trunc('month', m.movement_date)::date) from public.savings_movements m
       where m.member_id = (select id from me) and m.movement_date <= current_date),
      date_trunc('month', current_date)::date
    ) as first_month
  ),
  months as (
    select d.month::date as month
    from bounds b
    cross join generate_series(
      b.first_month::timestamp,
      date_trunc('month', current_date)::date::timestamp,
      interval '1 month'
    ) d(month)
    where (select id from me) is not null
  ),
  sal as (
    select date_trunc('month', s.pay_date)::date as month, sum(s.amount)::numeric as total
    from public.salaries s
    where s.profile_id = (select id from me) and s.pay_date <= current_date
    group by 1
  ),
  inc as (
    select date_trunc('month', i.income_date)::date as month, sum(i.amount)::numeric as total
    from public.incomes i
    where i.member_id = (select id from me) and i.income_date <= current_date
    group by 1
  ),
  exp as (
    select date_trunc('month', e.expense_date)::date as month, sum(e.amount)::numeric as total
    from public.expenses e
    where e.paid_by = (select id from me) and e.expense_date <= current_date
    group by 1
  ),
  sav as (
    select date_trunc('month', m.movement_date)::date as month, sum(m.amount)::numeric as total
    from public.savings_movements m
    where m.member_id = (select id from me) and m.movement_date <= current_date
    group by 1
  ),
  monthly as (
    select mo.month,
           coalesce(sal.total, 0) + coalesce(inc.total, 0) as income,
           coalesce(exp.total, 0) as expenses,
           coalesce(sav.total, 0) as savings,
           coalesce(sal.total, 0) + coalesce(inc.total, 0)
             - coalesce(exp.total, 0) - coalesce(sav.total, 0) as free
    from months mo
    left join sal on sal.month = mo.month
    left join inc on inc.month = mo.month
    left join exp on exp.month = mo.month
    left join sav on sav.month = mo.month
  )
  select month, income, expenses, savings, free,
         sum(free) over (order by month rows between unbounded preceding and current row) as accumulated
  from monthly
  order by month;
$$;

revoke all on function public.get_personal_monthly_history() from public, anon;
grant execute on function public.get_personal_monthly_history() to authenticated;
grant execute on function public.get_personal_monthly_history() to service_role;

-- Historial del hogar. El ahorro solo cuenta metas compartidas para no
-- filtrar las metas personales de otros miembros.
create or replace function public.get_household_monthly_history()
returns table (
  month date,
  income numeric,
  expenses numeric,
  savings numeric,
  free numeric,
  accumulated numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with hh as (
    select household_id from public.profiles where id = auth.uid()
  ),
  bounds as (
    select least(
      (select min(date_trunc('month', s.pay_date)::date) from public.salaries s
       where s.household_id = (select household_id from hh) and s.pay_date <= current_date),
      (select min(date_trunc('month', i.income_date)::date) from public.incomes i
       where i.household_id = (select household_id from hh) and i.income_date <= current_date),
      (select min(date_trunc('month', e.expense_date)::date) from public.expenses e
       where e.household_id = (select household_id from hh) and e.expense_date <= current_date),
      (select min(date_trunc('month', m.movement_date)::date)
       from public.savings_movements m
       join public.savings_goals g on g.id = m.goal_id
       where m.household_id = (select household_id from hh)
         and g.owner_id is null and m.movement_date <= current_date),
      date_trunc('month', current_date)::date
    ) as first_month
  ),
  months as (
    select d.month::date as month
    from bounds b
    cross join generate_series(
      b.first_month::timestamp,
      date_trunc('month', current_date)::date::timestamp,
      interval '1 month'
    ) d(month)
    where (select household_id from hh) is not null
  ),
  sal as (
    select date_trunc('month', s.pay_date)::date as month, sum(s.amount)::numeric as total
    from public.salaries s
    where s.household_id = (select household_id from hh) and s.pay_date <= current_date
    group by 1
  ),
  inc as (
    select date_trunc('month', i.income_date)::date as month, sum(i.amount)::numeric as total
    from public.incomes i
    where i.household_id = (select household_id from hh) and i.income_date <= current_date
    group by 1
  ),
  exp as (
    select date_trunc('month', e.expense_date)::date as month, sum(e.amount)::numeric as total
    from public.expenses e
    where e.household_id = (select household_id from hh) and e.expense_date <= current_date
    group by 1
  ),
  sav as (
    select date_trunc('month', m.movement_date)::date as month, sum(m.amount)::numeric as total
    from public.savings_movements m
    join public.savings_goals g on g.id = m.goal_id
    where m.household_id = (select household_id from hh)
      and g.owner_id is null and m.movement_date <= current_date
    group by 1
  ),
  monthly as (
    select mo.month,
           coalesce(sal.total, 0) + coalesce(inc.total, 0) as income,
           coalesce(exp.total, 0) as expenses,
           coalesce(sav.total, 0) as savings,
           coalesce(sal.total, 0) + coalesce(inc.total, 0)
             - coalesce(exp.total, 0) - coalesce(sav.total, 0) as free
    from months mo
    left join sal on sal.month = mo.month
    left join inc on inc.month = mo.month
    left join exp on exp.month = mo.month
    left join sav on sav.month = mo.month
  )
  select month, income, expenses, savings, free,
         sum(free) over (order by month rows between unbounded preceding and current row) as accumulated
  from monthly
  order by month;
$$;

revoke all on function public.get_household_monthly_history() from public, anon;
grant execute on function public.get_household_monthly_history() to authenticated;
grant execute on function public.get_household_monthly_history() to service_role;

-- Autoahorro idempotente: procesa los planes activos del hogar, recupera
-- hasta 12 meses, recorta el día al fin de mes y omite sin saldo.
create or replace function public.run_due_savings()
returns table (created int, skipped int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
  v_plan record;
  v_month date;
  v_start date;
  v_cutoff date := date_trunc('month', current_date)::date;
  v_window_start date := (date_trunc('month', current_date) - interval '11 months')::date;
  v_date date;
  v_income numeric;
  v_expenses numeric;
  v_savings numeric;
  v_saved numeric;
  v_has_base boolean;
  v_available numeric;
  v_old_months int;
  v_created int := 0;
  v_skipped int := 0;
  v_archived timestamptz;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select household_id into v_household from public.profiles where id = v_uid;
  if v_household is null then
    return query select 0, 0;
    return;
  end if;

  for v_plan in
    select p.id, p.household_id, p.goal_id, p.member_id, p.amount, p.day_of_month,
           p.start_month, p.last_run_month,
           g.target_amount, g.saved_amount, g.archived_at
    from public.savings_plans p
    join public.savings_goals g on g.id = p.goal_id
    where p.household_id = v_household and p.is_active
    order by p.created_at, p.id
  loop
    if v_plan.archived_at is not null then
      update public.savings_plans set is_active = false where id = v_plan.id;
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if v_plan.saved_amount >= v_plan.target_amount then
      update public.savings_plans set is_active = false where id = v_plan.id;
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_start := coalesce((v_plan.last_run_month + interval '1 month')::date, v_plan.start_month);

    if v_start < v_window_start then
      v_old_months := (
        (extract(year from v_window_start) * 12 + extract(month from v_window_start))
        - (extract(year from v_start) * 12 + extract(month from v_start))
      )::int;
      v_skipped := v_skipped + v_old_months;
      v_start := v_window_start;
    end if;

    v_month := v_start;
    while v_month <= v_cutoff loop
      v_date := make_date(
        extract(year from v_month)::int,
        extract(month from v_month)::int,
        least(
          v_plan.day_of_month,
          extract(day from (v_month + interval '1 month' - interval '1 day'))::int
        )
      );

      -- El mes en curso aún no vence: no se toca last_run_month.
      if v_date > current_date then
        exit;
      end if;

      -- Otro plan pudo haber alcanzado la meta en esta misma corrida.
      select g.saved_amount, g.archived_at into v_saved, v_archived
      from public.savings_goals g where g.id = v_plan.goal_id;

      if v_archived is not null or v_saved >= v_plan.target_amount then
        update public.savings_plans set is_active = false where id = v_plan.id;
        v_skipped := v_skipped + 1;
        exit;
      end if;

      if exists (
        select 1 from public.savings_movements m
        where m.plan_id = v_plan.id and m.period_month = v_month
      ) then
        update public.savings_plans set last_run_month = v_month where id = v_plan.id;
        v_skipped := v_skipped + 1;
        v_month := (v_month + interval '1 month')::date;
        continue;
      end if;

      select
        coalesce((select sum(s.amount) from public.salaries s
                  where s.profile_id = v_plan.member_id and s.pay_date <= v_date), 0)
        + coalesce((select sum(i.amount) from public.incomes i
                    where i.member_id = v_plan.member_id and i.income_date <= v_date), 0),
        exists (select 1 from public.salaries s
                where s.profile_id = v_plan.member_id and s.pay_date <= v_date)
        or exists (select 1 from public.incomes i
                   where i.member_id = v_plan.member_id and i.income_date <= v_date),
        (select coalesce(sum(e.amount), 0) from public.expenses e
         where e.paid_by = v_plan.member_id and e.expense_date <= v_date),
        (select coalesce(sum(m.amount), 0) from public.savings_movements m
         where m.member_id = v_plan.member_id and m.movement_date <= v_date)
      into v_income, v_has_base, v_expenses, v_savings;

      v_available := v_income - v_expenses - v_savings;

      if v_has_base and v_plan.amount > v_available then
        update public.savings_plans set last_run_month = v_month where id = v_plan.id;
        v_skipped := v_skipped + 1;
      else
        insert into public.savings_movements (
          household_id, goal_id, member_id, plan_id, amount, kind, movement_date, period_month, note
        )
        values (
          v_plan.household_id, v_plan.goal_id, v_plan.member_id, v_plan.id,
          v_plan.amount, 'auto', v_date, v_month, 'Aporte automático'
        );

        update public.savings_plans set last_run_month = v_month where id = v_plan.id;
        v_created := v_created + 1;

        select g.saved_amount into v_saved
        from public.savings_goals g where g.id = v_plan.goal_id;

        if v_saved >= v_plan.target_amount then
          update public.savings_plans set is_active = false where id = v_plan.id;
          exit;
        end if;
      end if;

      v_month := (v_month + interval '1 month')::date;
    end loop;
  end loop;

  return query select v_created, v_skipped;
end;
$$;

revoke all on function public.run_due_savings() from public, anon;
grant execute on function public.run_due_savings() to authenticated;
grant execute on function public.run_due_savings() to service_role;

-- Aplicar un servicio sin responsable (legado) queda bloqueado: no se
-- inventa el pagador y el gasto no se crea.
create or replace function public.apply_recurring_expense(p_recurring_id uuid, p_month date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  hh uuid := (select household_id from public.profiles where id = auth.uid());
  r record;
  first_day date := date_trunc('month', p_month)::date;
  last_day date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  already_applied boolean;
begin
  if hh is null then
    return 0;
  end if;

  select * into r
  from public.recurring_expenses
  where id = p_recurring_id
    and household_id = hh
    and is_active = true
    and next_due_date <= last_day;

  if r.id is null then
    return 0;
  end if;

  if r.paid_by is null or not public.is_household_member(hh, r.paid_by) then
    raise exception 'Asigna un responsable del hogar al servicio antes de aplicarlo'
      using errcode = '22023';
  end if;

  select exists(
    select 1 from public.expenses
    where household_id = hh
      and recurring_id = r.id
      and expense_date >= first_day
      and expense_date <= last_day
  ) into already_applied;

  if already_applied then
    return 0;
  end if;

  insert into public.expenses (household_id, category_id, paid_by, amount, description, expense_date, recurring_id)
  values (hh, r.category_id, r.paid_by, r.amount, r.description, greatest(r.next_due_date, first_day), r.id);

  update public.recurring_expenses
  set next_due_date = case r.frequency
    when 'bimonthly' then (date_trunc('month', p_month) + interval '2 months')::date
    when 'quarterly' then (date_trunc('month', p_month) + interval '3 months')::date
    when 'yearly' then (date_trunc('month', p_month) + interval '1 year')::date
    else (date_trunc('month', p_month) + interval '1 month')::date
  end
  where id = r.id;

  return 1;
end;
$$;
