import type { Day, Difficulty } from './constants'

/**
 * Row shapes for the tables in 0001_studyos_schema.sql, written by hand
 * because the target Supabase project is not reachable from this environment.
 * Replace with `supabase gen types typescript` output once it is.
 */
export interface DocumentRow {
  id: string
  user_id: string
  filename: string
  file_path: string
  file_size: number
  created_at: string
}

export interface TimetableRow {
  id: string
  user_id: string
  subject: string
  day: Day
  /** Postgres `time` — arrives as "HH:MM:SS". */
  start_time: string
  end_time: string
  room: string | null
  created_at: string
}

export interface AssignmentRow {
  id: string
  user_id: string
  title: string
  subject: string
  /** Postgres `date` — arrives as "YYYY-MM-DD". */
  deadline: string
  difficulty: Difficulty
  hours_required: number
  completed: boolean
  created_at: string
}
