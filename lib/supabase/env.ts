/**
 * Single place the Supabase URL and publishable key are read from, shared by
 * the browser, server and middleware clients.
 *
 * The placeholders exist so `next build` can succeed on a machine where the
 * env vars are absent (page-data collection imports every module). At runtime
 * `isSupabaseConfigured` lets the UI say what is missing instead of failing
 * with "Failed to fetch".
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
