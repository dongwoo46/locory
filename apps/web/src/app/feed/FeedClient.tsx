'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useDragScroll } from '@/hooks/useDragScroll'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/ui/BottomNav'
import PostGrid from '@/components/feed/PostGrid'
import NotificationBell from '@/components/ui/NotificationBell'
import { useTranslations } from 'next-intl'
import { CITIES, getMainDistricts, getExtraDistricts, getDistricts } from '@/lib/utils/districts'

const OTHER_DISTRICT = '__other__'
import type { City } from '@/types/database'

const NATIONALITY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', JP: '🇯🇵', US: '🇺🇸', CN: '🇨🇳', TW: '🇹🇼',
  ES: '🇪🇸', RU: '🇷🇺', GB: '🇬🇧', FR: '🇫🇷', DE: '🇩🇪',
  IT: '🇮🇹', AU: '🇦🇺', OTHER: '🌍',
}

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

const CURRENT_YEAR = 2026

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

  const [city, setCity] = useState<City | null>(null)
  const [district, setDistrict] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [feedTab, setFeedTab] = useState<'all' | 'following'>('all')
  const [viewMode, setViewMode] = useState<'posts' | 'places'>('posts')
  const [postType, setPostType] = useState<'all' | 'visited' | 'want'>('all')
  const [sortBy, setSortBy] = useState<'latest' | 'likes' | 'saves'>('latest')
  const [minRating, setMinRating] = useState<number | null>(null)
  const [categories, setCategories] = useState<Set<string>>(new Set())
  const [hiddenOnly, setHiddenOnly] = useState(false)
  const [nationalities, setNationalities] = useState<Set<string>>(new Set())
  const [ageRange, setAgeRange] = useState<string | null>(null)
  const [genderFilter, setGenderFilter] = useState<string | null>(null)

  const allDistricts = city ? [...getMainDistricts(city), ...getExtraDistricts(city)] : []
  const cityScroll = useDragScroll()
  const districtScroll = useDragScroll()

  // saved/liked 상태 — 5분 캐싱
  const { data: savedData } = useQuery({
    queryKey: ['user-saved', userId],
    queryFn: async () => {
      const [{ data: ps }, { data: pls }, { data: pl }, { data: pll }] = await Promise.all([
        supabase.from('post_saves').select('post_id').eq('user_id', userId),
        supabase.from('place_saves').select('place_id').eq('user_id', userId),
        supabase.from('post_likes').select('post_id').eq('user_id', userId),
        supabase.from('place_likes').select('place_id').eq('user_id', userId),
      ])
      return {
        savedPostIds: new Set((ps || []).map((s: any) => s.post_id)),
        savedPlaceIds: new Set((pls || []).map((s: any) => s.place_id)),
        likedPostIds: new Set((pl || []).map((s: any) => s.post_id)),
        likedPlaceIds: new Set((pll || []).map((s: any) => s.place_id)),
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  const savedPostIds = savedData?.savedPostIds ?? new Set<string>()
  const savedPlaceIds = savedData?.savedPlaceIds ?? new Set<string>()
  const likedPostIds = savedData?.likedPostIds ?? new Set<string>()
  const likedPlaceIds = savedData?.likedPlaceIds ?? new Set<string>()

  // 피드 포스트 — city/district/feedTab 변경 시 자동 캐싱
  const { data: rawPosts, isLoading: loading } = useQuery({
    queryKey: ['feed-posts', feedTab, city, district, followingUserIds.join(',')],
    queryFn: async () => {
      if (feedTab === 'following') {
        if (followingUserIds.length === 0) return []
        const { data } = await supabase
          .from('posts')
          .select(`
            id, type, rating, memo, photos, recommended_menu, created_at,
            profiles!user_id (id, nickname, nationality, avatar_url, trust_score, gender, birth_date),
            places!place_id (id, name, category, district, city, place_type),
            post_likes (count),
            post_saves (count)
          `)
          .eq('is_public', true)
          .in('user_id', followingUserIds)
          .order('created_at', { ascending: false })
          .limit(60)
        return data || []
      }

      let placesQuery = supabase.from('places').select('id')
      if (city) placesQuery = placesQuery.eq('city', city)
      if (city && district && district !== OTHER_DISTRICT) {
        placesQuery = placesQuery.eq('district', district)
      } else if (city && district === OTHER_DISTRICT) {
        const knownDistricts = getDistricts(city).map(d => d.value)
        placesQuery = placesQuery.or(`district.is.null,district.not.in.(${knownDistricts.join(',')})`)
      }
      const { data: matchedPlaces } = await placesQuery
      const placeIds = (matchedPlaces || []).map((p: any) => p.id)
      if (placeIds.length === 0) return []

      const { data } = await supabase
        .from('posts')
        .select(`
          id, type, rating, memo, photos, recommended_menu, created_at,
          profiles!user_id (id, nickname, nationality, avatar_url, trust_score, gender, birth_date),
          places!place_id (id, name, category, district, city, place_type),
          post_likes (count)
        `)
        .eq('is_public', true)
        .in('place_id', placeIds)
        .order('created_at', { ascending: false })
        .limit(60)
      return data || []
    },
    staleTime: 60 * 1000,
  })
  const posts = (rawPosts ?? []) as any[]

  async function togglePlaceSave(placeId: string) {
    const saved = savedPlaceIds.has(placeId)
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
    const liked = likedPlaceIds.has(placeId)
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

  function selectCity(c: City | null) { setCity(c); setDistrict(null) }
  function toggleCategory(cat: string) {
    setCategories(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n })
  }
  function toggleNationality(nat: string) {
    setNationalities(prev => { const n = new Set(prev); n.has(nat) ? n.delete(nat) : n.add(nat); return n })
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
    .filter(p => categories.size === 0 || categories.has(p.places?.category))
    .filter(p => !hiddenOnly || p.places?.place_type === 'hidden_spot')
    .filter(p => nationalities.size === 0 || nationalities.has(p.profiles?.nationality))
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
    if (sortBy === 'likes') return (b.post_likes?.[0]?.count || 0) - (a.post_likes?.[0]?.count || 0)
    if (sortBy === 'saves') return ((b as any).post_saves?.[0]?.count || 0) - ((a as any).post_saves?.[0]?.count || 0)
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
    categories.size > 0,
    hiddenOnly,
    nationalities.size > 0,
    ageRange != null,
  ].filter(Boolean).length

  const hasDistrict = !!city

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-40">
        <div className="max-w-lg mx-auto px-4 pt-3">

          {/* 로고 + 필터 + 프로필 */}
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold tracking-tight">
              <span style={{
                background: 'linear-gradient(135deg, #667eea 0%, #f093fb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Locory
              </span>
            </h1>
            <div className="flex items-center gap-2">
              {/* 포스팅/장소 pill */}
              <div className="flex items-center bg-gray-100 rounded-full p-0.5">
                {([
                  { key: 'posts', label: t('viewModePost') },
                  { key: 'places', label: t('viewModePlace') },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setViewMode(opt.key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      viewMode === opt.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* 필터 버튼 */}
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  activeFilterCount > 0 ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                {t('filter')}
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-white text-gray-900 text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {/* 알림 */}
              <NotificationBell userId={userId} />
              {/* 프로필 */}
              <button onClick={() => router.push('/profile/me')} className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-gray-100 overflow-hidden">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">{profile?.nickname?.[0]}</div>
                  }
                </div>
              </button>
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
                onClick={() => setDistrict(null)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !district ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {t('all')}
              </button>
              {allDistricts.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDistrict(d.value)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    district === d.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {city ? tDistricts(`${city}.${d.value}`) : d.label}
                </button>
              ))}
              <button
                onClick={() => setDistrict(OTHER_DISTRICT)}
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

      {/* 필터 바텀 시트 */}
      {showFilters && (
        <div
          className="fixed inset-0 bg-black/40 z-60 flex items-end justify-center"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl max-h-[80vh] overflow-y-auto pb-20"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1"><div className="w-8 h-1 bg-gray-200 rounded-full" /></div>
            <div className="px-4 pb-8 pt-2 flex flex-col gap-4">

              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">{t('filter')}</h2>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setFeedTab('all'); setPostType('all'); setSortBy('latest')
                      setMinRating(null); setCategories(new Set()); setHiddenOnly(false)
                      setNationalities(new Set()); setAgeRange(null)
                    }}
                    className="text-xs text-gray-400 underline"
                  >
                    {t('filterReset')}
                  </button>
                )}
              </div>

              {/* 전체/팔로잉 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2">{t('filterFeed')}</p>
                <div className="flex gap-2">
                  {([
                    { key: 'all', label: t('all') },
                    { key: 'following', label: t('followingTab') },
                  ] as const).map(opt => (
                    <button key={opt.key} onClick={() => setFeedTab(opt.key)}
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
                    <button key={opt.key} onClick={() => setSortBy(opt.key)}
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
                    <button key={opt.key} onClick={() => { setPostType(opt.key); if (opt.key !== 'visited') setMinRating(null) }}
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
                    <button onClick={() => setMinRating(null)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${minRating == null ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {t('all')}
                    </button>
                    {[
                      { score: 4, key: 'must_go' },
                      { score: 3, key: 'worth_it' },
                      { score: 2, key: 'neutral' },
                    ].map(r => (
                      <button key={r.score} onClick={() => setMinRating(minRating === r.score ? null : r.score)}
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
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${categories.has(cat) ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                      style={categories.has(cat) ? { backgroundColor: CATEGORY_COLORS[cat] } : {}}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categories.has(cat) ? 'white' : CATEGORY_COLORS[cat] }} />
                      {tPost(`category.${cat}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* 현지인 추천 */}
              <div>
                <button
                  onClick={() => setHiddenOnly(v => !v)}
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
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${nationalities.has(code) ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>
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
                    <button key={String(g)} onClick={() => setGenderFilter(g)}
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
                    <button key={String(opt.key)} onClick={() => setAgeRange(opt.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${ageRange === opt.key ? 'bg-gray-900 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => setShowFilters(false)}
                className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold">
                {t('filterApply')}
              </button>
            </div>
          </div>
        </div>
      )}

      <main
        className="max-w-lg mx-auto pb-24 px-4"
        style={{ paddingTop: hasDistrict ? '148px' : '108px' }}
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
                      {place.district ? ` · ${tDistricts(`${place.city}.${place.district}`)}` : ''}
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
            savedPostIds={savedPostIds}
            savedPlaceIds={savedPlaceIds}
            likedPostIds={likedPostIds}
            likedPlaceIds={likedPlaceIds}
          />
        )}
      </main>

      <BottomNav />
    </div>
  )
}
