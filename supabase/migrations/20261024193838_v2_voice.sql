-- =============================================================
-- v2.0 — Captura de gastos por voz (fase posterior, con bandera)
-- Intentos de análisis para rate limit. RLS sin políticas: solo la
-- Edge Function con service_role escribe y consulta.
-- =============================================================

create table if not exists public.audio_analysis_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  duration_seconds integer not null default 0
    check (duration_seconds >= 0 and duration_seconds <= 60),
  created_at timestamptz not null default now()
);

create index if not exists audio_attempts_user_date_idx
  on public.audio_analysis_attempts (user_id, created_at desc);

alter table public.audio_analysis_attempts enable row level security;

-- Limpieza de intentos viejos (30 días). La invoca la Edge Function o un cron.
create or replace function public.cleanup_audio_analysis_attempts()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.audio_analysis_attempts
    where created_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.cleanup_audio_analysis_attempts() from public, anon, authenticated;
grant execute on function public.cleanup_audio_analysis_attempts() to service_role;
