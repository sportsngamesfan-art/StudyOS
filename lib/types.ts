import type { Day, Difficulty } from './constants'
import type { Shortfall } from './planner/schedule'

/**
 * Row shapes for the tables in supabase/migrations, written by hand because
 * the target Supabase project is not reachable from this environment.
 * Replace with `supabase gen types typescript` output once it is.
 */

// --- 0001_studyos_schema.sql -------------------------------------------------

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

// --- 0002_study_plans.sql ----------------------------------------------------

export interface UserSettingsRow {
  user_id: string
  timezone: string
  study_start: string
  study_end: string
  daily_max_minutes: number
  updated_at: string
}

export interface StudyPlanRow {
  id: string
  user_id: string
  generated_at: string
  horizon_days: number
  params: Record<string, unknown>
  shortfalls: Shortfall[]
}

export interface StudyPlanSessionRow {
  id: string
  plan_id: string
  user_id: string
  assignment_id: string | null
  subject: string
  title: string
  difficulty: Difficulty
  date: string
  start_time: string
  end_time: string
  completed_at: string | null
}

// --- 0003_learn.sql ----------------------------------------------------------

export interface DeckRow {
  id: string
  /** null = official content */
  owner_id: string | null
  title: string
  description: string | null
  subject: string | null
  published: boolean
  created_at: string
  updated_at: string
}

export interface FlashcardRow {
  id: string
  deck_id: string
  front: string
  back: string
  hint: string | null
  sort: number
  created_at: string
}

export interface FlashcardReviewRow {
  card_id: string
  user_id: string
  ease_factor: number
  interval_days: number
  repetitions: number
  due_at: string
  last_grade: number | null
  reviewed_at: string | null
}

export type QuestionKind = 'mcq' | 'true_false'

export interface QuizRow {
  id: string
  owner_id: string | null
  title: string
  description: string | null
  subject: string | null
  published: boolean
  created_at: string
}

export interface QuizQuestionRow {
  id: string
  quiz_id: string
  kind: QuestionKind
  prompt: string
  explanation: string | null
  sort: number
}

export interface QuizOptionRow {
  id: string
  question_id: string
  text: string
  is_correct: boolean
  sort: number
}

export interface QuizAttemptRow {
  id: string
  quiz_id: string
  user_id: string
  started_at: string
  finished_at: string | null
  score: number
  max_score: number
}

export interface BadgeRow {
  slug: string
  name: string
  description: string
  icon: string
  rule_kind: 'xp_total' | 'streak' | 'cards_reviewed' | 'quizzes_completed' | 'perfect_quizzes'
  threshold: number
  sort: number
}

/** Shape returned by the learn_stats() function. */
export interface LearnStats {
  total_xp: number
  streak: number
  longest_streak: number
  due_reviews: number
  cards_reviewed: number
  badges: string[]
}
