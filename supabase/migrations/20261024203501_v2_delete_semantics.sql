-- =============================================================
-- v2.0 — Semántica de borrado de cuenta.
-- Al eliminar un miembro:
--   * sus movimientos en metas compartidas quedan sin member_id
--     (legado), conservando el saldo de la meta;
--   * sus planes se eliminan y los movimientos auto quedan sin plan_id,
--     conservando el monto y el saldo;
--   * las metas personales y sus movimientos se eliminan (trigger).
-- =============================================================

alter table public.savings_movements
  drop constraint if exists savings_movements_member_check;
alter table public.savings_movements
  add constraint savings_movements_member_check check (
    kind <> 'opening' or member_id is null
  );

alter table public.savings_movements
  drop constraint if exists savings_movements_plan_check;
alter table public.savings_movements
  add constraint savings_movements_plan_check check (
    (kind = 'auto' and period_month is not null)
    or (kind <> 'auto' and plan_id is null and period_month is null)
  );

create or replace function public.cleanup_personal_savings_before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Los auto de metas compartidas se conservan como auto sin plan.
  update public.savings_movements m
  set plan_id = null
  from public.savings_plans p
  where m.plan_id = p.id and p.member_id = old.id;

  delete from public.savings_movements m
  using public.savings_goals g
  where m.goal_id = g.id and g.owner_id = old.id;

  delete from public.savings_plans p
  using public.savings_goals g
  where p.goal_id = g.id and g.owner_id = old.id;

  delete from public.savings_goals
  where owner_id = old.id;

  return old;
end;
$$;
