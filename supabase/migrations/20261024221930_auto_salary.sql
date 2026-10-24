-- =============================================================
-- Nómina automática opt-in.
-- Cada miembro puede activar auto_salary. Al abrir/reconectar, el
-- RPC run_due_salaries crea la fila del mes actual cuando llega su
-- payday, usando el último salario registrado. No inventa si no hay
-- historial ni si la fila del mes ya existe.
-- =============================================================

alter table public.profiles
  add column if not exists auto_salary boolean not null default false;

create or replace function public.run_due_salaries()
returns table (created integer, skipped integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
  v_member record;
  v_last record;
  v_month date := date_trunc('month', current_date)::date;
  v_payday date;
  v_created integer := 0;
  v_skipped integer := 0;
  v_inserted integer := 0;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select household_id into v_household
  from public.profiles
  where id = v_uid;

  if v_household is null then
    return query select 0, 0;
    return;
  end if;

  for v_member in
    select p.id, p.payday
    from public.profiles p
    where p.household_id = v_household
      and p.auto_salary = true
  loop
    select s.amount, s.month
    into v_last
    from public.salaries s
    where s.profile_id = v_member.id
      and s.month < v_month
    order by s.month desc
    limit 1;

    if v_last.amount is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_payday := make_date(
      extract(year from v_month)::int,
      extract(month from v_month)::int,
      least(
        v_member.payday,
        extract(day from (v_month + interval '1 month' - interval '1 day'))::int
      )
    );

    if v_payday > current_date then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if exists (
      select 1 from public.salaries
      where profile_id = v_member.id and month = v_month
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.salaries (household_id, profile_id, amount, month, pay_date)
    values (v_household, v_member.id, v_last.amount, v_month, v_payday)
    on conflict (profile_id, month) do nothing;

    get diagnostics v_inserted = row_count;
    if v_inserted > 0 then
      v_created := v_created + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  return query select v_created, v_skipped;
end;
$$;

revoke all on function public.run_due_salaries() from public, anon;
grant execute on function public.run_due_salaries() to authenticated;
grant execute on function public.run_due_salaries() to service_role;

-- Activar para los dos miembros actuales del hogar (pedido explícito).
update public.profiles p
set auto_salary = true
where p.id = (
  select id from auth.users where email = 'jhotis12@gmail.com'
)
or (
  p.household_id = (
    select household_id from public.profiles
    where id = (select id from auth.users where email = 'jhotis12@gmail.com')
  )
  and p.full_name = 'Charith'
);
