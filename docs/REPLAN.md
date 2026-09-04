# StudyOS v2 — Replan

**Status:** proposal for approval · **Date:** 2026-09-04 · **Branch:** `claude/studyos-mvp-pages-onf3dq` → `main`

## Context

StudyOS is a Next.js 14 / Supabase MVP with six working-but-thin pages (auth, dashboard, documents, timetable, assignments, an LLM study plan) and two newer ones (settings, profile). An audit this session found the app is not just unfinished but structurally boxed in:

- **No server-side session.** The only Supabase client is a browser one (localStorage, not cookies). There is no `middleware.ts`, no server client, and API routes cannot identify the caller. Everything below that needs a server — admin, CMS, cron, authenticated APIs — is blocked until this exists.
- **`/api/generate-study-plan` is an open proxy to the Groq key.** It takes an arbitrary `prompt` from anyone on the internet and forwards it. This is a live security hole, not a nice-to-have.
- **No shared UI or data layer.** Card/button/input/alert are raw Tailwind strings copy-pasted 4–7× with two divergent card styles. `getUser()` is called 9 times across 5 files. The three CRUD pages are one template pasted three times. Adding ~15 new pages on this base multiplies the mess linearly.
- Assorted real defects: `transition-theme` is used 24× and never generated (dead class); dark-mode inputs unstyled on two pages; Delete Account deletes nothing; uploaded PDFs cannot be opened (private bucket, no signed URLs); timetable never sorts by time; study plans are never saved.

The product goal is an ICSE/ISC-focused learning platform: study planning, spaced-repetition flashcards, quizzes, XP/streaks, a board-news feed, and an admin CMS that can bulk-ingest syllabi and past papers from PDFs. Decisions already made:

| Decision | Choice |
|---|---|
| LLM | Deterministic algorithms are the default. Groq stays as an **optional extra behind an admin toggle**, with the auth hole fixed. |
| Python PDF | **Both**: a local admin CLI (`scripts/ingest.py`, pypdf) for bulk import, and a Vercel Python function for on-demand student uploads. |
| Sequencing | **Phased**; every phase deploys and is useful on its own. |
| Structure | **Restructure routes** into top-level sections; keep and refactor the existing code, no rewrite. |

## Target route tree

Next.js route groups keep URLs flat while sharing layouts. `(student)` carries the existing sidebar shell; `(admin)` gets its own.

```
app/
  (public)/
    page.tsx                    /            landing
    auth/page.tsx               /auth        login + signup
    auth/callback/route.ts      /auth/callback   PKCE code exchange — fixes email-confirmation links
  (student)/                    ← existing app/dashboard/layout.tsx moves here, unchanged in spirit
    layout.tsx                  sidebar shell + UserProvider + auth gate (server-side via middleware)
    dashboard/page.tsx          /dashboard   overview: due today, streak, XP, next session
    plan/page.tsx               /plan        generated schedule (deterministic; Groq optional)
    plan/timetable/page.tsx     /plan/timetable     ← app/dashboard/timetable
    plan/assignments/page.tsx   /plan/assignments   ← app/dashboard/assignments
    learn/page.tsx              /learn       hub: due reviews, decks, quizzes
    learn/review/page.tsx       /learn/review        SM-2 review queue
    learn/decks/page.tsx        /learn/decks
    learn/decks/[id]/page.tsx   /learn/decks/:id
    learn/quizzes/page.tsx      /learn/quizzes
    learn/quizzes/[id]/page.tsx /learn/quizzes/:id   attempt + results
    library/page.tsx            /library     ← app/dashboard/documents, + open + extract
    news/page.tsx               /news
    settings/page.tsx           /settings    ← app/dashboard/settings
    profile/page.tsx            /profile     ← app/dashboard/profile
  (admin)/
    admin/layout.tsx            role-gated in middleware, not just client redirect
    admin/page.tsx              /admin       counts, last cron status
    admin/users/page.tsx
    admin/curriculum/page.tsx   subjects + chapters (ICSE 9–10, ISC 11–12)
    admin/questions/page.tsx    quiz question bank
    admin/decks/page.tsx        official flashcard decks
    admin/news-sources/page.tsx
    admin/pages/page.tsx        CMS content pages
    admin/announcements/page.tsx
    admin/settings/page.tsx     app_settings incl. the Groq toggle
  api/
    account/delete/route.ts     service-role user deletion (fixes Delete Account)
    study-plan/generate/route.ts  auth-required; server builds the prompt; only if llm_enabled
    cron/refresh-news/route.ts  CRON_SECRET-protected feed refresh
api/                            ← Vercel Python runtime, separate from Next's app/api
  pdf/extract.py                /api/pdf/extract
scripts/
  ingest.py                     local admin CLI
lib/
  supabase/{client,server,middleware}.ts
  planner/schedule.ts           deterministic scheduler (pure)
  srs/sm2.ts                    spaced repetition (pure)
  gamification/{xp,streak,badges}.ts
  news/{parse,fetch}.ts
  database.types.ts
  constants.ts
components/ui/                  Button Card Input Select Label Alert Spinner EmptyState PageHeader Dialog DataTable
middleware.ts
```

