/**
 * SuperMemo-2 spaced repetition. Pure: the clock is passed in.
 *
 * Grades are 0–5 as in the original algorithm; the UI exposes four of them
 * (Again=1, Hard=3, Good=4, Easy=5). Below 3 counts as a lapse: repetitions
 * reset and the card comes back tomorrow. The ease factor moves on every
 * review, up for easy recalls and down for hard ones, never below 1.3.
 */

export type Grade = 0 | 1 | 2 | 3 | 4 | 5

export interface ReviewState {
  easeFactor: number
  intervalDays: number
  repetitions: number
  /** ISO timestamp of the next review. */
  dueAt: string
}

export type ReviewInput = Omit<ReviewState, 'dueAt'>

export const MIN_EASE = 1.3
export const DEFAULT_EASE = 2.5

export const NEW_CARD: ReviewInput = {
  easeFactor: DEFAULT_EASE,
  intervalDays: 0,
  repetitions: 0,
}

const MS_PER_DAY = 86_400_000

export function sm2(prev: ReviewInput, grade: Grade, now: Date): ReviewState {
  let { easeFactor, intervalDays, repetitions } = prev

  if (grade < 3) {
    repetitions = 0
    intervalDays = 1
  } else {
    if (repetitions === 0) intervalDays = 1
    else if (repetitions === 1) intervalDays = 6
    else intervalDays = Math.round(intervalDays * easeFactor)
    repetitions += 1
  }

  const q = 5 - grade
  easeFactor = Math.max(MIN_EASE, easeFactor + (0.1 - q * (0.08 + q * 0.02)))
  // Two decimals: matches the numeric(4,2) column and keeps results stable.
  easeFactor = Math.round(easeFactor * 100) / 100

  return {
    easeFactor,
    intervalDays,
    repetitions,
    dueAt: new Date(now.getTime() + intervalDays * MS_PER_DAY).toISOString(),
  }
}

/** The four answers the review screen offers, with their keyboard keys. */
export const GRADE_BUTTONS: { grade: Grade; label: string; key: string }[] = [
  { grade: 1, label: 'Again', key: '1' },
  { grade: 3, label: 'Hard', key: '2' },
  { grade: 4, label: 'Good', key: '3' },
  { grade: 5, label: 'Easy', key: '4' },
]

/** Days until the next review if this grade is chosen; for button hints. */
export function previewIntervalDays(prev: ReviewInput, grade: Grade): number {
  return sm2(prev, grade, new Date(0)).intervalDays
}

export function formatInterval(days: number): string {
  if (days < 1) return 'today'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  const months = Math.round(days / 30)
  return months === 1 ? '1 month' : `${months} months`
}
