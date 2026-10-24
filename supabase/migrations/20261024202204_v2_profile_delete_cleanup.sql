-- =============================================================
-- v2.0 — Borrado de cuenta con metas personales.
-- owner_id cascadea las metas, pero savings_movements.goal_id es
-- RESTRICT para proteger el historial. Antes de borrar el perfil se
-- eliminan los movimientos/planes de sus metas personales.
-- =============================================================

create or replace function public.cleanup_personal_savings_before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists profiles_cleanup_savings on public.profiles;
create trigger profiles_cleanup_savings
before delete on public.profiles
for each row execute function public.cleanup_personal_savings_before_profile_delete();
