-- Learn: flashcard decks with SM-2 review state, quizzes with attempts, and
-- gamification (XP events, streaks, badges).
--
-- Ownership model: decks and quizzes have a nullable owner_id. NULL means
-- official content (managed by admins in a later migration); a user id
-- means personal content. Everyone signed in can read published official
-- content; only the owner can read or change personal content.
--
-- XP is written exclusively by award_xp(); there is deliberately no insert
-- policy on xp_events or streaks.

-- ---------------------------------------------------------------------------
-- Flashcards
-- ---------------------------------------------------------------------------
create table if not exists public.decks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text,
  subject      text,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists decks_owner_id_idx on public.decks (owner_id);

create table if not exists public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  deck_id     uuid not null references public.decks (id) on delete cascade,
  front       text not null check (char_length(front) between 1 and 2000),
  back        text not null check (char_length(back) between 1 and 4000),
  hint        text,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists flashcards_deck_id_sort_idx on public.flashcards (deck_id, sort);

-- One row per (card, user): the SM-2 state. Absent row = never reviewed.
create table if not exists public.flashcard_reviews (
  card_id        uuid not null references public.flashcards (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  ease_factor    numeric(4,2) not null default 2.50 check (ease_factor >= 1.3),
  interval_days  int not null default 0 check (interval_days >= 0),
  repetitions    int not null default 0 check (repetitions >= 0),
  due_at         timestamptz not null default now(),
  last_grade     smallint check (last_grade between 0 and 5),
  reviewed_at    timestamptz,
  primary key (card_id, user_id)
);
create index if not exists flashcard_reviews_user_due_idx
  on public.flashcard_reviews (user_id, due_at);

-- ---------------------------------------------------------------------------
-- Quizzes
-- ---------------------------------------------------------------------------
create table if not exists public.quizzes (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text,
  subject      text,
  published    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists quizzes_owner_id_idx on public.quizzes (owner_id);

create table if not exists public.quiz_questions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  kind         text not null default 'mcq' check (kind in ('mcq', 'true_false')),
  prompt       text not null check (char_length(prompt) between 1 and 2000),
  explanation  text,
  sort         int not null default 0
);
create index if not exists quiz_questions_quiz_id_sort_idx on public.quiz_questions (quiz_id, sort);

create table if not exists public.quiz_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.quiz_questions (id) on delete cascade,
  text         text not null check (char_length(text) between 1 and 500),
  is_correct   boolean not null default false,
  sort         int not null default 0
);
create index if not exists quiz_options_question_id_sort_idx on public.quiz_options (question_id, sort);

create table if not exists public.quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  score        int not null default 0 check (score >= 0),
  max_score    int not null default 0 check (max_score >= 0),
  constraint quiz_attempts_score_within_max check (score <= max_score)
);
create index if not exists quiz_attempts_user_quiz_idx on public.quiz_attempts (user_id, quiz_id, started_at desc);

create table if not exists public.quiz_answers (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null references public.quiz_attempts (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  question_id  uuid not null references public.quiz_questions (id) on delete cascade,
  option_id    uuid references public.quiz_options (id) on delete set null,
  correct      boolean not null default false
);
create index if not exists quiz_answers_attempt_id_idx on public.quiz_answers (attempt_id);

-- ---------------------------------------------------------------------------
-- Gamification
-- ---------------------------------------------------------------------------
create table if not exists public.xp_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  kind           text not null check (kind in (
                   'card_reviewed', 'card_reviewed_well', 'quiz_question_correct',
                   'quiz_completed', 'session_completed', 'assignment_completed',
                   'daily_first_activity')),
  ref_id         uuid,
  qty            int not null default 1 check (qty between 1 and 200),
  points         int not null check (points >= 0),
  activity_date  date not null,
  created_at     timestamptz not null default now()
);
-- An event with a reference is paid at most once.
create unique index if not exists xp_events_idempotent_idx
  on public.xp_events (user_id, kind, ref_id) where ref_id is not null;
-- The daily bonus is paid at most once per local day.
create unique index if not exists xp_events_daily_bonus_idx
  on public.xp_events (user_id, activity_date) where kind = 'daily_first_activity';
create index if not exists xp_events_user_created_idx on public.xp_events (user_id, created_at desc);

