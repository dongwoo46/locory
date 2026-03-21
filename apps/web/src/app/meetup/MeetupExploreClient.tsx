'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import BottomNav from '@/components/ui/BottomNav'
import NotificationBell from '@/components/ui/NotificationBell'
import { CITIES } from '@/lib/utils/districts'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const ACTIVITIES = [
  { value: 'chat' }, { value: 'food' }, { value: 'photo' },
  { value: 'tour' }, { value: 'drink' }, { value: 'game' }, { value: 'other' },
]
const VIBES = [{ value: 'casual' }, { value: 'fun' }, { value: 'serious' }]
const WANTED_GENDER_OPTS = [{ value: 'female' }, { value: 'male' }, { value: 'any' }]
const DATE_OPTS = ['today', 'week', 'weekend'] as const

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

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface MeetupCard {
  id: string
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
  places: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profiles: any
}

interface Props {
  userId: string
  profile: {
    id: string
    gender: string | null
    birth_date: string | null
    nationality: string | null
    is_public: boolean
    trust_score: number
    avatar_url: string | null
  } | null
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function MeetupExploreClient({ userId, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('meetup')
  const tCities = useTranslations('cities')

  const [meetups, setMeetups] = useState<MeetupCard[]>([])
  const [myJoins, setMyJoins] = useState<{ meetup_id: string; status: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // 필터 상태
  const [filterCity, setFilterCity] = useState<string | null>(null)
  const [filterActivity, setFilterActivity] = useState<string | null>(null)
  const [filterVibe, setFilterVibe] = useState<string | null>(null)
  const [filterGender, setFilterGender] = useState<string | null>(null)
  const [filterDate, setFilterDate] = useState<string | null>(null)

  const activeFilterCount = [filterActivity, filterVibe, filterGender, filterDate].filter(Boolean).length

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoading(true)
    const now = new Date().toISOString()
    const [meetupsRes, joinsRes] = await Promise.all([
      supabase
        .from('place_meetups')
        .select(`
          id, scheduled_at, status, host_count, host_gender, host_age_groups,
          activities, vibe, description, wanted_gender, wanted_age_groups, wanted_count,
          places!place_id (id, name, city, district, category),
          profiles!organizer_id (id, nickname, avatar_url, gender, birth_date)
        `)
        .eq('status', 'open')
        .is('deleted_at', null)
        .gt('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(50),
      supabase
        .from('meetup_joins')
        .select('meetup_id, status')
        .eq('applicant_id', userId),
    ])
    setMeetups((meetupsRes.data as MeetupCard[]) ?? [])
    setMyJoins((joinsRes.data as { meetup_id: string; status: string }[]) ?? [])
    setLoading(false)
  }

  // ── 클라이언트 사이드 필터 ────────────────────────────────────────────────

  const filtered = meetups.filter((m) => {
    if (filterCity && m.places?.city !== filterCity) return false
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

  function resetFilters() {
    setFilterActivity(null)
    setFilterVibe(null)
    setFilterGender(null)
    setFilterDate(null)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 bg-white z-40">
        <div className="max-w-lg mx-auto px-4">
          {/* 타이틀 행 */}
          <div className="flex items-center h-14">
            <h1 className="flex-1 text-base font-bold text-gray-900">{t('explore.title')}</h1>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => router.push('/meetups')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-gray-200 text-gray-600 bg-white"
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t('explore.myMeetupsBtn')}
              </button>
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  activeFilterCount > 0 ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                {t('explore.filterActivity').split('').slice(0, 0).join('') || '필터'}
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-white text-gray-900 text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <NotificationBell userId={userId} />
            </div>
          </div>

          {/* 도시 탭 */}
          <div className="flex gap-0 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-0.5">
            <button
              onClick={() => setFilterCity(null)}
              className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                filterCity === null ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
              }`}
            >
              {t('explore.all')}
            </button>
            {CITIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setFilterCity(c.value === filterCity ? null : c.value)}
                className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  filterCity === c.value ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
                }`}
              >
                {tCities(c.value)}
              </button>
            ))}
          </div>
        </div>
        <div className="border-b border-gray-100" />
      </header>

