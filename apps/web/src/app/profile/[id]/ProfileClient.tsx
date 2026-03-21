'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import BottomNav from '@/components/ui/BottomNav'
import { getScentLevel } from '@/types/database'
import ScentBar from '@/components/ui/ScentBar'
import PostGrid from '@/components/feed/PostGrid'
import ReportSheet from '@/components/ui/ReportSheet'
import NotificationBell from '@/components/ui/NotificationBell'
import PlaceAddSheet from '@/components/place/PlaceAddSheet'

const NATIONALITY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', JP: '🇯🇵', US: '🇺🇸', CN: '🇨🇳', ES: '🇪🇸', RU: '🇷🇺', OTHER: '🌍',
}

const CATEGORY_COLOR: Record<string, string> = {
  cafe: '#795548', restaurant: '#F44336', photospot: '#9C27B0',
  bar: '#FF9800', culture: '#2196F3', nature: '#4CAF50',
  shopping: '#E91E63', street: '#607D8B',
}

const STYLE_TAG_CATEGORIES: { category: string; minPct: number }[] = [
  { category: 'cafe',       minPct: 25 },
  { category: 'restaurant', minPct: 25 },
  { category: 'photospot',  minPct: 20 },
  { category: 'street',     minPct: 20 },
  { category: 'bar',        minPct: 20 },
  { category: 'culture',    minPct: 20 },
  { category: 'nature',     minPct: 20 },
  { category: 'shopping',   minPct: 20 },
]

