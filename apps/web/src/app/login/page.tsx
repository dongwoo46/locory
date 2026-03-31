'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

type Lang = 'ko' | 'en' | 'ja' | 'ru'

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'ko', label: 'Korean' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ru', label: 'Russian' },
]

const LOGIN_TEXT: Record<Lang, { title: string; subtitle: string; loginBtn: string; terms: string }> = {
  ko: {
    title: 'Map-first travel app',
    subtitle: 'Discover spots and post directly from the map.',
    loginBtn: 'Continue with Google',
    terms: 'By continuing, you agree to our Terms and Privacy Policy.',
  },
  en: {
    title: 'Map-first travel app',
    subtitle: 'Discover spots and post directly from the map.',
    loginBtn: 'Continue with Google',
    terms: 'By continuing, you agree to our Terms and Privacy Policy.',
  },
  ja: {
    title: 'Map-first travel app',
    subtitle: 'Discover spots and post directly from the map.',
    loginBtn: 'Continue with Google',
    terms: 'By continuing, you agree to our Terms and Privacy Policy.',
  },
  ru: {
    title: 'Map-first travel app',
    subtitle: 'Discover spots and post directly from the map.',
    loginBtn: 'Continue with Google',
    terms: 'By continuing, you agree to our Terms and Privacy Policy.',
  },
}

function detectInAppBrowser(): { isInApp: boolean; isAndroid: boolean; isIOS: boolean; appName: string } {
  if (typeof navigator === 'undefined') {
    return { isInApp: false, isAndroid: false, isIOS: false, appName: '' }
  }

  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const inAppPatterns: Record<string, RegExp> = {
    KakaoTalk: /KAKAOTALK/i,
    Instagram: /Instagram/i,
    Naver: /NAVER/i,
    Facebook: /FBAN|FBAV|FB_IAB/i,
    Line: /Line\//i,
    Daum: /Daum/i,
    Twitter: /Twitter/i,
    Weibo: /Weibo/i,
    WeChat: /MicroMessenger/i,
    Everytime: /everytime/i,
  }

  for (const [name, pattern] of Object.entries(inAppPatterns)) {
    if (pattern.test(ua)) {
      return { isInApp: true, isAndroid, isIOS, appName: name }
    }
  }

  if (isAndroid && /wv/.test(ua)) {
    return { isInApp: true, isAndroid, isIOS, appName: 'In-app browser' }
  }
  if (isIOS && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua)) {
    return { isInApp: true, isAndroid, isIOS, appName: 'In-app browser' }
  }

  return { isInApp: false, isAndroid, isIOS, appName: '' }
}

export default function LoginPage() {
  const supabase = createClient()
  const t = useTranslations('login.inAppBrowser')

  const [lang, setLang] = useState<Lang>('en')
  const [showGuide, setShowGuide] = useState(false)

  const inAppInfo = typeof navigator !== 'undefined' ? detectInAppBrowser() : null
  const loginText = LOGIN_TEXT[lang]

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    : `${window.location.origin}/auth/callback`

  useEffect(() => {
    if (!inAppInfo) return
    if (inAppInfo.isInApp && inAppInfo.isAndroid) {
      const intentUrl = `intent://${window.location.href.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
      window.location.href = intentUrl
      setTimeout(() => setShowGuide(true), 1500)
    } else if (inAppInfo.isInApp) {
      setShowGuide(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGoogleLogin() {
    if (inAppInfo?.isInApp) {
      setShowGuide(true)
      return
    }

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  const isIOS = inAppInfo?.isIOS ?? false
  const appName = inAppInfo?.appName ?? 'In-app browser'

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex items-center justify-center gap-1 pt-4 px-4">
        {LANGUAGES.map((item) => (
          <button
            key={item.code}
            onClick={() => setLang(item.code)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${lang === item.code ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-10">
        <Image src="/logo_letter.png" alt="Locory" width={220} height={72} className="h-20 w-auto" priority />
        <h1 className="mt-6 text-xl font-bold text-gray-900 text-center">{loginText.title}</h1>
        <p className="mt-2 text-sm text-gray-500 text-center">{loginText.subtitle}</p>

        <button
          onClick={handleGoogleLogin}
          className="mt-7 flex items-center gap-2.5 px-5 py-2.5 border border-gray-200 rounded-2xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <GoogleIcon />
          {loginText.loginBtn}
        </button>

        <p className="mt-4 text-xs text-gray-400 text-center leading-relaxed px-4">{loginText.terms}</p>
      </div>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
          <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" fill="none" stroke="#EF4444" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{t('title', { app: appName })}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('subtitle')}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3 text-sm text-gray-700">
                {isIOS ? (
                  <>
                    <Step n={1} text={t('iosStep1')} />
                    <Step n={2} text={t('iosStep2')} />
                    <Step n={3} text={t('iosStep3')} />
                  </>
                ) : (
                  <>
                    <Step n={1} text={t('androidStep1')} />
                    <Step n={2} text={t('androidStep2')} />
                    <Step n={3} text={t('androidStep3')} />
                  </>
                )}
              </div>
            </div>
            <div className="px-6 py-4">
              <button onClick={() => setShowGuide(false)} className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-medium">
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" />
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.77-2.7.77-2.08 0-3.84-1.4-4.47-3.29H1.87v2.07A8 8 0 0 0 8.98 17z" />
      <path fill="#FBBC05" d="M4.51 10.53c-.16-.48-.25-.98-.25-1.53s.09-1.05.25-1.53V5.4H1.87A8 8 0 0 0 .98 9c0 1.29.31 2.51.89 3.6l2.64-2.07z" />
      <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 .89 5.4L3.53 7.47c.63-1.89 2.39-3.89 5.45-3.89z" />
    </svg>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
      <p className="leading-snug">{text}</p>
    </div>
  )
}
