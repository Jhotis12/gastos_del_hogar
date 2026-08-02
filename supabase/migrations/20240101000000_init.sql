-- =============================================================
-- App de Gastos del Hogar — Esquema Supabase/PostgreSQL
-- Ejecutar en el SQL Editor del proyecto Supabase.
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- TABLAS ----------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.salaries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  month date not null,
  created_at timestamptz not null default now(),
  unique (profile_id, month)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  icon text not null default 'tag',
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  paid_by uuid references public.profiles(id) on delete set null,
  recurring_id uuid,
  receipt_id uuid references public.receipts(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null default '',
  expense_date date not null default current_date,
  splits uuid[],
  created_at timestamptz not null default now()
);

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  paid_by uuid references public.profiles(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null default '',
  frequency text not null default 'monthly'
    check (frequency in ('monthly', 'bimonthly', 'quarterly', 'yearly')),
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.expenses
  add constraint expenses_recurring_id_fkey
  foreign key (recurring_id) references public.recurring_expenses(id) on delete set null;

create table public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month date not null,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (category_id, month)
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  saved_amount numeric(12, 2) not null default 0 check (saved_amount >= 0),
  target_date date,
  created_at timestamptz not null default now()
);

-- ---------- ÍNDICES ----------

create index if not exists expenses_household_date_idx on public.expenses (household_id, expense_date);
create index if not exists expenses_recurring_idx on public.expenses (recurring_id);
create index if not exists salaries_household_month_idx on public.salaries (household_id, month);
create index if not exists categories_household_idx on public.categories (household_id);
create index if not exists recurring_household_due_idx on public.recurring_expenses (household_id, next_due_date);
create index if not exists budgets_household_month_idx on public.category_budgets (household_id, month);
create index if not exists savings_household_idx on public.savings_goals (household_id);

-- ---------- TRIGGERS ----------

-- Crea el perfil automáticamente cuando un usuario se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- FUNCIÓN: crear hogar ----------
-- Crea el hogar, asigna al usuario como miembro e inserta las categorías
-- por defecto, todo en una transacción. Se usa RPC en vez de INSERT
-- (RETURNING) porque la política SELECT de households exige ser miembro,
-- y al insertar todavía no lo es (PostgREST devolvería 403/PGRST106).
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid := gen_random_uuid();
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Se requiere sesión iniciada';
  end if;

  insert into public.households (id, name, invite_code)
  values (new_id, p_name, upper(substr(md5(random()::text), 1, 6)));

  update public.profiles
  set household_id = new_id
  where id = uid;

  insert into public.categories (household_id, name, color, icon) values
    (new_id, 'Vivienda', '#6366f1', 'home'),
    (new_id, 'Comida', '#f59e0b', 'utensils'),
    (new_id, 'Transporte', '#10b981', 'car'),
    (new_id, 'Servicios', '#0ea5e9', 'zap'),
    (new_id, 'Salud', '#ef4444', 'heart'),
    (new_id, 'Ocio', '#ec4899', 'gamepad'),
    (new_id, 'Otros', '#8b5cf6', 'tag');

  return new_id;
end;
$$;

-- ---------- FUNCIÓN: buscar hogar por código de invitación ----------
-- Se usa al unirse a un hogar: la RLS impide a los no-miembros leer
-- la tabla households, por eso se resuelve vía RPC security definer.
-- Exige sesión iniciada (auth.uid()) para no exponer el lookup a anon.
create or replace function public.get_household_by_code(p_code text)
returns table (id uuid, name text, invite_code text)
language sql
stable
security definer
set search_path = public
as $$
  select h.id, h.name, h.invite_code
  from public.households h
  where h.invite_code = upper(p_code)
    and auth.uid() is not null
$$;

-- ---------- FUNCIÓN: aplicar un gasto recurrente ----------
-- Aplica UN servicio activo y vencido (next_due_date <= fin del mes
-- seleccionado) a la tabla expenses (con vínculo recurring_id para el
-- historial por servicio) y avanza su next_due_date según la frecuencia.
-- Devuelve 1 si aplicó, 0 si no era aplicable (fuera del mes, inactivo,
-- pertenencia a otro hogar o ya existe un gasto del servicio en el mes).
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

-- ---------- ROW LEVEL SECURITY ----------

-- Función auxiliar: ¿auth.uid() pertenece al hogar dado?
create or replace function public.is_household_member(check_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.household_id = check_household
  );
$$;

-- profiles
alter table public.profiles enable row level security;

