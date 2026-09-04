-- Study planner: per-user study preferences, generated plans and their
-- sessions. Same RLS discipline as 0001: every table is scoped to
-- auth.uid() because the browser talks to Supabase directly.

-- ---------------------------------------------------------------------------
-- user_settings — one row per user, created lazily by the app on first save.
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  timezone           text not null default 'Asia/Kolkata',
  study_start        time not null default '16:00',
  study_end          time not null default '21:00',
  daily_max_minutes  int  not null default 180
                       check (daily_max_minutes between 30 and 720),
  updated_at         timestamptz not null default now(),
  constraint user_settings_window check (study_end > study_start)
);

-- ---------------------------------------------------------------------------
-- study_plans — one row per generation. History is kept so completed
-- sessions from earlier plans still count toward an assignment.
-- ---------------------------------------------------------------------------
create table if not exists public.study_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  generated_at  timestamptz not null default now(),
  horizon_days  int not null default 14 check (horizon_days between 1 and 60),
  params        jsonb not null default '{}'::jsonb,
  shortfalls    jsonb not null default '[]'::jsonb
);

create index if not exists study_plans_user_id_generated_at_idx
  on public.study_plans (user_id, generated_at desc);

-- ---------------------------------------------------------------------------
-- study_plan_sessions — user_id is denormalised so the RLS check is a plain
-- column comparison rather than a join through study_plans.
-- ---------------------------------------------------------------------------
create table if not exists public.study_plan_sessions (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references public.study_plans (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  assignment_id  uuid references public.assignments (id) on delete cascade,
  subject        text not null,
  title          text not null,
  difficulty     text not null default 'medium'
                   check (difficulty in ('easy','medium','hard')),
  date           date not null,
  start_time     time not null,
  end_time       time not null,
  completed_at   timestamptz,
  constraint study_plan_sessions_end_after_start check (end_time > start_time)
);

create index if not exists study_plan_sessions_user_id_date_idx
  on public.study_plan_sessions (user_id, date, start_time);
create index if not exists study_plan_sessions_plan_id_idx
  on public.study_plan_sessions (plan_id);
create index if not exists study_plan_sessions_assignment_id_idx
  on public.study_plan_sessions (assignment_id)
  where completed_at is not null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.user_settings       enable row level security;
alter table public.study_plans         enable row level security;
alter table public.study_plan_sessions enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['user_settings', 'study_plans', 'study_plan_sessions']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (auth.uid() = user_id)', t || '_select_own', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (auth.uid() = user_id)', t || '_insert_own', t);

    execute format(
      'create policy %I on public.%I for update to authenticated
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)', t || '_update_own', t);

    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (auth.uid() = user_id)', t || '_delete_own', t);
  end loop;
end $$;
