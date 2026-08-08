-- =============================================================
-- Lista de deseos ("Quiero comprar"): items, plan de pago y estado.
-- El motor de cuotas/interés/corte vive en el frontend
-- (modules/wishlist/lib/installments.ts) — aquí solo datos.
-- =============================================================

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  price numeric(12, 2) not null check (price > 0),
  priority text not null default 'deseo'
    check (priority in ('necesidad', 'deseo', 'regalo')),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'comprado', 'descartado')),
  -- Plan de pago: contado o cuotas (con/sin interés)
  payment_method text not null default 'contado'
    check (payment_method in ('contado', 'cuotas')),
  installments_count smallint
    check (installments_count is null or installments_count between 1 and 60),
  interest_rate numeric(5, 2)
    check (interest_rate is null or interest_rate >= 0),
  -- Día de corte de la tarjeta (1-31; se ajusta al fin de mes)
  cutoff_day smallint
    check (cutoff_day is null or cutoff_day between 1 and 31),
  purchase_date date,
  bought_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.wishlist_items enable row level security;

create policy "wishlist: ver del hogar"
  on public.wishlist_items for select
  using (public.is_household_member(household_id));

create policy "wishlist: crear del hogar"
  on public.wishlist_items for insert
  with check (public.is_household_member(household_id));

create policy "wishlist: editar del hogar"
  on public.wishlist_items for update
  using (public.is_household_member(household_id));

create policy "wishlist: eliminar del hogar"
  on public.wishlist_items for delete
  using (public.is_household_member(household_id));

grant select, insert, update, delete on public.wishlist_items to authenticated;
