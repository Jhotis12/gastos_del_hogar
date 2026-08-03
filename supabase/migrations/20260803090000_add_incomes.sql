-- =============================================================
-- Dinero extra (ingresos fuera de nómina)
-- 1) incomes: monto, descripción, fecha y (opcional) el miembro
--    que recibió el dinero. Se suma al fondo común como ingreso.
-- 2) get_running_balance: + Σ incomes (income_date <= p_date).
-- 3) get_monthly_surpluses: income del mes = salarios + incomes.
-- =============================================================

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null default '',
  income_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists incomes_household_date_idx
  on public.incomes (household_id, income_date);

-- La tabla nace después del grant "all tables" de schema.sql, así que
-- necesita sus propios grants (RLS sigue protegiendo los datos).
grant select on table public.incomes to anon;
grant select, insert, update, delete on table public.incomes to authenticated;

alter table public.incomes enable row level security;

create policy "incomes: ver del hogar"
  on public.incomes for select
  using (public.is_household_member(household_id));

create policy "incomes: crear del hogar"
  on public.incomes for insert
  with check (public.is_household_member(household_id));

create policy "incomes: editar del hogar"
  on public.incomes for update
  using (public.is_household_member(household_id));

create policy "incomes: eliminar del hogar"
  on public.incomes for delete
  using (public.is_household_member(household_id));

-- Sobrante acumulado a una fecha: Σ salarios + Σ dinero extra − Σ gastos
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
    + coalesce((
      select sum(i.amount)::numeric
      from public.incomes i
      where i.household_id = (select household_id from public.profiles where id = auth.uid())
        and i.income_date <= p_date
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

-- Sobrantes por mes: ingreso del mes = salarios + dinero extra
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
  ),
  range as (
    select least(
             (select min(month) from salaries),
             (select min(month) from incomes),
             (select min(month) from expenses)
           ) as first_month,
           date_trunc('month', current_date)::date as last_month
  )
  select d.month::date as month,
         coalesce(s.total, 0) + coalesce(i.total, 0) as income,
         coalesce(e.total, 0) as expenses,
         coalesce(s.total, 0) + coalesce(i.total, 0) - coalesce(e.total, 0) as surplus
  from range
  cross join generate_series(
    range.first_month::timestamp,
    range.last_month::timestamp,
    interval '1 month'
  ) d(month)
  left join salaries s on s.month = d.month::date
  left join incomes i on i.month = d.month::date
  left join expenses e on e.month = d.month::date
  order by d.month
$$;

grant execute on function public.get_monthly_surpluses() to authenticated;

-- Realtime: publicar los cambios de incomes (sincronización entre miembros)
do $$
declare
  t text;
begin
  foreach t in array array['incomes']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
