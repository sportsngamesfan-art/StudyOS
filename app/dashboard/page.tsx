'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import { cn } from '@/lib/cn'
import { Button, Card, PageSpinner } from '@/components/ui'

interface Stats {
  documents: number
  assignments: number
  classes: number
  plans: number
}

interface Step {
  done: boolean
  label: string
  href: string
  cta: string
  disabled?: boolean
  hint?: string
}

export default function DashboardPage() {
  const user = useUser()
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({ documents: 0, assignments: 0, classes: 0, plans: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const count = (table: string) =>
          supabase.from(table).select('*', { count: 'exact', head: true }).eq('user_id', user.id)
        const [documents, assignments, timetable, plans] = await Promise.all([
          count('documents'),
          count('assignments'),
          count('timetable'),
          count('study_plans'),
        ])
        setStats({
          documents: documents.count ?? 0,
          assignments: assignments.count ?? 0,
          classes: timetable.count ?? 0,
          plans: plans.count ?? 0,
        })
      } catch (error) {
        console.error('Error loading stats:', error)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [user.id])

  const hasPlanInputs = stats.classes > 0 || stats.assignments > 0

  // Driven by real counts. Ticks only appear for steps actually completed,
  // and the first incomplete step becomes the primary call to action.
  const steps: Step[] = [
    {
      done: stats.classes > 0,
      label: 'Add your classes to the timetable',
      href: '/dashboard/timetable',
      cta: 'Add a class',
    },
    {
      done: stats.assignments > 0,
      label: 'Add an assignment with a deadline',
      href: '/dashboard/assignments',
      cta: 'Add an assignment',
    },
    {
      done: stats.documents > 0,
      label: 'Upload notes or past papers',
      href: '/dashboard/documents',
      cta: 'Upload a document',
    },
    {
      done: stats.plans > 0,
      label: 'Generate a study plan',
      href: '/dashboard/plan',
      cta: 'Generate plan',
      disabled: !hasPlanInputs,
      hint: 'Needs at least one class or assignment first',
    },
  ]
  const next = steps.find((s) => !s.done && !s.disabled)
  const doneCount = steps.filter((s) => s.done).length
  const name = user.email?.split('@')[0] ?? 'there'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Welcome back, {name}</h1>
        <p className="text-muted mt-1">Here&apos;s where things stand.</p>
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <StatCard title="Classes" value={stats.classes} href="/dashboard/timetable" icon={<CalendarIcon />} />
            <StatCard title="Assignments" value={stats.assignments} href="/dashboard/assignments" icon={<CheckSquareIcon />} />
            <StatCard title="Documents" value={stats.documents} href="/dashboard/documents" icon={<FileIcon />} />
          </div>

          <Card>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">Getting started</h2>
                <p className="text-sm text-muted mt-1">
                  {doneCount} of {steps.length} done
                </p>
              </div>
              {next && <Button onClick={() => router.push(next.href)}>{next.cta}</Button>}
            </div>
            <ol className="space-y-2">
              {steps.map((step) => (
                <li key={step.href} className="flex items-start gap-3 text-sm">
                  <span
                    className={cn(
                      'mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs border',
                      step.done
                        ? 'bg-success border-success text-white'
                        : 'border-line text-transparent'
                    )}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <div className="min-w-0">
                    {step.disabled ? (
                      <span className="text-muted">{step.label}</span>
                    ) : (
                      <Link
                        href={step.href}
                        className={cn(
                          'hover:underline',
                          step.done ? 'text-muted line-through' : 'text-ink'
                        )}
                      >
                        {step.label}
                      </Link>
                    )}
                    {step.disabled && step.hint && (
                      <p className="text-xs text-muted">{step.hint}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  href,
  icon,
}: {
  title: string
  value: number
  href: string
  icon: ReactNode
}) {
  return (
    <Link href={href} className="block">
      <Card className="hover:shadow-md hover:-translate-y-0.5 h-full">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted text-sm">{title}</p>
            <p className="text-3xl font-bold text-ink">{value}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center">
            {icon}
          </div>
        </div>
      </Card>
    </Link>
  )
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  )
}

function CheckSquareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
  )
}

function FileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
  )
}
