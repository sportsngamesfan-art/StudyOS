import { describe, expect, it } from 'vitest'
import { MIN_EASE, NEW_CARD, formatInterval, previewIntervalDays, sm2 } from './sm2'

const NOW = new Date('2026-09-07T10:00:00.000Z')
const daysLater = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString()

describe('sm2', () => {
  it('schedules a new card for tomorrow on Good and keeps the ease', () => {
    const next = sm2(NEW_CARD, 4, NOW)
    expect(next).toEqual({ easeFactor: 2.5, intervalDays: 1, repetitions: 1, dueAt: daysLater(1) })
  })

  it('follows the 1 → 6 → interval×ease ladder on repeated Good', () => {
    const first = sm2(NEW_CARD, 4, NOW)
    const second = sm2(first, 4, NOW)
    const third = sm2(second, 4, NOW)
    expect(second.intervalDays).toBe(6)
    expect(second.repetitions).toBe(2)
    expect(third.intervalDays).toBe(15) // round(6 × 2.5)
    expect(third.repetitions).toBe(3)
  })

  it('raises the ease on Easy and lowers it on Hard', () => {
    expect(sm2(NEW_CARD, 5, NOW).easeFactor).toBe(2.6)
    expect(sm2(NEW_CARD, 3, NOW).easeFactor).toBe(2.36)
  })

  it('resets on Again: repetitions to zero, back tomorrow, ease down', () => {
    const mature = { easeFactor: 2.5, intervalDays: 15, repetitions: 3 }
    const lapsed = sm2(mature, 1, NOW)
    expect(lapsed).toEqual({ easeFactor: 1.96, intervalDays: 1, repetitions: 0, dueAt: daysLater(1) })
  })

  it('never drops the ease below the floor', () => {
    let state = { ...NEW_CARD }
    for (let i = 0; i < 10; i++) state = sm2(state, 0, NOW)
    expect(state.easeFactor).toBe(MIN_EASE)
  })

  it('previews intervals without changing state', () => {
    const state = { easeFactor: 2.5, intervalDays: 6, repetitions: 2 }
    expect(previewIntervalDays(state, 1)).toBe(1)
    expect(previewIntervalDays(state, 4)).toBe(15)
    expect(state.intervalDays).toBe(6)
  })

  it('formats intervals for humans', () => {
    expect(formatInterval(0)).toBe('today')
    expect(formatInterval(1)).toBe('1 day')
    expect(formatInterval(6)).toBe('6 days')
    expect(formatInterval(45)).toBe('2 months')
  })
})
