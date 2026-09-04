'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import { DAYS, dayIndex, type Day } from '@/lib/constants'
import type { TimetableRow } from '@/lib/types'
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
  subject: '',
  day: 'Monday' as Day,
  start_time: '09:00',
  end_time: '10:00',
  room: '',
}

/** Postgres `time` arrives as "09:00:00"; show "09:00". */
const formatTime = (time: string) => time.slice(0, 5)

export default function TimetablePage() {
  const user = useUser()
  const [classes, setClasses] = useState<TimetableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  const loadClasses = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('timetable')
        .select('*')
        .eq('user_id', user.id)
      if (fetchError) throw fetchError
      setClasses((data as TimetableRow[]) ?? [])
    } catch (err) {
      console.error('Error loading classes:', err)
      setError('Failed to load timetable')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  // Weekday order, then start time. The DB `day` column is text, so ordering
  // there would be alphabetical.
  const byDay = useMemo(() => {
    const sorted = [...classes].sort(
      (a, b) =>
        dayIndex(a.day) - dayIndex(b.day) || a.start_time.localeCompare(b.start_time)
    )
    const groups = {} as Record<Day, TimetableRow[]>
    for (const d of DAYS) groups[d] = []
    for (const cls of sorted) groups[cls.day]?.push(cls)
    return groups
  }, [classes])

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.end_time <= form.start_time) {
      setError('End time must be after start time')
      return
    }

    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('timetable').insert({
        user_id: user.id,
        subject: form.subject.trim(),
        day: form.day,
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room.trim() || null,
      })
      if (insertError) throw insertError

      setSuccess('Class added')
      setForm(EMPTY_FORM)
      setShowForm(false)
      await loadClasses()
    } catch (err) {
      console.error('Error adding class:', err)
      setError(err instanceof Error ? err.message : 'Failed to add class')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClass = async (cls: TimetableRow) => {
    if (!confirm(`Delete ${cls.subject} on ${cls.day}?`)) return
    setError('')
    setSuccess('')
    try {
      const { error: deleteError } = await supabase
        .from('timetable')
        .delete()
        .eq('id', cls.id)
      if (deleteError) throw deleteError
      setSuccess('Class deleted')
      await loadClasses()
    } catch (err) {
      console.error('Error deleting class:', err)
      setError('Failed to delete class')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable"
        subtitle="Manage your class schedule"
        actions={
          <Button
            variant={showForm ? 'ghost' : 'primary'}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Cancel' : '+ Add Class'}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-ink">Add New Class</h2>
          <form onSubmit={handleAddClass} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Subject" htmlFor="subject" required>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g., Mathematics"
                  required
                />
              </Field>

              <Field label="Day" htmlFor="day" required>
                <Select
                  id="day"
                  value={form.day}
                  onChange={(e) => setForm({ ...form, day: e.target.value as Day })}
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Start time" htmlFor="start_time" required>
                <Input
                  id="start_time"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  required
                />
              </Field>

              <Field label="End time" htmlFor="end_time" required>
                <Input
                  id="end_time"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  required
                />
              </Field>

              <Field label="Room" htmlFor="room" className="md:col-span-2">
                <Input
                  id="room"
                  value={form.room}
                  onChange={(e) => setForm({ ...form, room: e.target.value })}
                  placeholder="e.g., Room 101"
                />
              </Field>
            </div>

            <Button type="submit" variant="secondary" loading={saving}>
              Add Class
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
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon />}
          title="No classes yet"
          description="Add your weekly classes and the study planner will schedule around them."
          action={<Button onClick={() => setShowForm(true)}>Add your first class</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DAYS.map((day) => (
            <Card key={day} padding="sm">
              <h3 className="font-semibold text-ink mb-3">{day}</h3>
              {byDay[day].length === 0 ? (
                <p className="text-muted text-sm">No classes</p>
              ) : (
                <div className="space-y-2">
                  {byDay[day].map((cls) => (
                    <div
                      key={cls.id}
                      className="bg-primary-light border border-primary/20 rounded-lg p-2.5 text-sm"
                    >
                      <div className="font-medium text-ink">{cls.subject}</div>
                      <div className="text-muted text-xs">
                        {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                        {cls.room && ` · ${cls.room}`}
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        className="mt-1 -ml-3"
                        onClick={() => handleDeleteClass(cls)}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  )
}
