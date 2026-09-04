'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import { cn } from '@/lib/cn'
import type {
  QuestionKind,
  QuizAttemptRow,
  QuizOptionRow,
  QuizQuestionRow,
  QuizRow,
} from '@/lib/types'
import { awardXp } from '@/lib/gamification/award'
import { XP_POINTS } from '@/lib/gamification/xp'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PageSpinner,
  Select,
} from '@/components/ui'

interface QuestionWithOptions extends QuizQuestionRow {
  options: QuizOptionRow[]
}

interface Result {
  attemptId: string
  score: number
  max: number
  xp: number
  newBadges: string[]
  /** question id → chosen option id */
  chosen: Record<string, string>
}

const EMPTY_QUESTION = {
  prompt: '',
  kind: 'mcq' as QuestionKind,
  explanation: '',
  options: ['', '', '', ''],
  correct: 0,
  tfCorrect: 'true',
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function QuizPage() {
  const { id } = useParams<{ id: string }>()
  const user = useUser()
  const router = useRouter()
  const [quiz, setQuiz] = useState<QuizRow | null>(null)
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([])
  const [attempts, setAttempts] = useState<QuizAttemptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [mode, setMode] = useState<'take' | 'edit' | 'result'>('take')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [startedAt, setStartedAt] = useState<string>(() => new Date().toISOString())
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const [qForm, setQForm] = useState(EMPTY_QUESTION)
  const [saving, setSaving] = useState(false)

  const isOwner = quiz?.owner_id === user.id

  const load = useCallback(async () => {
    try {
      const { data: quizRow, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (quizError) throw quizError
      if (!quizRow) {
        setNotFound(true)
        return
      }
      setQuiz(quizRow as QuizRow)

      const [questionsRes, attemptsRes] = await Promise.all([
        supabase.from('quiz_questions').select('*').eq('quiz_id', id).order('sort'),
        supabase
          .from('quiz_attempts')
          .select('*')
          .eq('quiz_id', id)
          .eq('user_id', user.id)
          .not('finished_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(10),
      ])
      if (questionsRes.error) throw questionsRes.error
      if (attemptsRes.error) throw attemptsRes.error

      const qs = (questionsRes.data ?? []) as QuizQuestionRow[]
      let options: QuizOptionRow[] = []
      if (qs.length > 0) {
        const { data: optionRows, error: optionsError } = await supabase
          .from('quiz_options')
          .select('*')
          .in(
            'question_id',
            qs.map((q) => q.id)
          )
          .order('sort')
        if (optionsError) throw optionsError
        options = (optionRows ?? []) as QuizOptionRow[]
      }
      setQuestions(qs.map((q) => ({ ...q, options: options.filter((o) => o.question_id === q.id) })))
      setAttempts((attemptsRes.data ?? []) as QuizAttemptRow[])
    } catch (err) {
      console.error('Error loading quiz:', err)
      setError('Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }, [id, user.id])

  useEffect(() => {
    load()
  }, [load])

  const startOver = () => {
    setAnswers({})
    setResult(null)
    setStartedAt(new Date().toISOString())
    setMode('take')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (questions.some((q) => !answers[q.id])) {
      setError('Answer every question before submitting')
      return
    }
    setSubmitting(true)
    try {
      const graded = questions.map((q) => {
        const chosen = q.options.find((o) => o.id === answers[q.id])
        return { question: q, chosen, correct: Boolean(chosen?.is_correct) }
      })
      const score = graded.filter((g) => g.correct).length
      const max = questions.length

      const { data: attempt, error: attemptError } = await supabase
        .from('quiz_attempts')
        .insert({
          quiz_id: id,
          user_id: user.id,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          score,
          max_score: max,
        })
        .select('id')
        .single()
      if (attemptError) throw attemptError

      const { error: answersError } = await supabase.from('quiz_answers').insert(
        graded.map((g) => ({
          attempt_id: attempt.id,
          user_id: user.id,
          question_id: g.question.id,
          option_id: g.chosen?.id ?? null,
          correct: g.correct,
        }))
      )
      if (answersError) throw answersError

      let xp = 0
      const newBadges: string[] = []
      const completed = await awardXp('quiz_completed', attempt.id)
      if (completed?.awarded) {
        xp += completed.points
        newBadges.push(...completed.new_badges)
      }
      if (score > 0) {
        const correct = await awardXp('quiz_question_correct', attempt.id, score)
        if (correct?.awarded) {
          xp += correct.points
          newBadges.push(...correct.new_badges)
        }
      }

      setResult({ attemptId: attempt.id, score, max, xp, newBadges, chosen: { ...answers } })
      setMode('result')
      await load()
    } catch (err) {
      console.error('Error submitting quiz:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit quiz')
    } finally {
      setSubmitting(false)
    }
  }

  const addQuestion = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const isMcq = qForm.kind === 'mcq'
    const filled = qForm.options.map((o) => o.trim()).filter(Boolean)
    if (isMcq && filled.length < 2) {
      setError('Give at least two answer options')
      return
    }
    if (isMcq && !qForm.options[qForm.correct]?.trim()) {
      setError('Mark one of the filled-in options as correct')
      return
    }

    setSaving(true)
    try {
      const { data: question, error: questionError } = await supabase
        .from('quiz_questions')
        .insert({
          quiz_id: id,
          kind: qForm.kind,
          prompt: qForm.prompt.trim(),
          explanation: qForm.explanation.trim() || null,
          sort: questions.length,
        })
        .select('id')
        .single()
      if (questionError) throw questionError

      const optionRows = isMcq
        ? qForm.options
            .map((text, i) => ({ text: text.trim(), is_correct: i === qForm.correct }))
            .filter((o) => o.text)
            .map((o, sort) => ({ ...o, question_id: question.id, sort }))
        : [
            { question_id: question.id, text: 'True', is_correct: qForm.tfCorrect === 'true', sort: 0 },
            { question_id: question.id, text: 'False', is_correct: qForm.tfCorrect === 'false', sort: 1 },
          ]
      const { error: optionsError } = await supabase.from('quiz_options').insert(optionRows)
      if (optionsError) throw optionsError

      setQForm(EMPTY_QUESTION)
      setSuccess('Question added')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question')
    } finally {
      setSaving(false)
    }
  }

  const deleteQuestion = async (q: QuizQuestionRow) => {
    if (!confirm('Delete this question?')) return
    setError('')
    try {
      const { error: deleteError } = await supabase.from('quiz_questions').delete().eq('id', q.id)
      if (deleteError) throw deleteError
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question')
    }
  }

  const deleteQuiz = async () => {
    if (!quiz) return
    if (!confirm(`Delete "${quiz.title}" and its ${questions.length} questions?`)) return
    try {
      const { error: deleteError } = await supabase.from('quizzes').delete().eq('id', id)
      if (deleteError) throw deleteError
      router.push('/dashboard/learn')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete quiz')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quiz" />
        <PageSpinner />
      </div>
    )
  }

  if (notFound || !quiz) {
    return (
      <EmptyState
        title="Quiz not found"
        description="It may have been deleted, or it isn't shared with you."
        action={<Button href="/dashboard/learn">Back to Learn</Button>}
      />
    )
  }

  const best = attempts.reduce<QuizAttemptRow | null>(
    (b, a) => (!b || a.score / Math.max(1, a.max_score) > b.score / Math.max(1, b.max_score) ? a : b),
    null
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={quiz.title}
        subtitle={[
          quiz.subject,
          `${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`,
          best && `best ${best.score}/${best.max_score}`,
          quiz.description,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Button variant="ghost" href="/dashboard/learn">
              Back
            </Button>
            {isOwner && mode !== 'result' && (
              <Button variant="ghost" onClick={() => setMode(mode === 'edit' ? 'take' : 'edit')}>
                {mode === 'edit' ? 'Take quiz' : 'Edit questions'}
              </Button>
            )}
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

      {mode === 'edit' && isOwner && (
        <>
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Add a question</h2>
            <form onSubmit={addQuestion} className="space-y-4">
              <Field label="Question" htmlFor="prompt" required>
                <Input
                  id="prompt"
                  value={qForm.prompt}
                  onChange={(e) => setQForm({ ...qForm, prompt: e.target.value })}
                  placeholder="e.g., Which gas is most abundant in Earth's atmosphere?"
                  maxLength={2000}
                  required
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Type" htmlFor="kind">
                  <Select
                    id="kind"
                    value={qForm.kind}
                    onChange={(e) => setQForm({ ...qForm, kind: e.target.value as QuestionKind })}
                  >
                    <option value="mcq">Multiple choice</option>
                    <option value="true_false">True / False</option>
                  </Select>
                </Field>
                {qForm.kind === 'true_false' && (
                  <Field label="Correct answer" htmlFor="tf">
                    <Select
                      id="tf"
                      value={qForm.tfCorrect}
                      onChange={(e) => setQForm({ ...qForm, tfCorrect: e.target.value })}
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </Select>
                  </Field>
                )}
              </div>

              {qForm.kind === 'mcq' && (
                <fieldset className="space-y-2">
                  <legend className="block text-sm font-medium text-ink mb-1">
                    Options <span className="text-muted font-normal">(tick the correct one)</span>
                  </legend>
                  {qForm.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="correct"
                        checked={qForm.correct === i}
                        onChange={() => setQForm({ ...qForm, correct: i })}
                        aria-label={`Option ${i + 1} is correct`}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                      />
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const options = [...qForm.options]
                          options[i] = e.target.value
                          setQForm({ ...qForm, options })
                        }}
                        placeholder={`Option ${i + 1}${i < 2 ? '' : ' (optional)'}`}
                        maxLength={500}
                      />
                    </div>
                  ))}
                </fieldset>
              )}

              <Field label="Explanation" htmlFor="explanation" hint="Shown after answering">
                <Input
                  id="explanation"
                  value={qForm.explanation}
                  onChange={(e) => setQForm({ ...qForm, explanation: e.target.value })}
                  placeholder="Optional"
                />
              </Field>

              <div className="flex items-center justify-between gap-2">
                <Button type="submit" variant="secondary" loading={saving}>
                  Add question
                </Button>
                <Button variant="danger" onClick={deleteQuiz}>
                  Delete quiz
                </Button>
              </div>
            </form>
          </Card>

          {questions.length > 0 && (
            <Card padding="none" className="overflow-hidden">
              <ol className="divide-y divide-line">
                {questions.map((q, i) => (
                  <li key={q.id} className="p-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-ink font-medium">
                        {i + 1}. {q.prompt}
                      </p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {q.options.map((o) => (
                          <li key={o.id} className={o.is_correct ? 'text-success font-semibold' : 'text-muted'}>
                            {o.is_correct ? '✓' : '·'} {o.text}
                          </li>
                        ))}
                      </ul>
                      {q.explanation && <p className="text-xs text-muted mt-2">{q.explanation}</p>}
                    </div>
                    <Button variant="danger" size="sm" onClick={() => deleteQuestion(q)}>
                      Delete
                    </Button>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}

      {mode === 'take' &&
        (questions.length === 0 ? (
          <EmptyState
            title="No questions yet"
            description={
              isOwner
                ? 'Add multiple-choice or true/false questions, then take the quiz.'
                : 'This quiz has no questions yet.'
            }
            action={isOwner ? <Button onClick={() => setMode('edit')}>Add questions</Button> : undefined}
          />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {questions.map((q, i) => (
              <Card key={q.id}>
                <p className="font-medium text-ink mb-3">
                  <span className="text-muted mr-2">{i + 1}.</span>
                  {q.prompt}
                </p>
                <div className="space-y-2">
                  {q.options.map((o) => (
                    <label
                      key={o.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors duration-theme',
                        answers[q.id] === o.id
                          ? 'border-primary bg-primary-light'
                          : 'border-line hover:bg-surface-hover'
                      )}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={o.id}
                        checked={answers[q.id] === o.id}
                        onChange={() => setAnswers({ ...answers, [q.id]: o.id })}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                      />
                      <span className="text-ink">{o.text}</span>
                    </label>
                  ))}
                </div>
              </Card>
            ))}
            <div className="flex items-center gap-3">
              <Button type="submit" loading={submitting}>
                Submit answers
              </Button>
              <span className="text-sm text-muted">
                {Object.keys(answers).length} of {questions.length} answered ·{' '}
                {XP_POINTS.quiz_question_correct} XP per correct answer
              </span>
            </div>
          </form>
        ))}

      {mode === 'result' && result && (
        <>
          <Card className="text-center space-y-3">
            <h2 className="text-2xl font-bold text-ink">
              {result.score} / {result.max}
            </h2>
            <p className="text-muted">
              {result.score === result.max
                ? 'Perfect score!'
                : result.score >= result.max / 2
                  ? 'Good work — review the ones you missed below.'
                  : 'Keep at it — the explanations below will help.'}
              {result.xp > 0 && (
                <>
                  {' '}· <span className="text-primary font-semibold">+{result.xp} XP</span>
                </>
              )}
            </p>
            {result.newBadges.length > 0 && (
              <Alert variant="info" className="text-left">
                New {result.newBadges.length === 1 ? 'badge' : 'badges'} earned: {result.newBadges.join(', ')}
              </Alert>
            )}
            <div className="flex justify-center gap-2 pt-1">
              <Button onClick={startOver}>Retake</Button>
              <Button variant="ghost" href="/dashboard/learn">
                Back to Learn
              </Button>
            </div>
          </Card>

          <div className="space-y-3">
            {questions.map((q, i) => {
              const chosenId = result.chosen[q.id]
              const chosen = q.options.find((o) => o.id === chosenId)
              const correct = q.options.find((o) => o.is_correct)
              const right = Boolean(chosen?.is_correct)
              return (
                <Card
                  key={q.id}
                  padding="sm"
                  className={cn('border-l-4', right ? 'border-l-success' : 'border-l-error')}
                >
                  <p className="font-medium text-ink">
                    <span className="text-muted mr-2">{i + 1}.</span>
                    {q.prompt}
                  </p>
                  <p className="text-sm mt-2">
                    <span className={right ? 'text-success' : 'text-error'}>
                      Your answer: {chosen?.text ?? '—'}
                    </span>
                    {!right && correct && (
                      <span className="text-muted"> · Correct: {correct.text}</span>
                    )}
                  </p>
                  {q.explanation && <p className="text-sm text-muted mt-1">{q.explanation}</p>}
                </Card>
              )
            })}
          </div>
        </>
      )}

      {attempts.length > 0 && mode !== 'edit' && (
        <Card padding="sm">
          <h3 className="text-sm font-semibold text-ink mb-2">Your attempts</h3>
          <ul className="text-sm divide-y divide-line">
            {attempts.map((a) => (
              <li key={a.id} className="py-1.5 flex justify-between text-muted">
                <span>{fmtDate(a.started_at)}</span>
                <span className={a.score === a.max_score && a.max_score > 0 ? 'text-success font-semibold' : 'text-ink'}>
                  {a.score} / {a.max_score}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
