-- =============================================================
-- Herencia de salarios en sobrantes por mes (cash basis)
--
-- El salario efectivo de una persona en el mes M es:
--   1) su(s) fila(s) con pay_date dentro de M (llegada real), o
--   2) si no hay fila en M: el último salario de un mes anterior,
--      con pay_date calculada según su día de pago
--      (profiles.payday, recortado al último día de M) — misma
--      lógica que effectiveSalariesForMonth del cliente.
--
-- El ingreso del mes M solo cuenta salarios cuya pay_date
-- (real o calculada) es <= least(current_date, fin de M): el
-- salario heredado se agrega a los sobrantes EN SU FECHA DE PAGO.
-- Si la nómina aún no ha llegado (pay_date futura), no infla el
-- mes. Consistente con get_running_balance (cash basis).
-- =============================================================

create or replace function public.get_monthly_surpluses()
returns table (
  month date,
  income numeric,
  expenses numeric,
  surplus numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with hh as (
    select household_id from public.profiles where id = auth.uid()
  ),
  members as (
    select id, payday
    from public.profiles
    where household_id = (select household_id from hh)
  ),
  months as (
    select d.month::date as month
    from (
      select least(
               (select min(date_trunc('month', s.pay_date)::date)
                from public.salaries s
                where s.household_id = (select household_id from hh)),
               (select min(date_trunc('month', i.income_date)::date)
                from public.incomes i
                where i.household_id = (select household_id from hh)),
               (select min(date_trunc('month', e.expense_date)::date)
                from public.expenses e
                where e.household_id = (select household_id from hh))
             ) as first_month,
             date_trunc('month', current_date)::date as last_month
    ) r
    cross join generate_series(
      r.first_month::timestamp,
      r.last_month::timestamp,
      interval '1 month'
    ) d(month)
  ),
  sal_eff as (
    -- Fila real (llegada real del dinero): todas las del hogar, incluso de
    -- miembros que ya salieron (el historial no puede perder su aporte).
    select m.month,
           s.profile_id,
           s.amount::numeric as amount,
           s.pay_date::date as pay_date
    from months m
    join public.salaries s
      on s.household_id = (select household_id from hh)
     and s.pay_date >= m.month
     and s.pay_date < (m.month + interval '1 month')::date
    union all
    -- Herencia: miembros ACTUALES sin FILA DEL MES (month = m.month), con
    -- pay_date calculada según su día de pago y solo si tienen historial
    -- previo. Chequear la fila del mes (no el pay_date) evita contar dos
    -- veces una nómina registrada cuyo pay_date cae en otro mes.
    select m.month,
           p.id as profile_id,
           ih.amount::numeric as amount,
           ih.pay_date::date as pay_date
    from months m
    cross join members p
    left join lateral (
      select 1 as present
      from public.salaries s
      where s.household_id = (select household_id from hh)
        and s.profile_id = p.id
        and s.month = m.month
      limit 1
    ) ex on true
    left join lateral (
      select s.amount,
             make_date(
               extract(year from m.month)::int,
               extract(month from m.month)::int,
               least(
                 greatest(p.payday, 1),
                 extract(day from (m.month + interval '1 month' - interval '1 day'))::int
               )
             ) as pay_date
      from public.salaries s
      where s.household_id = (select household_id from hh)
        and s.profile_id = p.id
        and s.month < m.month
      order by s.month desc
      limit 1
    ) ih on true
    where ex.present is null
      and ih.amount is not null
  ),
  salaries as (
    select e.month,
           sum(e.amount)::numeric as total
    from sal_eff e
    where e.pay_date <= least(
      current_date,
      (e.month + interval '1 month' - interval '1 day')::date
    )
    group by e.month
  ),
  incomes as (
    select date_trunc('month', i.income_date)::date as month,
           sum(i.amount)::numeric as total
    from public.incomes i
    join hh on hh.household_id = i.household_id
    group by 1
  ),
  expenses as (
    select date_trunc('month', e.expense_date)::date as month,
           sum(e.amount)::numeric as total
    from public.expenses e
    join hh on hh.household_id = e.household_id
    group by 1
  )
  select m.month::date,
         coalesce(s.total, 0) + coalesce(i.total, 0) as income,
         coalesce(e.total, 0) as expenses,
         coalesce(s.total, 0) + coalesce(i.total, 0) - coalesce(e.total, 0) as surplus
  from months m
  left join salaries s on s.month = m.month
  left join incomes i on i.month = m.month
  left join expenses e on e.month = m.month
  order by m.month
$$;

grant execute on function public.get_monthly_surpluses() to authenticated;