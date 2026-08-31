'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Class {
  id: string
  subject: string
  start_time: string
  end_time: string
  day: string
  room: string
  created_at: string
}

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export default function TimetablePage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    subject: '',
    day: 'Monday',
    start_time: '09:00',
    end_time: '10:00',
    room: '',
  })

  useEffect(() => {
    loadClasses()
  }, [])

  const loadClasses = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: fetchError } = await supabase
        .from('timetable')
        .select('*')
        .eq('user_id', user.id)
        .order('day', { ascending: true })

      if (fetchError) throw fetchError
      setClasses(data || [])
    } catch (err) {
      console.error('Error loading classes:', err)
      setError('Failed to load timetable')
    } finally {
      setLoading(false)
    }
  }

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: insertError } = await supabase.from('timetable').insert({
        user_id: user.id,
        subject: formData.subject,
        day: formData.day,
        start_time: formData.start_time,
        end_time: formData.end_time,
        room: formData.room,
      })

      if (insertError) throw insertError

      setSuccess('Class added successfully')
      setFormData({
        subject: '',
        day: 'Monday',
        start_time: '09:00',
        end_time: '10:00',
        room: '',
      })
      setShowForm(false)
      await loadClasses()
    } catch (err) {
      console.error('Error adding class:', err)
      setError(err instanceof Error ? err.message : 'Failed to add class')
    }
  }

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Delete this class?')) return

    try {
      const { error: deleteError } = await supabase
        .from('timetable')
        .delete()
        .eq('id', classId)

      if (deleteError) throw deleteError

      setSuccess('Class deleted successfully')
      await loadClasses()
    } catch (err) {
      console.error('Error deleting class:', err)
      setError('Failed to delete class')
    }
  }

  // Group classes by day
  const groupedClasses: Record<string, Class[]> = {}
  DAYS.forEach((day) => {
    groupedClasses[day] = classes.filter((c) => c.day === day)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Timetable</h1>
          <p className="text-gray-600 mt-1">Manage your class schedule</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {showForm ? '✕ Cancel' : '+ Add Class'}
        </button>
      </div>

      {/* Add Class Form */}
      {showForm && (
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">
            Add New Class
          </h2>
          <form onSubmit={handleAddClass} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  Day *
                </label>
                <select
                  value={formData.day}
                  onChange={(e) =>
                    setFormData({ ...formData, day: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room
                </label>
                <input
                  type="text"
                  value={formData.room}
                  onChange={(e) =>
                    setFormData({ ...formData, room: e.target.value })
                  }
                  placeholder="e.g., Room 101"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
            >
              Add Class
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

      {/* Weekly View */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DAYS.map((day) => (
            <div
              key={day}
              className="bg-white rounded-lg p-4 shadow"
            >
              <h3 className="font-semibold text-gray-900 mb-3">{day}</h3>
              {groupedClasses[day].length === 0 ? (
                <p className="text-gray-500 text-sm">No classes</p>
              ) : (
                <div className="space-y-2">
                  {groupedClasses[day].map((cls) => (
                    <div
                      key={cls.id}
                      className="bg-blue-50 border border-blue-200 rounded p-2 text-sm"
                    >
                      <div className="font-medium text-gray-900">
                        {cls.subject}
                      </div>
                      <div className="text-gray-600 text-xs">
                        {cls.start_time} - {cls.end_time}
                      </div>
                      {cls.room && (
                        <div className="text-gray-600 text-xs">{cls.room}</div>
                      )}
                      <button
                        onClick={() => handleDeleteClass(cls.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-semibold mt-1"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
