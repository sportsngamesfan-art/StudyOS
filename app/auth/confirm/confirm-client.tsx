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
    <main className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        {/* Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
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

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Confirm Your Email
          </h1>
          <p className="text-gray-600">
            We sent a confirmation link to <span className="font-semibold">{email}</span>
          </p>
        </div>

        {/* Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">What&apos;s next:</h2>
          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                1
              </span>
              <span>Check your email inbox</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span>Click the confirmation link</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                3
              </span>
              <span>You&apos;re all set! Log in to your account</span>
            </li>
          </ol>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg mb-4 text-sm">
            {success}
          </div>
        )}

        {/* Resend Button */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3">
            Didn&apos;t receive the email? Check your spam folder or
          </p>
          <button
            onClick={handleResendEmail}
            disabled={resending}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resending ? 'Resending...' : 'Resend Confirmation Email'}
          </button>
        </div>

        {/* Timer */}
        <div className="text-center mb-6 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            Auto-redirecting to login in{' '}
            <span className="font-mono font-bold text-blue-600">
              {formatTime(timeLeft)}
            </span>
          </p>
        </div>

        {/* Footer Links */}
        <div className="flex gap-4 text-center text-sm">
          <Link
            href="/auth"
            className="flex-1 text-blue-600 hover:text-blue-700 font-semibold"
          >
            Back to Login
          </Link>
          <div className="w-px bg-gray-300"></div>
          <Link
            href="/"
            className="flex-1 text-gray-600 hover:text-gray-700"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