`/dashboard/*` gets `redirect()` stubs for one release so old links don't 404.

## Phase 1 — Foundation, security, restructure

This is the largest phase and the one everything else depends on. Nothing user-visible is added except that the app becomes correct.

### 1a. Server-side auth with `@supabase/ssr`

`@supabase/auth-helpers-nextjs` is deprecated and, here, never imported; replace it.

- `lib/supabase/client.ts` — `createBrowserClient(url, key)`; keeps the `isSupabaseConfigured` guard.
- `lib/supabase/server.ts` — `createServerClient` reading/writing Next `cookies()`; used by server components, route handlers, server actions.
- `lib/supabase/middleware.ts` — `updateSession(request)` refreshes the cookie session on every request.
- `middleware.ts` (root) — calls `updateSession`, then: unauthenticated on `(student)`/`(admin)` → `307 /auth`; non-admin on `/admin/*` → `307 /dashboard` (reads `profiles.role` with the server client — one indexed query on admin paths only). `matcher` excludes `_next`, static assets, `/api/cron`, `/api/pdf`.
- `app/(public)/auth/callback/route.ts` — `exchangeCodeForSession(code)` then redirect. **Set Supabase Auth → URL Configuration → Site URL to the Vercel domain and add `/auth/callback` to Redirect URLs**, otherwise confirmation links go to localhost. This is the real fix for "email confirmation broken".
- Route handlers authenticate with `const { data: { user } } = await supabase.auth.getUser()` and `401` otherwise. No route accepts a raw prompt from the client again.

### 1b. Foundations to stop the duplication

- `components/ui/*` — the primitives listed above, encoding the *one* card style (`bg-surface rounded-xl border border-line shadow-sm`) and the themed input (`bg-background text-ink border-line`), which also fixes the dark-mode input bug.
- `hooks/use-user.ts` + `UserProvider` in the `(student)` layout, replacing the 9 scattered `getUser()` calls.
- `lib/constants.ts` — `DAYS`, `DIFFICULTIES`, `COLOR_SCHEMES`; single source, referenced by both TS and the migration `CHECK`s via comments.
- `lib/database.types.ts` — hand-written from the migrations in Phase 1 (the target project is unreachable from this sandbox, so `supabase gen types` must be run from your machine later and committed over it).
- Tailwind: add `transitionProperty.theme` so the 24 `transition-theme` usages actually emit CSS.
- `vitest` for the pure modules; `zod` for request validation.

### 1c. Defect fixes folded in

| Defect | Fix |
|---|---|
| Open Groq proxy | Route requires session, reads `app_settings.llm_enabled`, builds the prompt server-side from the caller's own rows |
| Delete Account no-op | `/api/account/delete`: verify session → `auth.admin.deleteUser(user.id)` with service role → cascades via FKs |
| PDFs can't be opened | `createSignedUrl(path, 60)` behind an Open button in `/library` |
| Timetable order | Sort by `DAYS` index then `start_time` client-side; DB index `(user_id, day, start_time)` |
| Plans never saved | `study_plans` + `study_plan_sessions` (Phase 2 fills them) |
| `loading` starts `false` | Primitive `useAsyncList` hook starts `true` — no empty-state flash |

