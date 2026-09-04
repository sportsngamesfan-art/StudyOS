/**
 * Compatibility shim. Existing pages import `{ supabase }` from '@/lib/supabase';
 * they keep working unchanged, but the client underneath now comes from
 * @supabase/ssr, so the session lives in cookies and is visible to
 * middleware.ts and route handlers.
 *
 * Note: '@/lib/supabase' resolves to this file, while '@/lib/supabase/client'
 * etc. resolve into the sibling directory. New code should import from the
 * directory modules directly.
 */
import { createClient } from './supabase/client'

export { isSupabaseConfigured } from './supabase/env'
export const supabase = createClient()
