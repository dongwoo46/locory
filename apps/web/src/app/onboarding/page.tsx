'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import type { Nationality } from '@/types/database'
import { validateNickname } from '@/lib/utils/nickname'

const NATIONALITIES: { value: Nationality; flag: string }[] = [
  { value: 'KR', flag: '🇰🇷' },
  { value: 'JP', flag: '🇯🇵' },
  { value: 'US', flag: '🇺🇸' },
  { value: 'CN', flag: '🇨🇳' },
  { value: 'ES', flag: '🇪🇸' },
  { value: 'EU', flag: '🇪🇺' },
  { value: 'RU', flag: '🇷🇺' },
  { value: 'OTHER', flag: '🌍' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('onboarding')
  const tProfile = useTranslations('profile')

  const [nickname, setNickname] = useState('')
  const [nationality, setNationality] = useState<Nationality | null>(null)
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!nationality) { setError(t('errorNationalityRequired')); return }
    if (!gender) { setError(t('errorGenderRequired')); return }
    if (!birthDate) { setError(t('errorBirthDateRequired')); return }

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const isAdmin = user.email === 'siwol406@gmail.com'
    if (!isAdmin) {
      const nicknameErr = validateNickname(nickname)
      if (nicknameErr) { setLoading(false); setError(nicknameErr); return }
    }

    const updates: any = {
      nickname: nickname.trim(),
      nationality,
      gender,
      gender_changed_at: new Date().toISOString(),
      birth_date: birthDate,
      onboarded: true,
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (updateError) {
      if (updateError.code === '23505') setError(t('errorNicknameDuplicate'))
      else if (updateError.code === '23514') setError(t('errorNicknameInvalid'))
      else setError(t('errorSaveFailed'))
      setLoading(false)
      return
    }

    document.cookie = 'onboarded=1; path=/; max-age=31536000'
    router.push('/feed')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm flex flex-col gap-7">

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #f093fb 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Locory
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('title')}</p>
        </div>

        {/* 닉네임 */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">{t('nickname')}</label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder={t('nicknamePlaceholder')}
            maxLength={16}
            className="px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-colors"
          />
        </div>

        {/* 국적 */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">{t('nationality')}</label>
          <div className="grid grid-cols-2 gap-2">
            {NATIONALITIES.map(n => (
              <button
                key={n.value}
                onClick={() => setNationality(n.value)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition-colors ${
                  nationality === n.value
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{n.flag}</span>
                <span>{tProfile(`nationality.${n.value}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 성별 (선택) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            {tProfile('gender.label')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['female', 'male', 'other'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGender(prev => prev === g ? null : g)}
                className={`py-3 rounded-xl border text-sm transition-colors ${
                  gender === g
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tProfile(`gender.${g}`)}
              </button>
            ))}
          </div>
        </div>

        {/* 생년월일 (선택) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            {t('birthDate')}
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 14)).toISOString().slice(0, 10)}
            min="1920-01-01"
            className="px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 bg-white"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {loading ? t('submitting') : t('submit')}
        </button>
      </div>
    </div>
  )
}