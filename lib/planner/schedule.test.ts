import { describe, expect, it } from 'vitest'
import {
  BREAK_MINUTES,
  CLASS_BUFFER_MINUTES,
  addDays,
  daysBetween,
  freeWindows,
  fromMinutes,
  schedule,
  toMinutes,
  weekdayOf,
  type BusyBlock,
  type PlanPrefs,
  type PlanTask,
} from './schedule'

// 2026-09-07 is a Monday.
const MONDAY = '2026-09-07'
const PREFS: PlanPrefs = { studyStart: toMinutes('16:00'), studyEnd: toMinutes('21:00'), dailyMaxMinutes: 180 }

const task = (over: Partial<PlanTask> = {}): PlanTask => ({
  id: 't1',
  title: 'Task',
  subject: 'Maths',
  deadline: addDays(MONDAY, 5),
  hoursRemaining: 1.5,
  difficulty: 'medium',
  ...over,
})

describe('helpers', () => {
  it('converts times both ways, tolerating seconds', () => {
    expect(toMinutes('16:00')).toBe(960)
    expect(toMinutes('09:30:00')).toBe(570)
    expect(fromMinutes(960)).toBe('16:00')
    expect(fromMinutes(605)).toBe('10:05')
  })

  it('does date arithmetic on local calendar dates', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-09-07', '2026-09-12')).toBe(5)
    expect(weekdayOf(MONDAY)).toBe('Monday')
    expect(weekdayOf(addDays(MONDAY, 6))).toBe('Sunday')
  })
})

describe('freeWindows', () => {
  it('is the whole study window with no classes', () => {
    expect(freeWindows('Monday', [], PREFS)).toEqual([{ start: 960, end: 1260 }])
  })

  it('cuts a class out of the middle with a buffer on both sides', () => {
    const busy: BusyBlock[] = [{ day: 'Monday', start: toMinutes('17:00'), end: toMinutes('18:00') }]
    expect(freeWindows('Monday', busy, PREFS)).toEqual([
      { start: 960, end: 1020 - CLASS_BUFFER_MINUTES },
      { start: 1080 + CLASS_BUFFER_MINUTES, end: 1260 },
    ])
  })

  it('ignores classes on other days', () => {
    const busy: BusyBlock[] = [{ day: 'Tuesday', start: 960, end: 1260 }]
    expect(freeWindows('Monday', busy, PREFS)).toHaveLength(1)
  })
})

