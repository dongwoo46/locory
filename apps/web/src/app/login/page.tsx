'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

function detectInAppBrowser(): { isInApp: boolean; isAndroid: boolean; isIOS: boolean; appName: string } {
  if (typeof navigator === 'undefined') return { isInApp: false, isAndroid: false, isIOS: false, appName: '' }

  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)

  const inAppPatterns: Record<string, RegExp> = {
    '카카오톡': /KAKAOTALK/i,
    '인스타그램': /Instagram/i,
    '네이버': /NAVER/i,
    '페이스북': /FBAN|FBAV|FB_IAB/i,
    '라인': /Line\//i,
    '다음': /Daum/i,
    '트위터': /Twitter/i,
    '웨이보': /Weibo/i,
    '위챗': /MicroMessenger/i,
    '에브리타임': /everytime/i,
  }

  for (const [name, pattern] of Object.entries(inAppPatterns)) {
    if (pattern.test(ua)) return { isInApp: true, isAndroid, isIOS, appName: name }
  }

  // Generic WebView detection
  if (isAndroid && /wv/.test(ua)) return { isInApp: true, isAndroid, isIOS, appName: '앱' }
  if (isIOS && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua)) return { isInApp: true, isAndroid, isIOS, appName: '앱' }

  return { isInApp: false, isAndroid, isIOS, appName: '' }
}

export default function LoginPage() {
  const supabase = createClient()
  const t = useTranslations('login.inAppBrowser')
  const [inAppInfo, setInAppInfo] = useState<ReturnType<typeof detectInAppBrowser> | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    const info = detectInAppBrowser()
    setInAppInfo(info)

    if (info.isInApp && info.isAndroid) {
      // Android: intent:// 로 Chrome 강제 전환 시도
      const currentUrl = window.location.href
      const intentUrl = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
      window.location.href = intentUrl
      // 실패 시 fallback으로 안내 표시
      setTimeout(() => setShowGuide(true), 1500)
    } else if (info.isInApp) {
      setShowGuide(true)
    }
  }, [])

  async function handleGoogleLogin() {
    if (inAppInfo?.isInApp) {
      setShowGuide(true)
      return
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const isIOS = inAppInfo?.isIOS ?? false
  const appName = inAppInfo?.appName ?? '앱'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* 로고 */}
        <div className="flex flex-col items-center gap-2">
          <h1>
            <img src="/logo_letter.png" alt="Locory" className="h-40 w-auto" />
          </h1>
          <p className="text-sm text-gray-500 text-center">
            한국의 숨겨진 장소를 발견하고 공유하세요
          </p>
        </div>

        {/* 소셜 로그인 버튼 */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.77-2.7.77-2.08 0-3.84-1.4-4.47-3.29H1.87v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.51 10.53c-.16-.48-.25-.98-.25-1.53s.09-1.05.25-1.53V5.4H1.87A8 8 0 0 0 .98 9c0 1.29.31 2.51.89 3.6l2.64-2.07z"/>
              <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 .89 5.4L3.53 7.47c.63-1.89 2.39-3.89 5.45-3.89z"/>
            </svg>
            Google로 계속하기
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          계속하면 서비스 이용약관 및 개인정보처리방침에 동의하는 것으로 간주합니다
        </p>
      </div>

      {/* 인앱 브라우저 안내 모달 */}
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
              <button
                onClick={() => setShowGuide(false)}
                className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-medium"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <p className="leading-snug">{text}</p>
    </div>
  )
}
