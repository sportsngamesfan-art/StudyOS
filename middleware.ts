import { NextResponse, type NextRequest } from './lib/next-edge'
// Relative on purpose. Vercel packages middleware as a separate Edge Function
// and its tracer does not resolve the "@/" tsconfig alias there, so aliased
// imports fail at deploy time with "referencing unsupported modules" even
// though `next build` succeeds. Keep everything middleware imports relative.
import { updateSession } from './lib/supabase/middleware'
import { isSupabaseConfigured } from './lib/supabase/env'

/** Route prefixes that require a signed-in user. */
const PROTECTED_PREFIXES = ['/dashboard']

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function middleware(request: NextRequest) {
  // With no Supabase configured there is no session to check; let the pages
  // render so the auth form can explain what is missing.
  if (!isSupabaseConfigured) return NextResponse.next()

  try {
    const { response, user } = await updateSession(request)
    const { pathname } = request.nextUrl

    if (isProtected(pathname) && !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      url.search = ''
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    if (pathname === '/auth' && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }

    return response
  } catch (err) {
    // Last line of defence: middleware runs on every request, so an uncaught
    // error here is a site-wide 500. Fail open and log. Protected pages still
    // have their client-side auth gate, and every table is behind RLS, so
    // nothing is exposed by letting the request through.
    console.error('[middleware] failed open:', err instanceof Error ? err.stack ?? err.message : err)
    return NextResponse.next()
  }
}

export const config = {
  // Run on everything except Next internals and static assets. API routes are
  // included on purpose so their cookies are refreshed too; they do their own
  // 401 handling.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
