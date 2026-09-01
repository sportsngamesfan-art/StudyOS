'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/auth')
        return
      }

      setUser(session.user)
      setLoading(false)
    }

    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push('/auth')
      } else {
        setUser(session.user)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background transition-theme">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background transition-theme">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-neutral-900 text-white transition-all duration-theme flex flex-col`}
        style={{ backgroundColor: '#0f172a' }}
      >
        <div className="p-4 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center font-bold flex-shrink-0">
              S
            </div>
            {sidebarOpen && <span className="font-bold">StudyOS</span>}
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLink
            href="/dashboard"
            icon="📊"
            label="Dashboard"
            sidebarOpen={sidebarOpen}
            active={pathname === '/dashboard'}
          />
          <NavLink
            href="/dashboard/documents"
            icon="📄"
            label="Documents"
            sidebarOpen={sidebarOpen}
            active={pathname === '/dashboard/documents'}
          />
          <NavLink
            href="/dashboard/timetable"
            icon="📅"
            label="Timetable"
            sidebarOpen={sidebarOpen}
            active={pathname === '/dashboard/timetable'}
          />
          <NavLink
            href="/dashboard/assignments"
            icon="✅"
            label="Assignments"
            sidebarOpen={sidebarOpen}
            active={pathname === '/dashboard/assignments'}
          />
          <NavLink
            href="/dashboard/plan"
            icon="🎯"
            label="Study Plan"
            sidebarOpen={sidebarOpen}
            active={pathname === '/dashboard/plan'}
          />

          {/* Divider */}
          <div className="my-4 border-t border-white/10"></div>

          <NavLink
            href="/dashboard/settings"
            icon="⚙️"
            label="Settings"
            sidebarOpen={sidebarOpen}
            active={pathname === '/dashboard/settings'}
          />
          <NavLink
            href="/dashboard/profile"
            icon="👤"
            label="Profile"
            sidebarOpen={sidebarOpen}
            active={pathname === '/dashboard/profile'}
          />
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full p-2 hover:bg-white/10 rounded-lg text-left text-sm transition-theme"
            title={sidebarOpen ? 'Collapse' : 'Expand'}
          >
            {sidebarOpen ? '← Collapse' : '→'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full p-2 hover:bg-error/90 rounded-lg text-left text-sm transition-theme"
          >
            {sidebarOpen ? '🚪 Logout' : '🚪'}
          </button>
        </div>

        {sidebarOpen && user && (
          <div className="p-4 border-t border-white/10 text-xs text-white/50">
            <p className="truncate">{user.email}</p>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <header className="bg-surface border-b border-line px-6 py-4 flex items-center justify-between transition-theme">
          <h2 className="text-2xl font-bold text-ink">Dashboard</h2>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-theme"
            >
              <span className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center font-semibold">
                {user?.email?.[0]?.toUpperCase() || '?'}
              </span>
              {user?.email}
            </Link>
          </div>
        </header>
        <div className="flex-1 p-6 overflow-auto">{children}</div>
      </main>
    </div>
  )
}

function NavLink({
  href,
  icon,
  label,
  sidebarOpen,
  active,
}: {
  href: string
  icon: string
  label: string
  sidebarOpen: boolean
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 p-3 rounded-lg transition-theme ${
        active
          ? 'bg-primary text-white'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
      title={!sidebarOpen ? label : ''}
    >
      <span className="text-xl">{icon}</span>
      {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
    </Link>
  )
}
