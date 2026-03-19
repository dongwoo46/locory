'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { getScentLevel } from '@/types/database'
import { useLikeStore } from '@/store/likeStore'
import ReportSheet from '@/components/ui/ReportSheet'

const RATING_COLORS: Record<string, string> = {
  must_go: '#B090D4', worth_it: '#6AC0D4', neutral: '#90C490', not_great: '#E8C070',
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
}

export default function PostGrid({ posts, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations()
  const tPost = useTranslations('post')
  const tFeed = useTranslations('feed')
  const tDistricts = useTranslations('districts')
  const [selected, setSelected] = useState<any | null>(null)
  const [showReport, setShowReport] = useState(false)

  const {
    likedPostIds, likeCountMap, savedPostIds, savedPlaceIds,
    mergePostCounts,
  } = useLikeStore()

  // 포스트 좋아요 수 store에 병합
  useEffect(() => {
    const counts = Object.fromEntries(
      posts.map(p => [p.id, parseInt(p.post_likes?.[0]?.count) || 0])
    )
    mergePostCounts(counts)
  }, [posts, mergePostCounts])

  async function handlePostLike(postId: string) {
    const { likedPostIds: cur, togglePostLike: toggle } = useLikeStore.getState()
    const wasLiked = cur.has(postId)
    toggle(postId)
    if (wasLiked) {
      await supabase.from('post_likes').delete().eq('user_id', userId).eq('post_id', postId)
    } else {
      await supabase.from('post_likes').insert({ user_id: userId, post_id: postId })
    }
  }

  async function handlePostSave(postId: string) {
    const { savedPostIds: cur, togglePostSave: toggle } = useLikeStore.getState()
    const wasSaved = cur.has(postId)
    toggle(postId)
    if (wasSaved) {
      await supabase.from('post_saves').delete().eq('user_id', userId).eq('post_id', postId)
    } else {
      await supabase.from('post_saves').insert({ user_id: userId, post_id: postId })
    }
  }

  async function handlePlaceSave(placeId: string) {
    const { savedPlaceIds: cur, togglePlaceSave: toggle } = useLikeStore.getState()
    const wasSaved = cur.has(placeId)
    toggle(placeId)
    if (wasSaved) {
      await supabase.from('place_saves').delete().eq('user_id', userId).eq('place_id', placeId)
    } else {
      await supabase.from('place_saves').insert({ user_id: userId, place_id: placeId })
    }
  }

  const post = selected

  return (
    <>
      {/* 3열 그리드 */}
      <div className="grid grid-cols-3 gap-px px-4">
        {posts.map(p => {
          const place = p.places
          const likeCount = likeCountMap[p.id] ?? parseInt(p.post_likes?.[0]?.count) ?? 0
          const saveCount = parseInt(p.post_saves?.[0]?.count) || 0
          return (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              className="bg-white overflow-hidden text-left cursor-pointer"
            >
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
                    className="absolute top-3 left-2 text-white text-[9px] font-semibold px-2 pt-1 pb-[2px] rounded-full"
                    style={{ backgroundColor: RATING_COLORS[p.rating] }}
                  >
                    {tPost('rating.' + p.rating)}
                  </div>
                )}
                {p.type === 'want' && (
                  <div className="absolute top-3 left-2 bg-black/50 text-white text-[9px] px-2 pt-1 pb-[2px] rounded-full">
                    {tFeed('wantTag')}
                  </div>
                )}
                {place?.place_type === 'hidden_spot' && (
                  <div className="absolute bottom-2 left-2 bg-purple-600/80 text-white text-[9px] px-2 pt-1 pb-[2px] rounded-full flex items-center gap-0.5">
                    <span className="text-[10px]">🔍</span> <span>{tPost('hiddenSpot')}</span>
                  </div>
                )}
              </div>
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1 leading-tight">
                  <span className="text-xs shrink-0">{CATEGORY_EMOJIS[place?.category]}</span>
                  <p className="text-[11px] font-semibold text-gray-900 line-clamp-2">{place?.name}</p>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[9px] text-gray-400 truncate">
                    {NATIONALITY_FLAGS[p.profiles?.nationality]} {p.profiles?.nickname}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-0.5">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="#9CA3AF" stroke="none">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      <span className="text-[9px] text-gray-400">{likeCount}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="#9CA3AF" stroke="none">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                      <span className="text-[9px] text-gray-400">{saveCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 신고 시트 */}
      {post && showReport && (
        <ReportSheet
          targetType="post"
          targetId={post.id}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* 포스트 상세 모달 */}
      {post && (
        <div
          className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center px-4"
          onClick={() => { setSelected(null); setShowReport(false) }}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: 'calc(100dvh - 120px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center px-4 pt-3 pb-1 shrink-0">
              <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto" />
              <button onClick={() => setShowReport(true)} className="absolute left-4 top-3 p-1 text-gray-300 hover:text-gray-500">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" />
                </svg>
              </button>
              <button onClick={() => setSelected(null)} className="absolute right-4 top-3 p-1 text-gray-400">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto">
              <div className="flex items-center gap-2.5 px-4 py-3">
                <button
                  onClick={() => { setSelected(null); router.push(`/profile/${post.profiles?.id}`) }}
                  className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0"
                >
                  {post.profiles?.avatar_url
                    ? <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">{post.profiles?.nickname?.[0]}</div>
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
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white shrink-0" style={{ backgroundColor: RATING_COLORS[post.rating] }}>
                    {tPost('rating.' + post.rating)}
                  </span>
                ) : post.type === 'want' ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 shrink-0">
                    {tFeed('wantTag')}
                  </span>
                ) : null}
              </div>

              {post.photos?.length > 0 && (
                <div className="aspect-square bg-gray-100">
                  <img src={post.photos[0]} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="px-4 py-3 pb-5 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">
                    {tPost('category.' + post.places?.category)}
                    {post.places?.place_type === 'hidden_spot' ? ` · ${tPost('hiddenSpot')}` : ''}
                  </span>
                  <div className="flex items-center gap-3">
                    {post.places?.id && (
                      <button onClick={() => handlePlaceSave(post.places.id)}>
                        <svg width="18" height="18" viewBox="0 0 24 24"
                          fill={savedPlaceIds.has(post.places.id) ? '#111' : 'none'}
                          stroke={savedPlaceIds.has(post.places.id) ? '#111' : '#9CA3AF'}
                          strokeWidth={2}>
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                        </svg>
                      </button>
                    )}
                    <button onClick={() => handlePostSave(post.id)}>
                      <svg width="18" height="18" viewBox="0 0 24 24"
                        fill={savedPostIds.has(post.id) ? '#111' : 'none'}
                        stroke={savedPostIds.has(post.id) ? '#111' : '#9CA3AF'}
                        strokeWidth={2}>
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>
                    <button onClick={() => handlePostLike(post.id)} className="flex items-center gap-1">
                      <svg width="18" height="18" viewBox="0 0 24 24"
                        fill={likedPostIds.has(post.id) ? '#111' : 'none'}
                        stroke={likedPostIds.has(post.id) ? '#111' : '#9CA3AF'}
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}
