'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useLikeStore } from '@/store/likeStore'
import { useFeedFilterStore } from '@/store/filterStore'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import PostGrid from '@/components/feed/PostGrid'
import { useTranslations } from 'next-intl'
import { POPULAR_NEIGHBORHOODS } from '@/lib/utils/districts'
import type { NeighborhoodFilter } from '@/store/filterStore'

type GenderFilterValue = 'female' | 'male' | null
type AgeRangeValue = '10s' | '20s' | '30s' | '40s+' | null

const PlaceAddSheet = dynamic(() => import('@/components/place/PlaceAddSheet'), { ssr: false })
const NotificationBell = dynamic(() => import('@/components/ui/NotificationBell'), {
  ssr: false,
  loading: () => <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />,
})
const BottomNav = dynamic(() => import('@/components/ui/BottomNav'), { ssr: false })
const FeedFilterModal = dynamic(() => import('./components/FeedFilterModal'), { ssr: false })
const FeedActionSheet = dynamic(() => import('./components/FeedActionSheet'), { ssr: false })

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
const FEED_FRAME_CLASS = 'mx-auto w-full max-w-lg'


interface Props {
  profile: { nickname: string; nationality: string; avatar_url: string | null; id: string } | null
  userId: string
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

export default function FeedClient({ profile, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const t = useTranslations('feed')
  const tPost = useTranslations('post')
  const tProfile = useTranslations('profile')
  const tNeighborhoods = useTranslations('neighborhoods')

  const {
    neighborhoods, feedTab, postType, sortBy, minRating,
    categories, hiddenOnly, nationalities, ageRange, genderFilter,
    setFilter, resetFilter,
  } = useFeedFilterStore()

  // 선택된 동네들의 union bounding box
  const unionBounds = useMemo(() => {
    if (neighborhoods.length === 0) return null
    return {
      latMin: Math.min(...neighborhoods.map(n => n.latMin)),
      latMax: Math.max(...neighborhoods.map(n => n.latMax)),
      lngMin: Math.min(...neighborhoods.map(n => n.lngMin)),
      lngMax: Math.max(...neighborhoods.map(n => n.lngMax)),
    }
  }, [neighborhoods])

  const neighborhoodsKey = neighborhoods.map(n => n.id).sort().join(',')

  const [showFilters, setShowFilters] = useState(false)
  const [showActionSheet, setShowActionSheet] = useState(false)
  const [showPlaceAdd, setShowPlaceAdd] = useState(false)
  const [viewMode, setViewMode] = useState<'posts' | 'places'>('posts')
  const getFiltersHydrated = () => {
    if (typeof useFeedFilterStore.persist?.hasHydrated === 'function') {
      return useFeedFilterStore.persist.hasHydrated()
    }
    return true
  }
  const [filtersHydrated, setFiltersHydrated] = useState(getFiltersHydrated)

  const categoriesSet = useMemo(() => new Set(categories), [categories])
  const nationalitiesSet = useMemo(() => new Set(nationalities), [nationalities])

  const searchRef = useRef<HTMLDivElement>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const [neighborhoodSearchQuery, setNeighborhoodSearchQuery] = useState('')
  const [neighborhoodSearchLoading, setNeighborhoodSearchLoading] = useState(false)

  useEffect(() => {
    if (typeof useFeedFilterStore.persist?.onFinishHydration === 'function') {
      const unsubscribe = useFeedFilterStore.persist.onFinishHydration(() => {
        setFiltersHydrated(true)
      })
      setFiltersHydrated(getFiltersHydrated())
      return () => unsubscribe()
    }
    setFiltersHydrated(true)
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
  const feedQueryKey = ['feed-posts', feedTab, neighborhoodsKey] as const
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
      const params = new URLSearchParams({
        feedTab,
        limit: String(FEED_PAGE_SIZE),
      })
      if (unionBounds) {
        params.set('latMin', String(unionBounds.latMin))
        params.set('latMax', String(unionBounds.latMax))
        params.set('lngMin', String(unionBounds.lngMin))
        params.set('lngMax', String(unionBounds.lngMax))
      }
      if (pageParam?.createdAt) params.set('cursorCreatedAt', pageParam.createdAt)
      if (pageParam?.id) params.set('cursorId', pageParam.id)

      const res = await fetch(`/api/feed?${params.toString()}`, { method: 'GET' })
      if (!res.ok) throw new Error('Failed to load feed')
      const payload = (await res.json()) as FeedPagePayload
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
  const posts = useMemo(
    () => ((rawPosts?.pages ?? []).flatMap(page => page.posts)) as any[],
    [rawPosts]
  )
  const [renderPostCount, setRenderPostCount] = useState(INITIAL_RENDER_POSTS)
  const [renderPlaceCount, setRenderPlaceCount] = useState(INITIAL_RENDER_PLACES)
  const [hasUserScrolled, setHasUserScrolled] = useState(false)

  useEffect(() => {
    setInteractionsInitialized(false)
  }, [feedTab, neighborhoodsKey, userId])

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

  function toggleNeighborhood(n: NeighborhoodFilter) {
    const exists = neighborhoods.some(nb => nb.id === n.id)
    if (exists) {
      setFilter({ neighborhoods: neighborhoods.filter(nb => nb.id !== n.id) })
    } else {
      setFilter({ neighborhoods: [...neighborhoods, n] })
    }
  }

  function removeNeighborhood(id: string) {
    setFilter({ neighborhoods: neighborhoods.filter(n => n.id !== id) })
  }

  function handleDropdownSelect(n: typeof allNeighborhoodsLabeled[number]) {
    toggleNeighborhood({ id: n.id, label: n.label, ...n.bounds })
    setNeighborhoodSearchQuery('')
    setSearchFocused(false)
  }

  async function searchNeighborhood() {
    const q = neighborhoodSearchQuery.trim()
    if (!q) return
    // Local match → select first
    if (dropdownItems.length > 0) {
      handleDropdownSelect(dropdownItems[0])
      return
    }
    // Geocoding fallback
    setNeighborhoodSearchLoading(true)
    try {
      const res = await fetch(`/api/places/geocode-forward?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.bounds) {
        toggleNeighborhood({ id: `search:${q}`, label: q, ...data.bounds })
        setNeighborhoodSearchQuery('')
        setSearchFocused(false)
      }
    } finally {
      setNeighborhoodSearchLoading(false)
    }
  }

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

  function setFeedTab(value: 'all' | 'following') {
    setFilter({ feedTab: value })
  }

  function setSortBy(value: 'latest' | 'likes' | 'saves') {
    setFilter({ sortBy: value })
  }

  function setPostType(value: 'all' | 'visited' | 'want') {
    setFilter({ postType: value })
    if (value !== 'visited') setFilter({ minRating: null })
  }

  function setGenderFilter(value: GenderFilterValue) {
    setFilter({ genderFilter: value })
  }

  function setAgeRange(value: AgeRangeValue) {
    setFilter({ ageRange: value })
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
  }, [feedTab, neighborhoodsKey, postType, sortBy, minRating, categories, hiddenOnly, nationalities, ageRange, genderFilter])

  // Ensure the first feed screen has enough cards even when client-side filters reduce first page results.
  useEffect(() => {
    if (viewMode !== 'posts') return
    if (!filtersHydrated || loading || isFetchingNextPage) return
    if (!hasNextPage) return
    if (sortedPosts.length >= INITIAL_RENDER_POSTS) return
    void fetchNextPage()
  }, [viewMode, filtersHydrated, loading, isFetchingNextPage, hasNextPage, sortedPosts.length, fetchNextPage])

  const visiblePosts = useMemo(
    () => sortedPosts.slice(0, renderPostCount),
    [sortedPosts, renderPostCount]
  )
  const canRenderMorePosts = renderPostCount < sortedPosts.length

  const placesFromPosts = useMemo(() => {
    const map = new Map<string, {
      id: string
      name: string
      category: string
      city: string
      district: string | null
      city_global?: string | null
      neighborhood_global?: string | null
      postCount: number
    }>()
    for (const p of filteredPosts) {
      const place = p.places
      if (!place?.id) continue
      if (!map.has(place.id)) {
        map.set(place.id, {
          id: place.id,
          name: place.name,
          category: place.category,
          city: place.city,
          district: place.district,
          city_global: place.city_global ?? null,
          neighborhood_global: place.neighborhood_global ?? null,
          postCount: 0,
        })
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

  const allNeighborhoodsLabeled = useMemo(
    () => POPULAR_NEIGHBORHOODS.map(n => ({ ...n, label: tNeighborhoods(n.id as any) })),
    [tNeighborhoods]
  )
  const featuredKR = useMemo(() => allNeighborhoodsLabeled.filter(n => n.featured && n.country === 'KR'), [allNeighborhoodsLabeled])
  const featuredJP = useMemo(() => allNeighborhoodsLabeled.filter(n => n.featured && n.country === 'JP'), [allNeighborhoodsLabeled])

  const dropdownItems = useMemo(() => {
    const q = neighborhoodSearchQuery.trim()
    if (!q) return []
    const qNorm = q.toLowerCase().replace(/\s+/g, '')
    return allNeighborhoodsLabeled.filter(n =>
      n.searchTokens.some(t => t.toLowerCase().replace(/\s+/g, '').includes(qNorm))
    )
  }, [neighborhoodSearchQuery, allNeighborhoodsLabeled])

  // 업로드 완료 후 피드로 돌아올 때 새로고침
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return
    const flag = sessionStorage.getItem('feed-needs-refresh')
    if (flag === '1') {
      sessionStorage.removeItem('feed-needs-refresh')
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] })
    }
  }, [queryClient])

  // Click-outside를 감지해 드롭다운 닫기
  useEffect(() => {
    if (!searchFocused) return
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [searchFocused])


  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 bg-white z-40">
        <div className={`${FEED_FRAME_CLASS} px-3 pt-1.5`}>

          {/* 헤더: 추가 버튼 | 로고 | 필터/알림 */}
          <div className="relative mb-0.5 flex h-12 items-center">
            {/* 왼쪽: 추가 버튼 */}
            <button
              onClick={() => setShowActionSheet(true)}
              className="-ml-1 shrink-0 p-1 text-gray-700 z-10"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            {/* 중앙: 로고 */}
            <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2">
                <Image
                  src="/logo40.png"
                  alt="Locory"
                  width={140}
                  height={64}
                  className="h-14 w-auto"
                  priority
                  sizes="140px"
                />
              </h1>
            {/* 오른쪽: 필터 + 알림 */}
            <div className="ml-auto flex items-center gap-1.5 shrink-0 z-10">
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-medium transition-colors border ${
                  activeFilterCount > 0 ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                {activeFilterCount > 0 && (
                  <span className="w-3.5 h-3.5 rounded-full bg-white text-gray-900 text-[9px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <NotificationBell userId={userId} />
            </div>
          </div>

          {/* 동네 검색 (드롭다운, 다중선택) */}
          <div ref={searchRef} className="relative pb-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-white transition-colors flex-wrap ${
                searchFocused ? 'border-gray-400' : 'border-gray-200'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2.5} className="shrink-0">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              {/* 선택된 동네 태그들 */}
              {neighborhoods.length > 0 && !neighborhoodSearchQuery && neighborhoods.map(nb => (
                <span key={nb.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-900 text-white text-[11px] font-medium shrink-0">
                  {nb.label}
                  <button
                    onMouseDown={e => { e.preventDefault(); removeNeighborhood(nb.id) }}
                    className="leading-none"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                value={neighborhoodSearchQuery}
                onChange={e => setNeighborhoodSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter') searchNeighborhood()
                  if (e.key === 'Escape') setSearchFocused(false)
                }}
                placeholder={neighborhoods.length === 0 ? t('searchNeighborhood') : ''}
                className="flex-1 text-xs outline-none bg-transparent placeholder-gray-400 min-w-0"
              />
              {neighborhoodSearchLoading && (
                <span className="text-gray-400 text-xs shrink-0">···</span>
              )}
              {neighborhoodSearchQuery && (
                <button
                  onMouseDown={e => { e.preventDefault(); setNeighborhoodSearchQuery('') }}
                  className="shrink-0 text-gray-300"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {/* 드롭다운 패널 */}
            {searchFocused && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
                {neighborhoodSearchQuery ? (
                  /* 검색 결과 */
                  <div className="max-h-56 overflow-y-auto">
                    {dropdownItems.length > 0 ? dropdownItems.map(n => {
                      const selected = neighborhoods.some(nb => nb.id === n.id)
                      return (
                        <button
                          key={n.id}
                          onMouseDown={e => { e.preventDefault(); handleDropdownSelect(n) }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${selected ? 'bg-gray-50' : ''}`}
                        >
                          <span className={`text-sm font-medium ${selected ? 'text-gray-900' : 'text-gray-700'}`}>{n.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{n.country === 'KR' ? t('groupKorea') : t('groupJapan')}</span>
                            {selected && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2.5}>
                                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    }) : (
                      <div className="px-4 py-3 text-xs text-gray-400 text-center">
                        {neighborhoodSearchLoading ? '···' : t('searchNeighborhood')}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 인기 동네 (한국 / 일본 그룹) */
                  <div className="p-3 space-y-3">
                    {/* 전체 초기화 */}
                    {neighborhoods.length > 0 && (
                      <button
                        onMouseDown={e => { e.preventDefault(); setFilter({ neighborhoods: [] }); setSearchFocused(false) }}
                        className="w-full text-xs text-gray-400 text-left px-0.5 underline underline-offset-2"
                      >
                        {t('all')} (초기화)
                      </button>
                    )}
                    {/* 한국 */}
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 mb-1.5 px-0.5">{t('groupKorea')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {featuredKR.map(n => {
                          const selected = neighborhoods.some(nb => nb.id === n.id)
                          return (
                            <button
                              key={n.id}
                              onMouseDown={e => { e.preventDefault(); handleDropdownSelect(n) }}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                            >
                              {n.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {/* 일본 */}
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 mb-1.5 px-0.5">{t('groupJapan')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {featuredJP.map(n => {
                          const selected = neighborhoods.some(nb => nb.id === n.id)
                          return (
                            <button
                              key={n.id}
                              onMouseDown={e => { e.preventDefault(); handleDropdownSelect(n) }}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                            >
                              {n.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </header>

      <FeedFilterModal
        open={showFilters}
        onClose={() => setShowFilters(false)}
        onReset={resetFilter}
        t={t}
        tPost={tPost}
        tProfile={tProfile}
        viewMode={viewMode}
        setViewMode={setViewMode}
        feedTab={feedTab}
        setFeedTab={setFeedTab}
        sortBy={sortBy}
        setSortBy={setSortBy}
        postType={postType}
        setPostType={setPostType}
        minRating={minRating}
        setMinRating={(value) => setFilter({ minRating: value })}
        categoryColors={CATEGORY_COLORS}
        categoriesSet={categoriesSet}
        toggleCategory={toggleCategory}
        hiddenOnly={hiddenOnly}
        setHiddenOnly={(value) => setFilter({ hiddenOnly: value })}
        nationalityChips={NATIONALITY_CHIPS}
        nationalitiesSet={nationalitiesSet}
        toggleNationality={toggleNationality}
        genderFilter={genderFilter as GenderFilterValue}
        setGenderFilter={setGenderFilter}
        ageRange={ageRange as AgeRangeValue}
        setAgeRange={setAgeRange}
        ratingColors={RATING_COLORS}
      />

      <main
        className={`${FEED_FRAME_CLASS} pb-16`}
        style={{ paddingTop: '104px' }}
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
              isFetchingNextPage ? (
                <div className="mt-4 flex items-center justify-center" aria-label={t('loadingMore')}>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                </div>
              ) : (
                <button
                  onClick={handleLoadMore}
                  className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white"
                >
                  {t('loadMore')}
                </button>
              )
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
                      {place.neighborhood_global && ` · ${place.neighborhood_global}`}
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
            variant="feed_discover"
            enableCommentCounts={false}
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
            {isFetchingNextPage ? (
              <div className="flex items-center justify-center" aria-label={t('loadingMore')}>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
              </div>
            ) : (
              <button
                onClick={handleLoadMore}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white"
              >
                {t('loadMore')}
              </button>
            )}
            <p className="text-xs text-gray-400">{t('loadMoreHint')}</p>
          </div>
        )}
      </main>

      <BottomNav avatarUrl={profile?.avatar_url ?? null} />

      <FeedActionSheet
        open={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        onUpload={() => {
          setShowActionSheet(false)
          router.push('/upload')
        }}
        onAddPlace={() => {
          setShowActionSheet(false)
          setShowPlaceAdd(true)
        }}
        t={t}
      />

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
