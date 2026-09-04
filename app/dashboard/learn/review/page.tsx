'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import { cn } from '@/lib/cn'
import type { FlashcardReviewRow, FlashcardRow } from '@/lib/types'
import {
  GRADE_BUTTONS,
  NEW_CARD,
  formatInterval,
  previewIntervalDays,
  sm2,
  type Grade,
  type ReviewInput,
} from '@/lib/srs/sm2'
import { awardXp } from '@/lib/gamification/award'
import { Alert, Button, Card, EmptyState, PageHeader, PageSpinner } from '@/components/ui'

/** New cards introduced per review session, so a big deck doesn't bury you. */
const MAX_NEW_PER_SESSION = 20

interface QueueItem {
  card: FlashcardRow
  deckTitle: string
  state: ReviewInput | null
  dueAt: number | null
}

type TallyKey = 'again' | 'hard' | 'good' | 'easy'
const tallyKey = (g: Grade): TallyKey => (g < 3 ? 'again' : g === 3 ? 'hard' : g === 4 ? 'good' : 'easy')

export default function ReviewPage() {
  const user = useUser()
  const [ready, setReady] = useState(false)
  const [deckFilter, setDeckFilter] = useState<string | null>(null)
  const [deckTitle, setDeckTitle] = useState('')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState('')
  const [tally, setTally] = useState<Record<TallyKey, number>>({ again: 0, hard: 0, good: 0, easy: 0 })
  const [xpEarned, setXpEarned] = useState(0)
  const [newBadges, setNewBadges] = useState<string[]>([])

  // Read ?deck= from the window so the page prerenders without a Suspense
  // boundary around useSearchParams.
  useEffect(() => {
    setDeckFilter(new URLSearchParams(window.location.search).get('deck'))
    setReady(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let decksQuery = supabase.from('decks').select('id, title')
      if (deckFilter) decksQuery = decksQuery.eq('id', deckFilter)
      const { data: decks, error: decksError } = await decksQuery
      if (decksError) throw decksError

      const titles = new Map<string, string>()
      for (const d of (decks ?? []) as { id: string; title: string }[]) titles.set(d.id, d.title)
      if (deckFilter) setDeckTitle(titles.get(deckFilter) ?? '')

      const deckIds = Array.from(titles.keys())
      if (deckIds.length === 0) {
        setQueue([])
        return
      }

      const { data: cards, error: cardsError } = await supabase
        .from('flashcards')
        .select('*')
        .in('deck_id', deckIds)
        .order('sort')
        .limit(2000)
      if (cardsError) throw cardsError
      const cardRows = (cards ?? []) as FlashcardRow[]
      if (cardRows.length === 0) {
        setQueue([])
        return
      }

      const { data: reviews, error: reviewsError } = await supabase
        .from('flashcard_reviews')
        .select('*')
        .eq('user_id', user.id)
        .in(
          'card_id',
          cardRows.map((c) => c.id)
        )
      if (reviewsError) throw reviewsError
      const byCard = new Map<string, FlashcardReviewRow>()
      for (const r of (reviews ?? []) as FlashcardReviewRow[]) byCard.set(r.card_id, r)

      const now = Date.now()
      const due: QueueItem[] = []
      const fresh: QueueItem[] = []
      for (const card of cardRows) {
        const r = byCard.get(card.id)
        const item: QueueItem = {
          card,
          deckTitle: titles.get(card.deck_id) ?? '',
          state: r
            ? {
                easeFactor: Number(r.ease_factor),
                intervalDays: r.interval_days,
                repetitions: r.repetitions,
              }
            : null,
          dueAt: r ? new Date(r.due_at).getTime() : null,
        }
        if (!r) fresh.push(item)
        else if (item.dueAt !== null && item.dueAt <= now) due.push(item)
      }
      due.sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))

      setQueue([...due, ...fresh.slice(0, MAX_NEW_PER_SESSION)])
      setIndex(0)
      setRevealed(false)
      setTally({ again: 0, hard: 0, good: 0, easy: 0 })
      setXpEarned(0)
      setNewBadges([])
    } catch (err) {
      console.error('Error loading review queue:', err)
      setError('Failed to load cards')
    } finally {
      setLoading(false)
    }
  }, [user.id, deckFilter])

  useEffect(() => {
    if (ready) load()
  }, [ready, load])

  const current: QueueItem | undefined = queue[index]
  const finished = ready && !loading && queue.length > 0 && index >= queue.length

  const grade = useCallback(
    async (g: Grade) => {
      if (!current || grading) return
      setGrading(true)
      setError('')
      try {
        const next = sm2(current.state ?? NEW_CARD, g, new Date())
        const { error: upsertError } = await supabase.from('flashcard_reviews').upsert(
          {
            card_id: current.card.id,
            user_id: user.id,
            ease_factor: next.easeFactor,
            interval_days: next.intervalDays,
            repetitions: next.repetitions,
            due_at: next.dueAt,
            last_grade: g,
            reviewed_at: new Date().toISOString(),
          },
          { onConflict: 'card_id,user_id' }
        )
        if (upsertError) throw upsertError

        setTally((t) => ({ ...t, [tallyKey(g)]: t[tallyKey(g)] + 1 }))

        const award = await awardXp(g >= 4 ? 'card_reviewed_well' : 'card_reviewed')
        if (award?.awarded) {
          setXpEarned((x) => x + award.points)
          if (award.new_badges.length > 0) setNewBadges((b) => [...b, ...award.new_badges])
        }

        setRevealed(false)
        setIndex((i) => i + 1)
      } catch (err) {
        console.error('Error saving review:', err)
        setError('Could not save that review — try again')
      } finally {
        setGrading(false)
      }
    },
    [current, grading, user.id]
  )

  // Space/Enter reveals; 1–4 grade. Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (!current || finished) return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
        return
      }
      if (revealed) {
        const btn = GRADE_BUTTONS.find((b) => b.key === e.key)
        if (btn) {
          e.preventDefault()
          grade(btn.grade)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, finished, revealed, grade])

  const subtitle = deckFilter
    ? `Deck: ${deckTitle || '…'}`
    : `Everything due, plus up to ${MAX_NEW_PER_SESSION} new cards`

  if (!ready || loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Review" subtitle={subtitle} />
        <PageSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Review"
        subtitle={subtitle}
        actions={
          <Button variant="ghost" href="/dashboard/learn">
            Back to Learn
          </Button>
        }
      />

      {error && (
        <Alert variant="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      {queue.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description={
            deckFilter
              ? 'Every card in this deck is scheduled for later. Come back when some are due, or add more cards.'
              : 'No cards are due and there are no new ones. Add cards to a deck, or come back tomorrow.'
          }
          action={<Button href="/dashboard/learn">Back to Learn</Button>}
        />
      ) : finished ? (
        <Card className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-ink">Session complete</h2>
          <p className="text-muted">
            {queue.length} {queue.length === 1 ? 'card' : 'cards'} reviewed
            {xpEarned > 0 && (
              <>
                {' '}· <span className="text-primary font-semibold">+{xpEarned} XP</span>
              </>
            )}
          </p>
          <div className="grid grid-cols-4 gap-2 max-w-md mx-auto text-sm">
            {(['again', 'hard', 'good', 'easy'] as TallyKey[]).map((k) => (
              <div key={k} className="bg-background rounded-lg p-2">
                <p className="text-xl font-bold text-ink">{tally[k]}</p>
                <p className="text-muted capitalize">{k}</p>
              </div>
            ))}
          </div>
          {newBadges.length > 0 && (
            <Alert variant="info" className="text-left">
              New {newBadges.length === 1 ? 'badge' : 'badges'} earned: {newBadges.join(', ')}
            </Alert>
          )}
          <div className="flex justify-center gap-2 pt-2">
            <Button onClick={load}>Review again</Button>
            <Button variant="ghost" href="/dashboard/learn">
              Back to Learn
            </Button>
          </div>
        </Card>
      ) : current ? (
        <>
          <div className="flex items-center gap-3 text-sm text-muted">
            <div className="flex-1 h-2 rounded-full bg-line overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-theme"
                style={{ width: `${Math.round((index / queue.length) * 100)}%` }}
              />
            </div>
            <span className="whitespace-nowrap">
              {index + 1} / {queue.length}
            </span>
          </div>

          <Card padding="lg" className="space-y-6">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="truncate">{current.deckTitle}</span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded font-semibold uppercase tracking-wide',
                  current.state ? 'bg-primary-light text-primary' : 'bg-line text-ink'
                )}
              >
                {current.state ? 'Due' : 'New'}
              </span>
            </div>

            <div className="min-h-[6rem] flex items-center justify-center">
              <p className="text-xl md:text-2xl font-semibold text-ink text-center whitespace-pre-wrap">
                {current.card.front}
              </p>
            </div>

            {revealed ? (
              <>
                <div className="border-t border-line pt-6">
                  <p className="text-lg text-ink text-center whitespace-pre-wrap">{current.card.back}</p>
                  {current.card.hint && (
                    <p className="text-sm text-muted text-center mt-3">Hint: {current.card.hint}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GRADE_BUTTONS.map((b) => {
                    const days = previewIntervalDays(current.state ?? NEW_CARD, b.grade)
                    return (
                      <Button
                        key={b.grade}
                        variant={b.grade === 1 ? 'danger' : b.grade === 4 ? 'primary' : 'ghost'}
                        onClick={() => grade(b.grade)}
                        disabled={grading}
                        className="flex-col gap-0 py-2"
                      >
                        <span>{b.label}</span>
                        <span className="text-[11px] font-normal opacity-80">
                          {formatInterval(days)} · {b.key}
                        </span>
                      </Button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="text-center">
                <Button onClick={() => setRevealed(true)}>Show answer</Button>
                <p className="text-xs text-muted mt-2">Space to reveal · 1–4 to grade</p>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
