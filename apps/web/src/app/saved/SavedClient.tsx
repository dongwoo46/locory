'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import BottomNav from '@/components/ui/BottomNav'
import NotificationBell from '@/components/ui/NotificationBell'
import PlaceAddSheet from '@/components/place/PlaceAddSheet'
import PostGrid from '@/components/feed/PostGrid'
import { CITIES, getMainDistricts, getExtraDistricts } from '@/lib/utils/districts'
import type { City } from '@/types/database'

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: '☕', restaurant: '🍽️', photospot: '📸', bar: '🍺',
  culture: '🎨', nature: '🌿', shopping: '🛍️', street: '📍',
}

const CATEGORY_LABEL: Record<string, string> = {
  cafe: '카페', restaurant: '맛집', photospot: '포토스팟', bar: '바',
  culture: '문화', nature: '자연', shopping: '쇼핑', street: '거리',
}

const CATEGORIES = Object.keys(CATEGORY_LABEL)

const RATING_LABEL: Record<string, string> = {
  must_go: '강추', worth_it: '좋아요', neutral: '보통', not_great: '별로', never: '비추',
}

interface Props {
  userId: string
  followingUserIds: string[]
  avatarUrl?: string | null
}

export default function SavedClient({ userId, followingUserIds, avatarUrl = null }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('saved')
  const tPost = useTranslations('post')
  const tCities = useTranslations('cities')
  const tDistricts = useTranslations('districts')
  const tFeed = useTranslations('feed')

  const { data: savedData } = useQuery({
    queryKey: ['saved-data', userId],
    queryFn: async () => {
      const followingQuery = followingUserIds.length > 0
        ? supabase.from('place_saves')
            .select('id, user_id, created_at, places!place_id(id, name, category, city, district, place_type), profiles!user_id(id, nickname, avatar_url)')
            .in('user_id', followingUserIds).order('created_at', { ascending: false }).limit(50)
        : Promise.resolve({ data: [] })

      const [
        { data: savedPlacesRaw },
        { data: savedPostsRaw },
        { data: fData },
      ] = await Promise.all([
        supabase.from('place_saves')
          .select('id, created_at, places!place_id(id, name, category, city, district, place_type, lat, lng)')
          .eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('post_saves')
          .select('id, created_at, posts!post_id(id, type, rating, memo, photos, created_at, profiles!user_id(id, nickname, nationality, avatar_url, trust_score), places!place_id(id, name, category, district, city, place_type), post_likes(count))')
          .eq('user_id', userId).order('created_at', { ascending: false }),
        followingQuery,
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const places = (savedPlacesRaw || []).map((s: any) => s.places).filter(Boolean)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posts = (savedPostsRaw || []).map((s: any) => s.posts).filter(Boolean).filter((p: any) => !p.deleted_at)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const followingPlaces = (fData || []).filter((s: any) => s.places).map((s: any) => ({ ...s.places, savedBy: s.profiles }))
      return { places, posts, followingPlaces }
    },
    staleTime: 3 * 60 * 1000,
  })

  const [tab, setTab] = useState<'places' | 'posts' | 'following'>('places')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [savedPlacesOverride, setSavedPlacesOverride] = useState<any[] | null>(null)
  const savedPlaces = savedPlacesOverride ?? savedData?.places ?? []
  const posts = savedData?.posts ?? []
  const followingPlaces = savedData?.followingPlaces ?? []
  const [showFilters, setShowFilters] = useState(false)
  const [showPlaceAdd, setShowPlaceAdd] = useState(false)

  // 도시/동네 공통 필터 (헤더)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const allDistricts = selectedCity ? [...getMainDistricts(selectedCity), ...getExtraDistricts(selectedCity)] : []

  function selectCity(c: City | null) { setSelectedCity(c); setSelectedDistrict(null) }

  // 카테고리/기타 필터 (모달)
  const [placeCategory, setPlaceCategory] = useState<string | null>(null)
  const [placeHiddenOnly, setPlaceHiddenOnly] = useState(false)
  const [postCategory, setPostCategory] = useState<string | null>(null)
  const [postRating, setPostRating] = useState<string | null>(null)
  const [postType, setPostType] = useState<'visited' | 'want' | null>(null)
  const [followingCategory, setFollowingCategory] = useState<string | null>(null)

  async function unsavePlace(placeId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSavedPlacesOverride(savedPlaces.filter((pl: any) => pl.id !== placeId))
    await supabase.from('place_saves').delete().eq('user_id', userId).eq('place_id', placeId)
  }

  // 필터 적용 (도시/동네는 공통으로 모든 탭에 적용)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function matchesCityDistrict(place: any) {
    if (selectedCity && place.city !== selectedCity) return false
    if (selectedDistrict && place.district !== selectedDistrict) return false
    return true
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredPlaces = savedPlaces.filter((p: any) => {
    if (!matchesCityDistrict(p)) return false
    if (placeCategory && p.category !== placeCategory) return false
    if (placeHiddenOnly && p.place_type !== 'hidden_spot') return false
    return true
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredPosts = posts.filter((p: any) => {
    if (!matchesCityDistrict(p.places)) return false
    if (postCategory && p.places?.category !== postCategory) return false
    if (postRating && p.rating !== postRating) return false
    if (postType && p.type !== postType) return false
    return true
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredFollowing = followingPlaces.filter((p: any) => {
    if (!matchesCityDistrict(p)) return false
    if (followingCategory && p.category !== followingCategory) return false
    return true
  })

  // 활성 필터 수 (도시/동네 제외 — 헤더에 따로 표시)
  const activeFilterCount = tab === 'places'
    ? [placeCategory, placeHiddenOnly || null].filter(Boolean).length
    : tab === 'posts'
    ? [postCategory, postRating, postType].filter(Boolean).length
    : [followingCategory].filter(Boolean).length

  function resetFilters() {
    if (tab === 'places') { setPlaceCategory(null); setPlaceHiddenOnly(false) }
    else if (tab === 'posts') { setPostCategory(null); setPostRating(null); setPostType(null) }
    else { setFollowingCategory(null) }
  }

  // 헤더 높이: 로고+필터(56) + 탭(44) + 도시(40) + 동네(40 if selected) = pt
  const headerPt = selectedCity ? 'pt-[180px]' : 'pt-[140px]'

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 bg-white z-40 border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4">
          {/* 상단 바 */}
          <div className="flex items-center h-12 gap-2">
            {/* 왼쪽: + 버튼 */}
            <button onClick={() => setShowPlaceAdd(true)} className="p-2 -ml-1 text-gray-700">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            {/* 중앙: 로고 */}
            <h1 className="flex-1 flex justify-center">
              <img src="/logo40.png" alt="Locory" className="h-full w-auto max-h-12" />
            </h1>
            {/* 오른쪽: 필터 + 알림 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  activeFilterCount > 0 ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
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

          {/* 탭 */}
          <div className="flex border-b border-gray-100">
            {(['places', 'posts', 'following'] as const).map(key => (
              <button
                key={key}
                onClick={() => { setTab(key); setShowFilters(false) }}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
                }`}
              >
                {t(key === 'places' ? 'placesTab' : key === 'posts' ? 'postsTab' : 'followingTab')}
              </button>
            ))}
          </div>

          {/* 도시 가로 스크롤 */}
          <div className="flex overflow-x-auto scrollbar-hide -mx-4 px-4 py-2 gap-0">
            <button
              onClick={() => selectCity(null)}
              className={`shrink-0 px-4 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                selectedCity === null ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
              }`}
            >
              {tFeed('all')}
            </button>
            {CITIES.map(c => (
              <button
                key={c.value}
                onClick={() => selectCity(c.value)}
                className={`shrink-0 px-4 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                  selectedCity === c.value ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
                }`}
              >
                {tCities(c.value)}
              </button>
            ))}
          </div>

          {/* 동네 칩 (도시 선택 시) */}
          {selectedCity && allDistricts.length > 0 && (
            <div className="flex overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 gap-2">
              <button
                onClick={() => setSelectedDistrict(null)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  !selectedDistrict ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tFeed('all')}
              </button>
              {allDistricts.map(d => (
                <button
                  key={d.value}
                  onClick={() => setSelectedDistrict(selectedDistrict === d.value ? null : d.value)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedDistrict === d.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tDistricts(`${selectedCity}.${d.value}`)}
                </button>
              ))}
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
            className="bg-white w-full max-w-lg rounded-2xl max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-4 flex flex-col gap-4">

              {/* 카테고리 */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('category')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => {
                    const active = tab === 'posts' ? postCategory === cat
                      : tab === 'following' ? followingCategory === cat
                      : placeCategory === cat
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          if (tab === 'posts') setPostCategory(postCategory === cat ? null : cat)
                          else if (tab === 'following') setFollowingCategory(followingCategory === cat ? null : cat)
                          else setPlaceCategory(placeCategory === cat ? null : cat)
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        <span>{CATEGORY_EMOJI[cat]}</span>
                        {CATEGORY_LABEL[cat]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* places: 히든스팟 */}
              {tab === 'places' && (
                <button
                  onClick={() => setPlaceHiddenOnly(v => !v)}
                  className={`self-start flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    placeHiddenOnly ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {t('hiddenOnly')}
                </button>
              )}

              {/* posts: 평점 + 타입 */}
              {tab === 'posts' && (
                <>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('rating')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(RATING_LABEL).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setPostRating(postRating === val ? null : val)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            postRating === val ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('type')}</p>
                    <div className="flex gap-1.5">
                      {(['visited', 'want'] as const).map(tp => (
                        <button
                          key={tp}
                          onClick={() => setPostType(postType === tp ? null : tp)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            postType === tp ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          {tp === 'visited' ? t('visited') : t('want')}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 초기화 */}
              {activeFilterCount > 0 && (
                <button onClick={resetFilters} className="self-start text-xs text-gray-400 underline">
                  {t('reset')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className={`max-w-lg mx-auto ${headerPt} pb-24`}>
        {tab === 'places' ? (
          filteredPlaces.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-gray-400">
                {savedPlaces.length === 0 ? t('noPlaces') : t('noResults')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {filteredPlaces.map((place: any) => (
                <div
                  key={place.id}
                  onClick={() => router.push(`/place/${place.id}`)}
                  className="px-4 py-4 text-left flex items-center gap-3 cursor-pointer active:bg-gray-50"
                >
                  <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-lg">
                    {CATEGORY_EMOJI[place.category] ?? '📍'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {tCities(place.city)}{place.district && place.district !== 'other' ? ` · ${tDistricts(`${place.city}.${place.district}`)}` : ''}
                      {place.place_type === 'hidden_spot' && ` · ${tPost('hiddenSpot')}`}
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); unsavePlace(place.id) }}
                    className="shrink-0 p-1.5 text-gray-300 hover:text-gray-500"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#111" stroke="#111" strokeWidth={2}>
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )
        ) : tab === 'posts' ? (
          filteredPosts.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-gray-400">
                {posts.length === 0 ? t('noPosts') : t('noResults')}
              </p>
            </div>
          ) : (
            <PostGrid posts={filteredPosts} userId={userId} />
          )
        ) : (
          filteredFollowing.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-gray-400">
                {followingPlaces.length === 0 ? t('noFollowingPlaces') : t('noResults')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {filteredFollowing.map((place: any, i: number) => (
                <button
                  key={`${place.id}-${i}`}
                  onClick={() => router.push(`/place/${place.id}`)}
                  className="px-4 py-4 text-left flex items-center gap-3 active:bg-gray-50 w-full"
                >
                  <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-lg">
                    {CATEGORY_EMOJI[place.category] ?? '📍'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {tCities(place.city)}{place.district && place.district !== 'other' ? ` · ${tDistricts(`${place.city}.${place.district}`)}` : ''}
                    </p>
                    {place.savedBy && (
                      <p className="text-[10px] text-gray-300 mt-0.5">{place.savedBy.nickname}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </main>

      <BottomNav avatarUrl={avatarUrl} />
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
