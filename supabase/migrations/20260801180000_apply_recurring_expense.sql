-- Aplicar servicios de uno en uno (wizard "Aplicar al mes").
-- Reemplaza al bulk apply_recurring_expenses(p_month).
drop function if exists public.apply_recurring_expenses(date);

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