### 1d. Migration `0002_foundation.sql`

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'student' check (role in ('student','admin')),
  class_level text check (class_level in ('9','10','11','12')),
  board text not null default 'ICSE' check (board in ('ICSE','ISC')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Admin check. SECURITY DEFINER with a locked search_path, and NOT executable by
-- anon — the Bhasha Setu project trips the linter on exactly this; don't repeat it.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Kolkata',
  study_start time not null default '16:00',
  study_end   time not null default '21:00',
  daily_max_minutes int not null default 180,
  theme jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings values ('llm_enabled', 'false'), ('llm_provider', '"groq"');

-- RLS: own-row on profiles/user_settings; role column immutable except via admin RPC;
-- app_settings readable by authenticated, writable by is_admin().
```

`role` is protected by a `before update` trigger that raises unless `is_admin()`, so a student cannot promote themselves through the REST API. The first admin is bootstrapped once by you in the SQL editor: `update public.profiles set role = 'admin' where id = (select id from auth.users where email = '<you>')`.

**Deploy checklist:** add `SUPABASE_SERVICE_ROLE_KEY` (server-only, no `NEXT_PUBLIC_`) and `CRON_SECRET` to Vercel; run `0002`; set Auth URLs; redeploy.

## Phase 2 — Deterministic study planner

Replaces the LLM as the default path. Pure, unit-tested, and it explains itself.

**`lib/planner/schedule.ts`**

```ts
type Busy   = { day: Day; start: Minutes; end: Minutes }             // from timetable
type Task   = { id: string; deadline: DateISO; hoursLeft: number; difficulty: Difficulty }
type Prefs  = { studyStart: Minutes; studyEnd: Minutes; dailyMaxMinutes: number; timezone: string }
type Session= { taskId: string; date: DateISO; start: Minutes; end: Minutes }
type Result = { sessions: Session[]; shortfalls: { taskId: string; minutesMissing: number }[] }

export function schedule(busy: Busy[], tasks: Task[], prefs: Prefs, now: Date, horizonDays = 14): Result
```

Algorithm — earliest-deadline-first with per-day capacity:

1. For each day in the horizon build the free windows: `[studyStart, studyEnd]` minus that weekday's timetable blocks, minus a 10-minute buffer after each class.
2. Sort tasks by deadline ascending; ties → harder first, then more hours left.
3. Session length by difficulty: easy 25 min, medium 45, hard 60; 10-minute break after each.
4. For each task, walk days from today to the day before its deadline, placing sessions into free windows until the task's minutes are covered, respecting `dailyMaxMinutes` across all tasks. Cap a task at 2 sessions/day unless its deadline is ≤ 2 days away, so work spreads instead of cramming.
5. Anything left over is reported in `shortfalls` — the UI shows "you need 3 more hours before Friday; raise your daily limit or move the deadline" rather than silently dropping it.

Persisted in `study_plans (id, user_id, generated_at, horizon_days, params jsonb)` and `study_plan_sessions (id, plan_id, assignment_id, date, start_time, end_time, completed_at)`. Marking a session complete awards XP (Phase 3). "Regenerate" is free and instant. When `llm_enabled` is on, an "Ask AI to refine" button sends the *server-built* summary of the same inputs to Groq and shows suggestions alongside — never replacing the deterministic plan.

Tests: fixed weekday timetable + 3 tasks → exact session list; deadline-tomorrow task takes priority; class blocks never overlapped; daily cap respected; shortfall reported when impossible.

## Phase 3 — Learn: flashcards, quizzes, gamification

**Migration `0003_learn.sql`** (columns abbreviated; every table gets own-row or published/is_admin RLS):

| Table | Key columns |
|---|---|
| `decks` | id, owner_id (null = official), chapter_id?, title, description, published |
| `flashcards` | id, deck_id, front, back, hint?, sort |
| `flashcard_reviews` | card_id, user_id, **ease_factor numeric(4,2) default 2.5, interval_days int default 0, repetitions int default 0, due_at timestamptz default now()**, last_grade, reviewed_at; unique (card_id, user_id) |
| `quizzes` | id, chapter_id?, title, difficulty, time_limit_sec?, published |
| `quiz_questions` | id, quiz_id, kind (mcq/true_false/short), prompt, explanation, sort |
| `quiz_options` | id, question_id, text, is_correct, sort |
| `quiz_attempts` | id, quiz_id, user_id, started_at, finished_at, score, max_score |
| `quiz_answers` | attempt_id, question_id, option_id?, text_answer?, correct |
| `xp_events` | id, user_id, kind, ref_id?, points, created_at; unique (user_id, kind, ref_id) for idempotent kinds |
| `streaks` | user_id pk, current int, longest int, last_activity_date date |
| `badges` | slug pk, name, description, icon, rule_kind, threshold |
| `user_badges` | user_id, badge_slug, awarded_at |

**`lib/srs/sm2.ts`** — SuperMemo-2, pure:

```ts
export function sm2(prev: ReviewState, grade: 0|1|2|3|4|5, now: Date): ReviewState
// grade < 3  → repetitions = 0, interval = 1
// else       → interval = reps===0 ? 1 : reps===1 ? 6 : round(interval * ef); reps++
// ef = max(1.3, ef + (0.1 - (5-grade) * (0.08 + (5-grade) * 0.02)))
// due = now + interval days
```

The review page pulls `flashcard_reviews where user_id = me and due_at <= now()` joined to cards, plus new cards from subscribed decks (capped at 20/day). Grades map to four buttons: Again (1) · Hard (3) · Good (4) · Easy (5).

**Gamification** — `award_xp(kind text, ref uuid)` is a Postgres function (security definer, `set search_path = ''`, `revoke from anon`) that derives the user from `auth.uid()`, validates `kind` against a fixed list, inserts the event, and updates the streak in the same transaction using the user's timezone (`last_activity_date` = today → no-op; = yesterday → `current + 1`; else → 1). The client never posts point values.

| Event | XP | | Badge | Rule |
|---|---|---|---|---|
| Card reviewed | 2 (5 if grade ≥ 4) | | first_review | 1 review |
| Quiz question correct | 5 | | week_streak | streak ≥ 7 |
| Quiz completed | 20 | | month_streak | streak ≥ 30 |
| Study session done | 15 | | scholar | XP ≥ 1000 |
| Assignment completed | 30 | | perfect_quiz | score = max |
| First activity of day | 10 | | century | 100 cards reviewed |

Level = `floor(sqrt(xp / 100))`. Badges are checked after each award. Leaderboards are deliberately out of scope — they need an opt-in and privacy design.

## Phase 4 — News

**Migration `0004_news.sql`**

```sql
create table public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null, url text not null unique,
  kind text not null default 'rss' check (kind in ('rss','atom','cisce_circulars')),
  category text not null default 'education', board text,   -- 'ICSE' | 'ISC' | null
  enabled boolean not null default true,
  last_fetched_at timestamptz, last_status text, last_error text
);
create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.news_sources(id) on delete cascade,
  guid text not null, title text not null, link text not null,
  summary text, published_at timestamptz, fetched_at timestamptz not null default now(),
  unique (source_id, guid)
);
-- RLS: items + sources readable by authenticated; writes by is_admin() (cron uses service role).
```

- `app/api/cron/refresh-news/route.ts` — rejects unless `Authorization: Bearer $CRON_SECRET`; service-role client; for each enabled source: `fetch` with a 10 s timeout and a UA header → `fast-xml-parser` → normalise RSS 2.0 / Atom into items → upsert on `(source_id, guid)` → write `last_status`/`last_error`. One source failing never fails the run.
- `kind = 'cisce_circulars'` — CISCE publishes no RSS. A best-effort scraper fetches the circulars page, extracts anchors ending in `.pdf`, and emits them as items. It is isolated so a markup change only marks that source failed.
- `vercel.json` gains **only** `{"crons":[{"path":"/api/cron/refresh-news","schedule":"0 3 * * *"}]}` — no `outputDirectory`, which is what caused the 404s. Vercel Hobby allows daily crons; the admin page has a "Refresh now" button that hits the same route server-side.
- `/news` is a server component: filter by board/category, newest first, summaries rendered as text (HTML stripped), links open in a new tab.

**Seed sources — unverified.** This sandbox blocks all external egress, so none of these could be tested here. They ship `enabled = true` with `last_status = 'unverified'`; the first cron run marks each working or failed, visible in `/admin/news-sources`.

| Name | URL | Kind |
|---|---|---|
| Google News · ICSE / CISCE | `https://news.google.com/rss/search?q=ICSE+OR+CISCE+OR+ISC+board&hl=en-IN&gl=IN&ceid=IN:en` | rss |
| The Hindu · Education | `https://www.thehindu.com/education/feeder/default.rss` | rss |
| Times of India · Education | `https://timesofindia.indiatimes.com/rssfeeds/913168846.cms` | rss |
| Hindustan Times · Education | `https://www.hindustantimes.com/feeds/rss/education/rssfeed.xml` | rss |
| NDTV · Education | `https://feeds.feedburner.com/ndtveducation` | rss |
| CISCE · Circulars | `https://cisce.org/` (circulars page) | cisce_circulars |

