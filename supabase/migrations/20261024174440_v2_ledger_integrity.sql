-- =============================================================
-- v2.0 — Integridad del ledger (1/2)
-- El pagador de un gasto es obligatorio y debe pertenecer al
-- mismo hogar. No se usa NOT NULL para conservar el legado nulo.
-- =============================================================

create or replace function public.is_household_member(check_household uuid, check_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = check_profile and p.household_id = check_household
  );
$$;

drop policy if exists "expenses: crear del hogar" on public.expenses;
create policy "expenses: crear del hogar"
  on public.expenses for insert
  to authenticated
  with check (
    public.is_household_member(household_id)
    and paid_by is not null
    and public.is_household_member(household_id, paid_by)
  );

-- El USING deja actualizar filas legadas (paid_by nulo) para poder
-- limpiarlas; el WITH CHECK exige pagador válido en el resultado.
drop policy if exists "expenses: editar del hogar" on public.expenses;
create policy "expenses: editar del hogar"
  on public.expenses for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and paid_by is not null
    and public.is_household_member(household_id, paid_by)
  );

-- incomes: member_id nulo = ingreso del hogar; no nulo debe ser del hogar.
drop policy if exists "incomes: crear del hogar" on public.incomes;
create policy "incomes: crear del hogar"
  on public.incomes for insert
  to authenticated
  with check (
    public.is_household_member(household_id)
    and (member_id is null or public.is_household_member(household_id, member_id))
  );

drop policy if exists "incomes: editar del hogar" on public.incomes;
create policy "incomes: editar del hogar"
  on public.incomes for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and (member_id is null or public.is_household_member(household_id, member_id))
  );

-- recurring_expenses: paid_by nulo se conserva como legado; si existe,
-- debe ser del hogar. La UI bloquea aplicar el legado sin responsable.
drop policy if exists "recurring: crear del hogar" on public.recurring_expenses;
create policy "recurring: crear del hogar"
  on public.recurring_expenses for insert
  to authenticated
  with check (
    public.is_household_member(household_id)
    and (paid_by is null or public.is_household_member(household_id, paid_by))
  );

drop policy if exists "recurring: editar del hogar" on public.recurring_expenses;
create policy "recurring: editar del hogar"
  on public.recurring_expenses for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and (paid_by is null or public.is_household_member(household_id, paid_by))
  );

-- Consultas por persona y fecha del ledger v2.
create index if not exists expenses_household_payer_date_idx
  on public.expenses (household_id, paid_by, expense_date);

create index if not exists incomes_household_member_date_idx
  on public.incomes (household_id, member_id, income_date);

create index if not exists salaries_profile_paydate_idx
  on public.salaries (profile_id, pay_date desc);
