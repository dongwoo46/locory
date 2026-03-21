'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLikeStore } from '@/store/likeStore'
import { useFeedFilterStore } from '@/store/filterStore'
import { useUserInteractions } from '@/hooks/useUserInteractions'
import { useRouter } from 'next/navigation'
import { useDragScroll } from '@/hooks/useDragScroll'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/ui/BottomNav'
import PostGrid from '@/components/feed/PostGrid'
import NotificationBell from '@/components/ui/NotificationBell'
import PlaceAddSheet from '@/components/place/PlaceAddSheet'
import { useTranslations } from 'next-intl'
import { CITIES, getMainDistricts, getExtraDistricts, getDistricts } from '@/lib/utils/districts'

const OTHER_DISTRICT = '__other__'
import type { City } from '@/types/database'


const NATIONALITY_CHIPS = [
  { code: 'KR', flag: '🇰🇷' }, { code: 'JP', flag: '🇯🇵' },
  { code: 'US', flag: '🇺🇸' }, { code: 'CN', flag: '🇨🇳' },
  { code: 'TW', flag: '🇹🇼' }, { code: 'GB', flag: '🇬🇧' },
  { code: 'FR', flag: '🇫🇷' }, { code: 'DE', flag: '🇩🇪' },
  { code: 'IT', flag: '🇮🇹' }, { code: 'ES', flag: '🇪🇸' },
  { code: 'AU', flag: '🇦🇺' }, { code: 'RU', flag: '🇷🇺' },
  { code: 'OTHER', flag: '🌍' },
]

const CATEGORY_EMOJIS: Record<string, string> = {
  cafe: '☕', restaurant: '🍽️', photospot: '📸', street: '🚶',
  bar: '🍻', culture: '🎨', nature: '🌿', shopping: '🛍️',
}

const CATEGORY_COLORS: Record<string, string> = {
  cafe: '#795548', restaurant: '#F44336', photospot: '#9C27B0',
  bar: '#FF9800', culture: '#2196F3', nature: '#4CAF50',
  shopping: '#E91E63', street: '#607D8B',
}

const RATING_COLORS: Record<string, string> = {
  must_go: '#B090D4', worth_it: '#6AC0D4', neutral: '#90C490', not_great: '#E8C070',
}


interface Props {
  profile: { nickname: string; nationality: string; avatar_url: string | null; id: string } | null
  userId: string
  followingUserIds: string[]
}

