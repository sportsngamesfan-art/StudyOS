'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    documents: 0,
    assignments: 0,
    classes: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [documentsRes, assignmentsRes, timetableRes] = await Promise.all([
          supabase.from('documents').select('*', { count: 'exact', head: true }),
          supabase.from('assignments').select('*', { count: 'exact', head: true }),
          supabase.from('timetable').select('*', { count: 'exact', head: true }),
        ])

        setStats({
          documents: documentsRes.count || 0,
          assignments: assignmentsRes.count || 0,
          classes: timetableRes.count || 0,
        })
      } catch (error) {
        console.error('Error loading stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-ink">Welcome to StudyOS</h1>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Documents"
            value={stats.documents}
            icon="📄"
            href="/dashboard/documents"
          />
          <StatCard
            title="Classes"
            value={stats.classes}
            icon="📅"
            href="/dashboard/timetable"
          />
          <StatCard
            title="Assignments"
            value={stats.assignments}
            icon="✅"
            href="/dashboard/assignments"
          />
        </div>
      )}

      <div className="bg-surface rounded-xl p-6 shadow-sm border border-line transition-theme">
        <h2 className="text-xl font-semibold mb-4 text-ink">Getting Started</h2>
        <ul className="space-y-2 text-muted">
          <li>✓ Upload study materials to Documents</li>
          <li>✓ Set up your timetable with class schedules</li>
          <li>✓ Create assignments and deadlines</li>
          <li>✓ Generate an AI-powered study plan</li>
        </ul>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  href,
}: {
  title: string
  value: number
  icon: string
  href: string
}) {
  return (
    <a
      href={href}
      className="bg-surface rounded-xl p-6 shadow-sm border border-line hover:shadow-md hover:-translate-y-0.5 transition-theme cursor-pointer block"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted text-sm">{title}</p>
          <p className="text-3xl font-bold text-ink">{value}</p>
        </div>
        <div className="w-12 h-12 rounded-lg bg-primary-light flex items-center justify-center text-2xl">
          {icon}
        </div>
      </div>
    </a>
  )
}
