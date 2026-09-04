import { describe, expect, it } from 'vitest'
import { levelFor, levelProgress, xpForLevel } from './xp'

describe('levels', () => {
  it('starts at level 1 and steps at 100, 400, 900', () => {
    expect(levelFor(0)).toBe(1)
    expect(levelFor(99)).toBe(1)
    expect(levelFor(100)).toBe(2)
    expect(levelFor(399)).toBe(2)
    expect(levelFor(400)).toBe(3)
    expect(levelFor(900)).toBe(4)
  })

  it('inverts levelFor at the thresholds', () => {
    for (const level of [1, 2, 3, 4, 10]) {
      expect(levelFor(xpForLevel(level))).toBe(level)
      expect(levelFor(xpForLevel(level) - 1)).toBe(Math.max(1, level - 1))
    }
  })

  it('reports progress within the current level', () => {
    expect(levelProgress(0)).toEqual({ level: 1, current: 0, needed: 100, fraction: 0 })
    expect(levelProgress(150)).toEqual({ level: 2, current: 50, needed: 300, fraction: 50 / 300 })
    expect(levelProgress(-20).current).toBe(0)
  })
})
