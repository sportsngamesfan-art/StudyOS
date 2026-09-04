'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import Link from 'next/link'

type Notice = { kind: 'error' | 'success' | 'info'; text: string }

export default function AuthPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [nextPath, setNextPath] = useState('/dashboard')
  // Set after signup when confirmation is required; replaces the form.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null)

  // Query params are read from window rather than useSearchParams so this
  // page keeps prerendering without a Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    const next = params.get('next')
    if (next && next.startsWith('/') && !next.startsWith('//')) setNextPath(next)
    if (error) setNotice({ kind: 'error', text: error })
    else if (params.get('deleted')) {
      setNotice({ kind: 'info', text: 'Your account has been deleted.' })
    }
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)

    if (!isSupabaseConfigured) {
      setNotice({
        kind: 'error',
        text:
          'Supabase is not configured for this deployment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.',
      })
      return
    }

    setLoading(true)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // Cookies are set; refresh so middleware and server components see them.
        router.push(nextPath)
        router.refresh()
        return
      }

      const callback = new URL('/auth/callback', window.location.origin)
      if (nextPath !== '/dashboard') callback.searchParams.set('next', nextPath)

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callback.toString() },
      })
      if (error) throw error

      if (data.session) {
        // Email confirmation is disabled on this project: signed in already.
        router.push(nextPath)
        router.refresh()
        return
      }

      setAwaitingConfirmation(email)
    } catch (err) {
      console.error('Auth error:', err)
      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong',
      })
    } finally {
      setLoading(false)
    }
  }

  const noticeClass =
    notice?.kind === 'error'
      ? 'bg-error/10 border-error/30 text-error'
      : notice?.kind === 'success'
        ? 'bg-success/10 border-success/30 text-success'
        : 'bg-primary-light border-primary/30 text-ink'

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-brand-gradient">
      <div className="bg-surface rounded-xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-ink">StudyOS</h1>

        {awaitingConfirmation ? (
          <div className="space-y-5 text-center">
            <p className="text-muted">Check your inbox</p>
            <div className="p-4 bg-primary-light border border-primary/30 rounded-lg text-sm text-ink text-left space-y-2">
              <p>
                We sent a confirmation link to{' '}
                <strong className="break-all">{awaitingConfirmation}</strong>.
              </p>
              <p>
                Open it to activate your account. It signs you in automatically
                and brings you to your dashboard.
              </p>
              <p className="text-muted">
                Nothing there? Check spam, or wait a minute — it can take a moment
                to arrive.
              </p>
            </div>
            <button
              onClick={() => {
                setAwaitingConfirmation(null)
                setIsLogin(true)
                setNotice(null)
              }}
              className="text-primary font-semibold hover:underline text-sm"
            >
              Back to login
            </button>
          </div>
        ) : (
          <>
            <p className="text-center text-muted mb-8">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </p>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-line text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-line text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                />
              </div>

              {notice && (
                <div className={`p-3 border rounded-lg text-sm ${noticeClass}`}>
                  {notice.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Please wait…' : isLogin ? 'Login' : 'Sign Up'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-muted">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin)
                    setNotice(null)
                  }}
                  className="text-primary font-semibold ml-1 hover:underline"
                >
                  {isLogin ? 'Sign up' : 'Login'}
                </button>
              </p>
            </div>
          </>
        )}

        <div className="mt-6 text-center">
          <Link href="/" className="text-muted hover:text-ink text-sm">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
