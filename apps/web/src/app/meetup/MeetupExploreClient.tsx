'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import BottomNav from '@/components/ui/BottomNav'
import NotificationBell from '@/components/ui/NotificationBell'
import { CITIES } from '@/lib/utils/districts'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

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
  title: string | null
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
  const tFeed = useTranslations('feed')
  const tCities = useTranslations('cities')
  const tDistricts = useTranslations('districts')

  const [meetups, setMeetups] = useState<MeetupCard[]>([])
  const [myJoins, setMyJoins] = useState<{ meetup_id: string; status: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // 필터 상태
  const [filterCity, setFilterCity] = useState<string | null>(null)
  const [filterActivity, setFilterActivity] = useState<string | null>(null)
  const [filterVibe, setFilterVibe] = useState<string | null>(null)
  const [filterGender, setFilterGender] = useState<string | null>(null)
  const [filterDate, setFilterDate] = useState<string | null>(null)

  const activeFilterCount = [filterActivity, filterVibe, filterGender, filterDate].filter(Boolean).length

  async function fetchMeetups(pageNum: number, city: string | null) {
    const now = new Date().toISOString()
    let query = supabase
      .from('place_meetups')
      .select(`
        id, title, scheduled_at, status, host_count, host_gender, host_age_groups,
        activities, vibe, description, wanted_gender, wanted_age_groups, wanted_count,
        organizer_id,
        places!place_id (id, name, city, district, category),
        profiles!organizer_id (id, nickname, avatar_url, gender, birth_date)
      `)
      .eq('status', 'open')
      .is('deleted_at', null)
      .gt('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (city) query = query.eq('places.city', city)
    return query
  }

  async function loadInitial(city: string | null) {
    setLoading(true)
    setPage(0)
    setHasMore(true)
    const [meetupsRes, joinsRes] = await Promise.all([
      fetchMeetups(0, city),
      supabase.from('meetup_joins').select('meetup_id, status').eq('applicant_id', userId),
    ])
    const items = (meetupsRes.data as MeetupCard[]) ?? []
    setMeetups(items)
    setMyJoins((joinsRes.data as { meetup_id: string; status: string }[]) ?? [])
    if (items.length < PAGE_SIZE) setHasMore(false)
    setLoading(false)
  }

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    const res = await fetchMeetups(nextPage, filterCity)
    const items = (res.data as MeetupCard[]) ?? []
    setMeetups(prev => [...prev, ...items])
    setPage(nextPage)
    if (items.length < PAGE_SIZE) setHasMore(false)
    setLoadingMore(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, page, filterCity])

  // 초기 로드 + 도시 필터 변경 시 재로드
  useEffect(() => {
    loadInitial(filterCity)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCity])

  // IntersectionObserver로 무한스크롤
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  // 클라이언트 사이드 필터 (activity/vibe/gender/date)
  const filtered = meetups.filter((m) => {
    if (filterActivity && !m.activities.includes(filterActivity)) return false
    if (filterVibe && m.vibe !== filterVibe) return false
    if (filterGender && m.wanted_gender !== filterGender) return false
    if (filterDate === 'today' && !isToday(m.scheduled_at)) return false
    if (filterDate === 'week' && !isThisWeek(m.scheduled_at)) return false
    if (filterDate === 'weekend' && !isWeekend(m.scheduled_at)) return false
    return true
  })

  function getDistrictLabel(city: string, district: string): string {
    try { return tDistricts(`${city}.${district}` as Parameters<typeof tDistricts>[0]) }
    catch { return district }
  }

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
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm animate-pulse">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">{t('explore.empty')}</div>
          ) : (
            <>
              {filtered.map((m) => {
                const myJoin = myJoins.find((j) => j.meetup_id === m.id)
                return (
                  <MeetupExploreCard
                    key={m.id}
                    meetup={m}
                    myJoin={myJoin ?? null}
                    userId={userId}
                    getDistrictLabel={getDistrictLabel}
                    onClick={() => router.push(`/meetup/${m.id}`)}
                  />
                )
              })}
              {/* 무한스크롤 sentinel */}
              <div ref={sentinelRef} className="h-4" />
              {loadingMore && (
                <div className="text-center py-4 text-gray-400 text-xs">
                  {t('explore.loading') || '...'}
                </div>
              )}
            </>
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
              <span className="text-sm font-bold text-gray-900">{tFeed('filter')}</span>
              <button
                onClick={resetFilters}
                className="text-xs text-gray-400 underline"
              >
                {tFeed('filterReset')}
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
                {tFeed('filterApply')}
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
  getDistrictLabel,
  onClick,
}: {
  meetup: MeetupCard
  myJoin: { meetup_id: string; status: string } | null
  userId: string
  getDistrictLabel: (city: string, district: string) => string
  onClick: () => void
}) {
  const t = useTranslations('meetup')
  const tCities = useTranslations('cities')
  const isMyMeetup = m.profiles?.id === userId

  const cityLabel = m.places?.city ? tCities(m.places.city as Parameters<typeof tCities>[0]) : null
  const districtLabel = m.places?.city && m.places?.district
    ? getDistrictLabel(m.places.city, m.places.district)
    : null

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-2xl p-4 cursor-pointer active:bg-gray-50 shadow-sm"
    >
      {/* 장소명 + 날짜 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {m.title && <p className="text-sm font-bold text-gray-900 truncate mb-0.5">{m.title}</p>}
          <p className={`truncate ${m.title ? 'text-xs text-gray-500' : 'text-sm font-bold text-gray-900'}`}>{m.places?.name ?? '-'}</p>
          {(cityLabel || districtLabel) && (
            <p className="text-xs text-gray-400 mt-0.5">
              {[cityLabel, districtLabel].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap ml-3 mt-0.5">
          {formatScheduled(m.scheduled_at)}
        </span>
      </div>

      {/* 주최자 정보 — 아바타 왼쪽 크게 */}
      <div className="flex gap-3">
        <div className="shrink-0">
          {m.profiles?.avatar_url ? (
            <img src={m.profiles.avatar_url} className="w-11 h-11 rounded-full object-cover" alt="" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-base font-semibold text-gray-400">
              {m.profiles?.nickname?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {/* 닉네임 */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm font-bold text-gray-900">{m.profiles?.nickname ?? '-'}</span>
            {isMyMeetup && (
              <span className="text-xs text-blue-500 font-medium">{t('myMeetup')}</span>
            )}
          </div>
          {/* 내 정보 칩 */}
          <div className="flex flex-wrap gap-1 mb-1.5">
            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">{m.host_count}명</span>
            {m.host_gender && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                {t(`gender.${m.host_gender}` as Parameters<typeof t>[0])}
              </span>
            )}
            {m.host_age_groups.map((a: string) => (
              <span key={a} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                {t(`ageGroup.${a}` as Parameters<typeof t>[0])}
              </span>
            ))}
            {m.activities.slice(0, 2).map((a: string) => (
              <span key={a} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600">
                {t(`activity.${a}` as Parameters<typeof t>[0])}
              </span>
            ))}
            {m.vibe && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600">
                {t(`vibe.${m.vibe}` as Parameters<typeof t>[0])}
              </span>
            )}
          </div>
          {/* 원하는 상대 */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-gray-400">{t('wantedLabel')}</span>
            <span className="text-xs text-gray-600">
              {t(`gender.${m.wanted_gender}` as Parameters<typeof t>[0])}
            </span>
            {m.wanted_age_groups?.map((a: string) => (
              <span key={a} className="text-xs text-gray-600">
                {t(`ageGroup.${a}` as Parameters<typeof t>[0])}
              </span>
            ))}
            {m.wanted_count && <span className="text-xs text-gray-600">{m.wanted_count}명</span>}
          </div>
          {/* 한마디 */}
          {m.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{m.description}</p>
          )}
          {/* 신청 상태 배지 */}
          {myJoin && (
            <div className="mt-1.5">
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
      </div>
    </div>
  )
}
