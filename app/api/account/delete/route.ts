import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Permanently deletes the signed-in user's account.
 *
 * Order matters: the caller's identity comes from their own session cookie
 * (never from the request body), only then is the service-role client used,
 * and only ever against that verified user id. Table rows go with the user
 * via `on delete cascade`; storage objects have no cascade, so they are
 * removed explicitly first.
 */
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      {
        error:
          'Account deletion is not configured on this server: SUPABASE_SERVICE_ROLE_KEY is missing.',
      },
      { status: 503 }
    )
  }

  try {
    const { data: files } = await admin.storage.from('documents').list(user.id)
    if (files && files.length > 0) {
      const { error: removeError } = await admin.storage
        .from('documents')
        .remove(files.map((f) => `${user.id}/${f.name}`))
      if (removeError) throw removeError
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) throw deleteError

    await supabase.auth.signOut()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Account deletion failed:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to delete account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
