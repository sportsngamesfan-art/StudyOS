import { DAYS, type Day, type Difficulty } from '@/lib/constants'

/**
 * Deterministic study scheduler. Pure: same input, same output, no clock,
 * no randomness, no I/O — which is what makes it testable and what lets the
 * app regenerate a plan for free.
 *
 * Strategy: earliest-deadline-first with per-day capacity.
 *   1. Each day in the horizon starts with the user's study window minus that
 *      weekday's classes (plus a buffer either side of each class).
 *   2. Tasks are ordered by deadline, then harder first, then more work left.
 *   3. Each task takes sessions sized by its difficulty, walking days from
 *      today up to its deadline, until its remaining minutes are covered.
 *      A task gets at most two sessions on one day unless the deadline is
 *      within two days, so work spreads out instead of cramming.
 *   4. Whatever cannot be placed is reported as a shortfall rather than
 *      silently dropped, so the UI can say "raise your daily limit or move
 *      the deadline".
 *
 * Times are minutes since midnight; dates are local "YYYY-MM-DD" strings.
 */

export type Minutes = number

export interface BusyBlock {
  day: Day
  start: Minutes
  end: Minutes
}

export interface PlanTask {
  id: string
  title: string
  subject: string
  /** "YYYY-MM-DD" */
  deadline: string
  /** Hours still to do, after subtracting completed sessions. */
  hoursRemaining: number
  difficulty: Difficulty
}

export interface PlanPrefs {
  studyStart: Minutes
  studyEnd: Minutes
  dailyMaxMinutes: number
}

export interface PlannedSession {
  taskId: string
  title: string
  subject: string
  difficulty: Difficulty
  date: string
  start: Minutes
  end: Minutes
}

export interface Shortfall {
  taskId: string
  title: string
  deadline: string
  minutesMissing: number
}

export interface ScheduleInput {
  busy: BusyBlock[]
  tasks: PlanTask[]
  prefs: PlanPrefs
  /** Today's local date, "YYYY-MM-DD". Passed in so the function stays pure. */
  today: string
  horizonDays?: number
}

export interface ScheduleResult {
  sessions: PlannedSession[]
  shortfalls: Shortfall[]
  totalMinutes: number
}

export const SESSION_MINUTES: Record<Difficulty, Minutes> = {
  easy: 25,
  medium: 45,
  hard: 60,
}
export const BREAK_MINUTES = 10
export const CLASS_BUFFER_MINUTES = 10
export const MIN_SESSION_MINUTES = 15
export const DEFAULT_HORIZON_DAYS = 14

const MAX_SESSIONS_PER_TASK_PER_DAY = 2
const CRAM_WINDOW_DAYS = 2
const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 }

// ---------------------------------------------------------------------------
// Date / time helpers (exported for the UI and tests)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')