create table if not exists public.streaks (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  current_streak      int not null default 0 check (current_streak >= 0),
  longest_streak      int not null default 0 check (longest_streak >= 0),
  last_activity_date  date,
  updated_at          timestamptz not null default now()
);

create table if not exists public.badges (
  slug         text primary key,
  name         text not null,
  description  text not null,
  icon         text not null,
  rule_kind    text not null check (rule_kind in (
                 'xp_total', 'streak', 'cards_reviewed', 'quizzes_completed', 'perfect_quizzes')),
  threshold    int not null check (threshold > 0),
  sort         int not null default 0
);

create table if not exists public.user_badges (
  user_id     uuid not null references auth.users (id) on delete cascade,
  badge_slug  text not null references public.badges (slug) on delete cascade,
  awarded_at  timestamptz not null default now(),
  primary key (user_id, badge_slug)
);

insert into public.badges (slug, name, description, icon, rule_kind, threshold, sort) values
  ('first_review',  'First Review',  'Reviewed your first flashcard',   '🎯', 'cards_reviewed',    1,    10),
  ('century',       'Century',       'Reviewed 100 flashcards',         '💯', 'cards_reviewed',    100,  20),
  ('week_streak',   'On a Roll',     'Studied 7 days in a row',         '🔥', 'streak',            7,    30),
  ('month_streak',  'Unstoppable',   'Studied 30 days in a row',        '🏆', 'streak',            30,   40),
  ('quiz_starter',  'Quiz Starter',  'Completed your first quiz',       '📝', 'quizzes_completed', 1,    50),
  ('perfect_quiz',  'Perfect Score', 'Scored full marks on a quiz',     '⭐', 'perfect_quizzes',   1,    60),
  ('scholar',       'Scholar',       'Earned 1,000 XP',                 '🎓', 'xp_total',          1000, 70)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- award_xp: the only writer of xp_events, streaks and user_badges.
