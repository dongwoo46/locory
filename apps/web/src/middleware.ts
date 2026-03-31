import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/settings', '/saved', '/admin']

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname.startsWith(prefix))
}

function hasSupabaseAuthCookie(request: NextRequest) {
  const cookies = request.cookies.getAll()
  return cookies.some(({ name, value }) => {
    if (!name.startsWith('sb-') || !name.includes('-auth-token')) return false
    return Boolean(value && value !== '[]')
  })
}

function withServerTiming(response: NextResponse, startTime: number) {
  const durationMs = performance.now() - startTime
  response.headers.set('Server-Timing', `mw_total;dur=${durationMs.toFixed(1)}`)
  return response
}

export function middleware(request: NextRequest) {
  const startedAt = performance.now()
  const { pathname } = request.nextUrl

  if (!matchesPrefix(pathname, PROTECTED_PATHS)) {
    return withServerTiming(NextResponse.next({ request }), startedAt)
  }

  if (!hasSupabaseAuthCookie(request)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return withServerTiming(NextResponse.redirect(url), startedAt)
  }

  return withServerTiming(NextResponse.next({ request }), startedAt)
}

export const config = {
  matcher: [
    '/settings/:path*',
    '/saved/:path*',
    '/admin/:path*',
  ],
}
