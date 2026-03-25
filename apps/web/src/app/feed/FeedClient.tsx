'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useLikeStore } from '@/store/likeStore'
import { useFeedFilterStore } from '@/store/filterStore'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useDragScroll } from '@/hooks/useDragScroll'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/ui/BottomNav'
import { useTranslations } from 'next-intl'
import { CITIES, getMainDistricts, getExtraDistricts, getDistricts } from '@/lib/utils/districts'

const OTHER_DISTRICT = '__other__'
import type { City } from '@/types/database'

const PlaceAddSheet = dynamic(() => import('@/components/place/PlaceAddSheet'), { ssr: false })
const PostGrid = dynamic(() => import('@/components/feed/PostGrid'), { ssr: false })
const NotificationBell = dynamic(() => import('@/components/ui/NotificationBell'), { ssr: false })

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
  cafe: '☕',
  restaurant: '🍽️',
  photospot: '📸',
  street: '🚶',
  bar: '🍻',
  culture: '🎨',
  nature: '🌿',
  shopping: '🛍️',
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

interface InteractionPayload {
  savedPostIds: string[]
  savedPlaceIds: string[]
  likedPostIds: string[]
  likedPlaceIds: string[]
}

interface FeedPagePayload {
  posts: any[]
  interactions: InteractionPayload
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
  const [showActionSheet, setShowActionSheet] = useState(false)
  const [showPlaceAdd, setShowPlaceAdd] = useState(false)
  const [viewMode, setViewMode] = useState<'posts' | 'places'>('posts')
  const [filtersHydrated, setFiltersHydrated] = useState(useFeedFilterStore.persist.hasHydrated())

  const categoriesSet = useMemo(() => new Set(categories), [categories])
  const nationalitiesSet = useMemo(() => new Set(nationalities), [nationalities])

  const allDistricts = useMemo(
    () => (city ? [...getMainDistricts(city), ...getExtraDistricts(city)] : []),
    [city]
  )
  const cityScroll = useDragScroll()
  const districtScroll = useDragScroll()

  useEffect(() => {
    const unsubscribe = useFeedFilterStore.persist.onFinishHydration(() => {
      setFiltersHydrated(true)
    })
    setFiltersHydrated(useFeedFilterStore.persist.hasHydrated())
    return () => unsubscribe()
  }, [])

  const [savedPlaceIds, setSavedPlaceIds] = useState(new Set<string>())
  const [likedPlaceIds, setLikedPlaceIds] = useState(new Set<string>())
  const [interactionsInitialized, setInteractionsInitialized] = useState(false)
  const { init: initLikeStore, togglePlaceLike: storePlaceLike, togglePlaceSave: storePlaceSave } = useLikeStore()

