/**
 * XP rules, mirrored from award_xp() in 0003_learn.sql. The database is the
 * source of truth for what is actually paid; this copy exists so the UI can
 * label buttons and show progress without a round trip.
 */
export const XP_POINTS = {
  card_reviewed: 2,
  card_reviewed_well: 5,
  quiz_question_correct: 5,
  quiz_completed: 20,
  session_completed: 15,
  assignment_completed: 30,
  daily_first_activity: 10,
} as const

export type XpKind = keyof typeof XP_POINTS

/** Level 1 starts at 0 XP; each level needs 100 × (level−1)² in total. */
export function levelFor(totalXp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, totalXp) / 100)) + 1
}

export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level))
  return (l - 1) * (l - 1) * 100
}

export interface LevelProgress {
  level: number
  /** XP earned within the current level. */
  current: number
  /** XP needed to finish the current level. */
  needed: number
  /** 0–1 */
  fraction: number
}

export function levelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, totalXp)
  const level = levelFor(xp)
  const start = xpForLevel(level)
  const needed = xpForLevel(level + 1) - start
  const current = xp - start
  return { level, current, needed, fraction: Math.min(1, current / needed) }
}
