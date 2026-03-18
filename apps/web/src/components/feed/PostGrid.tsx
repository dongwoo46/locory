'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { getScentLevel, calcScentScore } from '@/types/database'

const RATING_COLORS: Record<string, string> = {
  must_go: '#B090D4',
  worth_it: '#6AC0D4',
  neutral: '#90C490',
  not_great: '#E8C070',
}

const NATIONALITY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', JP: '🇯🇵', US: '🇺🇸', CN: '🇨🇳', ES: '🇪🇸', RU: '🇷🇺', OTHER: '🌍',
}

const CATEGORY_EMOJIS: Record<string, string> = {
  cafe: '☕', restaurant: '🍽️', photospot: '📸', street: '🚶',
  bar: '🍻', culture: '🎨', nature: '🌿', shopping: '🛍️',
}

interface Props {
  posts: any[]
  userId: string
  savedPostIds: Set<string>
  savedPlaceIds?: Set<string>
  likedPostIds?: Set<string>
  likedPlaceIds?: Set<string>
}

export default function PostGrid({ posts, userId, savedPostIds, savedPlaceIds = new Set(), likedPostIds, likedPlaceIds = new Set() }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<any | null>(null)
  const supabase = createClient()
  const t = useTranslations()
  const tPost = useTranslations('post')
  const tFeed = useTranslations('feed')
  const tDistricts = useTranslations('districts')

  const [likedMap, setLikedMap] = useState<Record<string, boolean>>(
    Object.fromEntries(posts.map(p => [p.id, likedPostIds?.has(p.id) ?? false]))
  )
  const [likeCountMap, setLikeCountMap] = useState<Record<string, number>>(
    Object.fromEntries(posts.map(p => [p.id, p.post_likes?.[0]?.count || 0]))
  )
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>(
    Object.fromEntries(posts.map(p => [p.id, savedPostIds.has(p.id)]))
  )
  const [savedPlaceMap, setSavedPlaceMap] = useState<Record<string, boolean>>(
    Object.fromEntries(posts.map(p => [p.places?.id, savedPlaceIds.has(p.places?.id)]))
  )
  const [likedPlaceMap, setLikedPlaceMap] = useState<Record<string, boolean>>(
    Object.fromEntries(posts.map(p => [p.places?.id, likedPlaceIds.has(p.places?.id)]))
  )

  async function toggleLike(postId: string) {
    const liked = likedMap[postId]
    if (liked) {
      await supabase.from('post_likes').delete().eq('user_id', userId).eq('post_id', postId)
      setLikedMap(m => ({ ...m, [postId]: false }))
      setLikeCountMap(m => ({ ...m, [postId]: (m[postId] || 0) - 1 }))
    } else {
      await supabase.from('post_likes').insert({ user_id: userId, post_id: postId })
      setLikedMap(m => ({ ...m, [postId]: true }))
      setLikeCountMap(m => ({ ...m, [postId]: (m[postId] || 0) + 1 }))
    }
  }

  async function toggleSave(postId: string) {
    const saved = savedMap[postId]
    if (saved) {
      await supabase.from('post_saves').delete().eq('user_id', userId).eq('post_id', postId)
      setSavedMap(m => ({ ...m, [postId]: false }))
    } else {
      await supabase.from('post_saves').insert({ user_id: userId, post_id: postId })
      setSavedMap(m => ({ ...m, [postId]: true }))
    }
  }

  async function togglePlaceSave(placeId: string) {
    const saved = savedPlaceMap[placeId]
    if (saved) {
      await supabase.from('place_saves').delete().eq('user_id', userId).eq('place_id', placeId)
      setSavedPlaceMap(m => ({ ...m, [placeId]: false }))
    } else {
      await supabase.from('place_saves').insert({ user_id: userId, place_id: placeId })
      setSavedPlaceMap(m => ({ ...m, [placeId]: true }))
    }
  }

  async function togglePlaceLike(e: React.MouseEvent, placeId: string) {
    e.stopPropagation()
    const liked = likedPlaceMap[placeId]
    if (liked) {
      await supabase.from('place_likes').delete().eq('user_id', userId).eq('place_id', placeId)
      setLikedPlaceMap(m => ({ ...m, [placeId]: false }))
    } else {
      await supabase.from('place_likes').insert({ user_id: userId, place_id: placeId })
      setLikedPlaceMap(m => ({ ...m, [placeId]: true }))
    }
  }

  const post = selected

  return (
    <>
      {/* 2열 그리드 */}
      <div className="grid grid-cols-3 gap-1.5">
        {posts.map(p => {
          const place = p.places
          return (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              className="bg-white rounded-xl overflow-hidden shadow-sm text-left cursor-pointer"
            >
              {/* 사진 */}
              <div className="aspect-square bg-gray-100 relative">
                {p.photos?.[0] ? (
                  <img src={p.photos[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-3">
                    <span className="text-xs text-gray-400 text-center leading-tight">{place?.name}</span>
                  </div>
                )}
                {p.type === 'visited' && p.rating && (
                  <div
                    className="absolute top-1.5 left-1.5 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: RATING_COLORS[p.rating] }}
                  >
                    {tPost('rating.' + p.rating)}
                  </div>
                )}
                {p.type === 'want' && (
                  <div className="absolute top-1.5 left-1.5 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                    {tFeed('wantTag')}
                  </div>
                )}
                {place?.place_type === 'hidden_spot' && (
                  <div className="absolute bottom-1.5 left-1.5 bg-purple-600/80 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                    🔍 {tPost('hiddenSpot')}
                  </div>
                )}
                {place?.id && (
                  <button
                    onClick={e => togglePlaceLike(e, place.id)}
                    className="absolute bottom-1.5 right-1.5 bg-black/40 rounded-full p-1"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24"
                      fill={likedPlaceMap[place.id] ? '#ef4444' : 'none'}
                      stroke={likedPlaceMap[place.id] ? '#ef4444' : 'white'}
                      strokeWidth={2.5}>
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                )}
              </div>
              {/* 정보 */}
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1 leading-tight">
                  <span className="text-xs shrink-0">{CATEGORY_EMOJIS[place?.category]}</span>
                  <p className="text-[11px] font-semibold text-gray-900 truncate">{place?.name}</p>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] text-gray-400 truncate">
                    {NATIONALITY_FLAGS[p.profiles?.nationality]} {p.profiles?.nickname}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 포스트 상세 모달 */}
      {post && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: 'calc(100dvh - 120px)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 닫기 버튼 */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
              <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto" />
              <button onClick={() => setSelected(null)} className="absolute right-4 top-3 p-1 text-gray-400">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto">

            {/* 유저 헤더 */}
            <div className="flex items-center gap-2.5 px-4 py-3">
              <button
                onClick={() => { setSelected(null); router.push(`/profile/${post.profiles?.id}`) }}
                className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0"
              >
                {post.profiles?.avatar_url
                  ? <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                      {post.profiles?.nickname?.[0]}
                    </div>
                }
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setSelected(null); router.push(`/profile/${post.profiles?.id}`) }}
                    className="text-sm font-semibold text-gray-900"
                  >
                    {post.profiles?.nickname}
                  </button>
                  {post.profiles?.trust_score != null && (() => {
                    const scent = getScentLevel(post.profiles.trust_score)
                    return (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{ color: scent.color, backgroundColor: scent.bg }}
                      >
                        {t(`scent.levels.${scent.id}`)}
                      </span>
                    )
                  })()}
                </div>
                <button
                  onClick={() => { setSelected(null); router.push(`/place/${post.places?.id}`) }}
                  className="block text-xs text-gray-400 hover:text-gray-600 truncate text-left"
                >
                  {post.places?.name}{post.places?.district ? ` · ${post.places?.city ? tDistricts(`${post.places.city}.${post.places.district}`) : post.places.district}` : ''}
                </button>
              </div>
              {post.type === 'visited' && post.rating ? (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium text-white shrink-0"
                  style={{ backgroundColor: RATING_COLORS[post.rating] }}
                >
                  {tPost('rating.' + post.rating)}
                </span>
              ) : post.type === 'want' ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 shrink-0">
                  {tFeed('wantTag')}
                </span>
              ) : null}
            </div>

            {/* 사진 */}
            {post.photos?.length > 0 && (
              <div className="aspect-square bg-gray-100">
                <img src={post.photos[0]} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            {/* 하단 */}
            <div className="px-4 py-3 pb-5 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">
                  {tPost('category.' + post.places?.category)}
                  {post.places?.place_type === 'hidden_spot' ? ` · ${tPost('hiddenSpot')}` : ''}
                </span>
                <div className="flex items-center gap-3">
                  {post.places?.id && (
                    <button onClick={() => togglePlaceSave(post.places.id)} className="flex items-center gap-1">
                      <svg width="18" height="18" viewBox="0 0 24 24"
                        fill={savedPlaceMap[post.places.id] ? '#111' : 'none'}
                        stroke={savedPlaceMap[post.places.id] ? '#111' : '#9CA3AF'}
                        strokeWidth={2}>
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                      </svg>
                    </button>
                  )}
<button onClick={() => toggleLike(post.id)} className="flex items-center gap-1">
                    <svg width="18" height="18" viewBox="0 0 24 24"
                      fill={likedMap[post.id] ? '#111' : 'none'}
                      stroke={likedMap[post.id] ? '#111' : '#9CA3AF'}
                      strokeWidth={2}>
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span className="text-xs text-gray-400">{likeCountMap[post.id] || 0}</span>
                  </button>
                </div>
              </div>
              {post.memo && (
                <p className="text-sm text-gray-700 leading-relaxed">{post.memo}</p>
              )}
            </div>
            </div>{/* overflow-y-auto 닫기 */}
          </div>
        </div>
      )}
    </>
  )
}
