'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import BottomNav from '@/components/ui/BottomNav'
import NotificationBell from '@/components/ui/NotificationBell'
import PostGrid from '@/components/feed/PostGrid'

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

const CITY_LABEL: Record<string, string> = {
  seoul: '서울', busan: '부산', jeju: '제주', gyeongju: '경주',
  jeonju: '전주', gangneung: '강릉', sokcho: '속초', yeosu: '여수', incheon: '인천',
}

interface Props {
  userId: string
}

export default function SavedClient({ userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('saved')
  const tPost = useTranslations('post')
  const tCities = useTranslations('cities')
  const tDistricts = useTranslations('districts')

  // 저장 데이터 — 3분 캐싱 (재방문 시 즉시 로드)
  const { data: savedData } = useQuery({
    queryKey: ['saved-data', userId],
    queryFn: async () => {
      const { data: followingData } = await supabase
        .from('follows').select('following_id').eq('follower_id', userId).eq('status', 'accepted')
      const followingIds = (followingData || []).map((f: any) => f.following_id as string)

      const [{ data: savedPlacesRaw }, { data: savedPostsRaw }] = await Promise.all([
        supabase.from('place_saves')
          .select('id, created_at, places!place_id(id, name, category, city, district, place_type, lat, lng)')
          .eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('post_saves')
          .select('id, created_at, posts!post_id(id, type, rating, memo, photos, created_at, profiles!user_id(id, nickname, nationality, avatar_url, trust_score), places!place_id(id, name, category, district, city, place_type), post_likes(count))')
          .eq('user_id', userId).order('created_at', { ascending: false }),
      ])

      let followingPlacesRaw: any[] = []
      if (followingIds.length > 0) {
        const { data: fData } = await supabase
          .from('place_saves')
          .select('id, user_id, created_at, places!place_id(id, name, category, city, district, place_type), profiles!user_id(id, nickname, avatar_url)')
          .in('user_id', followingIds).order('created_at', { ascending: false }).limit(50)
        followingPlacesRaw = (fData || []).filter((s: any) => s.places).map((s: any) => ({ ...s.places, savedBy: s.profiles }))
      }

      const places = (savedPlacesRaw || []).map((s: any) => s.places).filter(Boolean)
      const posts = (savedPostsRaw || []).map((s: any) => s.posts).filter(Boolean)
      return {
        places,
        posts,
        savedPostIds: new Set(posts.map((p: any) => p.id as string)),
        followingPlaces: followingPlacesRaw,
      }
    },
    staleTime: 3 * 60 * 1000,
  })

  const [tab, setTab] = useState<'places' | 'posts' | 'following'>('places')
  const [savedPlacesOverride, setSavedPlacesOverride] = useState<any[] | null>(null)
  const savedPlaces = savedPlacesOverride ?? savedData?.places ?? []
  const posts = savedData?.posts ?? []
  const savedPostIds = savedData?.savedPostIds ?? new Set<string>()
  const followingPlaces = savedData?.followingPlaces ?? []
  const [showFilters, setShowFilters] = useState(false)

  // places 탭 필터
  const [placeCategory, setPlaceCategory] = useState<string | null>(null)
  const [placeCity, setPlaceCity] = useState<string | null>(null)
  const [placeHiddenOnly, setPlaceHiddenOnly] = useState(false)

  // posts 탭 필터
  const [postCategory, setPostCategory] = useState<string | null>(null)
  const [postRating, setPostRating] = useState<string | null>(null)
  const [postType, setPostType] = useState<'visited' | 'want' | null>(null)

  // following 탭 필터
  const [followingCategory, setFollowingCategory] = useState<string | null>(null)
  const [followingCity, setFollowingCity] = useState<string | null>(null)

  async function unsavePlace(placeId: string) {
    setSavedPlacesOverride(savedPlaces.filter((pl: any) => pl.id !== placeId))
    await supabase.from('place_saves').delete().eq('user_id', userId).eq('place_id', placeId)
  }

  // 필터 적용
  const filteredPlaces = savedPlaces.filter(p => {
    if (placeCategory && p.category !== placeCategory) return false
    if (placeCity && p.city !== placeCity) return false
    if (placeHiddenOnly && p.place_type !== 'hidden_spot') return false
    return true
  })

  const filteredPosts = posts.filter(p => {
    if (postCategory && p.places?.category !== postCategory) return false
    if (postRating && p.rating !== postRating) return false
    if (postType && p.type !== postType) return false
    return true
  })

  const filteredFollowing = followingPlaces.filter(p => {
    if (followingCategory && p.category !== followingCategory) return false
    if (followingCity && p.city !== followingCity) return false
    return true
  })

  // 활성 필터 수
  const activeFilterCount = tab === 'places'
    ? [placeCategory, placeCity, placeHiddenOnly || null].filter(Boolean).length
    : tab === 'posts'
    ? [postCategory, postRating, postType].filter(Boolean).length
    : [followingCategory, followingCity].filter(Boolean).length

  function resetFilters() {
    if (tab === 'places') { setPlaceCategory(null); setPlaceCity(null); setPlaceHiddenOnly(false) }
    else if (tab === 'posts') { setPostCategory(null); setPostRating(null); setPostType(null) }
    else { setFollowingCategory(null); setFollowingCity(null) }
  }

  // 도시 목록 (해당 탭 데이터에 있는 도시만)
  const availableCities = tab === 'places'
    ? [...new Set(savedPlaces.map((p: any) => p.city).filter(Boolean))]
    : [...new Set(followingPlaces.map((p: any) => p.city).filter(Boolean))]

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 bg-white z-40">
        <div className="max-w-lg mx-auto px-4">
          {/* 상단 바 */}
          <div className="flex items-center h-14 gap-2">
            <h1 className="flex-1">
              <img src="/logo40.png" alt="Locory" className="h-16 w-auto" />
            </h1>
            <div className="flex items-center gap-2">
              {/* 필터 버튼 */}
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  activeFilterCount > 0
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200'
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
          <div className="flex">
            {(['places', 'posts', 'following'] as const).map(key => (
              <button
                key={key}
                onClick={() => { setTab(key); setShowFilters(false) }}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  tab === key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
                }`}
              >
                {t(key === 'places' ? 'placesTab' : key === 'posts' ? 'postsTab' : 'followingTab')}
              </button>
            ))}
          </div>
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

            {/* places & following 공통: 카테고리 */}
            {(tab === 'places' || tab === 'following' || tab === 'posts') && (
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
            )}

            {/* places 탭 전용: 도시 + 히든스팟 */}
            {tab === 'places' && availableCities.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('city')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableCities.map((city: string) => (
                    <button
                      key={city}
                      onClick={() => setPlaceCity(placeCity === city ? null : city)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        placeCity === city ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {CITY_LABEL[city] ?? city}
                    </button>
                  ))}
                </div>
              </div>
            )}
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

            {/* posts 탭 전용: 평점 + 방문/가고싶어 */}
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

            {/* following 탭 전용: 도시 */}
            {tab === 'following' && availableCities.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('city')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableCities.map((city: string) => (
                    <button
                      key={city}
                      onClick={() => setFollowingCity(followingCity === city ? null : city)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        followingCity === city ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {CITY_LABEL[city] ?? city}
                    </button>
                  ))}
                </div>
              </div>
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

      <main className="max-w-lg mx-auto pt-28 pb-24">
        {tab === 'places' ? (
          filteredPlaces.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-gray-400">
                {savedPlaces.length === 0 ? t('noPlaces') : t('noResults')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
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
                      {tCities(place.city)}{place.district ? ` · ${tDistricts(`${place.city}.${place.district}`)}` : ''}
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
                      {tCities(place.city)}{place.district ? ` · ${tDistricts(`${place.city}.${place.district}`)}` : ''}
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

      <BottomNav />
    </div>
  )
}