function DonutChart({ data, getCategoryLabel }: { data: { category: string; count: number }[]; getCategoryLabel: (cat: string) => string }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return null
  const r = 36; const cx = 44; const cy = 44
  let angle = -Math.PI / 2
  const slices = data.map(d => {
    const sweep = (d.count / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle)
    const y2 = cy + r * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    return {
      path: `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
      color: CATEGORY_COLOR[d.category] || '#9CA3AF',
      category: d.category,
      pct: Math.round((d.count / total) * 100),
    }
  })
  return (
    <div className="flex items-center gap-5">
      <svg width="88" height="88" viewBox="0 0 88 88">
        {slices.map(s => <path key={s.category} d={s.path} fill={s.color} />)}
        <circle cx={cx} cy={cy} r={18} fill="white" />
      </svg>
      <div className="flex flex-col gap-1.5">
        {slices.map(s => (
          <div key={s.category} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-gray-600">{getCategoryLabel(s.category)}</span>
            <span className="text-xs text-gray-400 ml-auto pl-3">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Profile {
  id: string
  nickname: string
  nationality: string
  avatar_url: string | null
  trust_score: number
  is_public: boolean
  created_at: string
  gender: 'male' | 'female' | 'other' | null
  birth_date: string | null
  bio: string | null
}

interface Props {
  profile: Profile
  followersCount: number
  followingCount: number
  isMe: boolean
  myId: string
  isFollowing: boolean
  followStatus: 'none' | 'pending' | 'accepted'
}

export default function ProfileClient({
  profile: initialProfile,
  followersCount: initialFollowers,
  followingCount,
  isMe,
  myId,
  isFollowing: initialFollowing,
  followStatus: initialFollowStatus,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('profile')
  const tCommon = useTranslations('common')
  const tFeed = useTranslations('feed')
  const tPost = useTranslations('post')

  const [profile, setProfile] = useState(initialProfile)
  const [followersCount, setFollowersCount] = useState(initialFollowers)

  // 포스팅 — 2분 캐싱
  const { data: rawPosts } = useQuery({
    queryKey: ['profile-posts', profile.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select(`
          id, type, rating, memo, photos, created_at, is_public,
          places!place_id (id, name, category, district, city, place_type),
          profiles!user_id (id, nickname, nationality, avatar_url, trust_score),
          post_likes (count)
        `)
        .eq('user_id', profile.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      return data || []
    },
    staleTime: 2 * 60 * 1000,
  })
  const posts = (rawPosts ?? []) as any[]
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [followStatus, setFollowStatus] = useState(initialFollowStatus)
  const [showTaste, setShowTaste] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showActionSheet, setShowActionSheet] = useState(false)
  const [showPlaceAdd, setShowPlaceAdd] = useState(false)

  const visiblePosts = isMe ? posts : (profile.is_public || isFollowing) ? posts : []

  // 카테고리 분포 계산
  const categoryCounts: Record<string, number> = {}
  posts.forEach(p => {
    const cat = p.places?.category
    if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  })
  const chartData = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
  const totalPosts = chartData.reduce((s, d) => s + d.count, 0)

  // 스타일 태그
  const styleTags = totalPosts >= 3
    ? STYLE_TAG_CATEGORIES.filter(tag => {
        const pct = ((categoryCounts[tag.category] || 0) / totalPosts) * 100
        return pct >= tag.minPct
      })
    : []
  const hasHiddenSpot = posts.some(p => p.places?.place_type === 'hidden_spot')

  async function handleFollow() {
    if (followStatus === 'accepted' || followStatus === 'pending') {
      await supabase.from('follows').delete()
        .eq('follower_id', myId).eq('following_id', profile.id)
      setIsFollowing(false)
      setFollowStatus('none')
      if (followStatus === 'accepted') setFollowersCount(c => c - 1)
    } else {
      const status = profile.is_public ? 'accepted' : 'pending'
      await supabase.from('follows').insert({ follower_id: myId, following_id: profile.id, status })
      setIsFollowing(status === 'accepted')
      setFollowStatus(status)
      if (status === 'accepted') setFollowersCount(c => c + 1)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-40">
        <div className="max-w-lg mx-auto flex items-center h-14 px-4">
          {/* 왼쪽 */}
          {isMe ? (
            <button
              onClick={() => setShowActionSheet(true)}
              className="p-2 -ml-1 text-gray-700 shrink-0"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <button onClick={() => router.back()} className="text-gray-500 p-1 shrink-0">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {/* 중앙: 닉네임 */}
          <h1 className="flex-1 text-center text-base font-bold text-gray-900">{profile.nickname}</h1>
          {/* 오른쪽 */}
          <div className="flex items-center gap-1 shrink-0">
            {!isMe && (
              <button onClick={() => setShowReport(true)} className="text-gray-300 p-1">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" />
                </svg>
              </button>
            )}
            {isMe && <NotificationBell userId={myId} />}
            {isMe && (
              <Link href="/settings" className="text-gray-400 p-1">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto pt-14 pb-24">
        {/* 프로필 카드 */}
        <div className="bg-white px-4 py-6 flex flex-col items-center gap-4 border-b border-gray-100">
          {/* 아바타 */}
          <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">
                  {profile.nickname?.[0]}
                </div>
            }
          </div>

          {/* 국적 + 성별/나이 */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>{NATIONALITY_FLAGS[profile.nationality]} {t(`nationality.${profile.nationality}`)}</span>
              {(profile.gender || profile.birth_date) && (
                <span className="text-gray-300">·</span>
              )}
              {profile.gender && (
                <span>{t(`gender.${profile.gender}`)}</span>
              )}
              {profile.birth_date && (
                <span>{(() => {
                  const today = new Date()
                  const birth = new Date(profile.birth_date!)
                  let age = today.getFullYear() - birth.getFullYear()
                  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
                  return age
                })()}세</span>
              )}
            </div>
            {profile.bio && (
              <p className="text-sm text-gray-500 text-center mt-1 max-w-xs">{profile.bio}</p>
            )}
          </div>

          {/* 냄새 바 */}
          <div className="w-full px-2">
            <ScentBar trustScore={profile.trust_score} />
          </div>

          {/* 팔로워 / 팔로잉 / 포스트 */}
          <div className="flex gap-8 text-center">
            <div>
              <p className="text-base font-bold text-gray-900">{followersCount}</p>
              <p className="text-xs text-gray-400">{t('followers')}</p>
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">{followingCount}</p>
              <p className="text-xs text-gray-400">{t('following')}</p>
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">{visiblePosts.length}</p>
              <p className="text-xs text-gray-400">{t('posts')}</p>
            </div>
          </div>

          {/* 스타일 태그 */}
          {(styleTags.length > 0 || hasHiddenSpot) && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {styleTags.map(tag => (
                <span
                  key={tag.category}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: CATEGORY_COLOR[tag.category] + '18', color: CATEGORY_COLOR[tag.category] }}
                >
                  {t(`styleTag.${tag.category}`)}
                </span>
              ))}
              {hasHiddenSpot && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-600">
                  {t('localSpotHunter')}
                </span>
              )}
            </div>
          )}

          {/* 내 취향 분포 토글 */}
          {chartData.length > 0 && (
            <button
              onClick={() => setShowTaste(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 font-medium px-3 py-1.5 bg-gray-50 rounded-full"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              </svg>
              {t('tasteDist')}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                style={{ transform: showTaste ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M6 9l6 6 6-6" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* 취향 분포 차트 */}
          {showTaste && chartData.length > 0 && (
            <div className="w-full px-2 py-3 bg-gray-50 rounded-2xl">
              <DonutChart data={chartData} getCategoryLabel={(cat) => tPost(`category.${cat}`)} />
            </div>
          )}

          {/* 팔로우 버튼 (타인 프로필) */}
          {!isMe && (
            <button
              onClick={handleFollow}
              className={`w-full max-w-xs py-2.5 rounded-xl text-sm font-medium transition-colors ${
                followStatus !== 'none'
                  ? 'bg-gray-100 text-gray-600 border border-gray-200'
                  : 'bg-gray-900 text-white'
              }`}
            >
              {followStatus === 'accepted' ? tCommon('following') : followStatus === 'pending' ? t('requested') : tCommon('follow')}
            </button>
          )}
        </div>

        {/* 포스트 그리드 */}
        {visiblePosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-gray-400 text-sm">
              {isMe ? t('noPosts') : t('noPublicPosts')}
            </p>
          </div>
        ) : (
          <div className="mt-1">
            <PostGrid
              posts={visiblePosts}
              userId={myId}
            />
          </div>
        )}
      </main>

      {showReport && (
        <ReportSheet targetType="user" targetId={profile.id} onClose={() => setShowReport(false)} />
      )}

      {/* + 액션시트 */}
      {showActionSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowActionSheet(false)} />
          <div className="relative bg-white rounded-t-2xl max-w-lg mx-auto w-full px-4 pt-4 pb-10">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <button
              onClick={() => { setShowActionSheet(false); router.push('/upload') }}
              className="w-full flex items-center gap-3 py-3 px-2 rounded-xl active:bg-gray-50"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M12 8v8M8 12h8" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">{tFeed('addFeed')}</p>
                <p className="text-xs text-gray-400">{tFeed('addFeedDesc')}</p>
              </div>
            </button>
            <button
              onClick={() => { setShowActionSheet(false); setShowPlaceAdd(true) }}
              className="w-full flex items-center gap-3 py-3 px-2 rounded-xl active:bg-gray-50"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">{tFeed('addPlace')}</p>
                <p className="text-xs text-gray-400">{tFeed('addPlaceDesc')}</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {showPlaceAdd && <PlaceAddSheet onClose={() => setShowPlaceAdd(false)} />}

      <BottomNav avatarUrl={profile.avatar_url} />
    </div>
  )
}
