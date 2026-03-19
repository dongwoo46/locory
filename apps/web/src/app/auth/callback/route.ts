import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { locales, defaultLocale, type Locale } from '@/i18n/config'

// locale 문자열 → 지원 Locale 매핑
function mapToLocale(lang: string): Locale | null {
  const l = lang.toLowerCase()
  if (l === 'ko' || l.startsWith('ko-')) return 'ko'
  if (l === 'ja' || l.startsWith('ja-')) return 'ja'
  if (l === 'zh-tw' || l === 'zh-hant') return 'zh-TW'
  if (l === 'zh-cn' || l === 'zh-hans' || l.startsWith('zh')) return 'zh-CN'
  if (l === 'es' || l.startsWith('es-')) return 'es'
  if (l === 'ru' || l.startsWith('ru-')) return 'ru'
  if (l === 'en' || l.startsWith('en-')) return 'en'
  return null
}

// Google user_metadata.locale 우선, 없으면 Accept-Language
function detectLocale(googleLocale: string | undefined, acceptLanguage: string | null): Locale {
  if (googleLocale) {
    const mapped = mapToLocale(googleLocale)
    if (mapped) return mapped
  }
  if (!acceptLanguage) return defaultLocale
  for (const lang of acceptLanguage.split(',').map(s => s.split(';')[0].trim())) {
    const mapped = mapToLocale(lang)
    if (mapped) return mapped
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
          const googleLocale = user.user_metadata?.locale as string | undefined
          const locale = detectLocale(googleLocale, request.headers.get('accept-language'))
          response.cookies.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 })
        }

        return response
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
