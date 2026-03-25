'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'
import dynamic from 'next/dynamic'
import { getScentLevel } from '@/types/database'
import { useLikeStore } from '@/store/likeStore'
import { getPostImageUrl } from '@/lib/utils/postImage'
const ReportSheet = dynamic(() => import('@/components/ui/ReportSheet'), { ssr: false })

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

const RATING_OPTIONS = ['must_go', 'worth_it', 'neutral', 'not_great']

interface Props {
  posts: any[]
  userId: string
  onDelete?: (postId: string) => void
}

export default function PostGrid({ posts, userId, onDelete }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations()
  const tPost = useTranslations('post')
  const tFeed = useTranslations('feed')
  const tDistricts = useTranslations('districts')

  const [localPosts, setLocalPosts] = useState<any[]>(posts)
  const [selected, setSelected] = useState<any | null>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [showReport, setShowReport] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)

  // Edit state
  const [showEdit, setShowEdit] = useState(false)
  const [editMemo, setEditMemo] = useState('')
  const [editMenu, setEditMenu] = useState('')
  const [editRating, setEditRating] = useState<string | null>(null)
  const [editPublic, setEditPublic] = useState(true)
  const [editLocalRec, setEditLocalRec] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  const locale = useLocale()

  const {
    likedPostIds, likeCountMap, savedPostIds,
    mergePostCounts,
  } = useLikeStore()

  const [commentCountMap, setCommentCountMap] = useState<Record<string, number>>({})
  const [memoTranslated, setMemoTranslated] = useState<string | null>(null)
  const [memoTranslating, setMemoTranslating] = useState(false)
  const [translateRemaining, setTranslateRemaining] = useState<number | null>(null)
  const [commentTranslations, setCommentTranslations] = useState<Record<string, string>>({})

  useEffect(() => {
    setLocalPosts(posts)
  }, [posts])

  // 포스트 좋아요 수 store에 병합
  useEffect(() => {
    const counts = Object.fromEntries(
      localPosts.map(p => [p.id, parseInt(p.post_likes?.[0]?.count) || 0])
    )
    mergePostCounts(counts)
  }, [localPosts, mergePostCounts])

  // 댓글 수 batch fetch
  useEffect(() => {
    if (localPosts.length === 0) return
    const ids = localPosts.map(p => p.id)
    supabase
      .from('post_comments')
      .select('post_id')
      .in('post_id', ids)
      .is('deleted_at', null)
      .then(({ data }) => {
        if (!data) return
        const counts: Record<string, number> = {}
        for (const row of data) {
          counts[row.post_id] = (counts[row.post_id] || 0) + 1
        }
        setCommentCountMap(prev => ({ ...prev, ...counts }))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPosts])

  async function translateText(text: string): Promise<{ translated: string; remaining: number } | null> {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, target: locale }),
    })
    if (!res.ok) return null
    return res.json()
  }

  async function translateMemo() {
    if (!selected?.memo || memoTranslating) return
    setMemoTranslating(true)
    const result = await translateText(selected.memo)
    setMemoTranslating(false)
    if (result) {
      setMemoTranslated(result.translated)
      setTranslateRemaining(result.remaining)
    }
  }

  async function translateComment(commentId: string, body: string) {
    const result = await translateText(body)
    if (result) {
      setCommentTranslations(prev => ({ ...prev, [commentId]: result.translated }))
      setTranslateRemaining(result.remaining)
    }
  }

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

  async function loadComments(postId: string) {
    const { data } = await supabase
      .from('post_comments')
      .select('id, body, created_at, user_id, profiles(nickname, avatar_url)')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    setComments(data ?? [])
  }

  async function submitComment() {
    if (!selected || !commentText.trim()) return
    setCommentLoading(true)
    const body = commentText.trim().slice(0, 200)
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: selected.id, user_id: userId, body })
      .select('id, body, created_at, user_id, profiles(nickname, avatar_url)')
      .single()
    setCommentLoading(false)
    if (!error && data) {
      setComments(prev => [...prev, data])
      setCommentText('')
    }
  }

  async function deleteComment(commentId: string) {
    await supabase.from('post_comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId)
    setComments(prev => prev.filter((c: any) => c.id !== commentId))
  }

  async function handleDeletePost(postId: string) {
    if (!confirm(tPost('deleteConfirm'))) return
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
    if (!res.ok) return
    setSelected(null)
    setLocalPosts(prev => prev.filter(p => p.id !== postId))
    onDelete?.(postId)
  }

  function openPostDetail(targetPost: any) {
    setSelected(targetPost)
    setPhotoIndex(0)
    setComments([])
    setCommentText('')
    setMemoTranslated(null)
    setCommentTranslations({})
    const firstMedium = getPostImageUrl(targetPost, 0, 'medium')
    if (firstMedium) {
      const preload = new window.Image()
      preload.src = firstMedium
    }
    window.setTimeout(() => {
      loadComments(targetPost.id)
    }, 120)
  }

  function openEdit(p: any) {
    setEditMemo(p.memo || '')
    setEditMenu(p.recommended_menu || '')
    setEditRating(p.rating || null)
    setEditPublic(p.is_public ?? true)
    setEditLocalRec(p.is_local_recommendation ?? false)
    setShowEdit(true)
    setShowMenu(false)
  }

  async function handleEditSubmit() {
    if (!selected) return
    setEditLoading(true)
    const body: Record<string, unknown> = {
      memo: editMemo,
      recommended_menu: editMenu,
      is_public: editPublic,
      is_local_recommendation: editLocalRec,
    }
    if (selected.type === 'visited') {
      body.rating = editRating
    }
    const res = await fetch(`/api/posts/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setEditLoading(false)
    if (!res.ok) return
    // Update local state
    const updated = {
      ...selected,
      memo: editMemo,
      recommended_menu: editMenu,
      rating: selected.type === 'visited' ? editRating : selected.rating,
      is_public: editPublic,
      is_local_recommendation: editLocalRec,
    }
    setLocalPosts(prev => prev.map(p => p.id === selected.id ? updated : p))
    setSelected(updated)
    setShowEdit(false)
  }

  const post = selected

  return (
    <>
      {/* 3열 그리드 */}
      <div className="grid grid-cols-3 gap-px px-4">
        {localPosts.map((p, index) => {
          const place = p.places
          const likeCount = likeCountMap[p.id] ?? parseInt(p.post_likes?.[0]?.count) ?? 0
          const saveCount = parseInt(p.post_saves?.[0]?.count) || 0
          return (
            <div
              key={p.id}
              onClick={() => openPostDetail(p)}
              className="bg-white overflow-hidden text-left cursor-pointer"
            >
              <div className="aspect-square bg-gray-100 relative">
                {p.photos?.[0] ? (
                  <Image
                    src={getPostImageUrl(p, 0, 'thumbnail')}
                    alt={place?.name ? `${place.name} thumbnail` : ''}
                    className="object-cover"
                    fill
                    sizes="(max-width: 768px) 33vw, 180px"
                    loading={index === 0 ? 'eager' : 'lazy'}
                    priority={index === 0}
                  />
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
                    {(commentCountMap[p.id] ?? 0) > 0 && (
                      <div className="flex items-center gap-0.5">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="#9CA3AF" stroke="none">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span className="text-[9px] text-gray-400">{commentCountMap[p.id]}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 포스트 상세 모달 */}
      {post && (
        <div
          className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center px-4"
          onClick={() => { setSelected(null); setShowReport(false); setShowMenu(false); setShowEdit(false) }}
        >
          <div
            className="relative bg-white w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: 'calc(100dvh - 120px)' }}
            onClick={e => e.stopPropagation()}
          >
          {showReport && (
            <ReportSheet
              targetType="post"
              targetId={post.id}
              onClose={() => setShowReport(false)}
            />
          )}
            <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
              <div className="w-8" />
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
              <button onClick={() => setSelected(null)} className="p-1 text-gray-400 w-8 flex justify-end">
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
                    ? (
                      <Image
                        src={post.profiles.avatar_url}
                        alt={post.profiles?.nickname ? `${post.profiles.nickname} avatar` : ''}
                        className="w-full h-full object-cover"
                        width={32}
                        height={32}
                        loading="lazy"
                      />
                    )
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
                    {post.places?.name}{post.places?.district && post.places?.district !== 'other' ? ` · ${post.places?.city ? tDistricts(`${post.places.city}.${post.places.district}`) : post.places.district}` : ''}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {post.type === 'visited' && post.rating ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: RATING_COLORS[post.rating] }}>
                      {tPost('rating.' + post.rating)}
                    </span>
                  ) : post.type === 'want' ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {tFeed('wantTag')}
                    </span>
                  ) : null}
                  {/* 점 3개 메뉴 */}
                  <div className="relative">
                    <button
                      onClick={() => setShowMenu(v => !v)}
                      className="p-1 text-gray-400"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {showMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                        <div className="absolute right-0 top-7 z-20 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-w-[100px]">
                          {post.profiles?.id === userId && (
                            <>
                              <button
                                onClick={() => openEdit(post)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                              >
                                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {tPost('edit')}
                              </button>
                              <button
                                onClick={() => { setShowMenu(false); handleDeletePost(post.id) }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-500 hover:bg-red-50"
                              >
                                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M9 6V4h6v2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {tPost('delete')}
                              </button>
                            </>
                          )}
                          {post.profiles?.id !== userId && (
                            <button
                              onClick={() => { setShowMenu(false); setShowReport(true) }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-600 hover:bg-gray-50"
                            >
                              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
                                className="rounded border border-red-200 text-red-400 p-0.5 box-content">
                                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinecap="round" strokeLinejoin="round" />
                                <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" />
                              </svg>
                              {tPost('report')}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {post.photos?.length > 0 && (
                <div className="relative aspect-square bg-gray-100 overflow-hidden">
                  <Image
                    src={getPostImageUrl(post, photoIndex, 'medium')}
                    alt={post.places?.name ? `${post.places.name} photo` : ''}
                    className="object-cover"
                    fill
                    sizes="(max-width: 768px) 100vw, 640px"
                    loading="eager"
                    priority={photoIndex === 0}
                    unoptimized
                  />
                  {post.photos.length > 1 && (
                    <>
                      {photoIndex > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setPhotoIndex(i => i - 1) }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 rounded-full flex items-center justify-center"
                        >
                          <svg width="14" height="14" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                      {photoIndex < post.photos.length - 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); setPhotoIndex(i => i + 1) }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 rounded-full flex items-center justify-center"
                        >
                          <svg width="14" height="14" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                        {post.photos.map((_: string, i: number) => (
                          <span
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === photoIndex ? 'bg-white' : 'bg-white/40'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="px-4 py-3 pb-5 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">
                    {tPost('category.' + post.places?.category)}
                    {post.places?.place_type === 'hidden_spot' ? ` · ${tPost('hiddenSpot')}` : ''}
                  </span>
                  <div className="flex items-center gap-3">
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
                  <div>
                    <p className="text-sm text-gray-700 leading-relaxed">{post.memo}</p>
                    {memoTranslated && (
                      <p className="text-sm text-gray-500 leading-relaxed mt-1 border-t border-gray-100 pt-1">{memoTranslated}</p>
                    )}
                    {!memoTranslated && (
                      <button
                        onClick={translateMemo}
                        disabled={memoTranslating}
                        className="mt-1.5 text-[11px] text-gray-400 underline disabled:opacity-40"
                      >
                        {memoTranslating ? '...' : tPost('translate')}
                        {translateRemaining !== null && ` · ${tPost('translateRemaining', { remaining: translateRemaining })}`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 댓글 섹션 */}
              <div className="border-t border-gray-100 shrink-0">
                {comments.length > 0 && (
                  <div className="px-4 pt-3 pb-1 flex flex-col gap-2 max-h-40 overflow-y-auto">
                    {comments.map((c) => {
                      const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
                      return (
                        <div key={c.id} className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 shrink-0 overflow-hidden">
                            {profile?.avatar_url && (
                              <Image
                                src={profile.avatar_url}
                                className="w-full h-full object-cover"
                                alt={profile?.nickname ? `${profile.nickname} avatar` : ''}
                                width={24}
                                height={24}
                                loading="lazy"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-gray-800 mr-1.5">{profile?.nickname}</span>
                            <span className="text-xs text-gray-700 break-words">{c.body}</span>
                            {commentTranslations[c.id] && (
                              <p className="text-xs text-gray-400 mt-0.5">{commentTranslations[c.id]}</p>
                            )}
                            {!commentTranslations[c.id] && (
                              <button
                                onClick={() => translateComment(c.id, c.body)}
                                className="text-[10px] text-gray-300 underline mt-0.5 block"
                              >
                                {tPost('translate')}
                              </button>
                            )}
                          </div>
                          {c.user_id === userId && (
                            <button onClick={() => deleteComment(c.id)} className="shrink-0 text-gray-300 text-[10px] leading-none mt-0.5">✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value.slice(0, 200))}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
                    placeholder={tPost('commentPlaceholder')}
                    className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400 bg-gray-50 rounded-full px-3 py-1.5"
                  />
                  <button
                    onClick={submitComment}
                    disabled={!commentText.trim() || commentLoading}
                    className="text-xs font-semibold text-gray-900 disabled:text-gray-300 shrink-0"
                  >
                    {tPost('commentPost')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 수정 바텀시트 */}
      {showEdit && post && (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end" onClick={() => setShowEdit(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 flex-1">{tPost('editTitle')}</h2>
              <button onClick={() => setShowEdit(false)} className="p-1 text-gray-400">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-5 pb-8">
              {/* 메모 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Memo</p>
                <textarea
                  value={editMemo}
                  onChange={e => setEditMemo(e.target.value.slice(0, 500))}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none resize-none"
                />
                <p className="text-right text-xs text-gray-300 mt-0.5">{editMemo.length}/500</p>
              </div>

              {/* 추천 메뉴 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{tPost('category.restaurant')}</p>
                <input
                  type="text"
                  value={editMenu}
                  onChange={e => setEditMenu(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none"
                />
              </div>

              {/* 평점 (방문 후기만) */}
              {post.type === 'visited' && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Rating</p>
                  <div className="flex flex-wrap gap-2">
                    {RATING_OPTIONS.map(r => (
                      <button
                        key={r}
                        onClick={() => setEditRating(editRating === r ? null : r)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                        style={editRating === r
                          ? { backgroundColor: RATING_COLORS[r], color: 'white', borderColor: 'transparent' }
                          : { borderColor: '#E5E7EB', color: '#4B5563' }
                        }
                      >
                        {tPost('rating.' + r)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 공개 여부 */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Public</p>
                <button
                  onClick={() => setEditPublic(v => !v)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${editPublic ? 'bg-gray-900' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editPublic ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* 현지인 추천 */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">{tPost('hiddenSpot')}</p>
                <button
                  onClick={() => setEditLocalRec(v => !v)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${editLocalRec ? 'bg-purple-600' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editLocalRec ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <button
                onClick={handleEditSubmit}
                disabled={editLoading}
                className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                {editLoading ? '...' : tPost('editSubmit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
