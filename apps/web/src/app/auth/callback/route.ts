import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { locales, defaultLocale, type Locale } from '@/i18n/config'

// Accept-Language 헤더에서 지원 locale 매핑
function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale

  const preferred = acceptLanguage
    .split(',')
    .map(s => s.split(';')[0].trim().toLowerCase())

  for (const lang of preferred) {
    if (lang === 'ko' || lang.startsWith('ko-')) return 'ko'
    if (lang === 'ja' || lang.startsWith('ja-')) return 'ja'
    if (lang === 'zh-tw' || lang === 'zh-hant') return 'zh-TW'
    if (lang === 'zh-cn' || lang === 'zh-hans' || lang.startsWith('zh')) return 'zh-CN'
    if (lang === 'es' || lang.startsWith('es-')) return 'es'
    if (lang === 'en' || lang.startsWith('en-')) return 'en'
  }

  return defaultLocale
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/feed'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname, nationality, onboarded')
          .eq('id', user.id)
          .single()

        const needsOnboarding = !profile?.onboarded
        const destination = needsOnboarding ? `${origin}/onboarding` : `${origin}${next}`

        const response = NextResponse.redirect(destination)

        // 처음 로그인 시에만 언어 자동 설정 (쿠키 없을 때)
        const existingLocale = request.headers.get('cookie')?.match(/locale=([^;]+)/)?.[1]
        if (!existingLocale) {
          const locale = detectLocale(request.headers.get('accept-language'))
          response.cookies.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
        }

        return response
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
