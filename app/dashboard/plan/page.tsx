'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import { cn } from '@/lib/cn'
import { awardXp } from '@/lib/gamification/award'
import type {
  AssignmentRow,
  StudyPlanRow,
  StudyPlanSessionRow,
  TimetableRow,
  UserSettingsRow,
} from '@/lib/types'
import {
  DEFAULT_HORIZON_DAYS,
  addDays,
  formatYmd,
  fromMinutes,
  schedule,
  toMinutes,
  type BusyBlock,
  type PlanTask,
  type Shortfall,
} from '@/lib/planner/schedule'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PageSpinner,
} from '@/components/ui'

const DEFAULT_PREFS = { study_start: '16:00', study_end: '21:00', daily_max_minutes: 180 }
type Prefs = typeof DEFAULT_PREFS

/** Shape the optional AI route returns; never persisted. */
interface AiPlanItem {
  date: string
  subject: string
  duration: number
  task: string
  priority: 'high' | 'medium' | 'low'
}

type CompletedSlice = Pick<StudyPlanSessionRow, 'assignment_id' | 'start_time' | 'end_time'>
type BusySlice = Pick<TimetableRow, 'day' | 'start_time' | 'end_time'>

const fmtTime = (t: string) => t.slice(0, 5)
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function dateHeading(ymd: string, today: string): string {
  const label = parseLocalDate(ymd).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  if (ymd === today) return `Today · ${label}`
  if (ymd === addDays(today, 1)) return `Tomorrow · ${label}`
  return label
}

function fmtGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function StudyPlanPage() {
  const user = useUser()
  const today = useMemo(() => formatYmd(new Date()), [])

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [draft, setDraft] = useState<Prefs>(DEFAULT_PREFS)
  const [showPrefs, setShowPrefs] = useState(false)
  const [plan, setPlan] = useState<StudyPlanRow | null>(null)
  const [sessions, setSessions] = useState<StudyPlanSessionRow[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiItems, setAiItems] = useState<AiPlanItem[] | null>(null)

  const load = useCallback(async () => {
    try {
      const [settingsRes, planRes, pendingRes] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('study_plans')
          .select('*')
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('assignments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('completed', false),
      ])
      if (settingsRes.error) throw settingsRes.error
      if (planRes.error) throw planRes.error
      if (pendingRes.error) throw pendingRes.error

      if (settingsRes.data) {
        const s = settingsRes.data as UserSettingsRow
        const loaded = {
          study_start: fmtTime(s.study_start),
          study_end: fmtTime(s.study_end),
          daily_max_minutes: s.daily_max_minutes,
        }
        setPrefs(loaded)
        setDraft(loaded)
      }
      setPendingCount(pendingRes.count ?? 0)

      const latest = (planRes.data as StudyPlanRow | null) ?? null
      setPlan(latest)
      if (latest) {
        const { data, error: sessionsError } = await supabase
          .from('study_plan_sessions')
          .select('*')
          .eq('plan_id', latest.id)
          .order('date')
          .order('start_time')
        if (sessionsError) throw sessionsError
        setSessions((data as StudyPlanSessionRow[]) ?? [])
      } else {
        setSessions([])
      }
    } catch (err) {
      console.error('Error loading study plan:', err)
      setError('Failed to load study plan')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetch('/api/generate-study-plan')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setAiEnabled(Boolean(d?.enabled)))
      .catch(() => setAiEnabled(false))
  }, [])

  /**
   * Runs the deterministic scheduler over the user's own rows and persists
   * the result. Minutes already completed in earlier plans are subtracted
   * from each assignment, so regenerating never asks for finished work again.
   */
  const generate = useCallback(
    async (usePrefs: Prefs) => {
      setGenerating(true)
      setError('')
      setSuccess('')
      try {
        const [timetableRes, assignmentsRes, completedRes] = await Promise.all([
          supabase.from('timetable').select('day, start_time, end_time').eq('user_id', user.id),
          supabase.from('assignments').select('*').eq('user_id', user.id).eq('completed', false),
          supabase
            .from('study_plan_sessions')
            .select('assignment_id, start_time, end_time')
            .eq('user_id', user.id)
            .not('completed_at', 'is', null),
        ])
        if (timetableRes.error) throw timetableRes.error
        if (assignmentsRes.error) throw assignmentsRes.error
        if (completedRes.error) throw completedRes.error

        const busy: BusyBlock[] = ((timetableRes.data ?? []) as BusySlice[]).map((t) => ({
          day: t.day,
          start: toMinutes(t.start_time),
          end: toMinutes(t.end_time),
        }))

        const doneMinutes = new Map<string, number>()
        for (const s of (completedRes.data ?? []) as CompletedSlice[]) {
          if (!s.assignment_id) continue
          doneMinutes.set(
            s.assignment_id,
            (doneMinutes.get(s.assignment_id) ?? 0) +
              (toMinutes(s.end_time) - toMinutes(s.start_time))
          )
        }

        const tasks: PlanTask[] = ((assignmentsRes.data ?? []) as AssignmentRow[]).map((a) => ({
          id: a.id,
          title: a.title,
          subject: a.subject,
          deadline: a.deadline,
          difficulty: a.difficulty,
          hoursRemaining: Math.max(0, a.hours_required - (doneMinutes.get(a.id) ?? 0) / 60),
        }))
        if (tasks.length === 0) {
          throw new Error('Add at least one pending assignment before generating a plan')
        }

        const result = schedule({
          busy,
          tasks,
          prefs: {
            studyStart: toMinutes(usePrefs.study_start),
            studyEnd: toMinutes(usePrefs.study_end),
            dailyMaxMinutes: usePrefs.daily_max_minutes,
          },
          today,
          horizonDays: DEFAULT_HORIZON_DAYS,
        })

        const { data: planRow, error: planError } = await supabase
          .from('study_plans')
          .insert({
            user_id: user.id,
            horizon_days: DEFAULT_HORIZON_DAYS,
            params: usePrefs,
            shortfalls: result.shortfalls,
          })
          .select('id')
          .single()
        if (planError) throw planError

        if (result.sessions.length > 0) {
          const rows = result.sessions.map((s) => ({
            plan_id: planRow.id,
            user_id: user.id,
            assignment_id: s.taskId,
            subject: s.subject,
            title: s.title,
            difficulty: s.difficulty,
            date: s.date,
            start_time: fromMinutes(s.start),
            end_time: fromMinutes(s.end),
          }))
          const { error: sessionsError } = await supabase.from('study_plan_sessions').insert(rows)
          if (sessionsError) throw sessionsError
        }

        setSuccess(
          result.sessions.length > 0
            ? `Planned ${result.sessions.length} sessions over the next ${DEFAULT_HORIZON_DAYS} days`
            : 'Nothing left to schedule — everything is already covered'
        )
        setAiItems(null)
        await load()
      } catch (err) {
        console.error('Error generating plan:', err)
        setError(err instanceof Error ? err.message : 'Failed to generate plan')
      } finally {
        setGenerating(false)
      }
    },
    [user.id, today, load]
  )

  const savePrefs = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (draft.study_end <= draft.study_start) {
      setError('Study window must end after it starts')
      return
    }
    if (!Number.isInteger(draft.daily_max_minutes) || draft.daily_max_minutes < 30 || draft.daily_max_minutes > 720) {
      setError('Daily limit must be between 30 and 720 minutes')
      return
    }

    setSavingPrefs(true)
    try {
      const { error: upsertError } = await supabase.from('user_settings').upsert(
        {
          user_id: user.id,
          study_start: draft.study_start,
          study_end: draft.study_end,
          daily_max_minutes: draft.daily_max_minutes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (upsertError) throw upsertError
      setPrefs(draft)
      setShowPrefs(false)
      if (plan) {
        await generate(draft)
      } else {
        setSuccess('Preferences saved')
      }
    } catch (err) {
      console.error('Error saving preferences:', err)
      setError(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setSavingPrefs(false)
    }
  }

  const toggleDone = async (session: StudyPlanSessionRow) => {
    const completed_at = session.completed_at ? null : new Date().toISOString()
    // Optimistic; reverted below if the update fails.
    setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, completed_at } : s)))
    const { error: updateError } = await supabase
      .from('study_plan_sessions')
      .update({ completed_at })
      .eq('id', session.id)
    if (updateError) {
      console.error('Error updating session:', updateError)
      setSessions((prev) => prev.map((s) => (s.id === session.id ? session : s)))
      setError('Failed to update session')
      return
    }
    // Paid once per session; un-ticking and re-ticking does not pay again.
    if (completed_at) void awardXp('session_completed', session.id)
  }

  const askAi = async () => {
    setAiLoading(true)
    setError('')
    try {
      const res = await fetch('/api/generate-study-plan', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'AI suggestions failed')
      setAiItems(Array.isArray(body.plan) ? (body.plan as AiPlanItem[]) : [])
    } catch (err) {
      console.error('AI suggestions error:', err)
      setError(err instanceof Error ? err.message : 'AI suggestions failed')
    } finally {
      setAiLoading(false)
    }
  }

  const byDate = useMemo(() => {
    const groups: { date: string; sessions: StudyPlanSessionRow[] }[] = []
    for (const s of sessions) {
      const last = groups[groups.length - 1]
      if (last && last.date === s.date) last.sessions.push(s)
      else groups.push({ date: s.date, sessions: [s] })
    }
    return groups
  }, [sessions])

  const minutesOf = (s: StudyPlanSessionRow) => toMinutes(s.end_time) - toMinutes(s.start_time)
  const totalMinutes = sessions.reduce((n, s) => n + minutesOf(s), 0)
  const doneMinutes = sessions.filter((s) => s.completed_at).reduce((n, s) => n + minutesOf(s), 0)
  const shortfalls = (plan?.shortfalls ?? []) as Shortfall[]

  const prefsForm = (
    <Card>
      <h2 className="text-lg font-semibold text-ink mb-1">Study preferences</h2>
      <p className="text-sm text-muted mb-4">
        The planner only schedules inside this window, around your classes, up to the daily limit.
      </p>
      <form onSubmit={savePrefs} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Study from" htmlFor="study_start" required>
            <Input
              id="study_start"
              type="time"
              value={draft.study_start}
              onChange={(e) => setDraft({ ...draft, study_start: e.target.value })}
              required
            />
          </Field>
          <Field label="Until" htmlFor="study_end" required>
            <Input
              id="study_end"
              type="time"
              value={draft.study_end}
              onChange={(e) => setDraft({ ...draft, study_end: e.target.value })}
              required
            />
          </Field>
          <Field label="Daily limit (minutes)" htmlFor="daily_max" required>
            <Input
              id="daily_max"
              type="number"
              min={30}
              max={720}
              step={15}
              value={draft.daily_max_minutes}
              onChange={(e) => setDraft({ ...draft, daily_max_minutes: Number(e.target.value) })}
              required
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" loading={savingPrefs}>
            {plan ? 'Save & regenerate' : 'Save'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(prefs)
              setShowPrefs(false)
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Plan"
        subtitle={`Your next ${DEFAULT_HORIZON_DAYS} days, scheduled around your classes`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowPrefs((v) => !v)}>
              Preferences
            </Button>
            {plan && (
              <Button onClick={() => generate(prefs)} loading={generating}>
                Regenerate
              </Button>
            )}
          </>
        }
      />

      {showPrefs && prefsForm}

      {error && (
        <Alert variant="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onDismiss={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {loading ? (
        <PageSpinner />
      ) : !plan ? (
        pendingCount === 0 ? (
          <EmptyState
            icon={<TargetIcon />}
            title="Nothing to plan yet"
            description="The planner works from your pending assignments and schedules around your timetable. Add an assignment with a deadline to get started."
            action={<Button href="/dashboard/assignments">Add an assignment</Button>}
          />
        ) : (
          <EmptyState
            icon={<TargetIcon />}
            title="No study plan yet"
            description={`You have ${pendingCount} pending ${pendingCount === 1 ? 'assignment' : 'assignments'}. Generate a plan that works around your classes, prioritises the nearest deadlines, and sizes each session by difficulty.`}
            action={
              <Button onClick={() => generate(prefs)} loading={generating}>
                Generate study plan
              </Button>
            }
          />
        )
      ) : (
        <>
          {shortfalls.length > 0 && (
            <Alert variant="info">
              <p className="font-semibold mb-1">Not everything fits before its deadline</p>
              <ul className="list-disc ml-5 space-y-0.5">
                {shortfalls.map((s) => (
                  <li key={s.taskId}>
                    <strong>{s.title}</strong> needs {fmtMinutes(s.minutesMissing)} more before{' '}
                    {parseLocalDate(s.deadline).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                    .
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-muted">
                Raise your daily limit or widen your study window in Preferences, or{' '}
                <Link href="/dashboard/assignments" className="text-primary hover:underline">
                  move the deadline
                </Link>
                .
              </p>
            </Alert>
          )}

          <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="text-muted">
              <span className="text-ink font-semibold">{sessions.length}</span> sessions ·{' '}
              <span className="text-ink font-semibold">{fmtMinutes(totalMinutes)}</span> planned ·{' '}
              <span className="text-ink font-semibold">{fmtMinutes(doneMinutes)}</span> done
            </div>
            <div className="text-muted">
              {prefs.study_start}–{prefs.study_end}, up to {fmtMinutes(prefs.daily_max_minutes)}/day ·
              generated {fmtGeneratedAt(plan.generated_at)}
            </div>
          </Card>

          {sessions.length === 0 ? (
            <EmptyState
              icon={<TargetIcon />}
              title="Nothing left to schedule"
              description="Every pending assignment is already covered by completed sessions. Add new work or regenerate after changing preferences."
            />
          ) : (
            <div className="space-y-6">
              {byDate.map(({ date, sessions: daySessions }) => {
                const past = date < today
                return (
                  <section key={date} className="space-y-2">
                    <h2
                      className={cn(
                        'text-lg font-semibold',
                        date === today ? 'text-primary' : past ? 'text-muted' : 'text-ink'
                      )}
                    >
                      {dateHeading(date, today)}
                      <span className="text-sm font-normal text-muted ml-2">
                        {fmtMinutes(daySessions.reduce((n, s) => n + minutesOf(s), 0))}
                      </span>
                    </h2>
                    {daySessions.map((s) => {
                      const done = Boolean(s.completed_at)
                      return (
                        <Card
                          key={s.id}
                          padding="sm"
                          className={cn(
                            'flex items-start gap-3',
                            date === today && !done && 'border-primary/40',
                            done && 'bg-background'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleDone(s)}
                            aria-label={`Mark ${s.title} ${done ? 'not done' : 'done'}`}
                            className="mt-1 h-4 w-4 accent-[var(--color-primary)] cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <span className="text-sm font-mono text-muted whitespace-nowrap">
                                {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                              </span>
                              <span
                                className={cn(
                                  'font-semibold truncate',
                                  done ? 'text-muted line-through' : 'text-ink'
                                )}
                              >
                                {s.title}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted">
                              <span>{s.subject}</span>
                              <span className="bg-line text-ink px-2 py-0.5 rounded">
                                {capitalize(s.difficulty)}
                              </span>
                              <span>{fmtMinutes(minutesOf(s))}</span>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          )}

          {aiEnabled && (
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">AI suggestions</h2>
                  <p className="text-sm text-muted mt-1">
                    Optional. Sends your timetable and pending assignments to the model and shows its
                    take alongside the plan above. Suggestions are not saved.
                  </p>
                </div>
                <Button variant="ghost" onClick={askAi} loading={aiLoading}>
                  {aiItems ? 'Ask again' : 'Get suggestions'}
                </Button>
              </div>
              {aiItems && (
                <ul className="mt-4 divide-y divide-line">
                  {aiItems.length === 0 && (
                    <li className="py-2 text-sm text-muted">The model returned no suggestions.</li>
                  )}
                  {aiItems.map((item, i) => (
                    <li key={i} className="py-2 text-sm flex flex-wrap gap-x-3 gap-y-1">
                      <span className="text-muted whitespace-nowrap">{item.date}</span>
                      <span className="text-ink font-medium">{item.subject}</span>
                      <span className="text-muted flex-1 min-w-[12rem]">{item.task}</span>
                      <span className="text-muted whitespace-nowrap">
                        {item.duration}h · {item.priority}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function TargetIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
  )
}