--
-- SECURITY DEFINER so it can write tables the caller has no insert policy
-- on; search_path locked and EXECUTE revoked from anon so it cannot be
-- called without a session. The user is always auth.uid(), never a param.
-- ---------------------------------------------------------------------------
create or replace function public.award_xp(
  p_kind text,
  p_ref  uuid default null,
  p_qty  int  default 1,
  p_tz   text default 'Asia/Kolkata'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_base      int;
  v_qty       int;
  v_points    int;
  v_today     date;
  v_prev_date date;
  v_inserted  boolean := false;
  v_streak    int := 0;
  v_longest   int := 0;
  v_total     int := 0;
  v_badges    text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  v_base := case p_kind
    when 'card_reviewed'         then 2
    when 'card_reviewed_well'    then 5
    when 'quiz_question_correct' then 5
    when 'quiz_completed'        then 20
    when 'session_completed'     then 15
    when 'assignment_completed'  then 30
    else null
  end;
  if v_base is null then
    raise exception 'unknown xp kind: %', p_kind using errcode = '22023';
  end if;

  v_qty := greatest(1, least(coalesce(p_qty, 1), 200));
  v_points := v_base * v_qty;

  -- Today in the caller's timezone; an invalid name falls back to IST.
  begin
    v_today := (now() at time zone p_tz)::date;
  exception when others then
    v_today := (now() at time zone 'Asia/Kolkata')::date;
  end;

  if p_ref is not null then
    insert into public.xp_events (user_id, kind, ref_id, qty, points, activity_date)
    values (v_uid, p_kind, p_ref, v_qty, v_points, v_today)
    on conflict (user_id, kind, ref_id) where ref_id is not null do nothing;
    v_inserted := found;
  else
    insert into public.xp_events (user_id, kind, qty, points, activity_date)
    values (v_uid, p_kind, v_qty, v_points, v_today);
    v_inserted := true;
  end if;

  if v_inserted then
    select last_activity_date into v_prev_date
      from public.streaks where user_id = v_uid;

    if v_prev_date is null or v_prev_date < v_today then
      -- First activity of the day: bonus points, and the streak moves.
      insert into public.xp_events (user_id, kind, qty, points, activity_date)
      values (v_uid, 'daily_first_activity', 1, 10, v_today)
      on conflict (user_id, activity_date) where kind = 'daily_first_activity' do nothing;

      insert into public.streaks (user_id, current_streak, longest_streak, last_activity_date, updated_at)
      values (v_uid, 1, 1, v_today, now())
      on conflict (user_id) do update set
        current_streak = case
          when public.streaks.last_activity_date = v_today - 1 then public.streaks.current_streak + 1
          else 1 end,
        longest_streak = greatest(
          public.streaks.longest_streak,
          case
            when public.streaks.last_activity_date = v_today - 1 then public.streaks.current_streak + 1
            else 1 end),
        last_activity_date = v_today,
        updated_at = now();
    end if;
  end if;

  select current_streak, longest_streak into v_streak, v_longest
    from public.streaks where user_id = v_uid;
  select coalesce(sum(points), 0) into v_total
    from public.xp_events where user_id = v_uid;

  -- Badges whose rule is now met and not yet awarded.
  with awarded as (
    insert into public.user_badges (user_id, badge_slug)
    select v_uid, b.slug
      from public.badges b
     where not exists (
             select 1 from public.user_badges ub
              where ub.user_id = v_uid and ub.badge_slug = b.slug)
       and case b.rule_kind
             when 'xp_total' then v_total >= b.threshold
             when 'streak'   then coalesce(v_streak, 0) >= b.threshold
             when 'cards_reviewed' then
               (select coalesce(sum(e.qty), 0) from public.xp_events e
                 where e.user_id = v_uid
                   and e.kind in ('card_reviewed', 'card_reviewed_well')) >= b.threshold
             when 'quizzes_completed' then
               (select count(*) from public.xp_events e
                 where e.user_id = v_uid and e.kind = 'quiz_completed') >= b.threshold
             when 'perfect_quizzes' then
               (select count(*) from public.quiz_attempts a
                 where a.user_id = v_uid and a.finished_at is not null
                   and a.max_score > 0 and a.score = a.max_score) >= b.threshold
             else false
           end
    returning badge_slug
  )
  select coalesce(array_agg(badge_slug), '{}') into v_badges from awarded;

  return jsonb_build_object(
    'awarded',        v_inserted,
    'points',         case when v_inserted then v_points else 0 end,
    'total_xp',       v_total,
    'streak',         coalesce(v_streak, 0),
    'longest_streak', coalesce(v_longest, 0),
    'new_badges',     to_jsonb(v_badges)
  );
end;
$$;

revoke execute on function public.award_xp(text, uuid, int, text) from public, anon;
grant  execute on function public.award_xp(text, uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- learn_stats: one call for the hub. SECURITY INVOKER (the default), so it
-- runs under the caller's RLS and can only ever see their own rows.
-- ---------------------------------------------------------------------------
create or replace function public.learn_stats()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'total_xp', coalesce((select sum(points) from public.xp_events where user_id = auth.uid()), 0),
    'streak', coalesce((select current_streak from public.streaks where user_id = auth.uid()), 0),
    'longest_streak', coalesce((select longest_streak from public.streaks where user_id = auth.uid()), 0),
    'due_reviews', (select count(*) from public.flashcard_reviews
                     where user_id = auth.uid() and due_at <= now()),
    'cards_reviewed', coalesce((select sum(qty) from public.xp_events
                                 where user_id = auth.uid()
                                   and kind in ('card_reviewed', 'card_reviewed_well')), 0),
    'badges', coalesce((select jsonb_agg(badge_slug order by awarded_at)
                          from public.user_badges where user_id = auth.uid()), '[]'::jsonb)
  );
$$;

revoke execute on function public.learn_stats() from public, anon;
grant  execute on function public.learn_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.decks             enable row level security;
alter table public.flashcards        enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.quizzes           enable row level security;
alter table public.quiz_questions    enable row level security;
alter table public.quiz_options      enable row level security;
alter table public.quiz_attempts     enable row level security;
alter table public.quiz_answers      enable row level security;
alter table public.xp_events         enable row level security;
alter table public.streaks           enable row level security;
alter table public.badges            enable row level security;
alter table public.user_badges       enable row level security;

-- Content containers: own, or official and published.
drop policy if exists decks_select on public.decks;
drop policy if exists decks_insert on public.decks;
drop policy if exists decks_update on public.decks;
drop policy if exists decks_delete on public.decks;
create policy decks_select on public.decks for select to authenticated
  using (owner_id = auth.uid() or (owner_id is null and published));
create policy decks_insert on public.decks for insert to authenticated
  with check (owner_id = auth.uid());
create policy decks_update on public.decks for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy decks_delete on public.decks for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists quizzes_select on public.quizzes;
drop policy if exists quizzes_insert on public.quizzes;
drop policy if exists quizzes_update on public.quizzes;
drop policy if exists quizzes_delete on public.quizzes;
create policy quizzes_select on public.quizzes for select to authenticated
  using (owner_id = auth.uid() or (owner_id is null and published));
create policy quizzes_insert on public.quizzes for insert to authenticated
  with check (owner_id = auth.uid());
create policy quizzes_update on public.quizzes for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy quizzes_delete on public.quizzes for delete to authenticated
  using (owner_id = auth.uid());

-- Content items: readable when the container is, writable when owned.
drop policy if exists flashcards_select on public.flashcards;
drop policy if exists flashcards_insert on public.flashcards;
drop policy if exists flashcards_update on public.flashcards;
drop policy if exists flashcards_delete on public.flashcards;
create policy flashcards_select on public.flashcards for select to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id
                   and (d.owner_id = auth.uid() or (d.owner_id is null and d.published))));
