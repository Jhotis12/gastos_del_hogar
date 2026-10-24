-- =============================================================
-- v2.0 — Ahorro por movimientos (1/2): modelo
-- Las metas existentes quedan como compartidas (owner_id null).
-- saved_amount sigue siendo caché; el trigger y el backfill se
-- agregan en las secciones siguientes de esta migración.
-- =============================================================

alter table public.savings_goals
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade,
  add column if not exists archived_at timestamptz;

-- Necesario para validar que movimientos y planes son del hogar de la meta.
create unique index if not exists savings_goals_id_household_key
  on public.savings_goals (id, household_id);

create index if not exists savings_goals_owner_idx
  on public.savings_goals (household_id, owner_id, archived_at);

create table if not exists public.savings_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  goal_id uuid not null,
  member_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  is_active boolean not null default true,
  start_month date not null default date_trunc('month', current_date)::date,
  last_run_month date,
  created_at timestamptz not null default now(),
  constraint savings_plans_goal_household_fkey
    foreign key (goal_id, household_id)
    references public.savings_goals (id, household_id) on delete restrict,
  constraint savings_plans_last_run_check
    check (last_run_month is null or last_run_month >= start_month)
);

create unique index if not exists savings_plans_id_household_key
  on public.savings_plans (id, household_id);

create table if not exists public.savings_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  goal_id uuid not null,
  member_id uuid references public.profiles(id) on delete set null,
  plan_id uuid,
  amount numeric(12, 2) not null check (amount <> 0),
  kind text not null check (kind in ('deposit', 'withdrawal', 'opening', 'auto')),
  movement_date date not null default current_date,
  period_month date,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint savings_movements_goal_household_fkey
    foreign key (goal_id, household_id)
    references public.savings_goals (id, household_id) on delete restrict,
  constraint savings_movements_plan_household_fkey
    foreign key (plan_id, household_id)
    references public.savings_plans (id, household_id) on delete restrict,
  constraint savings_movements_sign_check check (
    (kind = 'withdrawal' and amount < 0)
    or (kind <> 'withdrawal' and amount > 0)
  ),
  constraint savings_movements_member_check check (
    (kind = 'opening' and member_id is null)
    or (kind <> 'opening' and member_id is not null)
  ),
  constraint savings_movements_plan_check check (
    (kind = 'auto' and plan_id is not null and period_month is not null)
    or (kind <> 'auto' and plan_id is null and period_month is null)
  )
);

create index if not exists savings_movements_household_member_date_idx
  on public.savings_movements (household_id, member_id, movement_date);

create index if not exists savings_movements_goal_date_idx
  on public.savings_movements (goal_id, movement_date);

-- Un plan no puede generar dos movimientos para el mismo mes.
create unique index if not exists savings_movements_plan_period_key
  on public.savings_movements (plan_id, period_month)
  where plan_id is not null and period_month is not null and kind = 'auto';

create index if not exists savings_plans_goal_idx
  on public.savings_plans (goal_id);

create index if not exists savings_plans_household_active_idx
  on public.savings_plans (household_id, is_active);

-- Las tablas nuevas nacen después del grant global de la migración inicial.
grant select, insert, update, delete on table public.savings_movements to authenticated;
grant select, insert, update, delete on table public.savings_plans to authenticated;

-- RLS activo desde el inicio; las políticas se definen en esta migración.
alter table public.savings_movements enable row level security;
alter table public.savings_plans enable row level security;

-- Backfill idempotente: el saldo viejo queda como apertura sin dueño.
insert into public.savings_movements (household_id, goal_id, member_id, amount, kind, movement_date, note)
select g.household_id, g.id, null, g.saved_amount, 'opening', current_date, 'Saldo migrado'
from public.savings_goals g
where g.saved_amount > 0
  and not exists (
    select 1
    from public.savings_movements m
    where m.goal_id = g.id and m.kind = 'opening'
  );

