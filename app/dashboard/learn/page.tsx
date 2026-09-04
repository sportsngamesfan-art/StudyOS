'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import { cn } from '@/lib/cn'
import type { BadgeRow, DeckRow, LearnStats, QuizRow } from '@/lib/types'
import { levelProgress } from '@/lib/gamification/xp'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PageSpinner,
} from '@/components/ui'

interface DeckSummary extends DeckRow {
  total: number
  due: number
  fresh: number
}

interface QuizSummary extends QuizRow {
  questions: number
  best: { score: number; max: number } | null
}

const EMPTY_STATS: LearnStats = {
  total_xp: 0,
  streak: 0,
  longest_streak: 0,
  due_reviews: 0,
  cards_reviewed: 0,
  badges: [],
}

const EMPTY_FORM = { title: '', subject: '', description: '' }

export default function LearnPage() {
  const user = useUser()
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const [stats, setStats] = useState<LearnStats>(EMPTY_STATS)
  const [badges, setBadges] = useState<BadgeRow[]>([])
  const [totals, setTotals] = useState({ due: 0, fresh: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deckForm, setDeckForm] = useState(EMPTY_FORM)
  const [quizForm, setQuizForm] = useState(EMPTY_FORM)
  const [showDeckForm, setShowDeckForm] = useState(false)
  const [showQuizForm, setShowQuizForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [decksRes, cardsRes, reviewsRes, quizzesRes, questionsRes, attemptsRes, statsRes, badgesRes] =
        await Promise.all([
          supabase.from('decks').select('*').order('created_at', { ascending: false }),
          supabase.from('flashcards').select('id, deck_id').limit(2000),
          supabase.from('flashcard_reviews').select('card_id, due_at').eq('user_id', user.id),
          supabase.from('quizzes').select('*').order('created_at', { ascending: false }),
          supabase.from('quiz_questions').select('id, quiz_id').limit(2000),
          supabase
            .from('quiz_attempts')
            .select('quiz_id, score, max_score')
            .eq('user_id', user.id)
            .not('finished_at', 'is', null),
          supabase.rpc('learn_stats'),
          supabase.from('badges').select('*').order('sort'),
        ])
      for (const r of [decksRes, cardsRes, reviewsRes, quizzesRes, questionsRes, attemptsRes, statsRes, badgesRes]) {
        if (r.error) throw r.error
      }

      const now = Date.now()
      const dueAt = new Map<string, number>()
      for (const r of (reviewsRes.data ?? []) as { card_id: string; due_at: string }[]) {
        dueAt.set(r.card_id, new Date(r.due_at).getTime())
      }
      const perDeck = new Map<string, { total: number; due: number; fresh: number }>()
      let due = 0
      let fresh = 0
      for (const c of (cardsRes.data ?? []) as { id: string; deck_id: string }[]) {
        const s = perDeck.get(c.deck_id) ?? { total: 0, due: 0, fresh: 0 }
        s.total += 1
        const d = dueAt.get(c.id)
        if (d === undefined) {
          s.fresh += 1
          fresh += 1
        } else if (d <= now) {
          s.due += 1
          due += 1
        }
        perDeck.set(c.deck_id, s)
      }
      setTotals({ due, fresh })
      setDecks(
        ((decksRes.data ?? []) as DeckRow[]).map((d) => ({
          ...d,
          ...(perDeck.get(d.id) ?? { total: 0, due: 0, fresh: 0 }),
        }))
      )

      const questionCount = new Map<string, number>()
      for (const q of (questionsRes.data ?? []) as { id: string; quiz_id: string }[]) {
        questionCount.set(q.quiz_id, (questionCount.get(q.quiz_id) ?? 0) + 1)
      }
      const best = new Map<string, { score: number; max: number }>()
      for (const a of (attemptsRes.data ?? []) as { quiz_id: string; score: number; max_score: number }[]) {
        const prev = best.get(a.quiz_id)
        if (!prev || a.score / Math.max(1, a.max_score) > prev.score / Math.max(1, prev.max)) {
          best.set(a.quiz_id, { score: a.score, max: a.max_score })
        }
      }
      setQuizzes(
        ((quizzesRes.data ?? []) as QuizRow[]).map((q) => ({
          ...q,
          questions: questionCount.get(q.id) ?? 0,
          best: best.get(q.id) ?? null,
        }))
      )

      setStats({ ...EMPTY_STATS, ...((statsRes.data ?? {}) as Partial<LearnStats>) })
      setBadges((badgesRes.data ?? []) as BadgeRow[])
    } catch (err) {
      console.error('Error loading learn hub:', err)
      setError('Failed to load. If this is a fresh database, migration 0003 may not have been run yet.')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  const createDeck = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('decks').insert({
        owner_id: user.id,
        title: deckForm.title.trim(),
        subject: deckForm.subject.trim() || null,
        description: deckForm.description.trim() || null,
      })
      if (insertError) throw insertError
      setDeckForm(EMPTY_FORM)
      setShowDeckForm(false)
      setSuccess('Deck created — open it to add cards')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deck')
    } finally {
      setSaving(false)
    }
  }

  const createQuiz = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('quizzes').insert({
        owner_id: user.id,
        title: quizForm.title.trim(),
        subject: quizForm.subject.trim() || null,
        description: quizForm.description.trim() || null,
      })
      if (insertError) throw insertError
      setQuizForm(EMPTY_FORM)
      setShowQuizForm(false)
      setSuccess('Quiz created — open it to add questions')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quiz')
    } finally {
      setSaving(false)
    }
  }

  const progress = levelProgress(stats.total_xp)
  const earned = new Set(stats.badges)
  const reviewable = totals.due + totals.fresh

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learn"
        subtitle="Flashcards with spaced repetition, quizzes, and your progress"
        actions={
          reviewable > 0 ? (
            <Button href="/dashboard/learn/review">
              Review now · {totals.due} due{totals.fresh > 0 && `, ${totals.fresh} new`}
            </Button>
          ) : (
            <Button disabled>Nothing to review</Button>
          )
        }
      />

      {error && (
        <Alert variant="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onDismiss={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          {/* Progress */}
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted">Level</p>
                <p className="text-3xl font-bold text-ink">{progress.level}</p>
                <div className="mt-2 h-2 rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-theme"
                    style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted mt-1">
                  {progress.current} / {progress.needed} XP to level {progress.level + 1} ·{' '}
                  {stats.total_xp} total
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">Streak</p>
                <p className="text-3xl font-bold text-ink">
                  {stats.streak} <span className="text-base font-medium text-muted">days</span>
                </p>
                <p className="text-xs text-muted mt-1">
                  Longest {stats.longest_streak} · {stats.cards_reviewed} cards reviewed
                </p>
              </div>
              <div>
                <p className="text-sm text-muted mb-2">
                  Badges · {earned.size} of {badges.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {badges.map((b) => (
                    <span
                      key={b.slug}
                      title={`${b.name} — ${b.description}`}
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center text-lg border',
                        earned.has(b.slug)
                          ? 'bg-primary-light border-primary/30'
                          : 'bg-background border-line opacity-40 grayscale'
                      )}
                    >
                      {b.icon}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Decks */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-ink">Flashcard decks</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowDeckForm((v) => !v)}>
                {showDeckForm ? 'Cancel' : '+ New deck'}
              </Button>
            </div>

            {showDeckForm && (
              <Card>
                <form onSubmit={createDeck} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Title" htmlFor="deck-title" required>
                      <Input
                        id="deck-title"
                        value={deckForm.title}
                        onChange={(e) => setDeckForm({ ...deckForm, title: e.target.value })}
                        placeholder="e.g., Chemistry — Periodic Table"
                        maxLength={120}
                        required
                      />
                    </Field>
                    <Field label="Subject" htmlFor="deck-subject">
                      <Input
                        id="deck-subject"
                        value={deckForm.subject}
                        onChange={(e) => setDeckForm({ ...deckForm, subject: e.target.value })}
                        placeholder="e.g., Chemistry"
                      />
                    </Field>
                    <Field label="Description" htmlFor="deck-description" className="md:col-span-2">
                      <Input
                        id="deck-description"
                        value={deckForm.description}
                        onChange={(e) => setDeckForm({ ...deckForm, description: e.target.value })}
                        placeholder="What this deck covers"
                      />
                    </Field>
                  </div>
                  <Button type="submit" variant="secondary" loading={saving}>
                    Create deck
                  </Button>
                </form>
              </Card>
            )}

            {decks.length === 0 ? (
              <EmptyState
                title="No decks yet"
                description="Create a deck, add cards, and review them daily. Spaced repetition schedules each card for just before you'd forget it."
                action={<Button onClick={() => setShowDeckForm(true)}>Create your first deck</Button>}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {decks.map((d) => (
                  <Card key={d.id} padding="sm" className="flex flex-col gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-ink truncate">{d.title}</h3>
                        {d.owner_id === null && (
                          <span className="text-[10px] uppercase tracking-wide bg-line text-ink px-1.5 py-0.5 rounded">
                            Official
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {d.subject && `${d.subject} · `}
                        {d.total} {d.total === 1 ? 'card' : 'cards'}
                        {d.due > 0 && <span className="text-primary font-semibold"> · {d.due} due</span>}
                        {d.fresh > 0 && ` · ${d.fresh} new`}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <Button
                        size="sm"
                        href={`/dashboard/learn/review?deck=${d.id}`}
                        className={cn(d.due + d.fresh === 0 && 'pointer-events-none opacity-50')}
                      >
                        Study
                      </Button>
                      <Button size="sm" variant="ghost" href={`/dashboard/learn/decks/${d.id}`}>
                        Open
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Quizzes */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-ink">Quizzes</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowQuizForm((v) => !v)}>
                {showQuizForm ? 'Cancel' : '+ New quiz'}
              </Button>
            </div>

            {showQuizForm && (
              <Card>
                <form onSubmit={createQuiz} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Title" htmlFor="quiz-title" required>
                      <Input
                        id="quiz-title"
                        value={quizForm.title}
                        onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                        placeholder="e.g., Physics — Light, chapter test"
                        maxLength={120}
                        required
                      />
                    </Field>
                    <Field label="Subject" htmlFor="quiz-subject">
                      <Input
                        id="quiz-subject"
                        value={quizForm.subject}
                        onChange={(e) => setQuizForm({ ...quizForm, subject: e.target.value })}
                        placeholder="e.g., Physics"
                      />
                    </Field>
                    <Field label="Description" htmlFor="quiz-description" className="md:col-span-2">
                      <Input
                        id="quiz-description"
                        value={quizForm.description}
                        onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                        placeholder="What this quiz tests"
                      />
                    </Field>
                  </div>
                  <Button type="submit" variant="secondary" loading={saving}>
                    Create quiz
                  </Button>
                </form>
              </Card>
            )}

            {quizzes.length === 0 ? (
              <EmptyState
                title="No quizzes yet"
                description="Build a quiz from multiple-choice and true/false questions, then test yourself. Every correct answer earns XP."
                action={<Button onClick={() => setShowQuizForm(true)}>Create your first quiz</Button>}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizzes.map((q) => (
                  <Card key={q.id} padding="sm" className="flex flex-col gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-ink truncate">{q.title}</h3>
                        {q.owner_id === null && (
                          <span className="text-[10px] uppercase tracking-wide bg-line text-ink px-1.5 py-0.5 rounded">
                            Official
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {q.subject && `${q.subject} · `}
                        {q.questions} {q.questions === 1 ? 'question' : 'questions'}
                        {q.best && (
                          <span className="text-success font-semibold">
                            {' '}· best {q.best.score}/{q.best.max}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="mt-auto">
                      <Button size="sm" href={`/dashboard/learn/quizzes/${q.id}`}>
                        {q.questions > 0 ? 'Take quiz' : 'Add questions'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
