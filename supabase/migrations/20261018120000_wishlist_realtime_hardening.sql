-- =============================================================
-- Quiero comprar: Realtime entre miembros + hardening de la
-- política UPDATE (misma convención que el resto del esquema).
-- 1) wishlist_items debe estar en la publicación supabase_realtime
--    para que el canal del hogar reciba sus cambios.
-- 2) La política UPDATE replica su USING en WITH CHECK para que
--    una fila no pueda moverse a otro hogar al editarla.
-- =============================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wishlist_items'
  ) then
    alter publication supabase_realtime add table public.wishlist_items;
  end if;
end $$;

drop policy if exists "wishlist: editar del hogar" on public.wishlist_items;

create policy "wishlist: editar del hogar"
  on public.wishlist_items for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
