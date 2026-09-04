import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

/**
 * Server client for Server Components, Route Handlers and Server Actions.
 * Reads the session from the request cookies, so `auth.getUser()` here is the
 * authoritative "who is calling" check for any API route.
 *
 * Next 14: `cookies()` is synchronous. (It becomes async in Next 15.)
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Thrown when called from a Server Component, which cannot write
          // cookies. Safe to ignore: middleware refreshes the session instead.
        }
      },
    },
  })
}
