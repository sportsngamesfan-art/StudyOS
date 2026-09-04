'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import { DIFFICULTIES, type Difficulty } from '@/lib/constants'
import type { AssignmentRow } from '@/lib/types'
import { cn } from '@/lib/cn'
import { awardXp } from '@/lib/gamification/award'
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

const EMPTY_FORM = {
  title: '',
  subject: '',
  deadline: '',
  difficulty: 'medium' as Difficulty,
  hours_required: '2',
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Postgres `date` arrives as "YYYY-MM-DD". Parsing that with `new Date()`
 * treats it as UTC midnight, which displays as the previous day anywhere
 * west of Greenwich, so it is always parsed as a local calendar date.
 */
function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole calendar days until the deadline; "due today" is 0. */
function daysUntil(deadline: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((parseLocalDate(deadline).getTime() - today.getTime()) / MS_PER_DAY)
}

/** Border colour and label share one source so they can never disagree. */
function urgency(deadline: string): { border: string; text: string; label: string } {
  const days = daysUntil(deadline)
  if (days < 0) return { border: 'border-error', text: 'text-error', label: `${-days}d overdue` }
  if (days === 0) return { border: 'border-error', text: 'text-error', label: 'Due today' }
  if (days === 1) return { border: 'border-warning', text: 'text-warning', label: 'Due tomorrow' }
  if (days < 7) return { border: 'border-warning', text: 'text-warning', label: `${days} days left` }
  return { border: 'border-success', text: 'text-success', label: `${days} days left` }
}

const formatDate = (date: string) =>
  parseLocalDate(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function AssignmentsPage() {
  const user = useUser()
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  const loadAssignments = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('assignments')
        .select('*')
        .eq('user_id', user.id)
        .order('deadline', { ascending: true })
      if (fetchError) throw fetchError
      setAssignments((data as AssignmentRow[]) ?? [])
    } catch (err) {
      console.error('Error loading assignments:', err)
      setError('Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    loadAssignments()
  }, [loadAssignments])

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const hours = parseFloat(form.hours_required)
    if (!Number.isFinite(hours) || hours <= 0) {
      setError('Hours required must be a positive number')
      return
    }

    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('assignments').insert({
        user_id: user.id,
        title: form.title.trim(),
        subject: form.subject.trim(),
        deadline: form.deadline,
        difficulty: form.difficulty,
        hours_required: hours,
        completed: false,
      })
      if (insertError) throw insertError

      setSuccess('Assignment added')
      setForm(EMPTY_FORM)
      setShowForm(false)
      await loadAssignments()
    } catch (err) {
      console.error('Error adding assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to add assignment')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleCompletion = async (assignment: AssignmentRow) => {
    setError('')
    setSuccess('')
    try {
      const { error: updateError } = await supabase
        .from('assignments')
        .update({ completed: !assignment.completed })
        .eq('id', assignment.id)
      if (updateError) throw updateError
      setSuccess(assignment.completed ? 'Marked as pending' : 'Marked as completed')
      // Paid once per assignment, however many times it is toggled.
      if (!assignment.completed) void awardXp('assignment_completed', assignment.id)
      await loadAssignments()
    } catch (err) {
      console.error('Error updating assignment:', err)
      setError('Failed to update assignment')
    }
  }

  const handleDeleteAssignment = async (assignment: AssignmentRow) => {
    if (!confirm(`Delete "${assignment.title}"?`)) return
    setError('')
    setSuccess('')
    try {
      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignment.id)
      if (deleteError) throw deleteError
      setSuccess('Assignment deleted')
      await loadAssignments()
    } catch (err) {
      console.error('Error deleting assignment:', err)
      setError('Failed to delete assignment')
    }
  }

  const pending = assignments.filter((a) => !a.completed)
  const completed = assignments.filter((a) => a.completed)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        subtitle="Track your work and deadlines"
        actions={
          <Button
            variant={showForm ? 'ghost' : 'primary'}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Cancel' : '+ Add Assignment'}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-ink">Add New Assignment</h2>
          <form onSubmit={handleAddAssignment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Title" htmlFor="title" required>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Math Problem Set"
                  required
                />
              </Field>

              <Field label="Subject" htmlFor="subject" required>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g., Mathematics"
                  required
                />
              </Field>

              <Field label="Deadline" htmlFor="deadline" required>
                <Input
                  id="deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  required
                />
              </Field>

              <Field label="Difficulty" htmlFor="difficulty" required>
                <Select
                  id="difficulty"
                  value={form.difficulty}
                  onChange={(e) =>
                    setForm({ ...form, difficulty: e.target.value as Difficulty })
                  }
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {capitalize(d)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Hours required"
                htmlFor="hours_required"
                required
                className="md:col-span-2"
                hint="Your best estimate — the planner uses it to size study sessions."
              >
                <Input
                  id="hours_required"
                  type="number"
                  min="0.5"
                  step="0.5"
                  inputMode="decimal"
                  value={form.hours_required}
                  onChange={(e) => setForm({ ...form, hours_required: e.target.value })}
                  required
                />
              </Field>
            </div>

            <Button type="submit" variant="secondary" loading={saving}>
              Add Assignment
            </Button>
          </form>
        </Card>
      )}

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
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<CheckSquareIcon />}
          title="No assignments yet"
          description="Add coursework with a deadline and the planner will prioritise what's due soonest."
          action={<Button onClick={() => setShowForm(true)}>Add your first assignment</Button>}
        />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">Pending ({pending.length})</h2>
              {pending.map((assignment) => {
                const u = urgency(assignment.deadline)
                return (
                  <Card
                    key={assignment.id}
                    padding="sm"
                    className={cn('border-l-4 hover:shadow-md', u.border)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-ink truncate">{assignment.title}</h3>
                        <p className="text-sm text-muted">{assignment.subject}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                          <span className={cn('font-semibold', u.text)}>{u.label}</span>
                          <span className="text-muted">{formatDate(assignment.deadline)}</span>
                          <span className="bg-line text-ink px-2 py-0.5 rounded">
                            {capitalize(assignment.difficulty)}
                          </span>
                          <span className="text-muted">{assignment.hours_required}h</span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleToggleCompletion(assignment)}
                        >
                          ✓ Done
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteAssignment(assignment)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </section>
          )}

          {completed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">Completed ({completed.length})</h2>
              {completed.map((assignment) => (
                <Card
                  key={assignment.id}
                  padding="sm"
                  className="border-l-4 border-l-line bg-background"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-muted line-through truncate">
                        {assignment.title}
                      </h3>
                      <p className="text-sm text-muted">{assignment.subject}</p>
                      <p className="text-xs text-muted mt-2">{formatDate(assignment.deadline)}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => handleToggleCompletion(assignment)}
                      >
                        Undo
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteAssignment(assignment)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function CheckSquareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
  )
}
