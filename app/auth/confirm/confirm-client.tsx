'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ConfirmEmailClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }

    // Check if user is already verified
    const checkVerification = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        // User is logged in, redirect to dashboard
        router.push('/dashboard')
      }
    }

    checkVerification()

    // Countdown timer
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-redirect after 5 minutes
          router.push('/auth')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [router, searchParams])

  const handleResendEmail = async () => {
    if (!email) return

    setResending(true)
    setError('')
    setSuccess('')

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (resendError) throw resendError
      setSuccess('Confirmation email sent! Check your inbox.')
      setTimeLeft(300) // Reset timer
    } catch (err) {
      console.error('Resend error:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to resend email'
      )
    } finally {
      setResending(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <main className="min-h-screen bg-background transition-theme flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-xl border border-line p-8 w-full max-w-md transition-theme">
        {/* Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-light rounded-full mb-4">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-ink mb-2">
            Confirm Your Email
          </h1>
          <p className="text-muted">
            We sent a confirmation link to <span className="font-semibold text-ink">{email}</span>
          </p>
        </div>

        {/* Steps */}
        <div className="bg-primary-light border border-primary/20 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-ink mb-3">What&apos;s next:</h2>
          <ol className="space-y-2 text-sm text-ink/80">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                1
              </span>
              <span>Check your email inbox</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span>Click the confirmation link</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                3
              </span>
              <span>You&apos;re all set! Log in to your account</span>
            </li>
          </ol>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-3 bg-error/10 border border-error/30 text-error rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-success/10 border border-success/30 text-success rounded-lg mb-4 text-sm">
            {success}
          </div>
        )}

        {/* Resend Button */}
        <div className="mb-6">
          <p className="text-sm text-muted mb-3">
            Didn&apos;t receive the email? Check your spam folder or
          </p>
          <button
            onClick={handleResendEmail}
            disabled={resending}
            className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primary-hover transition-theme disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resending ? 'Resending...' : 'Resend Confirmation Email'}
          </button>
        </div>

        {/* Timer */}
        <div className="text-center mb-6 p-3 bg-background rounded-lg border border-line">
          <p className="text-sm text-muted">
            Auto-redirecting to login in{' '}
            <span className="font-mono font-bold text-primary">
              {formatTime(timeLeft)}
            </span>
          </p>
        </div>

        {/* Footer Links */}
        <div className="flex gap-4 text-center text-sm">
          <Link
            href="/auth"
            className="flex-1 text-primary hover:text-primary-hover font-semibold"
          >
            Back to Login
          </Link>
          <div className="w-px bg-line"></div>
          <Link
            href="/"
            className="flex-1 text-muted hover:text-ink"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
