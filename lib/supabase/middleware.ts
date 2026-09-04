import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

/**
 * Refreshes the auth session on every request and forwards any rotated
 * cookies to both the downstream request and the outgoing response. This is
 * the canonical @supabase/ssr pattern; without it, server components would
 * see expired tokens.
 *
 * Returns the user (or null) so `middleware.ts` can make routing decisions.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // getUser() validates the JWT against Supabase; getSession() would only
  // read the cookie and can be spoofed, so it is never used for auth decisions.
  //
  // A signed-out request returns an error *object* (AuthSessionMissingError)
  // and never throws. What throws is a failed fetch to the Supabase host —
  // wrong URL, DNS, project paused mid-request — and gotrue re-throws those.
  // Left uncaught, that turned every request on the site into a 500
  // (MIDDLEWARE_INVOCATION_FAILED). Treat it as "signed out" instead and log
  // it, so protected routes redirect to /auth and the cause is in the logs.
  let user: User | null = null
  try {
    const { data, error } = await supabase.auth.getUser()
    user = data.user
    if (error && error.name !== 'AuthSessionMissingError') {
      console.error('[middleware] getUser:', error.name, error.message)
    }
  } catch (err) {
    console.error('[middleware] getUser threw:', err instanceof Error ? err.message : err)
  }

  return { response, user }
}
