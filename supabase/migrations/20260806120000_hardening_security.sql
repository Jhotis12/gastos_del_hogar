-- =============================================================
-- Hardening de seguridad (2026-08-06)
-- 1) Códigos de invitación: 10 chars hex mayúsculas (40 bits) en vez de
--    6 chars hex (16^6 = 16.7M, enumerable por fuerza bruta). Se regeneran
--    TODOS los códigos existentes (los viejos quedan inválidos).
-- 2) Rate limit en get_household_by_code: 10 búsquedas por usuario cada
--    10 minutos.
-- 3) Políticas UPDATE con WITH CHECK en todas las tablas (evita mover filas
--    a otro hogar o reasignar ownership).
-- 4) Bucket receipts: límite de 8MB y solo imágenes.
-- =============================================================

-- ---------- 1) Códigos de invitación ----------

create or replace function public.generate_invite_code()
returns text
language sql
volatile
set search_path = public
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
$$;

-- Regenerar códigos existentes (reintenta ante una colisión improbable)
do $$
declare
  h record;
begin
  for h in select id from public.households loop
    loop
      begin
        update public.households
        set invite_code = public.generate_invite_code()
        where id = h.id;
        exit;
      exception when unique_violation then
        -- código repetido: genera otro
      end;
    end loop;
  end loop;
end $$;

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
  values (new_id, p_name, public.generate_invite_code());

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

-- ---------- 2) Rate limit en la búsqueda por código ----------

create table if not exists public.invite_lookup_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts int not null default 1,
  window_start timestamptz not null default now()
);

alter table public.invite_lookup_attempts enable row level security;

create or replace function public.get_household_by_code(p_code text)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  attempt record;
begin
  if uid is null then
    return;
  end if;

  -- Ventana deslizante de 10 minutos, máximo 10 búsquedas por usuario.
  select * into attempt
  from public.invite_lookup_attempts
  where user_id = uid
  for update;

  if attempt.user_id is null then
    insert into public.invite_lookup_attempts (user_id)
    values (uid);
  elsif attempt.window_start < now() - interval '10 minutes' then
    update public.invite_lookup_attempts
    set attempts = 1, window_start = now()
    where user_id = uid;
  elsif attempt.attempts >= 10 then
    raise exception 'Demasiados intentos de unión. Espera 10 minutos e inténtalo de nuevo.';
  else
    update public.invite_lookup_attempts
    set attempts = attempts + 1
    where user_id = uid;
  end if;

  return query
    select h.id, h.name, h.invite_code
    from public.households h
    where h.invite_code = upper(p_code);
end;
$$;

-- ---------- 3) Políticas UPDATE con WITH CHECK ----------

drop policy if exists "profiles: editar propio" on public.profiles;
create policy "profiles: editar propio"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "households: editar del hogar" on public.households;
create policy "households: editar del hogar"
  on public.households for update
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

drop policy if exists "salaries: editar el propio" on public.salaries;
create policy "salaries: editar el propio"
  on public.salaries for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists "categories: editar del hogar" on public.categories;
create policy "categories: editar del hogar"
  on public.categories for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "expenses: editar del hogar" on public.expenses;
create policy "expenses: editar del hogar"
  on public.expenses for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "incomes: editar del hogar" on public.incomes;
create policy "incomes: editar del hogar"
  on public.incomes for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "recurring: editar del hogar" on public.recurring_expenses;
create policy "recurring: editar del hogar"
  on public.recurring_expenses for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "budgets: editar del hogar" on public.category_budgets;
create policy "budgets: editar del hogar"
  on public.category_budgets for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "savings: editar del hogar" on public.savings_goals;
create policy "savings: editar del hogar"
  on public.savings_goals for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "receipts: editar del hogar" on public.receipts;
create policy "receipts: editar del hogar"
  on public.receipts for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Storage: avatares (actualizar el propio no puede cambiar el path)
drop policy if exists "avatars: actualizar el propio" on storage.objects;
create policy "avatars: actualizar el propio"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 4) Bucket receipts: tamaño y MIME ----------

update storage.buckets
set file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'receipts';