describe('schedule', () => {
  it('splits a task into difficulty-sized sessions with breaks between', () => {
    const { sessions, shortfalls, totalMinutes } = schedule({
      busy: [],
      tasks: [task({ hoursRemaining: 1.5, difficulty: 'medium' })],
      prefs: PREFS,
      today: MONDAY,
    })
    expect(shortfalls).toEqual([])
    expect(totalMinutes).toBe(90)
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toMatchObject({ date: MONDAY, start: 960, end: 1005 })
    expect(sessions[1].start).toBe(1005 + BREAK_MINUTES)
  })

  it('never overlaps a class, including its buffer', () => {
    const busy: BusyBlock[] = [{ day: 'Monday', start: toMinutes('16:00'), end: toMinutes('17:00') }]
    const { sessions } = schedule({
      busy,
      tasks: [task({ hoursRemaining: 1, difficulty: 'hard' })],
      prefs: PREFS,
      today: MONDAY,
    })
    const monday = sessions.filter((s) => s.date === MONDAY)
    expect(monday.length).toBeGreaterThan(0)
    for (const s of monday) {
      expect(s.start).toBeGreaterThanOrEqual(1020 + CLASS_BUFFER_MINUTES)
    }
  })

  it('places the nearest deadline first', () => {
    const { sessions } = schedule({
      busy: [],
      tasks: [
        task({ id: 'later', deadline: addDays(MONDAY, 5), difficulty: 'hard', hoursRemaining: 1 }),
        task({ id: 'soon', deadline: addDays(MONDAY, 1), difficulty: 'easy', hoursRemaining: 1 }),
      ],
      prefs: PREFS,
      today: MONDAY,
    })
    expect(sessions[0].taskId).toBe('soon')
  })

  it('respects the daily limit across all tasks', () => {
    const { sessions } = schedule({
      busy: [],
      tasks: [task({ hoursRemaining: 3, difficulty: 'medium', deadline: addDays(MONDAY, 10) })],
      prefs: { ...PREFS, dailyMaxMinutes: 60 },
      today: MONDAY,
    })
    const perDay = new Map<string, number>()
    for (const s of sessions) perDay.set(s.date, (perDay.get(s.date) ?? 0) + (s.end - s.start))
    for (const minutes of perDay.values()) expect(minutes).toBeLessThanOrEqual(60)
    expect(sessions.reduce((n, s) => n + (s.end - s.start), 0)).toBe(180)
  })

  it('spreads a task to at most two sessions a day when the deadline is far', () => {
    const { sessions } = schedule({
      busy: [],
      tasks: [task({ hoursRemaining: 4, difficulty: 'hard', deadline: addDays(MONDAY, 10) })],
      prefs: { ...PREFS, dailyMaxMinutes: 300 },
      today: MONDAY,
    })
    expect(sessions.filter((s) => s.date === MONDAY)).toHaveLength(2)
  })

  it('allows cramming when the deadline is within two days', () => {
    const { sessions, shortfalls } = schedule({
      busy: [],
      tasks: [task({ hoursRemaining: 3, difficulty: 'hard', deadline: addDays(MONDAY, 1) })],
      prefs: { ...PREFS, dailyMaxMinutes: 300 },
      today: MONDAY,
    })
    expect(shortfalls).toEqual([])
    expect(sessions.filter((s) => s.date === MONDAY).length).toBeGreaterThan(2)
  })

  it('reports a shortfall instead of dropping work that cannot fit', () => {
    const { sessions, shortfalls } = schedule({
      busy: [],
      tasks: [task({ hoursRemaining: 10, difficulty: 'medium', deadline: addDays(MONDAY, 1) })],
      prefs: { ...PREFS, dailyMaxMinutes: 120 },
      today: MONDAY,
    })
    // Today and the deadline day, 120 min each.
    expect(sessions.reduce((n, s) => n + (s.end - s.start), 0)).toBe(240)
    expect(shortfalls).toEqual([
      { taskId: 't1', title: 'Task', deadline: addDays(MONDAY, 1), minutesMissing: 360 },
    ])
  })

  it('still schedules overdue work, starting today', () => {
    const { sessions, shortfalls } = schedule({
      busy: [],
      tasks: [task({ hoursRemaining: 1, deadline: addDays(MONDAY, -3) })],
      prefs: PREFS,
      today: MONDAY,
    })
    expect(shortfalls).toEqual([])
    expect(sessions[0].date).toBe(MONDAY)
  })

  it('skips tasks with nothing left and never makes a session shorter than the minimum', () => {
    const { sessions, shortfalls } = schedule({
      busy: [],
      tasks: [
        task({ id: 'done', hoursRemaining: 0 }),
        task({ id: 'sliver', hoursRemaining: 0.1, difficulty: 'easy' }),
      ],
      prefs: PREFS,
      today: MONDAY,
    })
    expect(shortfalls).toEqual([])
    expect(sessions.map((s) => s.taskId)).toEqual(['sliver'])
    expect(sessions[0].end - sessions[0].start).toBe(15)
  })

  it('returns sessions sorted by date then start, and is deterministic', () => {
    const input = {
      busy: [{ day: 'Tuesday' as const, start: 960, end: 1080 }],
      tasks: [
        task({ id: 'a', deadline: addDays(MONDAY, 4), difficulty: 'hard', hoursRemaining: 2 }),
        task({ id: 'b', deadline: addDays(MONDAY, 2), difficulty: 'easy', hoursRemaining: 1 }),
        task({ id: 'c', deadline: addDays(MONDAY, 6), difficulty: 'medium', hoursRemaining: 3 }),
      ],
      prefs: PREFS,
      today: MONDAY,
    }
    const first = schedule(input)
    const second = schedule(input)
    expect(second).toEqual(first)
    for (let i = 1; i < first.sessions.length; i++) {
      const prev = first.sessions[i - 1]
      const cur = first.sessions[i]
      expect(cur.date > prev.date || (cur.date === prev.date && cur.start >= prev.end)).toBe(true)
    }
  })

  it('rejects an inverted study window', () => {
    expect(() =>
      schedule({ busy: [], tasks: [], prefs: { ...PREFS, studyEnd: 900 }, today: MONDAY })
    ).toThrow(/window/)
  })
})