/** "16:00" or "16:00:00" → 960 */
export function toMinutes(hhmm: string): Minutes {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** 960 → "16:00" */
export function fromMinutes(min: Minutes): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatYmd(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function addDays(ymd: string, n: number): string {
  const d = parseYmd(ymd)
  d.setDate(d.getDate() + n)
  return formatYmd(d)
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86_400_000)
}

/** JS getDay() is Sunday-first; DAYS is Monday-first. */
export function weekdayOf(ymd: string): Day {
  return DAYS[(parseYmd(ymd).getDay() + 6) % 7]
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

interface Interval {
  start: Minutes
  end: Minutes
}

interface DayState {
  date: string
  windows: Interval[]
  used: Minutes
  perTask: Map<string, number>
}

/** The study window minus that weekday's classes, each padded by the buffer. */
export function freeWindows(day: Day, busy: BusyBlock[], prefs: PlanPrefs): Interval[] {
  let windows: Interval[] = [{ start: prefs.studyStart, end: prefs.studyEnd }]

  for (const block of busy) {
    if (block.day !== day) continue
    const b = {
      start: block.start - CLASS_BUFFER_MINUTES,
      end: block.end + CLASS_BUFFER_MINUTES,
    }
    const next: Interval[] = []
    for (const w of windows) {
      if (b.end <= w.start || b.start >= w.end) {
        next.push(w)
        continue
      }
      if (b.start > w.start) next.push({ start: w.start, end: b.start })
      if (b.end < w.end) next.push({ start: b.end, end: w.end })
    }
    windows = next
  }

  return windows
    .filter((w) => w.end - w.start >= MIN_SESSION_MINUTES)
    .sort((a, b) => a.start - b.start)
}

/**
 * Takes up to `length` minutes from the day, plus a break. Prefers the first
 * window that fits the whole session; failing that, the largest window that
 * is still worth a session, so an odd 30 minutes of capacity is used rather
 * than wasted.
 */
function place(day: DayState, length: Minutes): Interval | null {
  let target: Interval | null = null
  for (const w of day.windows) {
    if (w.end - w.start >= length) {
      target = w
      break
    }
  }
  if (!target) {
    for (const w of day.windows) {
      const size = w.end - w.start
      if (size >= MIN_SESSION_MINUTES && (!target || size > target.end - target.start)) {
        target = w
      }
    }
  }
  if (!target) return null

  const session = { start: target.start, end: target.start + Math.min(length, target.end - target.start) }
  target.start = session.end + BREAK_MINUTES
  return session
}

export function schedule(input: ScheduleInput): ScheduleResult {
  const { prefs, today } = input
  const horizon = input.horizonDays ?? DEFAULT_HORIZON_DAYS

  if (prefs.studyEnd <= prefs.studyStart) {
    throw new Error('Study window must end after it starts')
  }
  if (prefs.dailyMaxMinutes < MIN_SESSION_MINUTES) {
    throw new Error(`Daily limit must be at least ${MIN_SESSION_MINUTES} minutes`)
  }

  const days: DayState[] = []
  for (let i = 0; i < horizon; i++) {
    const date = addDays(today, i)
    days.push({
      date,
      windows: freeWindows(weekdayOf(date), input.busy, prefs),
      used: 0,
      perTask: new Map(),
    })
  }

  // Overdue work is treated as due today so it sorts first and can still be
  // placed; the original deadline is preserved for reporting.
  const tasks = input.tasks
    .map((t) => ({
      ...t,
      effectiveDeadline: t.deadline < today ? today : t.deadline,
      remaining: Math.max(0, Math.round(t.hoursRemaining * 60)),
    }))
    .filter((t) => t.remaining > 0)
    .sort(
      (a, b) =>
        a.effectiveDeadline.localeCompare(b.effectiveDeadline) ||
        DIFFICULTY_RANK[b.difficulty] - DIFFICULTY_RANK[a.difficulty] ||
        b.remaining - a.remaining
    )

  const sessions: PlannedSession[] = []
  const shortfalls: Shortfall[] = []

  for (const task of tasks) {
    let remaining = task.remaining
    const length = SESSION_MINUTES[task.difficulty]

    for (const day of days) {
      if (remaining <= 0) break
      if (day.date > task.effectiveDeadline) break

      const daysLeft = daysBetween(day.date, task.effectiveDeadline)
      const cap = daysLeft <= CRAM_WINDOW_DAYS ? Infinity : MAX_SESSIONS_PER_TASK_PER_DAY

      while (remaining > 0 && (day.perTask.get(task.id) ?? 0) < cap) {
        const capacityLeft = prefs.dailyMaxMinutes - day.used
        if (capacityLeft < MIN_SESSION_MINUTES) break

        // A final sliver still gets a real session rather than a 5-minute
        // one; a session never exceeds what the day has left.
        const want = Math.min(length, Math.max(MIN_SESSION_MINUTES, remaining), capacityLeft)

        const placed = place(day, want)
        if (!placed) break
        const took = placed.end - placed.start

        sessions.push({
          taskId: task.id,
          title: task.title,
          subject: task.subject,
          difficulty: task.difficulty,
          date: day.date,
          start: placed.start,
          end: placed.end,
        })
        day.used += took
        day.perTask.set(task.id, (day.perTask.get(task.id) ?? 0) + 1)
        remaining -= took
      }
    }

    if (remaining > 0) {
      shortfalls.push({
        taskId: task.id,
        title: task.title,
        deadline: task.deadline,
        minutesMissing: remaining,
      })
    }
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)

  return {
    sessions,
    shortfalls,
    totalMinutes: sessions.reduce((sum, s) => sum + (s.end - s.start), 0),
  }
}
