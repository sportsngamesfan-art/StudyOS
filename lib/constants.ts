/**
 * Shared enums. The same values are enforced as CHECK constraints in
 * supabase/migrations/0001_studyos_schema.sql — keep both in step.
 */
export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const
export type Day = (typeof DAYS)[number]

/** Position of a weekday for sorting; unknown values sort last. */
export function dayIndex(day: string): number {
  const i = (DAYS as readonly string[]).indexOf(day)
  return i === -1 ? DAYS.length : i
}

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const ALLOWED_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
] as const
