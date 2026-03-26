import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) redirect('/login')

  const targetId = id === 'me' ? user.id : id

  const [{ data: profile }, { count: followersCount }, { count: followingCount }, { count: totalPostsCount }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, nickname, nationality, avatar_url, trust_score, is_public, created_at, gender, birth_date, bio')
        .eq('id', targetId)
        .single(),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', targetId)
        .eq('status', 'accepted'),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', targetId)
        .eq('status', 'accepted'),
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetId)
        .is('deleted_at', null),
    ])

  // 팔로우 상태 확인 (본인이 아닐 때만)
  let followStatus: 'none' | 'pending' | 'accepted' = 'none'
  if (user.id !== targetId) {
    const { data: followRow } = await supabase
      .from('follows')
      .select('status')
      .eq('follower_id', user.id)
      .eq('following_id', targetId)
      .single()
    if (followRow) followStatus = followRow.status as 'pending' | 'accepted'
  }

  // 내 프로필이 없으면 세션 초기화, 타인 프로필이 없으면 피드로
  if (!profile) {
    if (targetId === user.id) redirect('/api/auth/signout')
    else redirect('/feed')
  }

  return (
    <ProfileClient
      profile={profile}
      followersCount={followersCount ?? 0}
      followingCount={followingCount ?? 0}
      totalPostsCount={totalPostsCount ?? 0}
      isMe={user.id === targetId}
      myId={user.id}
      isFollowing={followStatus === 'accepted'}
      followStatus={followStatus}
    />
  )
}
