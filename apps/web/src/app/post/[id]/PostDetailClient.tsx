'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLocale, useTranslations } from 'next-intl'
import { getPostImageUrl } from '@/lib/utils/postImage'

interface Props {
  userId: string
  post: PostDetailData
  initialLiked: boolean
  initialSaved: boolean
  initialComments: CommentItem[]
  isAdmin: boolean
}

interface ProfileData {
  id?: string
  nickname?: string
  avatar_url?: string | null
}

interface PlaceData {
  id?: string
  name?: string
  category?: string
  place_type?: string
}

interface CountRow {
  count?: string | number | null
}

interface CommentItem {
  id: string
  body: string
  created_at?: string
  user_id: string
  profiles?: ProfileData | ProfileData[] | null
}

interface PostDetailData {
  id: string
  type?: string
  rating?: string
  memo?: string | null
  photos?: string[]
  places?: PlaceData | PlaceData[] | null
  profiles?: ProfileData | ProfileData[] | null
  post_likes?: CountRow[]
  post_saves?: CountRow[]
}

function toCount(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export default function PostDetailClient({
  userId,
  post,
  initialLiked,
  initialSaved,
  initialComments,
  isAdmin,
}: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const locale = useLocale()
  const tPost = useTranslations('post')
  const tFeed = useTranslations('feed')
  const translateTarget = isAdmin ? 'en' : locale
  const place = Array.isArray(post.places) ? post.places[0] : post.places
  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
  const photos = post.photos ?? []

  const [photoIndex, setPhotoIndex] = useState(0)
  const [liked, setLiked] = useState(initialLiked)
  const [saved, setSaved] = useState(initialSaved)
  const [likeCount, setLikeCount] = useState(toCount(post.post_likes?.[0]?.count))
  const [saveCount, setSaveCount] = useState(toCount(post.post_saves?.[0]?.count))

  const [comments, setComments] = useState<CommentItem[]>(initialComments)
  const [commentsLoading, setCommentsLoading] = useState(initialComments.length === 0)
  const [commentText, setCommentText] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)

  const [memoTranslated, setMemoTranslated] = useState<{ locale: string; text: string } | null>(null)
  const [memoTranslating, setMemoTranslating] = useState(false)
  const [memoCanTranslate, setMemoCanTranslate] = useState(false)
  const [translateRemaining, setTranslateRemaining] = useState<number | null>(null)
  const [commentTranslations, setCommentTranslations] = useState<Record<string, { locale: string; text: string }>>({})
  const [commentCanTranslate, setCommentCanTranslate] = useState<Record<string, boolean>>({})
  const [commentTranslatingId, setCommentTranslatingId] = useState<string | null>(null)

  const detectCanTranslate = useCallback(
    async (text: string): Promise<boolean> => {
      const value = text?.trim()
      if (!value) return false
      if (isAdmin) return true

      try {
        const res = await fetch('/api/translate/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: value, target: translateTarget }),
        })
        if (!res.ok) return true
        const result: { sameLanguage?: boolean } = await res.json()
        return result.sameLanguage !== true
      } catch {
        return true
      }
    },
    [isAdmin, translateTarget]
  )

  useEffect(() => {
    let active = true

    const loadComments = async () => {
      setCommentsLoading(true)
      const { data } = await supabase
        .from('post_comments')
        .select('id, body, created_at, user_id, profiles(nickname, avatar_url)')
        .eq('post_id', post.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (active) {
        setComments(data ?? [])
        setCommentsLoading(false)
      }
    }

    void loadComments()

    return () => {
      active = false
    }
  }, [post.id, supabase])

  useEffect(() => {
    let active = true

    const detectMemoLanguage = async () => {
      if (!post.memo?.trim()) {
        setMemoCanTranslate(false)
        return
      }
      if (isAdmin) {
        setMemoCanTranslate(true)
        return
      }

      const canTranslate = await detectCanTranslate(post.memo)
      if (active) {
        setMemoCanTranslate(canTranslate)
      }
    }

    void detectMemoLanguage()

    return () => {
      active = false
    }
  }, [detectCanTranslate, isAdmin, post.memo])

  useEffect(() => {
    let active = true

    const detectCommentLanguages = async () => {
      if (!comments.length) return
      const unresolved = comments.filter((comment) => commentCanTranslate[`${translateTarget}:${comment.id}`] === undefined)
      if (!unresolved.length) return

      if (isAdmin) {
        if (!active) return
        setCommentCanTranslate((prev) => ({
          ...prev,
          ...Object.fromEntries(unresolved.map((comment) => [`${translateTarget}:${comment.id}`, true])),
        }))
        return
      }

      const entries = await Promise.all(
        unresolved.map(async (comment) => [`${translateTarget}:${comment.id}`, await detectCanTranslate(comment.body)] as const)
      )

      if (!active) return
      setCommentCanTranslate((prev) => ({
        ...prev,
        ...Object.fromEntries(entries),
      }))
    }

    void detectCommentLanguages()

    return () => {
      active = false
    }
  }, [comments, commentCanTranslate, detectCanTranslate, isAdmin, translateTarget])

  async function translateText(text: string): Promise<{ translated: string; remaining: number } | null> {
    const value = text?.trim()
    if (!value) return null

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value, target: translateTarget }),
      })

      if (!res.ok) {
        return null
      }

      return await res.json()
    } catch {
      return null
    }
  }

  async function translateMemo() {
    if (!post.memo || memoTranslating || !memoCanTranslate) return

    setMemoTranslating(true)
    const result = await translateText(post.memo)
    setMemoTranslating(false)

    if (!result) {
      alert(tPost('translateError'))
      return
    }

    setMemoTranslated({ locale: translateTarget, text: result.translated })
    setTranslateRemaining(result.remaining)
  }

  async function translateComment(commentId: string, body: string) {
    if (commentTranslatingId || !commentCanTranslate[`${translateTarget}:${commentId}`]) return

    setCommentTranslatingId(commentId)
    const result = await translateText(body)
    setCommentTranslatingId(null)

    if (!result) {
      alert(tPost('translateError'))
      return
    }

    setCommentTranslations((prev) => ({
      ...prev,
      [commentId]: { locale: translateTarget, text: result.translated },
    }))
    setTranslateRemaining(result.remaining)
  }

  async function handleToggleLike() {
    const next = !liked
    setLiked(next)
    setLikeCount((c: number) => Math.max(0, c + (next ? 1 : -1)))

    if (next) {
      await supabase.from('post_likes').insert({ user_id: userId, post_id: post.id })
    } else {
      await supabase.from('post_likes').delete().eq('user_id', userId).eq('post_id', post.id)
    }
  }

  async function handleToggleSave() {
    const next = !saved
    setSaved(next)
    setSaveCount((c: number) => Math.max(0, c + (next ? 1 : -1)))

    if (next) {
      await supabase.from('post_saves').insert({ user_id: userId, post_id: post.id })
    } else {
      await supabase.from('post_saves').delete().eq('user_id', userId).eq('post_id', post.id)
    }
  }

  async function submitComment() {
    if (!commentText.trim()) return

    setCommentLoading(true)
    const body = commentText.trim().slice(0, 200)
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: post.id, user_id: userId, body })
      .select('id, body, created_at, user_id, profiles(nickname, avatar_url)')
      .single()

    setCommentLoading(false)

    if (!error && data) {
      setComments((prev) => [...prev, data])
      setCommentText('')
    }
  }

  async function deleteComment(commentId: string) {
    await supabase.from('post_comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId)
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white">
        <div className="mx-auto flex h-12 w-full max-w-lg items-center px-4">
          <button onClick={() => router.back()} className="p-1 text-gray-500">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-sm font-semibold text-gray-900">{place?.name ?? ''}</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg pb-24">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <button
            onClick={() => router.push(`/profile/${profile?.id}`)}
            className="h-8 w-8 overflow-hidden rounded-full bg-gray-100"
          >
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile?.nickname ? `${profile.nickname} avatar` : ''}
                className="h-full w-full object-cover"
                width={32}
                height={32}
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                {profile?.nickname?.[0]}
              </div>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <button
              onClick={() => router.push(`/profile/${profile?.id}`)}
              className="block truncate text-left text-sm font-semibold text-gray-900"
            >
              {profile?.nickname}
            </button>
            <button
              onClick={() => router.push(`/place/${place?.id}`)}
              className="block truncate text-left text-xs text-gray-400"
            >
              {place?.name}
            </button>
          </div>

          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {post.type === 'visited' && post.rating ? tPost('rating.' + post.rating) : tFeed('wantTag')}
          </span>
        </div>

        {photos.length > 0 && (
          <div className="relative aspect-square overflow-hidden bg-gray-100">
            <Image
              src={getPostImageUrl(post, photoIndex, 'medium')}
              alt={place?.name ? `${place.name} photo` : ''}
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              loading="eager"
              priority={photoIndex === 0}
              unoptimized
            />
            {photos.length > 1 && (
              <>
                {photoIndex > 0 && (
                  <button
                    onClick={() => setPhotoIndex((i: number) => i - 1)}
                    className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40"
                  >
                    <svg width="14" height="14" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                {photoIndex < photos.length - 1 && (
                  <button
                    onClick={() => setPhotoIndex((i: number) => i + 1)}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40"
                  >
                    <svg width="14" height="14" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {tPost('category.' + place?.category)}
              {place?.place_type === 'hidden_spot' ? ` · ${tPost('hiddenSpot')}` : ''}
            </span>
            <div className="flex items-center gap-3">
              <button onClick={handleToggleSave} className="flex items-center gap-1">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={saved ? '#111' : 'none'}
                  stroke={saved ? '#111' : '#9CA3AF'}
                  strokeWidth={2}
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-xs text-gray-400">{saveCount}</span>
              </button>

              <button onClick={handleToggleLike} className="flex items-center gap-1">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={liked ? '#111' : 'none'}
                  stroke={liked ? '#111' : '#9CA3AF'}
                  strokeWidth={2}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span className="text-xs text-gray-400">{likeCount}</span>
              </button>

              <div className="flex items-center gap-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-xs text-gray-400">{commentsLoading ? '...' : comments.length}</span>
              </div>
            </div>
          </div>

          {post.memo && (
            <div>
              <p className="text-sm leading-relaxed text-gray-700">{post.memo}</p>
              {memoTranslated?.locale === translateTarget && (
                <p className="mt-1 text-sm leading-relaxed text-gray-500">{memoTranslated.text}</p>
              )}
              {memoCanTranslate && (
                <button onClick={translateMemo} disabled={memoTranslating} className="mt-1 text-xs font-medium text-gray-500">
                  {memoTranslating ? '...' : tPost('translate')}
                  {translateRemaining !== null && ` · ${tPost('translateRemaining', { remaining: translateRemaining })}`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100">
          {commentsLoading ? (
            <div className="px-4 py-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            </div>
          ) : comments.length > 0 ? (
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto px-4 pb-1 pt-3">
              {comments.map((c) => {
                const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-gray-200">
                      {profile?.avatar_url && (
                        <Image
                          src={profile.avatar_url}
                          className="h-full w-full object-cover"
                          alt={profile?.nickname ? `${profile.nickname} avatar` : ''}
                          width={24}
                          height={24}
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="mr-1.5 text-xs font-semibold text-gray-800">{profile?.nickname}</span>
                      <span className="break-words text-xs text-gray-700">{c.body}</span>
                      {commentTranslations[c.id]?.locale === translateTarget && (
                        <p className="mt-0.5 text-xs text-gray-400">{commentTranslations[c.id].text}</p>
                      )}
                      {commentTranslations[c.id]?.locale !== translateTarget && commentCanTranslate[`${translateTarget}:${c.id}`] === true && (
                        <button
                          onClick={() => translateComment(c.id, c.body)}
                          disabled={commentTranslatingId === c.id}
                          className="mt-0.5 text-[11px] font-medium text-gray-400"
                        >
                          {commentTranslatingId === c.id ? '...' : tPost('translate')}
                        </button>
                      )}
                    </div>
                    {c.user_id === userId && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="mt-0.5 shrink-0 text-[10px] leading-none text-gray-300"
                      >
                        {tPost('delete')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="flex items-center gap-2 px-4 py-2.5">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value.slice(0, 200))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submitComment()
                }
              }}
              placeholder={tPost('commentPlaceholder')}
              className="flex-1 rounded-full bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none placeholder:text-gray-400"
            />
            <button
              onClick={submitComment}
              disabled={!commentText.trim() || commentLoading}
              className="shrink-0 text-gray-900 disabled:text-gray-300"
              aria-label={tPost('commentPost')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="M22 2L11 13" strokeLinecap="round" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

