-- Eliminar una meta de ahorro desde el front, con sus movimientos y planes.
-- Archivar conserva el saldo; eliminar lo saca de los totales. Si el dinero
-- ya se gastó, el usuario debe registrar el gasto correspondiente.

create or replace function public.delete_savings_goal(p_goal uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
  v_owner uuid;
  v_user_household uuid;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select household_id, owner_id
  into v_household, v_owner
  from public.savings_goals
  where id = p_goal;

  if not found then
    raise exception 'Meta no encontrada' using errcode = '22023';
  end if;

  select household_id into v_user_household
  from public.profiles
  where id = v_uid;

  if v_user_household is null or v_user_household <> v_household then
    raise exception 'Sin permisos sobre esta meta' using errcode = '42501';
  end if;

  if v_owner is not null and v_owner <> v_uid then
    raise exception 'Sin permisos sobre esta meta' using errcode = '42501';
  end if;

  delete from public.savings_plans where goal_id = p_goal;
  delete from public.savings_movements where goal_id = p_goal;
  delete from public.savings_goals where id = p_goal;
end;
$$;

revoke all on function public.delete_savings_goal(uuid) from public, anon;
grant execute on function public.delete_savings_goal(uuid) to authenticated;
grant execute on function public.delete_savings_goal(uuid) to service_role;
