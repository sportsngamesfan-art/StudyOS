import { supabase } from '@/lib/supabase'
import type { XpKind } from './xp'

export interface AwardResult {
  /** False when the event had already been paid (same kind + reference). */
  awarded: boolean
  points: number
  total_xp: number
  streak: number
  longest_streak: number
  new_badges: string[]
}

/**
 * Calls award_xp() in the database. Never throws: XP is a bonus on top of
 * the real action, so a failure here (migration not applied, network blip)
 * is logged and the caller carries on.
 */
export async function awardXp(
  kind: Exclude<XpKind, 'daily_first_activity'>,
  ref?: string | null,
  qty = 1
): Promise<AwardResult | null> {
  try {
    const { data, error } = await supabase.rpc('award_xp', {
      p_kind: kind,
      p_ref: ref ?? null,
      p_qty: qty,
      p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    })
    if (error) throw error
    return data as AwardResult
  } catch (err) {
    console.warn('XP not awarded:', err)
    return null
  }
}