create policy flashcards_insert on public.flashcards for insert to authenticated
  with check (exists (select 1 from public.decks d where d.id = deck_id and d.owner_id = auth.uid()));
create policy flashcards_update on public.flashcards for update to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.owner_id = auth.uid()))
  with check (exists (select 1 from public.decks d where d.id = deck_id and d.owner_id = auth.uid()));
create policy flashcards_delete on public.flashcards for delete to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.owner_id = auth.uid()));

drop policy if exists quiz_questions_select on public.quiz_questions;
drop policy if exists quiz_questions_insert on public.quiz_questions;
drop policy if exists quiz_questions_update on public.quiz_questions;
drop policy if exists quiz_questions_delete on public.quiz_questions;
create policy quiz_questions_select on public.quiz_questions for select to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id
                   and (q.owner_id = auth.uid() or (q.owner_id is null and q.published))));
create policy quiz_questions_insert on public.quiz_questions for insert to authenticated
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = auth.uid()));
create policy quiz_questions_update on public.quiz_questions for update to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = auth.uid()))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = auth.uid()));
create policy quiz_questions_delete on public.quiz_questions for delete to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = auth.uid()));

drop policy if exists quiz_options_select on public.quiz_options;
drop policy if exists quiz_options_insert on public.quiz_options;
drop policy if exists quiz_options_update on public.quiz_options;
drop policy if exists quiz_options_delete on public.quiz_options;
create policy quiz_options_select on public.quiz_options for select to authenticated
  using (exists (select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
                  where qq.id = question_id
                    and (q.owner_id = auth.uid() or (q.owner_id is null and q.published))));
create policy quiz_options_insert on public.quiz_options for insert to authenticated
  with check (exists (select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
                       where qq.id = question_id and q.owner_id = auth.uid()));
create policy quiz_options_update on public.quiz_options for update to authenticated
  using (exists (select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
                  where qq.id = question_id and q.owner_id = auth.uid()))
  with check (exists (select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
                       where qq.id = question_id and q.owner_id = auth.uid()));
create policy quiz_options_delete on public.quiz_options for delete to authenticated
  using (exists (select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
                  where qq.id = question_id and q.owner_id = auth.uid()));

-- Per-user rows: plain own-row policies.
do $$
declare
  t text;
begin
  foreach t in array array['flashcard_reviews', 'quiz_attempts', 'quiz_answers']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
      t || '_delete_own', t);
  end loop;
end $$;

-- Read-only to the user; only award_xp() writes these.
drop policy if exists xp_events_select_own on public.xp_events;
create policy xp_events_select_own on public.xp_events for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists streaks_select_own on public.streaks;
create policy streaks_select_own on public.streaks for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_badges_select_own on public.user_badges;
create policy user_badges_select_own on public.user_badges for select to authenticated
  using (auth.uid() = user_id);

-- The badge catalogue is public to signed-in users.
drop policy if exists badges_select_all on public.badges;
create policy badges_select_all on public.badges for select to authenticated using (true);
