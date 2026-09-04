import { createServerClient } from '@supabase/ssr'
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
