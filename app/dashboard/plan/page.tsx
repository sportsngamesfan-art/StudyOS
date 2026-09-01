'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface StudyPlan {
  date: string
  subject: string
  duration: number
  task: string
  priority: 'high' | 'medium' | 'low'
}

interface TimetableClass {
  day: string
  subject: string
  start_time: string
  end_time: string
}

interface Assignment {
  title: string
  subject: string
  deadline: string
  difficulty: string
  hours_required: number
}

export default function StudyPlanPage() {
  const [plan, setPlan] = useState<StudyPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadPlan()
  }, [])

  const loadPlan = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // In a real implementation, this would fetch saved plans
      // For now, we'll just load an empty plan that can be generated
    } catch (err) {
      console.error('Error loading plan:', err)
      setError('Failed to load study plan')
    } finally {
      setLoading(false)
    }
  }

  const generateStudyPlan = async () => {
    setGenerating(true)
    setError('')
    setSuccess('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Fetch timetable and assignments
      const [timetableRes, assignmentsRes] = await Promise.all([
        supabase
          .from('timetable')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('assignments')
          .select('*')
          .eq('user_id', user.id)
          .eq('completed', false),
      ])

      if (timetableRes.error) throw timetableRes.error
      if (assignmentsRes.error) throw assignmentsRes.error

      const timetable: TimetableClass[] = timetableRes.data || []
      const assignments: Assignment[] = assignmentsRes.data || []

      // Create prompt for Groq API
      const prompt = buildStudyPlanPrompt(timetable, assignments)

      // Call API to generate plan
      const response = await fetch('/api/generate-study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, timetable, assignments }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate study plan')
      }

      const data = await response.json()
      setPlan(data.plan || [])
      setSuccess('Study plan generated successfully!')
    } catch (err) {
      console.error('Error generating plan:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate study plan')
    } finally {
      setGenerating(false)
    }
  }

  const buildStudyPlanPrompt = (
    timetable: TimetableClass[],
    assignments: Assignment[]
  ) => {
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    let prompt = `Create a detailed study plan for the next week (${today.toLocaleDateString()} to ${nextWeek.toLocaleDateString()}).

Classes scheduled:
${timetable.map((c) => `- ${c.day}: ${c.subject} (${c.start_time}-${c.end_time})`).join('\n') || '- No classes scheduled'}

Pending assignments:
${assignments
  .map(
    (a) =>
      `- ${a.title} (${a.subject}): Due ${new Date(a.deadline).toLocaleDateString()}, ${a.difficulty} difficulty, ${a.hours_required} hours required`
  )
  .join('\n') || '- No assignments'}

Please provide a structured study plan that:
1. Avoids scheduled classes
2. Prioritizes urgent assignments (closest deadlines first)
3. Allocates appropriate time based on difficulty and required hours
4. Includes study breaks
5. Balances study across different subjects
6. Is realistic and achievable

Format the response as a JSON array with this structure:
[
  {
    "date": "YYYY-MM-DD",
    "subject": "Subject name",
    "duration": hours as number,
    "task": "specific task or topic",
    "priority": "high|medium|low"
  }
]

Return ONLY the JSON array, no other text.`

    return prompt
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const getPriorityColor = (priority: string) => {
    return priority === 'high'
      ? 'bg-error/10 border-error/40'
      : priority === 'medium'
        ? 'bg-warning/10 border-warning/40'
        : 'bg-success/10 border-success/40'
  }

  // Group plan by date
  const groupedPlan: Record<string, StudyPlan[]> = {}
  plan.forEach((item) => {
    if (!groupedPlan[item.date]) {
      groupedPlan[item.date] = []
    }
    groupedPlan[item.date].push(item)
  })

  const sortedDates = Object.keys(groupedPlan).sort()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Study Plan</h1>
          <p className="text-muted mt-1">
            AI-generated smart study schedule
          </p>
        </div>
        <button
          onClick={generateStudyPlan}
          disabled={generating}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {generating ? (
            <>
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Generating...
            </>
          ) : (
            <>🤖 Generate Plan</>
          )}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-error/10 border border-error/30 text-error rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-success/10 border border-success/30 text-success rounded">
          {success}
        </div>
      )}

      {/* Study Plan */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="bg-surface rounded-lg p-12 shadow text-center">
          <div className="text-4xl mb-4">🎯</div>
          <h2 className="text-xl font-semibold text-ink mb-2">
            No study plan yet
          </h2>
          <p className="text-muted mb-6">
            Generate a personalized study plan based on your assignments and
            timetable
          </p>
          <button
            onClick={generateStudyPlan}
            disabled={generating}
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating...' : 'Generate Study Plan'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date} className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">
                {formatDate(date)}
              </h2>
              {groupedPlan[date].map((item, idx) => (
                <div
                  key={idx}
                  className={`border-l-4 rounded-lg p-4 bg-surface shadow hover:shadow-md transition ${getPriorityColor(
                    item.priority
                  )}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-ink">
                        {item.subject}
                      </h3>
                      <p className="text-sm text-muted mt-1">{item.task}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs bg-line text-ink px-2 py-1 rounded">
                          {item.duration}h
                        </span>
                        <span className="text-xs font-semibold text-ink capitalize">
                          {item.priority} Priority
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 text-3xl">{getPriorityIcon(item.priority)}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="bg-primary-light border border-primary/20 rounded-lg p-4 mt-6">
            <p className="text-sm text-ink">
              💡 <strong>Tip:</strong> Adjust study sessions as needed. The plan
              adapts to your priorities and schedule.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function getPriorityIcon(priority: string) {
  return priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢'
}
