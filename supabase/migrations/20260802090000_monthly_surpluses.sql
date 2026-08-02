-- =============================================================
-- Sobrantes por mes: seguimiento histórico
-- get_monthly_surpluses(): una fila por mes desde el primer mes
-- con actividad (salarios o gastos) hasta el mes actual.
-- Sobrante del mes M = Σ salarios con pay_date en M
--                     − Σ gastos con expense_date en M.
-- Coincide con la semántica de get_running_balance (la suma
-- acumulada de los sobrantes mensuales es el saldo disponible).
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
  salaries as (
    select date_trunc('month', s.pay_date)::date as month,
           sum(s.amount)::numeric as total
    from public.salaries s
    join hh on hh.household_id = s.household_id
    group by 1
  ),
  expenses as (
    select date_trunc('month', e.expense_date)::date as month,
           sum(e.amount)::numeric as total
    from public.expenses e
    join hh on hh.household_id = e.household_id
    group by 1
  ),
  range as (
    select least(
             (select min(month) from salaries),
             (select min(month) from expenses)
           ) as first_month,
           date_trunc('month', current_date)::date as last_month
  )
  select d.month::date as month,
         coalesce(s.total, 0) as income,
         coalesce(e.total, 0) as expenses,
         coalesce(s.total, 0) - coalesce(e.total, 0) as surplus
  from range
  cross join generate_series(
    range.first_month::timestamp,
    range.last_month::timestamp,
    interval '1 month'
  ) d(month)
  left join salaries s on s.month = d.month::date
  left join expenses e on e.month = d.month::date
  order by d.month
$$;

grant execute on function public.get_monthly_surpluses() to authenticated;