-- saved_amount es caché: se recalcula desde los movimientos.
create or replace function public.sync_savings_goal_saved_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.savings_goals g
    set saved_amount = coalesce((
      select sum(m.amount) from public.savings_movements m where m.goal_id = g.id
    ), 0)
    where g.id = old.goal_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.goal_id <> old.goal_id) then
    update public.savings_goals g
    set saved_amount = coalesce((
      select sum(m.amount) from public.savings_movements m where m.goal_id = g.id
    ), 0)
    where g.id = new.goal_id;
  end if;

  return null;
end;
$$;

drop trigger if exists savings_movements_goal_sync on public.savings_movements;
create trigger savings_movements_goal_sync
after insert or update or delete on public.savings_movements
for each row execute function public.sync_savings_goal_saved_amount();

-- Metas: personales solo para su dueño; compartidas para todo el hogar.
create or replace function public.can_access_savings_goal(check_goal uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.savings_goals g
    where g.id = check_goal
      and public.is_household_member(g.household_id)
      and (g.owner_id is null or g.owner_id = auth.uid())
  );
$$;

drop policy if exists "savings: ver del hogar" on public.savings_goals;
create policy "savings: ver del hogar"
  on public.savings_goals for select
  to authenticated
  using (public.is_household_member(household_id) and (owner_id is null or owner_id = auth.uid()));

drop policy if exists "savings: crear del hogar" on public.savings_goals;
create policy "savings: crear del hogar"
  on public.savings_goals for insert
  to authenticated
  with check (public.is_household_member(household_id) and (owner_id is null or owner_id = auth.uid()));

drop policy if exists "savings: editar del hogar" on public.savings_goals;
create policy "savings: editar del hogar"
  on public.savings_goals for update
  to authenticated
  using (public.is_household_member(household_id) and (owner_id is null or owner_id = auth.uid()))
  with check (public.is_household_member(household_id) and (owner_id is null or owner_id = auth.uid()));

drop policy if exists "savings: eliminar del hogar" on public.savings_goals;
create policy "savings: eliminar del hogar"
  on public.savings_goals for delete
  to authenticated
  using (public.is_household_member(household_id) and (owner_id is null or owner_id = auth.uid()));

-- Movimientos: solo de metas accesibles. La escritura directa del cliente
-- queda limitada a movimientos manuales propios; apertura y automáticos
-- los crean la migración y los RPCs security definer.
create policy "savings movements: ver"
  on public.savings_movements for select
  to authenticated
  using (public.can_access_savings_goal(goal_id));

create policy "savings movements: crear"
  on public.savings_movements for insert
  to authenticated
  with check (
    public.can_access_savings_goal(goal_id)
    and member_id = auth.uid()
    and kind in ('deposit', 'withdrawal')
  );

create policy "savings movements: eliminar"
  on public.savings_movements for delete
  to authenticated
  using (
    public.can_access_savings_goal(goal_id)
    and member_id = auth.uid()
    and kind in ('deposit', 'withdrawal')
  );

-- Planes: cada miembro administra los suyos sobre metas que puede ver.
create policy "savings plans: ver"
  on public.savings_plans for select
  to authenticated
  using (member_id = auth.uid() and public.can_access_savings_goal(goal_id));

create policy "savings plans: crear"
  on public.savings_plans for insert
  to authenticated
  with check (member_id = auth.uid() and public.can_access_savings_goal(goal_id));

create policy "savings plans: editar"
  on public.savings_plans for update
  to authenticated
  using (member_id = auth.uid() and public.can_access_savings_goal(goal_id))
  with check (member_id = auth.uid() and public.can_access_savings_goal(goal_id));

create policy "savings plans: eliminar"
  on public.savings_plans for delete
  to authenticated
  using (member_id = auth.uid() and public.can_access_savings_goal(goal_id));

-- Realtime para movimientos y planes compartidos.
alter publication supabase_realtime add table public.savings_movements;
alter publication supabase_realtime add table public.savings_plans;