## Phase 5 — Admin and CMS

**Migration `0005_cms.sql`**: `subjects (code, name, board, class_level, sort)`, `chapters (subject_id, number, title, summary_md, published)`, `content_pages (slug pk, title, body_md, published)`, `announcements (title, body_md, starts_at, ends_at, audience)`. Published rows readable by authenticated; all writes `is_admin()`. `quizzes.chapter_id` and `decks.chapter_id` (Phase 3) hang off `chapters`.

Seed `subjects` with the ICSE Class 9–10 groups (English Language, Literature in English, Hindi/second language, History & Civics, Geography, Mathematics, Physics, Chemistry, Biology, Economics, Commercial Studies, Computer Applications, Environmental Science) and the common ISC 11–12 set. Chapters are entered through the admin UI or ingested in Phase 6.

Admin pages share one `DataTable` + form pattern (create/edit in a `Dialog`, `zod`-validated server actions that re-check `is_admin()` even though RLS already enforces it). `/admin/settings` exposes `llm_enabled` and `llm_provider`; `/admin` shows counts and the last cron status per source.

## Phase 6 — PDF ingestion

**Shared heuristics — Python package `studyos_ingest/`** (pure Python; the `pdf` skill confirms `pypdf` has no system deps, so it is safe on Vercel):

