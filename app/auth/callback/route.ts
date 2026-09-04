import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Completes the PKCE flow. Supabase sends users here from the confirmation
 * email (and from password-reset / magic links) with a `?code=`; exchanging it
 * sets the session cookies, after which the user is signed in on every device
 * that shares the browser — not only the tab that signed up, which is what
 * the previous client-only setup required.
 *
 * Supabase Auth → URL Configuration must list `<site>/auth/callback` under
 * Redirect URLs for this to be reachable.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Only allow same-site relative paths as the post-login destination.
  const requestedNext = searchParams.get('next') ?? '/dashboard'
  const next =
    requestedNext.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/dashboard'

  // Behind Vercel's proxy `origin` is the internal host; the public one is in
  // x-forwarded-host. Locally there is no proxy.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const base =
    process.env.NODE_ENV === 'development' || !forwardedHost
      ? origin
      : `https://${forwardedHost}`

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${base}${next}`)
    }
    return NextResponse.redirect(
      `${base}/auth?error=${encodeURIComponent(error.message)}`
    )
  }

  const message =
    searchParams.get('error_description') ??
    searchParams.get('error') ??
    'The confirmation link is missing its code. Request a new one by signing up again.'

  return NextResponse.redirect(`${base}/auth?error=${encodeURIComponent(message)}`)
}
