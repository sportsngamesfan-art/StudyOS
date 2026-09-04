import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client. Bypasses RLS, so it must only ever be imported from
 * server code (route handlers, server actions) and only after the caller's
 * own session has been verified with the normal server client.
 *
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is not set so callers can
 * respond with a clear 503 rather than crashing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
