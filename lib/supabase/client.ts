import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

/**
 * Browser client. Unlike the plain supabase-js client this stores the session
 * in cookies, which is what lets `middleware.ts` and route handlers see who is
 * signed in. `createBrowserClient` returns a per-page singleton.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