  // 피드 목록 + 상호작용 데이터를 RPC 1회로 조회
  // city/district/feedTab 변경 시 queryKey 기준으로 자동 캐시 분리
  const FEED_PAGE_SIZE = 15
  const INITIAL_RENDER_POSTS = 15
  const RENDER_POST_CHUNK = 15
  const INITIAL_RENDER_PLACES = 15
  const RENDER_PLACE_CHUNK = 15
  const feedQueryKey = ['feed-posts', feedTab, city, district, followingUserIds.join(',')] as const
  const {
    data: rawPosts,
    isLoading: loading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    isError,
  } = useInfiniteQuery({
    queryKey: feedQueryKey,
    enabled: filtersHydrated,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialPageParam: null as { createdAt: string; id: string } | null,
    queryFn: async ({ pageParam }): Promise<FeedPagePayload> => {
      const knownDistricts =
        city && district === OTHER_DISTRICT ? getDistricts(city).map(d => d.value) : []
      const { data, error } = await supabase.rpc('get_feed_with_interactions', {
        p_user_id: userId,
        p_feed_tab: feedTab,
        p_following_ids: followingUserIds,
        p_city: city,
        p_district: district,
        p_known_districts: knownDistricts,
        p_limit: FEED_PAGE_SIZE,
        p_cursor_created_at: pageParam?.createdAt ?? null,
        p_cursor_id: pageParam?.id ?? null,
      })
      if (error) throw error
      const payload = (data ?? {}) as FeedPagePayload
      return {
        posts: payload.posts ?? [],
        interactions: payload.interactions ?? {
          savedPostIds: [],
          savedPlaceIds: [],
          likedPostIds: [],
          likedPlaceIds: [],
        },
      }
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.posts.length < FEED_PAGE_SIZE) return undefined
      const last = lastPage.posts[lastPage.posts.length - 1]
      if (!last?.created_at || !last?.id) return undefined
      return { createdAt: last.created_at, id: last.id }
    },
    staleTime: 60 * 1000,
  })
  const posts = (((rawPosts?.pages ?? []).flatMap(page => page.posts)) ?? []) as any[]
  const [renderPostCount, setRenderPostCount] = useState(INITIAL_RENDER_POSTS)
  const [renderPlaceCount, setRenderPlaceCount] = useState(INITIAL_RENDER_PLACES)
  const [hasUserScrolled, setHasUserScrolled] = useState(false)

  useEffect(() => {
    setInteractionsInitialized(false)
  }, [feedTab, city, district, userId, followingUserIds.join(',')])

  useEffect(() => {
    if (interactionsInitialized) return
    const firstPage = rawPosts?.pages?.[0]
    if (!firstPage?.interactions) return
    const interactions = firstPage.interactions
    setSavedPlaceIds(new Set(interactions.savedPlaceIds ?? []))
    setLikedPlaceIds(new Set(interactions.likedPlaceIds ?? []))
    initLikeStore({
      likedPostIds: new Set(interactions.likedPostIds ?? []),
      likedPlaceIds: new Set(interactions.likedPlaceIds ?? []),
      savedPostIds: new Set(interactions.savedPostIds ?? []),
      savedPlaceIds: new Set(interactions.savedPlaceIds ?? []),
      likeCountMap: {},
    })
    setInteractionsInitialized(true)
  }, [rawPosts?.pages, initLikeStore, interactionsInitialized])

  async function togglePlaceSave(placeId: string) {
    const saved = savedPlaceIds.has(placeId)
    storePlaceSave(placeId)
    setSavedPlaceIds(prev => {
      const newSet = new Set(prev)
      saved ? newSet.delete(placeId) : newSet.add(placeId)
      return newSet
    })
    if (saved) {
      await supabase.from('place_saves').delete().eq('user_id', userId).eq('place_id', placeId)
    } else {
      await supabase.from('place_saves').insert({ user_id: userId, place_id: placeId })
    }
  }

  async function togglePlaceLike(placeId: string) {
    const liked = likedPlaceIds.has(placeId)
    storePlaceLike(placeId)
    setLikedPlaceIds(prev => {
      const newSet = new Set(prev)
      liked ? newSet.delete(placeId) : newSet.add(placeId)
      return newSet
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

  const filteredPosts = useMemo(() => {
    return posts
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
  }, [posts, postType, minRating, categoriesSet, hiddenOnly, nationalitiesSet, genderFilter, ageRange])

  const sortedPosts = useMemo(() => {
    return [...filteredPosts].sort((a, b) => {
      if (sortBy === 'likes') return (parseInt(b.post_likes?.[0]?.count) || 0) - (parseInt(a.post_likes?.[0]?.count) || 0)
      if (sortBy === 'saves') return (parseInt(b.post_saves?.[0]?.count) || 0) - (parseInt(a.post_saves?.[0]?.count) || 0)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [filteredPosts, sortBy])

  useEffect(() => {
    setRenderPostCount(INITIAL_RENDER_POSTS)
    setRenderPlaceCount(INITIAL_RENDER_PLACES)
  }, [feedTab, city, district, postType, sortBy, minRating, categories, hiddenOnly, nationalities, ageRange, genderFilter])

  const visiblePosts = useMemo(
    () => sortedPosts.slice(0, renderPostCount),
    [sortedPosts, renderPostCount]
  )
  const canRenderMorePosts = renderPostCount < sortedPosts.length

  const placesFromPosts = useMemo(() => {
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
  }, [filteredPosts])

  const visiblePlaces = useMemo(
    () => placesFromPosts.slice(0, renderPlaceCount),
    [placesFromPosts, renderPlaceCount]
  )
  const canRenderMorePlaces = renderPlaceCount < placesFromPosts.length
  const canLoadMorePosts = canRenderMorePosts || !!hasNextPage
  const canLoadMorePlaces = canRenderMorePlaces || !!hasNextPage

  const handleLoadMore = useCallback(() => {
    if (viewMode === 'places') {
      if (canRenderMorePlaces) {
        setRenderPlaceCount(prev => Math.min(prev + RENDER_PLACE_CHUNK, placesFromPosts.length))
        return
      }
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
      return
    }
    if (canRenderMorePosts) {
      setRenderPostCount(prev => Math.min(prev + RENDER_POST_CHUNK, sortedPosts.length))
      return
    }
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [viewMode, canRenderMorePlaces, placesFromPosts.length, hasNextPage, isFetchingNextPage, fetchNextPage, canRenderMorePosts, sortedPosts.length])

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset
      if (scrollY > 8) setHasUserScrolled(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const needsMoreInView = viewMode === 'places' ? canLoadMorePlaces : canLoadMorePosts
    if (!needsMoreInView) return
    if (isFetchingNextPage) return
    if (sortedPosts.length === 0) return
    if (!hasUserScrolled) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const scrollY = window.scrollY || window.pageYOffset
        if (scrollY <= 0) return
        const viewportBottom = window.innerHeight + scrollY
        const fullHeight = document.documentElement.scrollHeight
        const isNearBottom = viewportBottom >= fullHeight - 240
        if (!isNearBottom) return
        handleLoadMore()
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [isFetchingNextPage, sortedPosts.length, viewMode, canLoadMorePosts, canLoadMorePlaces, handleLoadMore, hasUserScrolled])

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

          {/* 헤더: 추가 버튼 | 로고 | 필터/알림 */}
          <div className="flex items-center mb-2 h-16">
            {/* 왼쪽: 추가 버튼 */}
            <button
              onClick={() => setShowActionSheet(true)}
              className="p-2 -ml-1 text-gray-700 shrink-0"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            {/* 중앙: 로고 */}
            <h1 className="flex-1 flex justify-center">
              <img src="/logo40.png" alt="Locory" className="h-16 w-auto" />
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

          {/* 동네(구역) 탭 */}
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

            {/* 스크롤 가능한 필터 본문 */}
            <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-4">

              {/* 보기 모드: 피드/장소 */}
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

              {/* 평점(방문일 때만) */}
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

              {/* 로컬 추천만 */}
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

              {/* 연령대 */}
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
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-gray-400 text-sm">{t('loadError')}</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white"
            >
              {t('retry')}
            </button>
          </div>
        ) : sortedPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-gray-400 text-sm">{t('noPostsTitle')}</p>
            <p className="text-gray-300 text-xs">{t('noPostsSubtitle')}</p>
            {canLoadMorePosts && (
              <button
                onClick={handleLoadMore}
                disabled={isFetchingNextPage}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white disabled:opacity-50"
              >
                {isFetchingNextPage ? t('loadingMore') : t('loadMore')}
              </button>
            )}
          </div>
        ) : viewMode === 'places' ? (
          <div className="flex flex-col gap-2">
            {visiblePlaces.map(place => (
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
                  <span className="text-xs text-gray-400 shrink-0">{place.postCount} posts</span>
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
            posts={visiblePosts}
            userId={userId}
            onDelete={(postId) => {
              queryClient.setQueryData(
                feedQueryKey,
                (old: any) => {
                  if (!old) return old
                  const pages = (old.pages ?? []).map((page: any) => ({
                    ...page,
                    posts: (page.posts ?? []).filter((p: any) => p.id !== postId),
                  }))
                  return { ...old, pages }
                }
              )
            }}
          />
        )}

        {((viewMode === 'places' && canLoadMorePlaces && placesFromPosts.length > 0) ||
          (viewMode === 'posts' && canLoadMorePosts && sortedPosts.length > 0)) && (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <button
              onClick={handleLoadMore}
              disabled={isFetchingNextPage}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white disabled:opacity-50"
            >
              {isFetchingNextPage ? t('loadingMore') : t('loadMore')}
            </button>
            <p className="text-xs text-gray-400">{t('loadMoreHint')}</p>
          </div>
        )}
      </main>

      <BottomNav avatarUrl={profile?.avatar_url ?? null} />

      {/* 추가 액션 시트 */}
      {showActionSheet && (
        <>
          <div className="fixed inset-0 bg-black/40 z-60" onClick={() => setShowActionSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-70 bg-white rounded-t-2xl pb-10 pt-3 max-w-lg mx-auto">
            <div className="flex justify-center mb-4">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex flex-col gap-2 px-4">
              <button
                onClick={() => { setShowActionSheet(false); router.push('/upload') }}
                className="flex items-center gap-4 px-4 py-4 bg-gray-50 rounded-2xl text-left"
              >
                <div className="w-11 h-11 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
                  <svg width="20" height="20" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('addFeed')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('addFeedDesc')}</p>
                </div>
              </button>
              <button
                onClick={() => { setShowActionSheet(false); setShowPlaceAdd(true) }}
                className="flex items-center gap-4 px-4 py-4 bg-gray-50 rounded-2xl text-left"
              >
                <div className="w-11 h-11 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
                  <svg width="20" height="20" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('addPlace')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('addPlaceDesc')}</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

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

