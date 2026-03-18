'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import BottomNav from '@/components/ui/BottomNav'
import { getScentLevel } from '@/types/database'
import ScentBar from '@/components/ui/ScentBar'
import PostGrid from '@/components/feed/PostGrid'
import ReportSheet from '@/components/ui/ReportSheet'
import NotificationBell from '@/components/ui/NotificationBell'

const NATIONALITY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', JP: '🇯🇵', US: '🇺🇸', CN: '🇨🇳', ES: '🇪🇸', RU: '🇷🇺', OTHER: '🌍',
}

const NATIONALITY_LABELS: Record<string, string> = {
  KR: '한국', JP: '일본', US: '미국', CN: '중국', ES: '스페인/남미', RU: '러시아', OTHER: '기타',
}

const CATEGORY_COLOR: Record<string, string> = {
  cafe: '#795548', restaurant: '#F44336', photospot: '#9C27B0',
  bar: '#FF9800', culture: '#2196F3', nature: '#4CAF50',
  shopping: '#E91E63', street: '#607D8B',
}

const CATEGORY_LABEL: Record<string, string> = {
  cafe: '카페', restaurant: '맛집', photospot: '포토스팟',
  bar: '바', culture: '문화', nature: '자연',
  shopping: '쇼핑', street: '길거리',
}

const STYLE_TAGS: { category: string; label: string; minPct: number }[] = [
  { category: 'cafe',       label: '카페 탐방러',     minPct: 25 },
  { category: 'restaurant', label: '맛집 헌터',       minPct: 25 },
  { category: 'photospot',  label: '포토스팟 수집가', minPct: 20 },
  { category: 'street',     label: '길거리 탐험가',   minPct: 20 },
  { category: 'bar',        label: '바 홀릭',         minPct: 20 },
  { category: 'culture',    label: '문화 탐방러',     minPct: 20 },
  { category: 'nature',     label: '자연 힐러',       minPct: 20 },
  { category: 'shopping',   label: '쇼핑 러버',       minPct: 20 },
]

function DonutChart({ data }: { data: { category: string; count: number }[] }) {
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
            <span className="text-xs text-gray-600">{CATEGORY_LABEL[s.category]}</span>
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
  posts: any[]
  followersCount: number
  followingCount: number
  isMe: boolean
  myId: string
  isFollowing: boolean
  followStatus: 'none' | 'pending' | 'accepted'
}

export default function ProfileClient({
  profile: initialProfile,
  posts,
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

  const [profile, setProfile] = useState(initialProfile)
  const [followersCount, setFollowersCount] = useState(initialFollowers)
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [followStatus, setFollowStatus] = useState(initialFollowStatus)
  const [showTaste, setShowTaste] = useState(false)
  const [showReport, setShowReport] = useState(false)

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
    ? STYLE_TAGS.filter(t => {
        const pct = ((categoryCounts[t.category] || 0) / totalPosts) * 100
        return pct >= t.minPct
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
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-40">
        <div className="max-w-lg mx-auto flex items-center h-14 px-4 gap-3">
          {!isMe && (
            <button onClick={() => router.back()} className="text-gray-500 p-1">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <h1 className="text-base font-bold text-gray-900 flex-1">
            {isMe ? t('myProfile') : profile.nickname}
          </h1>
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

          {/* 닉네임 + 국적 + 성별/나이 */}
          <div className="flex flex-col items-center gap-1">
            <h2 className="text-lg font-bold text-gray-900">{profile.nickname}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>{NATIONALITY_FLAGS[profile.nationality]} {NATIONALITY_LABELS[profile.nationality]}</span>
              {(profile.gender || profile.birth_date) && (
                <span className="text-gray-300">·</span>
              )}
              {profile.gender && (
                <span>{profile.gender === 'female' ? '여자' : profile.gender === 'male' ? '남자' : '기타'}</span>
              )}
              {profile.birth_date && (
                <span>{new Date().getFullYear() - new Date(profile.birth_date).getFullYear()}세</span>
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
                  {tag.label}
                </span>
              ))}
              {hasHiddenSpot && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-600">
                  히든스팟 헌터
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
              내 취향 분포보기
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                style={{ transform: showTaste ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M6 9l6 6 6-6" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* 취향 분포 차트 */}
          {showTaste && chartData.length > 0 && (
            <div className="w-full px-2 py-3 bg-gray-50 rounded-2xl">
              <DonutChart data={chartData} />
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
              savedPostIds={new Set()}
            />
          </div>
        )}
      </main>

      {showReport && (
        <ReportSheet targetType="user" targetId={profile.id} onClose={() => setShowReport(false)} />
      )}
      <BottomNav />
    </div>
  )
}