- `extract_pages(path) -> list[str]` via `pypdf.PdfReader`.
- `detect_headings(lines)` — short lines that are numbered (`1.2`, `Chapter 3`), Title Case, or ALL CAPS become chapter/section candidates.
- `definitions(text)` — sentences matching `<Term> (is|are|refers to|is defined as) …` → flashcard *front* "What is <Term>?" / *back* the sentence.
- `cloze(text)` — sentences containing a detected term → the term blanked.
- `mcq_from_paper(text)` — past-paper patterns (`Q1.`, `(a) … (d)`) → `quiz_questions` + `quiz_options`, answer key parsed when present.
- Output is a JSON document `{chapter, cards[], questions[]}`; nothing here calls an LLM.

**`scripts/ingest.py`** — `argparse`: `--pdf`, `--subject CODE`, `--chapter N`, `--kind syllabus|notes|paper`, `--dry-run`, `--ocr`. Writes through `supabase-py` with `SUPABASE_SERVICE_ROLE_KEY` from a local `.env` (never in Vercel's public vars). `--ocr` uses `pytesseract` + `pdf2image` for scanned PDFs — those need Tesseract and Poppler installed locally, which is why OCR lives only in the CLI. `requirements-dev.txt` pins `pypdf`, `supabase`, `python-dotenv`, and the optional OCR pair.

**`api/pdf/extract.py`** — Vercel Python function. `POST {document_id}` with the user's bearer token; verifies it against `GET {SUPABASE_URL}/auth/v1/user` (stdlib `urllib`, no SDK), loads the row with the service role, downloads via a signed URL, runs the same heuristics, and returns `{text, cards, questions}` which the client can save into a personal deck. Guards: 50-page cap, 20 MB cap, text-layer only (a scanned PDF returns a clear "no text layer — use the desktop importer" message). Root `requirements.txt` contains only `pypdf`. **Risk:** mixing Vercel's Python runtime with Next.js is documented but I cannot deploy from this sandbox to prove it; if it misbehaves, the fallback is in-browser extraction with `pdfjs-dist` behind the same UI, which keeps the feature without the second runtime.

## Phasing and effort

| Phase | Delivers | Relative effort |
|---|---|---|
| 0 — Prerequisites (you) | `.claude/settings.json` build permissions; run `0001` in `fsqmldqhzcuusnlllxad`; Vercel env incl. service-role key + `CRON_SECRET`; Auth URL config | — |
| 1 — Foundation | SSR auth, middleware, route restructure, UI primitives, all defect fixes, Groq hole closed | 35 % |
| 2 — Planner | Deterministic scheduler, persisted plans, session completion | 15 % |
| 3 — Learn | Decks, SM-2 review, quizzes, XP/streaks/badges | 20 % |
| 4 — News | Sources, cron, `/news`, CISCE scraper | 10 % |
| 5 — Admin/CMS | Role gate, curriculum, question bank, pages, settings, ICSE seed | 12 % |
| 6 — PDF | Heuristics package, CLI, serverless function, card generation | 8 % |

Each phase ships as one PR to `main` with its migration file, tests, and a deploy checklist. Nothing later is started until the previous phase is verified on Vercel.

## Verification

Per phase, before merge: `npx tsc --noEmit` · `npm run lint` · `npm run build` (with `.env.local` removed, to match Vercel) · `vitest run` for `planner`, `srs`, `gamification`, `news/parse`. Then `npm run start` and a Playwright smoke via the `run` skill: public routes 200, `(student)` routes redirect to `/auth` when signed out, `/admin` redirects non-admins. After deploy: the manual checklist — signup → confirmation email lands on `/auth/callback` → dashboard; add class; add assignment; generate plan; review a card; take a quiz; XP and streak move; `/news` shows items after the first cron; admin can edit a chapter; `ingest.py --dry-run` on a real ICSE PDF prints sensible cards.

## What cannot be verified from this sandbox

- **Builds** are blocked until `.claude/settings.json` exists (the classifier correctly refuses to let me write my own permissions).
- **Supabase project `fsqmldqhzcuusnlllxad`** returns *permission denied* from the connected account; migrations are handed to you to run, and `supabase gen types` must run on your machine.
- **External URLs** are all blocked, so feed URLs, the CISCE page, and skills.sh could not be fetched; the news design assumes per-source failure and surfaces status in admin.
- **Vercel deploys** can't be observed here; the Python runtime is placed last for that reason.

## Skills used

`skills.sh` is unreachable from this environment, so the local registry was used instead:

- **`pdf`** — confirmed `pypdf` for serverless-safe extraction and `pytesseract`/`pdf2image` for CLI-only OCR; shaped Phase 6.
- **`update-config`** — produced the permission rules for `.claude/settings.json` (which you must apply).
- **`run`** — launches the built app for the Playwright smoke in each phase.
- **`code-review`** and **`security-review`** — run on every phase PR; Phase 1 especially, since it touches auth.
- **`skill-creator`** — a repo skill at `.claude/skills/studyos/` documenting conventions (token names, the one card style, migration numbering, RLS rules) so later sessions follow them without re-discovery.
- **`dataviz`** — for the dashboard progress charts once Phase 3 has data to show.
