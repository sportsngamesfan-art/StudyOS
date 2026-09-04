/**
 * NextRequest/NextResponse via their own submodules, not the `next/server`
 * barrel.
 *
 * `next/server` re-exports `userAgent()` from the same file as
 * NextResponse/NextRequest. Next's own webpack build for the Edge runtime
 * does not tree-shake that unused re-export away, so importing anything at
 * all from `next/server` pulls in the compiled ua-parser-js bundle — which
 * references `__dirname` at module scope, undefined on Edge — even though
 * middleware never calls userAgent(). That crashed every request in
 * production: "ReferenceError: __dirname is not defined" at
 * node_modules/next/dist/compiled/ua-parser-js/ua-parser.js, thrown before
 * the middleware function body ever runs, which is why the try/catch around
 * updateSession() could not catch it.
 *
 * Reproduced directly: bundling this repo's real middleware.ts and running
 * it in @edge-runtime/vm (the same package Vercel's Edge runtime is built
 * on) throws that exact error when importing from `next/server`, and does
 * not when importing from these submodules instead — request.js and
 * response.js have no ua-parser-js or __dirname reference at all.
 *
 * Tracked upstream: https://github.com/vercel/next.js/issues/53968
 *
 * middleware.ts and lib/supabase/middleware.ts are the only files that run
 * on the Edge runtime; import NextRequest/NextResponse from here, not
 * 'next/server', in either of them or anything they import.
 */
export { NextRequest } from 'next/dist/server/web/spec-extension/request'
export { NextResponse } from 'next/dist/server/web/spec-extension/response'
