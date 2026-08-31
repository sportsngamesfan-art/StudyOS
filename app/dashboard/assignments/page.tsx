'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Assignment {
  id: string
  title: string
  subject: string
  deadline: string
  difficulty: 'easy' | 'medium' | 'hard'
  hours_required: number
  completed: boolean
  created_at: string
}

const DIFFICULTIES = ['easy', 'medium', 'hard']

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    deadline: '',
    difficulty: 'medium',
    hours_required: 2,
  })

  useEffect(() => {
    loadAssignments()
  }, [])

  const loadAssignments = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: fetchError } = await supabase
        .from('assignments')
        .select('*')
        .eq('user_id', user.id)
        .order('deadline', { ascending: true })

      if (fetchError) throw fetchError
      setAssignments(data || [])
    } catch (err) {
      console.error('Error loading assignments:', err)
      setError('Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: insertError } = await supabase
        .from('assignments')
        .insert({
          user_id: user.id,
          title: formData.title,
          subject: formData.subject,
          deadline: formData.deadline,
          difficulty: formData.difficulty,
          hours_required: formData.hours_required,
          completed: false,
        })

      if (insertError) throw insertError

      setSuccess('Assignment added successfully')
      setFormData({
        title: '',
        subject: '',
        deadline: '',
        difficulty: 'medium',
        hours_required: 2,
      })
      setShowForm(false)
      await loadAssignments()
    } catch (err) {
      console.error('Error adding assignment:', err)
      setError(err instanceof Error ? err.message : 'Failed to add assignment')
    }
  }

  const handleToggleCompletion = async (assignment: Assignment) => {
    try {
      const { error: updateError } = await supabase
        .from('assignments')
        .update({ completed: !assignment.completed })
        .eq('id', assignment.id)

      if (updateError) throw updateError

      setSuccess(
        assignment.completed
          ? 'Assignment marked as pending'
          : 'Assignment marked as completed'
      )
      await loadAssignments()
    } catch (err) {
      console.error('Error updating assignment:', err)
      setError('Failed to update assignment')
    }
  }

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Delete this assignment?')) return

    try {
      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId)

      if (deleteError) throw deleteError

      setSuccess('Assignment deleted successfully')
      await loadAssignments()
    } catch (err) {
      console.error('Error deleting assignment:', err)
      setError('Failed to delete assignment')
    }
  }

  // Sort assignments
  const pending = assignments.filter((a) => !a.completed)
  const completed = assignments.filter((a) => a.completed)

  // Calculate urgency based on deadline and difficulty
  const getUrgencyColor = (deadline: string, difficulty: string) => {
    const daysUntil =
      (new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    if (daysUntil < 1) return 'border-red-500 bg-red-50'
    if (daysUntil < 3) return 'border-orange-500 bg-orange-50'
    if (daysUntil < 7) return 'border-yellow-500 bg-yellow-50'
    return 'border-green-500 bg-green-50'
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getDifficultyEmoji = (difficulty: string) => {
    return difficulty === 'easy' ? '🟢' : difficulty === 'medium' ? '🟡' : '🔴'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assignments</h1>
          <p className="text-gray-600 mt-1">Track your work and deadlines</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {showForm ? '✕ Cancel' : '+ Add Assignment'}
        </button>
      </div>

      {/* Add Assignment Form */}
      {showForm && (
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">
            Add New Assignment
          </h2>
          <form onSubmit={handleAddAssignment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g., Math Problem Set"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  placeholder="e.g., Mathematics"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline *
                </label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty *
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) =>
                    setFormData({ ...formData, difficulty: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hours Required *
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={formData.hours_required}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hours_required: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
            >
              Add Assignment
            </button>
          </form>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      {/* Assignments List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending Assignments */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Pending ({pending.length})
              </h2>
              {pending.map((assignment) => (
                <div
                  key={assignment.id}
                  className={`border-l-4 rounded-lg p-4 bg-white shadow hover:shadow-md transition ${getUrgencyColor(
                    assignment.deadline,
                    assignment.difficulty
                  )}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {assignment.title}
                      </h3>
                      <p className="text-sm text-gray-600">{assignment.subject}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                          {formatDate(assignment.deadline)}
                        </span>
                        <span className="text-xs">{getDifficultyEmoji(assignment.difficulty)}</span>
                        <span className="text-xs text-gray-600">
                          {assignment.hours_required}h
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleToggleCompletion(assignment)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition"
                      >
                        ✓ Done
                      </button>
                      <button
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed Assignments */}
          {completed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Completed ({completed.length})
              </h2>
              {completed.map((assignment) => (
                <div
                  key={assignment.id}
                  className="border-l-4 border-gray-300 bg-gray-50 rounded-lg p-4 shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-500 line-through">
                        {assignment.title}
                      </h3>
                      <p className="text-sm text-gray-500">{assignment.subject}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                          {formatDate(assignment.deadline)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleToggleCompletion(assignment)}
                        className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                      >
                        Undo
                      </button>
                      <button
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pending.length === 0 && completed.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-600">No assignments yet. Create one to get started!</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
