'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
      >
        <div className="p-4 border-b border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
              S
            </div>
            {sidebarOpen && <span className="font-bold">StudyOS</span>}
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavLink
            href="/dashboard"
            icon="📊"
            label="Dashboard"
            sidebarOpen={sidebarOpen}
          />
          <NavLink
            href="/dashboard/documents"
            icon="📄"
            label="Documents"
            sidebarOpen={sidebarOpen}
          />
          <NavLink
            href="/dashboard/timetable"
            icon="📅"
            label="Timetable"
            sidebarOpen={sidebarOpen}
          />
          <NavLink
            href="/dashboard/assignments"
            icon="✅"
            label="Assignments"
            sidebarOpen={sidebarOpen}
          />
          <NavLink
            href="/dashboard/plan"
            icon="🎯"
            label="Study Plan"
            sidebarOpen={sidebarOpen}
          />

          {/* Divider */}
          <div className="my-4 border-t border-gray-700"></div>

          <NavLink
            href="/dashboard/settings"
            icon="⚙️"
            label="Settings"
            sidebarOpen={sidebarOpen}
          />
          <NavLink
            href="/dashboard/profile"
            icon="👤"
            label="Profile"
            sidebarOpen={sidebarOpen}
          />
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full p-2 hover:bg-gray-800 rounded text-left text-sm"
            title={sidebarOpen ? 'Collapse' : 'Expand'}
          >
            {sidebarOpen ? '←' : '→'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full p-2 hover:bg-red-600 rounded text-left text-sm transition"
          >
            {sidebarOpen ? '🚪 Logout' : '🚪'}
          </button>
        </div>

        {sidebarOpen && user && (
          <div className="p-4 border-t border-gray-800 text-xs text-gray-400">
            <p className="truncate">{user.email}</p>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
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
}: {
  href: string
  icon: string
  label: string
  sidebarOpen: boolean
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded transition text-gray-300 hover:text-white"
      title={!sidebarOpen ? label : ''}
    >
      <span className="text-xl">{icon}</span>
      {sidebarOpen && <span>{label}</span>}
    </Link>
  )
}
