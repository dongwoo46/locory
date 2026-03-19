'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  async function signInWithApple() {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* 로고 */}
        <div className="flex flex-col items-center gap-2">
          <h1>
            <img src="/logo40.png" alt="Locory" className="h-10 w-auto" />
          </h1>
          <p className="text-sm text-gray-500 text-center">
            한국의 숨겨진 장소를 발견하고 공유하세요
          </p>
        </div>

        {/* 소셜 로그인 버튼 */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={signInWithGoogle}
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

          {/* Apple 로그인 - 추후 활성화 */}
          {/* <button onClick={signInWithApple} ...> */}
        </div>

        <p className="text-xs text-gray-400 text-center">
          계속하면 서비스 이용약관 및 개인정보처리방침에 동의하는 것으로 간주합니다
        </p>
      </div>
    </div>
  )
}
