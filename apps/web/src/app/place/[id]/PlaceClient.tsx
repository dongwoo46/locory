'use client'

import { useState, useEffect } from 'react'
import { useLikeStore } from '@/store/likeStore'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'

const PlaceMapPreview = dynamic(() => import('@/components/ui/PlaceMapPreview'), {
  ssr: false,
  loading: () => <div className="h-52 bg-gray-200 animate-pulse" />,
})
import { useTranslations } from 'next-intl'
import BottomNav from '@/components/ui/BottomNav'
import PostGrid from '@/components/feed/PostGrid'
import ReportSheet from '@/components/ui/ReportSheet'
import MeetupSheet from '@/components/place/MeetupSheet'


const RATING_KEYS = ['must_go', 'worth_it', 'neutral', 'not_great', 'never']

const RATING_COLORS: Record<string, string> = {
  must_go: '#B090D4', worth_it: '#6AC0D4',
  neutral: '#90C490', not_great: '#E8C070',
}

const NATIONALITY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', JP: '🇯🇵', US: '🇺🇸', CN: '🇨🇳', ES: '🇪🇸', RU: '🇷🇺', OTHER: '🌍',
}

interface Place {
  id: string
  name: string
  lat: number
  lng: number
  address: string | null
  city: string
  district: string | null
  category: string
  place_type: string
  avg_rating: number | null
}

interface Props {
  place: Place
  posts: any[]
  userId: string
  savedPostIds: Set<string>
  likedPostIds: Set<string>
  isPlaceSaved: boolean
  isPlaceLiked: boolean
  placeLikeCount: number
  userGender: string | null
  userBirthDate: string | null
  userNationality: string | null
  userIsPublic: boolean
  userTrustScore: number
}