      {/* 컨텐츠 */}
      <div className="pt-28 pb-20">
        <div className="px-4 py-4 flex flex-col gap-3 max-w-lg mx-auto">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">{t('explore.empty')}</div>
          ) : (
            filtered.map((m) => {
              const myJoin = myJoins.find((j) => j.meetup_id === m.id)
              return (
                <MeetupExploreCard
                  key={m.id}
                  meetup={m}
                  myJoin={myJoin ?? null}
                  userId={userId}
                  onClick={() => router.push(`/meetup/${m.id}`)}
                />
              )
            })
          )}
        </div>
      </div>

      <BottomNav avatarUrl={profile?.avatar_url ?? null} />

      {/* 필터 모달 */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="relative bg-white rounded-t-2xl max-w-lg mx-auto w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="text-sm font-bold text-gray-900">필터</span>
              <button
                onClick={resetFilters}
                className="text-xs text-gray-400 underline"
              >
                초기화
              </button>
            </div>

            {/* 활동 */}
            <div className="px-4 pb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">{t('explore.filterActivity')}</p>
              <div className="flex flex-wrap gap-2">
                {ACTIVITIES.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => toggleFilter(a.value, filterActivity, setFilterActivity)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      filterActivity === a.value
                        ? 'bg-blue-600 text-white border-transparent'
                        : 'border-gray-200 text-gray-600 bg-white'
                    }`}
                  >
                    {t(`activity.${a.value}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* 분위기 */}
            <div className="px-4 pb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">{t('explore.filterVibe')}</p>
              <div className="flex flex-wrap gap-2">
                {VIBES.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => toggleFilter(v.value, filterVibe, setFilterVibe)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      filterVibe === v.value
                        ? 'bg-purple-600 text-white border-transparent'
                        : 'border-gray-200 text-gray-600 bg-white'
                    }`}
                  >
                    {t(`vibe.${v.value}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* 원하는 상대 성별 */}
            <div className="px-4 pb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">{t('explore.filterWantedGender')}</p>
              <div className="flex flex-wrap gap-2">
                {WANTED_GENDER_OPTS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => toggleFilter(g.value, filterGender, setFilterGender)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      filterGender === g.value
                        ? 'bg-pink-600 text-white border-transparent'
                        : 'border-gray-200 text-gray-600 bg-white'
                    }`}
                  >
                    {t(`gender.${g.value}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* 날짜 */}
            <div className="px-4 pb-6">
              <p className="text-xs font-semibold text-gray-500 mb-2">{t('explore.filterDate')}</p>
              <div className="flex flex-wrap gap-2">
                {DATE_OPTS.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleFilter(d, filterDate, setFilterDate)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
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

            {/* 적용 버튼 */}
            <div className="px-4 pb-8">
              <button
                onClick={() => setShowFilters(false)}
                className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold"
              >
                {filtered.length}개 모임 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 카드 컴포넌트 ────────────────────────────────────────────────────────────

function MeetupExploreCard({
  meetup: m,
  myJoin,
  userId,
  onClick,
}: {
  meetup: MeetupCard
  myJoin: { meetup_id: string; status: string } | null
  userId: string
  onClick: () => void
}) {
  const t = useTranslations('meetup')
  const isMyMeetup = m.profiles?.id === userId

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-2xl p-4 cursor-pointer active:bg-gray-50 shadow-sm"
    >
      {/* 상단: 장소 + 시간 */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-base font-bold text-gray-900">{m.places?.name ?? '-'}</span>
            {isMyMeetup && (
              <span className="text-xs text-blue-500 font-medium">{t('myMeetup')}</span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {m.places?.city ? <span>{m.places.city}</span> : null}
            {m.places?.district ? <span> · {m.places.district}</span> : null}
          </p>
        </div>
        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap ml-2">
          {formatScheduled(m.scheduled_at)}
        </span>
      </div>

      {/* 주최자 */}
      <div className="flex items-center gap-1.5 mb-2">
        {m.profiles?.avatar_url ? (
          <img src={m.profiles.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
            {m.profiles?.nickname?.[0] ?? '?'}
          </div>
        )}
        <span className="text-xs text-gray-500">{m.profiles?.nickname ?? '-'}</span>
      </div>

      {/* 우리 측 + 활동 */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
          {m.host_count}명
        </span>
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

      {/* 원하는 상대 */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-gray-400">{t('wantedLabel')}</span>
        <span className="text-xs text-gray-600">{t(`gender.${m.wanted_gender}`)}</span>
        {m.wanted_age_groups?.map((a: string) => (
          <span key={a} className="text-xs text-gray-600">{t(`ageGroup.${a}`)}</span>
        ))}
        {m.wanted_count && (
          <span className="text-xs text-gray-600">{m.wanted_count}명</span>
        )}
      </div>

      {/* 한마디 */}
      {m.description && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-1">{m.description}</p>
      )}

      {/* 신청 상태 배지 */}
      {myJoin && (
        <div className="mt-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              myJoin.status === 'accepted'
                ? 'bg-green-100 text-green-700'
                : myJoin.status === 'rejected'
                  ? 'bg-red-50 text-red-500'
                  : myJoin.status === 'unmatched'
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-yellow-50 text-yellow-600'
            }`}
          >
            {myJoin.status === 'accepted'
              ? t('status.accepted')
              : myJoin.status === 'rejected'
                ? t('status.rejected')
                : myJoin.status === 'unmatched'
                  ? t('status.unmatched')
                  : t('status.pending')}
          </span>
        </div>
      )}
    </div>
  )
}
