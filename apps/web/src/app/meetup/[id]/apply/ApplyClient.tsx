'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { containsProfanity } from '@/lib/utils/profanity'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const AGE_GROUPS = [
  { value: 'teens' }, { value: '20s_early' }, { value: '20s_mid' }, { value: '20s_late' },
  { value: '30s_early' }, { value: '30s_mid' }, { value: '30s_late' }, { value: '40s_plus' },
]
const GENDER_OPTS = [{ value: 'female' }, { value: 'male' }, { value: 'mixed' }]
const COUNT_OPTS = [1, 2, 3, 4]

function calcAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return age
}

function getAgeGroup(birthDate: string | null): string | null {
  if (!birthDate) return null
  const age = calcAge(birthDate)
  if (age < 20) return 'teens'
  if (age <= 23) return '20s_early'
  if (age <= 26) return '20s_mid'
  if (age <= 29) return '20s_late'
  if (age <= 33) return '30s_early'
  if (age <= 36) return '30s_mid'
  if (age <= 39) return '30s_late'
  return '40s_plus'
}

function ChipSelect({ options, value, onChange, labelKey }: {
  options: { value: string }[]
  value: string | null
  onChange: (v: string) => void
  labelKey: (v: string) => string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            value === o.value
              ? 'bg-gray-900 text-white border-transparent'
              : 'border-gray-200 text-gray-600'
          }`}
        >
          {labelKey(o.value)}
        </button>
      ))}
    </div>
  )
}

function MultiChipSelect({ options, values, onChange, labelKey }: {
  options: { value: string }[]
  values: string[]
  onChange: (v: string[]) => void
  labelKey: (v: string) => string
}) {
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => toggle(o.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            values.includes(o.value)
              ? 'bg-gray-900 text-white border-transparent'
              : 'border-gray-200 text-gray-600'
          }`}
        >
          {labelKey(o.value)}
        </button>
      ))}
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

interface Props {
  meetupId: string
  userId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any
}

export default function ApplyClient({ meetupId, userId, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('meetup')
  const tCommon = useTranslations('common')

  const myAgeGroup = getAgeGroup(profile?.birth_date ?? null)
  const myGender = profile?.gender ?? null

  const [joinCount, setJoinCount] = useState(1)
  const [joinGender, setJoinGender] = useState<string>(
    myGender === 'female' ? 'female' : myGender === 'male' ? 'male' : 'mixed'
  )
  const [joinAgeGroups, setJoinAgeGroups] = useState<string[]>(myAgeGroup ? [myAgeGroup] : [])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (joinAgeGroups.length === 0) {
      setError(t('join.selectAgeGroup'))
      return
    }
    if (containsProfanity(message)) {
      setError(tCommon('profanityError'))
      return
    }
    setLoading(true)
    const { error: err } = await supabase.from('meetup_joins').insert({
      meetup_id: meetupId,
      applicant_id: userId,
      join_count: joinCount,
      join_gender: joinGender,
      join_age_groups: joinAgeGroups,
      message: message.trim() || null,
    })
    if (err) {
      setError(t('join.failed'))
      setLoading(false)
      return
    }
    router.push(`/meetup/${meetupId}`)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 max-w-lg mx-auto">
        <div className="flex items-center px-4 h-14">
          <button onClick={() => router.back()} className="p-1 mr-2 text-gray-400">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="flex-1 text-base font-bold text-gray-900">{t('join.title')}</h1>
        </div>
      </header>

      <div className="pt-14 pb-28 px-4 py-4 max-w-lg mx-auto w-full">
        <div className="flex flex-col gap-5 mt-4">
          {/* 인원 */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">{t('join.ourCount')}</p>
            <div className="flex gap-1.5">
              {COUNT_OPTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setJoinCount(n)}
                  className={`w-10 h-10 rounded-xl text-sm font-medium border transition-colors ${
                    joinCount === n
                      ? 'bg-gray-900 text-white border-transparent'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setJoinCount(5)}
                className={`px-3 h-10 rounded-xl text-sm font-medium border transition-colors ${
                  joinCount >= 5
                    ? 'bg-gray-900 text-white border-transparent'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                5+
              </button>
            </div>
          </div>

          {/* 성별 구성 */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">{t('join.genderComp')}</p>
            <ChipSelect
              options={GENDER_OPTS}
              value={joinGender}
              onChange={setJoinGender}
              labelKey={(v) => t(`gender.${v}`)}
            />
          </div>

          {/* 나잇대 */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">{t('join.ageGroups')}</p>
            <MultiChipSelect
              options={AGE_GROUPS}
              values={joinAgeGroups}
              onChange={setJoinAgeGroups}
              labelKey={(v) => t(`ageGroup.${v}`)}
            />
          </div>

          {/* 한마디 */}
          <div>
            <p className="text-xs font-semibold text-gray-900 mb-2">{t('join.description')}</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 80))}
              placeholder={t('join.descriptionPlaceholder')}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none resize-none bg-white"
            />
            <p className="text-right text-xs text-gray-300 mt-0.5">{message.length}/80</p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 px-4 py-4 max-w-lg mx-auto">
        <button
          onClick={handleSubmit}
          disabled={loading || joinAgeGroups.length === 0}
          className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
        >
          {loading ? t('join.submitting') : t('join.submit')}
        </button>
      </div>
    </div>
  )
}
