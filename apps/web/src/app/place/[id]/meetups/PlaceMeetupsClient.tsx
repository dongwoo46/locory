'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { containsProfanity } from '@/lib/utils/profanity'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const NATIONALITY_OPTS = [
  { value: 'KR', label: '🇰🇷 한국' }, { value: 'JP', label: '🇯🇵 일본' },
  { value: 'US', label: '🇺🇸 미국' }, { value: 'CN', label: '🇨🇳 중국' },
  { value: 'ES', label: '🇪🇸 스페인/남미' }, { value: 'RU', label: '🇷🇺 러시아' },
  { value: 'OTHER', label: '🌍 기타' },
]
const AGE_GROUPS = [
  { value: 'teens' }, { value: '20s_early' }, { value: '20s_mid' }, { value: '20s_late' },
  { value: '30s_early' }, { value: '30s_mid' }, { value: '30s_late' }, { value: '40s_plus' },
]
const ACTIVITIES = [
  { value: 'chat' }, { value: 'food' }, { value: 'photo' },
  { value: 'tour' }, { value: 'drink' }, { value: 'game' }, { value: 'other' },
]
const VIBES = [{ value: 'casual' }, { value: 'fun' }, { value: 'serious' }]
const GENDER_OPTS = [{ value: 'female' }, { value: 'male' }, { value: 'mixed' }]
const WANTED_GENDER_OPTS = [{ value: 'female' }, { value: 'male' }, { value: 'any' }]
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

