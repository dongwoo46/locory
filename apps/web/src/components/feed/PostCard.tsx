'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import ReportSheet from '@/components/ui/ReportSheet'

const RATING_COLORS: Record<string, string> = {
  must_go: '#B090D4',
  worth_it: '#6AC0D4',
  neutral: '#90C490',
  not_great: '#E8C070',
}

const CATEGORY_COLORS: Record<string, string> = {
  cafe: '#795548', restaurant: '#F44336', photospot: '#9C27B0',
  bar: '#FF9800', culture: '#2196F3', nature: '#4CAF50',
  shopping: '#E91E63', street: '#607D8B',
}

const NATIONALITY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', JP: '🇯🇵', US: '🇺🇸', CN: '🇨🇳', ES: '🇪🇸', RU: '🇷🇺', OTHER: '🌍',
}

interface Props {
  post: any
  userId: string
  isSaved?: boolean
  onLikeChange: () => void
}

export default function PostCard({ post, userId, isSaved: initialSaved = false, onLikeChange }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const tPost = useTranslations('post')
  const tFeed = useTranslations('feed')
  const tDistricts = useTranslations('districts')

  const [likeCount, setLikeCount] = useState(post.post_likes?.[0]?.count || 0)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(initialSaved)
  const [likeLoading, setLikeLoading] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const [showReport, setShowReport] = useState(false)

  const profile = post.profiles
  const place = post.places

  async function toggleLike() {
    if (likeLoading) return
    setLikeLoading(true)
    if (liked) {
      await supabase.from('post_likes').delete().eq('user_id', userId).eq('post_id', post.id)
      setLikeCount((n: number) => n - 1)
      setLiked(false)
    } else {
      await supabase.from('post_likes').insert({ user_id: userId, post_id: post.id })
      setLikeCount((n: number) => n + 1)
      setLiked(true)
    }
    setLikeLoading(false)
    onLikeChange()
  }

  async function toggleSave() {
    if (saved) {
      await supabase.from('post_saves').delete().eq('user_id', userId).eq('post_id', post.id)
      setSaved(false)
    } else {
      await supabase.from('post_saves').insert({ user_id: userId, post_id: post.id })
      setSaved(true)
    }
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">

      {/* 유저 + 평가 */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <button
          onClick={() => router.push(`/profile/${profile?.id}`)}
          className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0"
        >
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">{profile?.nickname?.[0]}</div>
          }
        </button>
        <button
          onClick={() => router.push(`/profile/${profile?.id}`)}
          className="flex items-center gap-1.5 flex-1 min-w-0"
        >
          <span className="text-sm font-semibold text-gray-900 truncate">{profile?.nickname}</span>
          <span className="text-xs shrink-0">{NATIONALITY_FLAGS[profile?.nationality] || '🌍'}</span>
        </button>
        {post.type === 'visited' && post.rating && (
          <span
            className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: RATING_COLORS[post.rating] }}
          >
            {tPost('rating.' + post.rating)}
          </span>
        )}
        {post.type === 'want' && (
          <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
            {tFeed('wantTag')}
          </span>
        )}
        {/* 신고 버튼 — 본인 포스팅 제외 */}
        {post.user_id !== userId && (
          <button
            onClick={() => setShowReport(true)}
            className="shrink-0 p-1 text-gray-300 hover:text-gray-500"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>
      {showReport && (
        <ReportSheet
          targetType="post"
          targetId={post.id}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* 사진 */}
      {post.photos?.length > 0 && (
        <div className="relative aspect-square bg-gray-100">
          <img src={post.photos[imgIndex]} alt="" className="w-full h-full object-cover" />
          {post.photos.length > 1 && (
            <div className="absolute bottom-2 right-2 flex gap-1">
              {post.photos.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setImgIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIndex ? 'bg-white' : 'bg-white/50'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 장소 정보 + 액션 */}
      <div className="px-4 pt-3 pb-3 flex flex-col gap-2">

        {/* 장소명 + 카테고리 */}
        {place && (
          <button
            onClick={() => place.id && router.push(`/place/${place.id}`)}
            className="flex items-start gap-2 text-left"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0 mt-1.5"
              style={{ backgroundColor: CATEGORY_COLORS[place.category] || '#9CA3AF' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 line-clamp-2">
                {place.name}
                {place.place_type === 'hidden_spot' && (
                  <span className="ml-1.5 text-xs font-medium text-gray-400">{tPost('hiddenSpot')}</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {place.category ? tPost('category.' + place.category) : ''}
                {place.district && place.district !== 'other' ? ` · ${place.city ? tDistricts(`${place.city}.${place.district}`) : place.district}` : ''}
              </p>
            </div>
          </button>
        )}

        {/* 메모 */}
        {post.memo && (
          <p className="text-sm text-gray-700 leading-relaxed">{post.memo}</p>
        )}

        {/* 저장 / 좋아요 */}
        <div className="flex items-center justify-end gap-3 pt-0.5">
          <button onClick={toggleSave}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? '#111' : 'none'} stroke={saved ? '#111' : '#9CA3AF'} strokeWidth={2}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button onClick={toggleLike} className="flex items-center gap-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? '#111' : 'none'} stroke={liked ? '#111' : '#9CA3AF'} strokeWidth={2}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span className="text-xs text-gray-400">{likeCount}</span>
          </button>
        </div>

      </div>
    </div>
  )
}