export default function FeedClient({ profile, userId, followingUserIds }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const t = useTranslations('feed')
  const tPost = useTranslations('post')
  const tProfile = useTranslations('profile')
  const tCities = useTranslations('cities')
  const tDistricts = useTranslations('districts')

  const {
    city, district, feedTab, postType, sortBy, minRating,
    categories, hiddenOnly, nationalities, ageRange, genderFilter,
    setFilter, resetFilter,
  } = useFeedFilterStore()

  const [showFilters, setShowFilters] = useState(false)
  const [showPlaceAdd, setShowPlaceAdd] = useState(false)
  const [viewMode, setViewMode] = useState<'posts' | 'places'>('posts')

  const categoriesSet = new Set(categories)
  const nationalitiesSet = new Set(nationalities)

  const allDistricts = city ? [...getMainDistricts(city), ...getExtraDistricts(city)] : []
  const cityScroll = useDragScroll()
  const districtScroll = useDragScroll()

  // user interactions — RPC 1번으로 통합 (post_saves + place_saves + post_likes + place_likes)
  const { data: interactions } = useUserInteractions(userId)
  const savedPlaceIds = interactions?.savedPlaceIds ?? new Set<string>()
  const likedPlaceIds = interactions?.likedPlaceIds ?? new Set<string>()

  const { togglePlaceLike: storePlaceLike, togglePlaceSave: storePlaceSave } = useLikeStore()

  // 피드 포스트 — city/district/feedTab 변경 시 자동 캐싱
  // all탭: places!inner embedded join으로 2-step 쿼리를 1개로 통합
  const { data: rawPosts, isLoading: loading } = useQuery({
    queryKey: ['feed-posts', feedTab, city, district, followingUserIds.join(',')],
    queryFn: async () => {
      const SELECT = `
        id, type, rating, memo, photos, recommended_menu, created_at,
        profiles!user_id (id, nickname, nationality, avatar_url, trust_score, gender, birth_date),
        places!place_id!inner (id, name, category, district, city, place_type),
        post_likes (count),
        post_saves (count)
      `
      if (feedTab === 'following') {
        if (followingUserIds.length === 0) return []
        const { data } = await supabase
          .from('posts').select(SELECT)
          .eq('is_public', true)
          .is('deleted_at', null)
          .in('user_id', followingUserIds)
          .order('created_at', { ascending: false })
          .limit(60)
        return data || []
      }

      let q = supabase.from('posts').select(SELECT)
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(60)

      if (city) {
        q = (q as any).eq('places.city', city)
        if (district && district !== OTHER_DISTRICT) {
          q = (q as any).eq('places.district', district)
        } else if (district === OTHER_DISTRICT) {
          const knownDistricts = getDistricts(city).map(d => d.value)
          q = (q as any).or(
            `district.is.null,district.not.in.(${knownDistricts.join(',')})`,
            { referencedTable: 'places' }
          )
        }
      }

      const { data } = await q
      return data || []
    },
    staleTime: 60 * 1000,
  })
  const posts = (rawPosts ?? []) as any[]

  async function togglePlaceSave(placeId: string) {
    const cur = (queryClient.getQueryData(['user-saved', userId]) as any)?.savedPlaceIds as Set<string> | undefined
    const saved = cur?.has(placeId) ?? savedPlaceIds.has(placeId)
    storePlaceSave(placeId)
    queryClient.setQueryData(['user-saved', userId], (old: any) => {
      if (!old) return old
      const newSet = new Set(old.savedPlaceIds)
      saved ? newSet.delete(placeId) : newSet.add(placeId)
      return { ...old, savedPlaceIds: newSet }
    })
    if (saved) {
      await supabase.from('place_saves').delete().eq('user_id', userId).eq('place_id', placeId)
    } else {
      await supabase.from('place_saves').insert({ user_id: userId, place_id: placeId })
    }
  }

  async function togglePlaceLike(placeId: string) {
    const cur = (queryClient.getQueryData(['user-saved', userId]) as any)?.likedPlaceIds as Set<string> | undefined
    const liked = cur?.has(placeId) ?? likedPlaceIds.has(placeId)
    storePlaceLike(placeId)
    queryClient.setQueryData(['user-saved', userId], (old: any) => {
      if (!old) return old
      const newSet = new Set(old.likedPlaceIds)
      liked ? newSet.delete(placeId) : newSet.add(placeId)
      return { ...old, likedPlaceIds: newSet }
    })
    if (liked) {
      await supabase.from('place_likes').delete().eq('user_id', userId).eq('place_id', placeId)
    } else {
      await supabase.from('place_likes').insert({ user_id: userId, place_id: placeId })
    }
  }

  function selectCity(c: City | null) { setFilter({ city: c, district: null }) }
  function toggleCategory(cat: string) {
    const next = new Set(categoriesSet)
    next.has(cat) ? next.delete(cat) : next.add(cat)
    setFilter({ categories: Array.from(next) })
  }
  function toggleNationality(nat: string) {
    const next = new Set(nationalitiesSet)
    next.has(nat) ? next.delete(nat) : next.add(nat)
    setFilter({ nationalities: Array.from(next) })
  }

  // 클라이언트 필터링
  const filteredPosts = posts
    .filter(p => postType === 'all' || p.type === postType)
    .filter(p => {
      if (minRating == null) return true
      if (p.type !== 'visited' || !p.rating) return false
      const score: Record<string, number> = { must_go: 4, worth_it: 3, neutral: 2, not_great: 1 }
      return (score[p.rating] || 0) >= minRating
    })
    .filter(p => categoriesSet.size === 0 || categoriesSet.has(p.places?.category))
    .filter(p => !hiddenOnly || p.places?.place_type === 'hidden_spot')
    .filter(p => nationalitiesSet.size === 0 || nationalitiesSet.has(p.profiles?.nationality))
    .filter(p => !genderFilter || p.profiles?.gender === genderFilter)
    .filter(p => {
      if (!ageRange) return true
      const bd = p.profiles?.birth_date
      if (!bd) return false
      const age = new Date().getFullYear() - new Date(bd).getFullYear()
      if (ageRange === '10s') return age < 20
      if (ageRange === '20s') return age >= 20 && age < 30
      if (ageRange === '30s') return age >= 30 && age < 40
      if (ageRange === '40s+') return age >= 40
      return true
    })

  // 정렬
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortBy === 'likes') return (parseInt(b.post_likes?.[0]?.count) || 0) - (parseInt(a.post_likes?.[0]?.count) || 0)
    if (sortBy === 'saves') return (parseInt(b.post_saves?.[0]?.count) || 0) - (parseInt(a.post_saves?.[0]?.count) || 0)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // 장소 뷰
  const placesFromPosts = (() => {
    const map = new Map<string, { id: string; name: string; category: string; city: string; district: string | null; postCount: number }>()
    for (const p of filteredPosts) {
      const place = p.places
      if (!place?.id) continue
      if (!map.has(place.id)) {
        map.set(place.id, { id: place.id, name: place.name, category: place.category, city: place.city, district: place.district, postCount: 0 })
      }
      map.get(place.id)!.postCount++
    }
    return Array.from(map.values()).sort((a, b) => b.postCount - a.postCount)
  })()

  const activeFilterCount = [
    feedTab !== 'all',
    postType !== 'all',
    sortBy !== 'latest',
    minRating != null,
    categoriesSet.size > 0,
    hiddenOnly,
    nationalitiesSet.size > 0,
    ageRange != null,
    genderFilter != null,
  ].filter(Boolean).length

  const hasDistrict = !!city

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 bg-white z-40">
        <div className="max-w-lg mx-auto px-4 pt-3">

          {/* 헤더: + | Locory (중앙) | 필터 + 알림 */}
          <div className="flex items-center mb-2 h-14">
            {/* 왼쪽: + 버튼 */}
            <button
              onClick={() => setShowPlaceAdd(true)}
              className="p-2 -ml-1 text-gray-700 shrink-0"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            {/* 중앙: 로고 */}
            <h1 className="flex-1 flex justify-center">
              <img src="/logo40.png" alt="Locory" className="h-full w-auto max-h-14" />
            </h1>
            {/* 오른쪽: 필터 + 알림 */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  activeFilterCount > 0 ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                {t('filter')}
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
          <div
            ref={cityScroll.ref}
            onMouseDown={cityScroll.onMouseDown}
            onMouseMove={cityScroll.onMouseMove}
            onMouseUp={cityScroll.onMouseUp}
            onMouseLeave={cityScroll.onMouseLeave}
            className="flex gap-0 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-0.5 select-none"
          >
            <button
              onClick={() => selectCity(null)}
              className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                city === null ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
              }`}
            >
              {t('all')}
            </button>
            {CITIES.map(c => (
              <button
                key={c.value}
                onClick={() => selectCity(c.value)}
                className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  city === c.value ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
                }`}
              >
                {tCities(c.value)}
              </button>
            ))}
          </div>

          {/* 동네 칩 */}
          {hasDistrict && (
            <div
              ref={districtScroll.ref}
              onMouseDown={districtScroll.onMouseDown}
              onMouseMove={districtScroll.onMouseMove}
              onMouseUp={districtScroll.onMouseUp}
              onMouseLeave={districtScroll.onMouseLeave}
              className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 py-2 select-none"
            >
              <button
                onClick={() => setFilter({ district: null })}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !district ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {t('all')}
              </button>
              {allDistricts.map(d => (
                <button
                  key={d.value}
                  onClick={() => setFilter({ district: d.value })}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    district === d.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {city ? tDistricts(`${city}.${d.value}`) : d.label}
                </button>
              ))}
              <button
                onClick={() => setFilter({ district: OTHER_DISTRICT })}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  district === OTHER_DISTRICT ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {t('other')}
              </button>
            </div>
          )}

        </div>
      </header>

      {/* 필터 모달 */}
      {showFilters && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl flex flex-col"
            style={{ maxHeight: '75vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 고정 헤더: 제목 + 초기화 + 적용 */}
            <div className="shrink-0 px-4 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">{t('filter')}</h2>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={resetFilter}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 border border-gray-200"
                >
                  {t('filterReset')}
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-gray-900 text-white"
                >
                  {t('filterApply')}
                </button>
              </div>
            </div>

            {/* 스크롤 가능한 필터 내용 */}
            <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-4">

              {/* 보기 모드: 포스팅/장소 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterViewMode')}</p>
                <div className="flex gap-2">
                  {([
                    { key: 'posts', label: t('viewModePost') },
                    { key: 'places', label: t('viewModePlace') },
                  ] as const).map(opt => (
                    <button key={opt.key} onClick={() => setViewMode(opt.key)}
                      className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${viewMode === opt.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 전체/팔로잉 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterFeed')}</p>
                <div className="flex gap-2">
                  {([
                    { key: 'all', label: t('all') },
                    { key: 'following', label: t('followingTab') },
                  ] as const).map(opt => (
                    <button key={opt.key} onClick={() => setFilter({ feedTab: opt.key })}
                      className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${feedTab === opt.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 정렬 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterSort')}</p>
                <div className="flex gap-2">
                  {([
                    { key: 'latest', label: t('filterSortLatest') },
                    { key: 'likes', label: t('filterSortLikes') },
                    { key: 'saves', label: t('filterSortSaves') },
                  ] as const).map(opt => (
                    <button key={opt.key} onClick={() => setFilter({ sortBy: opt.key })}
                      className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${sortBy === opt.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 방문/가고싶어 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterPostType')}</p>
                <div className="flex gap-2">
                  {([
                    { key: 'all', label: t('all') },
                    { key: 'visited', label: t('filterPostVisited') },
                    { key: 'want', label: t('filterPostWant') },
                  ] as const).map(opt => (
                    <button key={opt.key} onClick={() => {
                      setFilter({ postType: opt.key })
                      if (opt.key !== 'visited') setFilter({ minRating: null })
                    }}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${postType === opt.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 평점 (방문 후기일때) */}
              {postType !== 'want' && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterRatingAbove')}</p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setFilter({ minRating: null })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${minRating == null ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {t('all')}
                    </button>
                    {[
                      { score: 4, key: 'must_go' },
                      { score: 3, key: 'worth_it' },
                      { score: 2, key: 'neutral' },
                    ].map(r => (
                      <button key={r.score} onClick={() => setFilter({ minRating: minRating === r.score ? null : r.score })}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                        style={minRating === r.score
                          ? { backgroundColor: RATING_COLORS[r.key], color: 'white', borderColor: 'transparent' }
                          : { backgroundColor: 'white', color: '#4B5563', borderColor: '#E5E7EB' }
                        }>
                        {tPost(`rating.${r.key}`)} {t('filterAboveSuffix')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 카테고리 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterCategory')}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(CATEGORY_COLORS).map(cat => (
                    <button key={cat} onClick={() => toggleCategory(cat)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${categoriesSet.has(cat) ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                      style={categoriesSet.has(cat) ? { backgroundColor: CATEGORY_COLORS[cat] } : {}}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoriesSet.has(cat) ? 'white' : CATEGORY_COLORS[cat] }} />
                      {tPost(`category.${cat}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* 현지인 추천 */}
              <div>
                <button
                  onClick={() => setFilter({ hiddenOnly: !hiddenOnly })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${hiddenOnly ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {t('filterLocalOnly')}
                </button>
              </div>

              {/* 국적 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterNationality')}</p>
                <div className="flex flex-wrap gap-2">
                  {NATIONALITY_CHIPS.map(({ code, flag }) => (
                    <button key={code} onClick={() => toggleNationality(code)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${nationalitiesSet.has(code) ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {flag} {code}
                    </button>
                  ))}
                </div>
              </div>

              {/* 성별 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterGender')}</p>
                <div className="flex gap-2">
                  {([null, 'female', 'male'] as const).map(g => (
                    <button key={String(g)} onClick={() => setFilter({ genderFilter: g })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${genderFilter === g ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {g === null ? t('all') : tProfile(`gender.${g}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* 나잇대 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterAge')}</p>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: null, label: t('all') },
                    { key: '10s', label: t('filterAge10s') },
                    { key: '20s', label: t('filterAge20s') },
                    { key: '30s', label: t('filterAge30s') },
                    { key: '40s+', label: t('filterAge40s') },
                  ] as const).map(opt => (
                    <button key={String(opt.key)} onClick={() => setFilter({ ageRange: opt.key })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${ageRange === opt.key ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      <main
        className="max-w-lg mx-auto pb-24"
        style={{ paddingTop: hasDistrict ? '156px' : '116px' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : sortedPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-gray-400 text-sm">{t('noPostsTitle')}</p>
            <p className="text-gray-300 text-xs">{t('noPostsSubtitle')}</p>
          </div>
        ) : viewMode === 'places' ? (
          <div className="flex flex-col gap-2">
            {placesFromPosts.map(place => (
              <div
                key={place.id}
                className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3"
              >
                <button
                  onClick={() => router.push(`/place/${place.id}`)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span className="text-xl shrink-0">{CATEGORY_EMOJIS[place.category] || '📍'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{place.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {tPost(`category.${place.category}`)}
                      {place.district && place.district !== 'other' ? ` · ${tDistricts(`${place.city}.${place.district}`)}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{place.postCount}개</span>
                </button>
                <div className="flex items-center gap-2 shrink-0 pl-2">
                  <button onClick={() => togglePlaceLike(place.id)}>
                    <svg width="18" height="18" viewBox="0 0 24 24"
                      fill={likedPlaceIds.has(place.id) ? '#ef4444' : 'none'}
                      stroke={likedPlaceIds.has(place.id) ? '#ef4444' : '#9CA3AF'}
                      strokeWidth={2}>
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                  <button onClick={() => togglePlaceSave(place.id)}>
                    <svg width="18" height="18" viewBox="0 0 24 24"
                      fill={savedPlaceIds.has(place.id) ? '#111' : 'none'}
                      stroke={savedPlaceIds.has(place.id) ? '#111' : '#9CA3AF'}
                      strokeWidth={2}>
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <PostGrid
            posts={sortedPosts}
            userId={userId}
            onDelete={(postId) => {
              queryClient.setQueryData(
                ['feed-posts', feedTab, city, district, followingUserIds.join(',')],
                (old: any[]) => old?.filter(p => p.id !== postId) ?? []
              )
            }}
          />
        )}
      </main>

      <BottomNav avatarUrl={profile?.avatar_url ?? null} />
      {showPlaceAdd && (
        <PlaceAddSheet
          userId={userId}
          onClose={() => setShowPlaceAdd(false)}
          onSaved={() => setShowPlaceAdd(false)}
        />
      )}
    </div>
  )
}