create policy "profiles: ver propio"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: ver compañeros de hogar"
  on public.profiles for select
  using (public.is_household_member(household_id));

create policy "profiles: crear propio"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: editar propio"
  on public.profiles for update
  using (auth.uid() = id);

-- households
alter table public.households enable row level security;

create policy "households: ver mi hogar"
  on public.households for select
  using (public.is_household_member(id));

create policy "households: crear hogar"
  on public.households for insert
  with check (true);

create policy "households: editar del hogar"
  on public.households for update
  using (public.is_household_member(id));

create policy "households: eliminar del hogar"
  on public.households for delete
  using (public.is_household_member(id));

-- salaries
alter table public.salaries enable row level security;

create policy "salaries: ver del hogar"
  on public.salaries for select
  using (public.is_household_member(household_id));

create policy "salaries: registrar el propio"
  on public.salaries for insert
  with check (profile_id = auth.uid() and public.is_household_member(household_id));

create policy "salaries: editar el propio"
  on public.salaries for update
  using (profile_id = auth.uid());

create policy "salaries: eliminar el propio"
  on public.salaries for delete
  using (profile_id = auth.uid());

-- categories
alter table public.categories enable row level security;

create policy "categories: ver del hogar"
  on public.categories for select
  using (public.is_household_member(household_id));

create policy "categories: crear del hogar"
  on public.categories for insert
  with check (public.is_household_member(household_id));

create policy "categories: editar del hogar"
  on public.categories for update
  using (public.is_household_member(household_id));

create policy "categories: eliminar del hogar"
  on public.categories for delete
  using (public.is_household_member(household_id));

-- expenses
alter table public.expenses enable row level security;

create policy "expenses: ver del hogar"
  on public.expenses for select
  using (public.is_household_member(household_id));

create policy "expenses: crear del hogar"
  on public.expenses for insert
  with check (public.is_household_member(household_id));

create policy "expenses: editar del hogar"
  on public.expenses for update
  using (public.is_household_member(household_id));

create policy "expenses: eliminar del hogar"
  on public.expenses for delete
  using (public.is_household_member(household_id));

-- recurring_expenses
alter table public.recurring_expenses enable row level security;

create policy "recurring: ver del hogar"
  on public.recurring_expenses for select
  using (public.is_household_member(household_id));

create policy "recurring: crear del hogar"
  on public.recurring_expenses for insert
  with check (public.is_household_member(household_id));

create policy "recurring: editar del hogar"
  on public.recurring_expenses for update
  using (public.is_household_member(household_id));

create policy "recurring: eliminar del hogar"
  on public.recurring_expenses for delete
  using (public.is_household_member(household_id));

-- category_budgets
alter table public.category_budgets enable row level security;

create policy "budgets: ver del hogar"
  on public.category_budgets for select
  using (public.is_household_member(household_id));

create policy "budgets: crear del hogar"
  on public.category_budgets for insert
  with check (public.is_household_member(household_id));

create policy "budgets: editar del hogar"
  on public.category_budgets for update
  using (public.is_household_member(household_id));

create policy "budgets: eliminar del hogar"
  on public.category_budgets for delete
  using (public.is_household_member(household_id));

-- savings_goals
alter table public.savings_goals enable row level security;

create policy "savings: ver del hogar"
  on public.savings_goals for select
  using (public.is_household_member(household_id));

create policy "savings: crear del hogar"
  on public.savings_goals for insert
  with check (public.is_household_member(household_id));

create policy "savings: editar del hogar"
  on public.savings_goals for update
  using (public.is_household_member(household_id));

create policy "savings: eliminar del hogar"
  on public.savings_goals for delete
  using (public.is_household_member(household_id));

-- receipts
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  parsed_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.receipts enable row level security;

create policy "receipts: ver del hogar"
  on public.receipts for select
  using (public.is_household_member(household_id));

create policy "receipts: crear del hogar"
  on public.receipts for insert
  with check (public.is_household_member(household_id));

create policy "receipts: editar del hogar"
  on public.receipts for update
  using (public.is_household_member(household_id));

create policy "receipts: eliminar del hogar"
  on public.receipts for delete
  using (public.is_household_member(household_id));

-- Realtime: publicar los cambios de las tablas del hogar (sincronización entre miembros)
do $$
declare
  t text;
begin
  foreach t in array array['expenses','salaries','categories','category_budgets','recurring_expenses','savings_goals','receipts','profiles','households']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Grants base (los mismos que Supabase aplica por defecto en proyectos reales)
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