function formatScheduled(iso: string) {
  const d = new Date(iso)
  const mm = d.getMonth() + 1
  const dd = d.getDate()
  const hh = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${mm}/${dd} ${hh}:${min}`
}

function isToday(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isThisWeek(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 86400000)
  return d >= now && d <= weekFromNow
}

function isWeekend(iso: string) {
  const d = new Date(iso)
  const day = d.getDay()
  return day === 0 || day === 6
}

// ─── 칩 헬퍼 ─────────────────────────────────────────────────────────────────

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

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface MeetupItem {
  id: string
  organizer_id: string
  scheduled_at: string
  status: string
  host_count: number
  host_gender: string
  host_age_groups: string[]
  activities: string[]
  vibe: string
  description: string | null
  wanted_gender: string
  wanted_age_groups: string[] | null
  wanted_count: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profiles: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meetup_joins?: any[]
}

interface Props {
  placeId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  place: any
  userId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function PlaceMeetupsClient({ placeId, place, userId, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('meetup')

  const [meetups, setMeetups] = useState<MeetupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const [filterActivity, setFilterActivity] = useState<string | null>(null)
  const [filterVibe, setFilterVibe] = useState<string | null>(null)
  const [filterGender, setFilterGender] = useState<string | null>(null)
  const [filterDate, setFilterDate] = useState<string | null>(null)

  const canParticipate = profile?.is_public && (profile?.trust_score ?? 0) >= 3
  const myAgeGroup = getAgeGroup(profile?.birth_date ?? null)

  useEffect(() => {
    loadMeetups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadMeetups() {
    setLoading(true)
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('place_meetups')
      .select(`
        id, organizer_id, scheduled_at, status, host_count, host_gender, host_age_groups,
        activities, vibe, description, wanted_gender, wanted_age_groups, wanted_count,
        profiles!organizer_id (id, nickname, avatar_url, gender, birth_date),
        meetup_joins (status, applicant_id)
      `)
      .eq('place_id', placeId)
      .eq('status', 'open')
      .is('deleted_at', null)
      .gt('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
    setMeetups((data as MeetupItem[]) ?? [])
    setLoading(false)
  }

  const filtered = meetups.filter((m) => {
    if (filterActivity && !m.activities.includes(filterActivity)) return false
    if (filterVibe && m.vibe !== filterVibe) return false
    if (filterGender && m.wanted_gender !== filterGender) return false
    if (filterDate === 'today' && !isToday(m.scheduled_at)) return false
    if (filterDate === 'week' && !isThisWeek(m.scheduled_at)) return false
    if (filterDate === 'weekend' && !isWeekend(m.scheduled_at)) return false
    return true
  })

  function toggleFilter<T extends string>(val: T, current: T | null, set: (v: T | null) => void) {
    set(current === val ? null : val)
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
          <h1 className="flex-1 text-base font-bold text-gray-900 truncate">{place.name}</h1>
          {canParticipate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-full text-xs font-medium"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              {t('placeMeetups.createBtn')}
            </button>
          )}
        </div>
      </header>

      <div className="pt-14 pb-6">
        {/* 필터 */}
        <div className="bg-white border-b border-gray-100 sticky top-14 z-40">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-4 py-2">
            {ACTIVITIES.map((a) => (
              <button
                key={a.value}
                onClick={() => toggleFilter(a.value, filterActivity, setFilterActivity)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterActivity === a.value
                    ? 'bg-blue-600 text-white border-transparent'
                    : 'border-gray-200 text-gray-600 bg-white'
                }`}
              >
                {t(`activity.${a.value}`)}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-4 pb-2">
            {VIBES.map((v) => (
              <button
                key={v.value}
                onClick={() => toggleFilter(v.value, filterVibe, setFilterVibe)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterVibe === v.value
                    ? 'bg-purple-600 text-white border-transparent'
                    : 'border-gray-200 text-gray-600 bg-white'
                }`}
              >
                {t(`vibe.${v.value}`)}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-1 self-stretch" />
            {WANTED_GENDER_OPTS.map((g) => (
              <button
                key={g.value}
                onClick={() => toggleFilter(g.value, filterGender, setFilterGender)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterGender === g.value
                    ? 'bg-pink-600 text-white border-transparent'
                    : 'border-gray-200 text-gray-600 bg-white'
                }`}
              >
                {t(`gender.${g.value}`)}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-1 self-stretch" />
            {(['today', 'week', 'weekend'] as const).map((d) => (
              <button
                key={d}
                onClick={() => toggleFilter(d, filterDate, setFilterDate)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterDate === d
                    ? 'bg-orange-500 text-white border-transparent'
                    : 'border-gray-200 text-gray-600 bg-white'
                }`}
              >
                {d === 'today' ? t('explore.dateToday') : d === 'week' ? t('explore.dateWeek') : t('explore.dateWeekend')}
              </button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        <div className="px-4 py-4 flex flex-col gap-3 max-w-lg mx-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">{t('placeMeetups.empty')}</div>
          ) : (
            filtered.map((m) => {
              const myJoin = m.meetup_joins?.find((j: { applicant_id: string; status: string }) => j.applicant_id === userId)
              const isOrganizer = m.organizer_id === userId
              return (
                <div
                  key={m.id}
                  onClick={() => router.push(`/meetup/${m.id}`)}
                  className="bg-white border border-gray-100 rounded-2xl p-4 cursor-pointer active:bg-gray-50 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-900">
                      {formatScheduled(m.scheduled_at)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {m.profiles?.avatar_url ? (
                        <img src={m.profiles.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
                          {m.profiles?.nickname?.[0] ?? '?'}
                        </div>
                      )}
                      <span className="text-xs text-gray-500">{m.profiles?.nickname ?? '-'}</span>
                      {isOrganizer && (
                        <span className="text-xs text-blue-500 font-medium">{t('myMeetup')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">{m.host_count}명</span>
                    {m.host_gender && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                        {t(`gender.${m.host_gender}`)}
                      </span>
                    )}
                    {m.host_age_groups.map((a: string) => (
                      <span key={a} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                        {t(`ageGroup.${a}`)}
                      </span>
                    ))}
                    {m.activities.slice(0, 2).map((a: string) => (
                      <span key={a} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600">
                        {t(`activity.${a}`)}
                      </span>
                    ))}
                    {m.vibe && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600">
                        {t(`vibe.${m.vibe}`)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-gray-400">{t('wantedLabel')}</span>
                    <span className="text-xs text-gray-600">{t(`gender.${m.wanted_gender}`)}</span>
                    {m.wanted_age_groups?.map((a: string) => (
                      <span key={a} className="text-xs text-gray-600">{t(`ageGroup.${a}`)}</span>
                    ))}
                    {m.wanted_count && <span className="text-xs text-gray-600">{m.wanted_count}명</span>}
                  </div>

                  {m.description && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-1">{m.description}</p>
                  )}

                  {myJoin && !isOrganizer && (
                    <div className="mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        myJoin.status === 'accepted' ? 'bg-green-100 text-green-700'
                        : myJoin.status === 'rejected' ? 'bg-red-50 text-red-500'
                        : myJoin.status === 'unmatched' ? 'bg-gray-100 text-gray-400'
                        : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {myJoin.status === 'accepted' ? t('status.accepted')
                          : myJoin.status === 'rejected' ? t('status.rejected')
                          : myJoin.status === 'unmatched' ? t('status.unmatched')
                          : t('status.pending')}
                      </span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 만들기 모달 */}
      {showCreate && (
        <CreateModal
          placeId={placeId}
          userId={userId}
          myAgeGroup={myAgeGroup}
          myGender={profile?.gender ?? null}
          onClose={() => setShowCreate(false)}
          onDone={async () => {
            setShowCreate(false)
            await loadMeetups()
          }}
        />
      )}
    </div>
  )
}

// ─── 만들기 모달 ───────────────────────────────────────────────────────────────

function CreateModal({
  placeId,
  userId,
  myAgeGroup,
  myGender,
  onClose,
  onDone,
}: {
  placeId: string
  userId: string
  myAgeGroup: string | null
  myGender: string | null
  onClose: () => void
  onDone: () => void
}) {
  const supabase = createClient()
  const t = useTranslations('meetup')
  const tCommon = useTranslations('common')

  const defaultScheduledAt = () => {
    const d = new Date()
    d.setHours(d.getHours() + 1, 0, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
  }

  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt())
  const [hostCount, setHostCount] = useState(1)
  const [hostGender, setHostGender] = useState<string>(
    myGender === 'female' ? 'female' : myGender === 'male' ? 'male' : 'mixed'
  )
  const [hostAgeGroups, setHostAgeGroups] = useState<string[]>(myAgeGroup ? [myAgeGroup] : [])
  const [activities, setActivities] = useState<string[]>([])
  const [vibe, setVibe] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [wantedGender, setWantedGender] = useState<string>('any')
  const [wantedAgeGroups, setWantedAgeGroups] = useState<string[]>([])
  const [wantedCount, setWantedCount] = useState<number | null>(null)
  const [wantedNationalities, setWantedNationalities] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = scheduledAt && hostAgeGroups.length > 0 && activities.length > 0

  async function handleSubmit() {
    if (!canSubmit) return
    if (containsProfanity(description)) { setError(tCommon('profanityError')); return }
    setLoading(true)
    const { error: err } = await supabase.from('place_meetups').insert({
      place_id: placeId,
      organizer_id: userId,
      scheduled_at: new Date(scheduledAt).toISOString(),
      host_count: hostCount,
      host_gender: hostGender,
      host_age_groups: hostAgeGroups,
      activities,
      vibe: vibe || null,
      description: description.trim() || null,
      wanted_gender: wantedGender,
      wanted_age_groups: wantedAgeGroups.length > 0 ? wantedAgeGroups : null,
      wanted_count: wantedCount,
      wanted_nationalities: wantedNationalities.length > 0 ? wantedNationalities : null,
    })
    if (err) {
      setError(t('form.saveFailed'))
      setLoading(false)
      return
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center px-4 py-3 border-b border-gray-100">
          <button onClick={onClose} className="p-1 mr-2 text-gray-400">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2 className="text-base font-bold text-gray-900 flex-1">{t('create')}</h2>
          <button onClick={onClose} className="p-1 text-gray-400">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-5 pb-8">
          {/* 날짜/시간 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">{t('form.dateTime')}</p>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              step={300}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none bg-white"
            />
          </div>

          {/* 우리 측 */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-gray-900">{t('form.ourTeam')}</p>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t('form.memberCount')}</p>
              <div className="flex gap-1.5">
                {COUNT_OPTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setHostCount(n)}
                    className={`w-10 h-10 rounded-xl text-sm font-medium border transition-colors ${
                      hostCount === n ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setHostCount(5)}
                  className={`px-3 h-10 rounded-xl text-sm font-medium border transition-colors ${
                    hostCount >= 5 ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  5+
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t('form.genderComp')}</p>
              <ChipSelect
                options={GENDER_OPTS}
                value={hostGender}
                onChange={setHostGender}
                labelKey={(v) => t(`gender.${v}`)}
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t('form.ageGroups')}</p>
              <MultiChipSelect
                options={AGE_GROUPS}
                values={hostAgeGroups}
                onChange={setHostAgeGroups}
                labelKey={(v) => t(`ageGroup.${v}`)}
              />
            </div>
          </div>

          {/* 활동/분위기 */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-gray-900">{t('form.activitiesVibe')}</p>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t('form.whatToDo')}</p>
              <MultiChipSelect
                options={ACTIVITIES}
                values={activities}
                onChange={setActivities}
                labelKey={(v) => t(`activity.${v}`)}
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t('form.vibe')}</p>
              <ChipSelect
                options={VIBES}
                value={vibe}
                onChange={(v) => setVibe((prev) => (prev === v ? null : v))}
                labelKey={(v) => t(`vibe.${v}`)}
              />
            </div>
          </div>

          {/* 한마디 */}
          <div>
            <p className="text-xs font-semibold text-gray-900 mb-2">{t('form.description')}</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 100))}
              placeholder={t('form.descriptionPlaceholder')}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none resize-none"
            />
            <p className="text-right text-xs text-gray-300 mt-0.5">{description.length}/100</p>
          </div>

          {/* 원하는 상대 */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold text-gray-900">{t('form.wantedConditions')}</p>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t('form.gender')}</p>
              <ChipSelect
                options={WANTED_GENDER_OPTS}
                value={wantedGender}
                onChange={setWantedGender}
                labelKey={(v) => t(`gender.${v}`)}
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t('form.ageGroupsOptional')}</p>
              <MultiChipSelect
                options={AGE_GROUPS}
                values={wantedAgeGroups}
                onChange={setWantedAgeGroups}
                labelKey={(v) => t(`ageGroup.${v}`)}
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t('form.countOptional')}</p>
              <div className="flex gap-1.5">
                {COUNT_OPTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setWantedCount((prev) => (prev === n ? null : n))}
                    className={`w-10 h-10 rounded-xl text-sm font-medium border transition-colors ${
                      wantedCount === n ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setWantedCount((prev) => (prev === 5 ? null : 5))}
                  className={`px-3 h-10 rounded-xl text-sm font-medium border transition-colors ${
                    (wantedCount ?? 0) >= 5 ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  5+
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">{t('form.nationalityOptional')}</p>
              <div className="flex flex-wrap gap-1.5">
                {NATIONALITY_OPTS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setWantedNationalities((prev) =>
                      prev.includes(o.value) ? prev.filter((x) => x !== o.value) : [...prev, o.value]
                    )}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      wantedNationalities.includes(o.value)
                        ? 'bg-gray-900 text-white border-transparent'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
          >
            {loading ? t('form.saving') : t('form.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}
