import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession()은 쿠키에서 읽어서 네트워크 요청 없음 (빠름)
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  const { pathname } = request.nextUrl

  const protectedPaths = ['/feed', '/map', '/upload', '/profile', '/place', '/post', '/settings', '/saved']
  const isProtected = protectedPaths.some(path => pathname.startsWith(path))

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 로그인됐지만 온보딩 안 됐으면 온보딩으로 (쿠키 캐싱)
  if (user && isProtected) {
    const onboardedCookie = request.cookies.get('onboarded')?.value
    if (onboardedCookie !== '1') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', user.id)
        .single()

      if (!profile?.onboarded) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }
      supabaseResponse.cookies.set('onboarded', '1', { path: '/', maxAge: 60 * 60 * 24 * 365 })
    }
  }

  // 로그인된 유저가 로그인 페이지 접근 시 피드로
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/feed'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/feed/:path*',
    '/map/:path*',
    '/upload/:path*',
    '/profile/:path*',
    '/place/:path*',
    '/post/:path*',
    '/settings/:path*',
    '/saved/:path*',
    '/login',
    '/onboarding',
  ],
}