-- =============================================================
-- Día de pago por persona + salario heredado + saldo acumulado
-- 1) profiles.payday: día del mes en que cada persona recibe su
--    salario (1-31, default 1; se ajusta al último día del mes).
-- 2) salaries.pay_date: fecha real de la nómina de esa fila
--    (backfill = month para las filas existentes).
-- 3) get_running_balance(p_date): sobrante acumulado a una fecha =
--    Σ salarios (pay_date <= p_date) − Σ gastos (expense_date <= p_date).
-- =============================================================

alter table public.profiles
  add column if not exists payday smallint not null default 1
  check (payday between 1 and 31);

alter table public.salaries
  add column if not exists pay_date date;

update public.salaries
  set pay_date = month
  where pay_date is null;

alter table public.salaries
  alter column pay_date set not null,
  alter column pay_date set default (date_trunc('month', current_date))::date;

-- Índice para el cálculo del saldo acumulado por fechas
create index if not exists salaries_household_paydate_idx
  on public.salaries (household_id, pay_date);
create index if not exists expenses_household_date_idx
  on public.expenses (household_id, expense_date);

-- Sobrante acumulado del hogar del usuario a una fecha dada
create or replace function public.get_running_balance(p_date date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select (
    coalesce((
      select sum(s.amount)::numeric
      from public.salaries s
      where s.household_id = (select household_id from public.profiles where id = auth.uid())
        and s.pay_date <= p_date
    ), 0)
    - coalesce((
      select sum(e.amount)::numeric
      from public.expenses e
      where e.household_id = (select household_id from public.profiles where id = auth.uid())
        and e.expense_date <= p_date
    ), 0)
  );
$$;

grant execute on function public.get_running_balance(date) to authenticated;
