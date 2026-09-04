'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import type { DeckRow, FlashcardReviewRow, FlashcardRow } from '@/lib/types'
import { formatInterval } from '@/lib/srs/sm2'
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

const EMPTY_CARD = { front: '', back: '', hint: '' }

function reviewLabel(r: FlashcardReviewRow | undefined): { text: string; tone: string } {
  if (!r) return { text: 'New', tone: 'bg-line text-ink' }
  const ms = new Date(r.due_at).getTime() - Date.now()
  if (ms <= 0) return { text: 'Due', tone: 'bg-primary-light text-primary' }
  return { text: `In ${formatInterval(Math.ceil(ms / 86_400_000))}`, tone: 'bg-background text-muted' }
}

export default function DeckPage() {
  const { id } = useParams<{ id: string }>()
  const user = useUser()
  const router = useRouter()
  const [deck, setDeck] = useState<DeckRow | null>(null)
  const [cards, setCards] = useState<FlashcardRow[]>([])
  const [reviews, setReviews] = useState<Map<string, FlashcardReviewRow>>(new Map())
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cardForm, setCardForm] = useState(EMPTY_CARD)
  const [editing, setEditing] = useState(false)
  const [deckForm, setDeckForm] = useState({ title: '', subject: '', description: '' })
  const [saving, setSaving] = useState(false)

  const isOwner = deck?.owner_id === user.id

  const load = useCallback(async () => {
    try {
      const { data: deckRow, error: deckError } = await supabase
        .from('decks')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (deckError) throw deckError
      if (!deckRow) {
        setNotFound(true)
        return
      }
      const d = deckRow as DeckRow
      setDeck(d)
      setDeckForm({ title: d.title, subject: d.subject ?? '', description: d.description ?? '' })

      const { data: cardRows, error: cardsError } = await supabase
        .from('flashcards')
        .select('*')
        .eq('deck_id', id)
        .order('sort')
        .order('created_at')
      if (cardsError) throw cardsError
      const list = (cardRows ?? []) as FlashcardRow[]
      setCards(list)

      if (list.length > 0) {
        const { data: reviewRows, error: reviewsError } = await supabase
          .from('flashcard_reviews')
          .select('*')
          .eq('user_id', user.id)
          .in(
            'card_id',
            list.map((c) => c.id)
          )
        if (reviewsError) throw reviewsError
        const m = new Map<string, FlashcardReviewRow>()
        for (const r of (reviewRows ?? []) as FlashcardReviewRow[]) m.set(r.card_id, r)
        setReviews(m)
      } else {
        setReviews(new Map())
      }
    } catch (err) {
      console.error('Error loading deck:', err)
      setError('Failed to load deck')
    } finally {
      setLoading(false)
    }
  }, [id, user.id])

  useEffect(() => {
    load()
  }, [load])

  const addCard = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('flashcards').insert({
        deck_id: id,
        front: cardForm.front.trim(),
        back: cardForm.back.trim(),
        hint: cardForm.hint.trim() || null,
        sort: cards.length,
      })
      if (insertError) throw insertError
      setCardForm(EMPTY_CARD)
      setSuccess('Card added')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add card')
    } finally {
      setSaving(false)
    }
  }

  const deleteCard = async (card: FlashcardRow) => {
    if (!confirm('Delete this card? Your review history for it goes too.')) return
    setError('')
    try {
      const { error: deleteError } = await supabase.from('flashcards').delete().eq('id', card.id)
      if (deleteError) throw deleteError
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete card')
    }
  }

  const saveDeck = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('decks')
        .update({
          title: deckForm.title.trim(),
          subject: deckForm.subject.trim() || null,
          description: deckForm.description.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (updateError) throw updateError
      setEditing(false)
      setSuccess('Deck updated')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update deck')
    } finally {
      setSaving(false)
    }
  }

  const deleteDeck = async () => {
    if (!deck) return
    if (!confirm(`Delete "${deck.title}" and all ${cards.length} cards?`)) return
    setError('')
    try {
      const { error: deleteError } = await supabase.from('decks').delete().eq('id', id)
      if (deleteError) throw deleteError
      router.push('/dashboard/learn')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deck')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deck" />
        <PageSpinner />
      </div>
    )
  }

  if (notFound || !deck) {
    return (
      <EmptyState
        title="Deck not found"
        description="It may have been deleted, or it isn't shared with you."
        action={<Button href="/dashboard/learn">Back to Learn</Button>}
      />
    )
  }

  const dueCount = cards.filter((c) => {
    const r = reviews.get(c.id)
    return !r || new Date(r.due_at).getTime() <= Date.now()
  }).length

  return (
    <div className="space-y-6">
      <PageHeader
        title={deck.title}
        subtitle={[deck.subject, `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`, deck.description]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Button variant="ghost" href="/dashboard/learn">
              Back
            </Button>
            {isOwner && (
              <Button variant="ghost" onClick={() => setEditing((v) => !v)}>
                {editing ? 'Cancel' : 'Edit deck'}
              </Button>
            )}
            <Button
              href={`/dashboard/learn/review?deck=${deck.id}`}
              className={dueCount === 0 ? 'pointer-events-none opacity-50' : undefined}
            >
              Study{dueCount > 0 && ` · ${dueCount}`}
            </Button>
          </>
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

      {editing && isOwner && (
        <Card>
          <form onSubmit={saveDeck} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Title" htmlFor="title" required>
                <Input
                  id="title"
                  value={deckForm.title}
                  onChange={(e) => setDeckForm({ ...deckForm, title: e.target.value })}
                  maxLength={120}
                  required
                />
              </Field>
              <Field label="Subject" htmlFor="subject">
                <Input
                  id="subject"
                  value={deckForm.subject}
                  onChange={(e) => setDeckForm({ ...deckForm, subject: e.target.value })}
                />
              </Field>
              <Field label="Description" htmlFor="description" className="md:col-span-2">
                <Input
                  id="description"
                  value={deckForm.description}
                  onChange={(e) => setDeckForm({ ...deckForm, description: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button type="submit" variant="secondary" loading={saving}>
                Save
              </Button>
              <Button variant="danger" onClick={deleteDeck}>
                Delete deck
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isOwner && (
        <Card>
          <h2 className="text-lg font-semibold text-ink mb-4">Add a card</h2>
          <form onSubmit={addCard} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Front" htmlFor="front" required hint="The question or term">
                <Input
                  id="front"
                  value={cardForm.front}
                  onChange={(e) => setCardForm({ ...cardForm, front: e.target.value })}
                  placeholder="e.g., What is the atomic number of Carbon?"
                  maxLength={2000}
                  required
                />
              </Field>
              <Field label="Back" htmlFor="back" required hint="The answer">
                <Input
                  id="back"
                  value={cardForm.back}
                  onChange={(e) => setCardForm({ ...cardForm, back: e.target.value })}
                  placeholder="e.g., 6"
                  maxLength={4000}
                  required
                />
              </Field>
              <Field label="Hint" htmlFor="hint" className="md:col-span-2">
                <Input
                  id="hint"
                  value={cardForm.hint}
                  onChange={(e) => setCardForm({ ...cardForm, hint: e.target.value })}
                  placeholder="Optional nudge shown with the answer"
                />
              </Field>
            </div>
            <Button type="submit" variant="secondary" loading={saving}>
              Add card
            </Button>
          </form>
        </Card>
      )}

      {cards.length === 0 ? (
        <EmptyState
          title="No cards yet"
          description={
            isOwner
              ? 'Add your first card above. Short, single-fact cards work best for spaced repetition.'
              : 'This deck has no cards yet.'
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-line">
            {cards.map((card) => {
              const label = reviewLabel(reviews.get(card.id))
              return (
                <li key={card.id} className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                    <p className="text-ink font-medium whitespace-pre-wrap">{card.front}</p>
                    <p className="text-muted whitespace-pre-wrap">{card.back}</p>
                    {card.hint && (
                      <p className="text-xs text-muted md:col-span-2">Hint: {card.hint}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${label.tone}`}>
                      {label.text}
                    </span>
                    {isOwner && (
                      <Button variant="danger" size="sm" onClick={() => deleteCard(card)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
