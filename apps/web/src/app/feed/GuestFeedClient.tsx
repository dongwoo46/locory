'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { getPostImageUrl } from '@/lib/utils/postImage'
import { createClient } from '@/lib/supabase/client'

type GuestPost = {
  id: string
  type: 'visited' | 'want'
  rating: string | null
  photos?: string[] | null
  photo_variants?: Array<{ thumbnailUrl?: string; mediumUrl?: string; originalUrl?: string }> | null
  places?: { name?: string | null; category?: string | null } | Array<{ name?: string | null; category?: string | null }> | null
  post_likes?: Array<{ count?: number | string }>
  post_saves?: Array<{ count?: number | string }>
}

const FEED_FRAME_CLASS = 'mx-auto w-full max-w-lg'
const GUEST_PREVIEW_LIMIT = 8

function loginHref(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`
}

function resolvePlace(
  place: GuestPost['places']
): { name?: string | null; category?: string | null } | null {
  if (!place) return null
  if (Array.isArray(place)) return place[0] ?? null
  return place
}

function toCount(value: number | string | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseInt(value, 10) || 0
  return 0
}

export default function GuestFeedClient({ posts }: { posts: GuestPost[] }) {
  const supabase = useMemo(() => createClient(), [])
  const tFeed = useTranslations('feed')
  const tPost = useTranslations('post')
  const tUpload = useTranslations('upload')
  const [guestPosts, setGuestPosts] = useState<GuestPost[]>(posts)
  const [loadingPosts, setLoadingPosts] = useState(posts.length === 0)
  const [showLoadMoreSpinner, setShowLoadMoreSpinner] = useState(false)
  const [showLoginGateModal, setShowLoginGateModal] = useState(false)
  const gateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gateActiveRef = useRef(false)

  useEffect(() => {
    if (posts.length > 0) return

    let active = true
    const loadGuestPosts = async () => {
      setLoadingPosts(true)
      const { data } = await supabase
        .from('posts')
        .select('id, type, rating, created_at, photos, photo_variants, places(name, category), post_likes(count), post_saves(count)')
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(GUEST_PREVIEW_LIMIT)

      if (active) {
        setGuestPosts((data as GuestPost[]) ?? [])
        setLoadingPosts(false)
      }
    }

    void loadGuestPosts()
    return () => {
      active = false
    }
  }, [posts.length, supabase])

  useEffect(() => {
    if (guestPosts.length < GUEST_PREVIEW_LIMIT) return

    const onScroll = () => {
      if (gateActiveRef.current) return
      const scrollY = window.scrollY || window.pageYOffset
      const viewportBottom = window.innerHeight + scrollY
      const fullHeight = document.documentElement.scrollHeight
      const nearBottom = viewportBottom >= fullHeight - 180
      if (!nearBottom) return

      gateActiveRef.current = true
      setShowLoadMoreSpinner(true)
      if (gateTimerRef.current) {
        clearTimeout(gateTimerRef.current)
      }
      gateTimerRef.current = setTimeout(() => {
        setShowLoadMoreSpinner(false)
        setShowLoginGateModal(true)
      }, 700)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (gateTimerRef.current) {
        clearTimeout(gateTimerRef.current)
      }
    }
  }, [guestPosts.length])

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className={`${FEED_FRAME_CLASS} flex items-center justify-between px-4 py-1`}>
          <Image src="/logo_guest_header.png" alt="Locory" width={168} height={72} className="h-14 w-auto" priority sizes="168px" />
          <Link
            href={loginHref('/feed')}
            prefetch={false}
            className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
          >
            {tUpload('loginRequired')}
          </Link>
        </div>
      </header>

      <main className={`${FEED_FRAME_CLASS} pb-28`}>
        {loadingPosts ? (
          <div className="grid grid-cols-3 gap-[1px] bg-gray-100">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div key={idx} className="aspect-[3/4] animate-pulse bg-gray-200" />
            ))}
          </div>
        ) : guestPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-gray-400 text-sm">{tFeed('noPostsTitle')}</p>
            <p className="text-gray-300 text-xs">{tFeed('noPostsSubtitle')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-[1px] bg-gray-100">
            {guestPosts.map((post, index) => {
              const place = resolvePlace(post.places)
              const likeCount = toCount(post.post_likes?.[0]?.count)
              const saveCount = toCount(post.post_saves?.[0]?.count)
              return (
                <Link
                  key={post.id}
                  href={loginHref(`/post/${post.id}`)}
                  prefetch={false}
                  className="relative block aspect-[3/4] overflow-hidden bg-gray-100"
                >
                  {post.photos?.[0] ? (
                    <Image
                      src={getPostImageUrl(
                        {
                          photos: post.photos ?? undefined,
                          photo_variants: post.photo_variants ?? undefined,
                        },
                        0,
                        'thumbnail'
                      )}
                      alt={place?.name ? `${place.name} thumbnail` : ''}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 33vw, 180px"
                      loading={index === 0 ? 'eager' : 'lazy'}
                      priority={index === 0}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-2">
                      <span className="text-center text-[11px] text-gray-400">{place?.name || ''}</span>
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 via-black/22 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-8 text-white">
                    <p className="truncate text-[11px] font-bold leading-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">
                      {place?.name || ''}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[9px] font-medium text-white/95 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">
                        {post.type === 'visited' && post.rating ? tPost(`rating.${post.rating}`) : tFeed('wantTag')}
                      </span>
                      <span className="shrink-0 text-[10px] font-medium text-white/95 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">
                        {likeCount + saveCount > 0 ? `${likeCount + saveCount}` : ''}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      {showLoadMoreSpinner && (
        <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
          <div className="rounded-full bg-gray-900/92 p-2.5">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </div>
        </div>
      )}

      {showLoginGateModal && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/40 px-4 pb-24 sm:items-center sm:pb-0">
          <div className={`${FEED_FRAME_CLASS} w-full rounded-2xl bg-white p-4 shadow-lg`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{tUpload('loginRequired')}</p>
                <p className="mt-1 text-xs text-gray-500">{tFeed('guestLoginRequiredMessage')}</p>
              </div>
              <button
                onClick={() => {
                  setShowLoginGateModal(false)
                  setShowLoadMoreSpinner(false)
                  gateActiveRef.current = false
                }}
                className="shrink-0 rounded-full p-1 text-gray-400"
                aria-label="Close"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex justify-end">
              <Link
                href={loginHref('/feed')}
                prefetch={false}
                className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Continue with Google
              </Link>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white pb-1">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-[calc(env(safe-area-inset-bottom)+4px)]">
          <Link href={loginHref('/feed')} prefetch={false} className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 text-gray-900">
            <svg width="20" height="20" fill="currentColor" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </Link>
          <Link href={loginHref('/map')} prefetch={false} className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 text-gray-400">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </Link>
          <Link href={loginHref('/meetup')} prefetch={false} className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 text-gray-400">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link href={loginHref('/saved')} prefetch={false} className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 text-gray-400">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </Link>
          <Link href={loginHref('/profile/me')} prefetch={false} className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 text-gray-400">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
      </nav>
    </div>
  )
}
