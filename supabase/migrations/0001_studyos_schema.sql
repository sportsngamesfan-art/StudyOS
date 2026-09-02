-- StudyOS schema: documents, timetable, assignments.
--
-- Every table is scoped to auth.uid() through RLS, so a signed-in user can only
-- ever read or write their own rows. The app talks to Supabase directly from the
-- browser with the anon key, which means RLS is the only thing standing between
-- one user's data and another's -- it is not optional here.

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  filename    text not null,
  file_path   text not null,
  file_size   bigint not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists documents_user_id_created_at_idx
  on public.documents (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- timetable
-- ---------------------------------------------------------------------------
create table if not exists public.timetable (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  subject     text not null,
  day         text not null check (
                day in ('Monday','Tuesday','Wednesday','Thursday',
                        'Friday','Saturday','Sunday')
              ),
  start_time  time not null,
  end_time    time not null,
  room        text,
  created_at  timestamptz not null default now(),
  constraint timetable_end_after_start check (end_time > start_time)
);

create index if not exists timetable_user_id_idx
  on public.timetable (user_id);

-- ---------------------------------------------------------------------------
-- assignments
-- ---------------------------------------------------------------------------
create table if not exists public.assignments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  title           text not null,
  subject         text not null,
  deadline        date not null,
  difficulty      text not null default 'medium'
                    check (difficulty in ('easy','medium','hard')),
  hours_required  numeric(5,1) not null default 2 check (hours_required > 0),
  completed       boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists assignments_user_id_deadline_idx
  on public.assignments (user_id, deadline);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.documents   enable row level security;
alter table public.timetable   enable row level security;
alter table public.assignments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['documents', 'timetable', 'assignments']
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

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded documents
--
-- Private bucket. The app uploads to "<user id>/<filename>", so each policy
-- checks that the first path segment matches the caller's uid.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_storage_select_own on storage.objects;
drop policy if exists documents_storage_insert_own on storage.objects;
drop policy if exists documents_storage_update_own on storage.objects;
drop policy if exists documents_storage_delete_own on storage.objects;

create policy documents_storage_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy documents_storage_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy documents_storage_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy documents_storage_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