export default function PlaceClient({ place, posts, userId, savedPostIds, likedPostIds, isPlaceSaved: initialSaved, isPlaceLiked: initialLiked, placeLikeCount: initialLikeCount, userGender, userBirthDate, userNationality, userIsPublic, userTrustScore }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const tPost = useTranslations('post')
  const tPlace = useTranslations('place')
  const tCities = useTranslations('cities')
  const tDistricts = useTranslations('districts')
  const [isPlaceSaved, setIsPlaceSaved] = useState(initialSaved)
  const [isPlaceLiked, setIsPlaceLiked] = useState(initialLiked)
  const [placeLikeCount, setPlaceLikeCount] = useState(initialLikeCount)

  // Zustand store 초기화
  const { init: initLikeStore } = useLikeStore()
  useEffect(() => {
    initLikeStore({
      likedPostIds: likedPostIds,
      likedPlaceIds: new Set(initialLiked ? [place.id] : []),
      savedPostIds: savedPostIds,
      savedPlaceIds: new Set(initialSaved ? [place.id] : []),
      likeCountMap: {},
    })
  }, [])
  const [showReport, setShowReport] = useState(false)
  const [showMeetup, setShowMeetup] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  // 통계 계산
  const visitedPosts = posts.filter(p => p.type === 'visited' && p.rating)
  const ratingCounts = visitedPosts.reduce<Record<string, number>>((acc, p) => {
    acc[p.rating] = (acc[p.rating] || 0) + 1
    return acc
  }, {})

  const nationalityCounts = posts.reduce<Record<string, number>>((acc, p) => {
    const nat = p.profiles?.nationality || 'OTHER'
    acc[nat] = (acc[nat] || 0) + 1
    return acc
  }, {})
  const totalPosts = posts.length

  async function togglePlaceSave() {
    if (isPlaceSaved) {
      setIsPlaceSaved(false)
      await supabase.from('place_saves').delete().eq('user_id', userId).eq('place_id', place.id)
    } else {
      setIsPlaceSaved(true)
      await supabase.from('place_saves').insert({ user_id: userId, place_id: place.id })
    }
  }

  async function togglePlaceLike() {
    if (isPlaceLiked) {
      setIsPlaceLiked(false)
      setPlaceLikeCount(c => c - 1)
      await supabase.from('place_likes').delete().eq('user_id', userId).eq('place_id', place.id)
    } else {
      setIsPlaceLiked(true)
      setPlaceLikeCount(c => c + 1)
      await supabase.from('place_likes').insert({ user_id: userId, place_id: place.id })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-40">
        <div className="max-w-lg mx-auto flex items-center h-14 px-4 gap-3">
          <button onClick={() => router.back()} className="text-gray-500 p-1">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-gray-900 flex-1 truncate">{place.name}</h1>
          <div className="relative">
            <button onClick={() => setShowMenu(v => !v)} className="p-1 text-gray-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-w-[100px]">
                  <button
                    onClick={() => { setShowMenu(false); setShowReport(true) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
                      className="rounded border border-red-200 text-red-400 p-0.5 box-content">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" />
                    </svg>
                    신고
                  </button>
                </div>
              </>
            )}
          </div>
          <button onClick={togglePlaceLike} className="flex items-center gap-1 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24"
              fill={isPlaceLiked ? '#ef4444' : 'none'}
              stroke={isPlaceLiked ? '#ef4444' : '#9CA3AF'}
              strokeWidth={2}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {placeLikeCount > 0 && <span className="text-xs text-gray-400">{placeLikeCount}</span>}
          </button>
          <button onClick={togglePlaceSave} className="p-1">
            <svg
              width="22" height="22" viewBox="0 0 24 24"
              fill={isPlaceSaved ? '#111' : 'none'}
              stroke={isPlaceSaved ? '#111' : '#9CA3AF'}
              strokeWidth={2}
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </header>
      {showReport && (
        <ReportSheet targetType="place" targetId={place.id} onClose={() => setShowReport(false)} />
      )}
      {showMeetup && (
        <MeetupSheet
          placeId={place.id}
          placeName={place.name}
          userId={userId}
          userBirthDate={userBirthDate}
          userGender={userGender}
          userNationality={userNationality}
          userIsPublic={userIsPublic}
          userTrustScore={userTrustScore}
          onClose={() => setShowMeetup(false)}
        />
      )}

      <main className="max-w-lg mx-auto pt-14 pb-24">
        {/* 지도 */}
        <div className="h-52 bg-gray-100">
          <PlaceMapPreview lat={place.lat} lng={place.lng} />
        </div>

        {/* 장소 정보 */}
        <div className="bg-white px-4 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                  {tPost(`category.${place.category}`)}
                </span>
                {place.place_type === 'hidden_spot' && (
                  <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">
                    {tPost('hiddenSpot')}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-900 mt-1">{place.name}</h2>
              <p className="text-sm text-gray-400">
                {tCities(place.city)}
                {place.district && place.district !== 'other' ? ` · ${tDistricts(`${place.city}.${place.district}`)}` : ''}
              </p>
              {place.address && (
                <p className="text-xs text-gray-400 mt-0.5">{place.address}</p>
              )}
              {(place.category === 'cafe' || place.category === 'restaurant' || place.category === 'bar') && (
                <a
                  href={`https://map.naver.com/v5/search/${encodeURIComponent(place.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-full"
                >
                  🗺 {tPlace('naverMenu')}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 즉석만남 버튼 */}
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <button
            onClick={() => setShowMeetup(true)}
            className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl border border-gray-100"
          >
            <div className="flex items-center gap-2">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium text-gray-700">{tPlace('meetupButton')}</span>
            </div>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* 방문자 통계 */}
        {totalPosts > 0 && (
          <div className="bg-white mt-2 px-4 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{tPlace('visitorStats')}</p>
              {place.avg_rating != null && (
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: place.avg_rating >= 3.5 ? '#B090D4' : place.avg_rating >= 2.5 ? '#6AC0D4' : place.avg_rating >= 1.5 ? '#90C490' : '#E8C070' }}
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    {place.avg_rating >= 3.5 ? tPlace('avgRating.must_go')
                      : place.avg_rating >= 2.5 ? tPlace('avgRating.worth_it')
                      : place.avg_rating >= 1.5 ? tPlace('avgRating.neutral')
                      : tPlace('avgRating.not_great')}
                  </span>
                </div>
              )}
            </div>

            <span className="text-xs text-gray-400">{totalPosts}{tPlace('totalPosts')}</span>

            {/* 평점 분포 */}
            {visitedPosts.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {RATING_KEYS.map((key) => {
                  const count = ratingCounts[key] || 0
                  const pct = visitedPosts.length > 0 ? Math.round(count / visitedPosts.length * 100) : 0
                  if (count === 0) return null
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-24 shrink-0">{tPlace(`avgRating.${key}`)}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: RATING_COLORS[key] }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 포스트 그리드 */}
        <div className="mt-2">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-gray-400 text-sm">{tPlace('noPostsTitle')}</p>
              <p className="text-gray-300 text-xs mt-1">{tPlace('noPostsSubtitle')}</p>
            </div>
          ) : (
            <PostGrid
              posts={posts}
              userId={userId}
            />
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
