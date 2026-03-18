import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const targetId = id === 'me' ? user.id : id

  const [{ data: profile }, { data: posts }, { count: followersCount }, { count: followingCount }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, nickname, nationality, avatar_url, trust_score, is_public, created_at, gender, birth_date, bio')
        .eq('id', targetId)
        .single(),
      supabase
        .from('posts')
        .select(`
          id, type, rating, memo, photos, created_at, is_public,
          places!place_id (id, name, category, district, city, place_type),
          profiles!user_id (id, nickname, nationality, avatar_url, trust_score),
          post_likes (count)
        `)
        .eq('user_id', targetId)
        .order('created_at', { ascending: false }),
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
    ])

  // 팔로우 상태 확인
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

  if (!profile) redirect('/feed')

  return (
    <ProfileClient
      profile={profile}
      posts={posts || []}
      followersCount={followersCount ?? 0}
      followingCount={followingCount ?? 0}
      isMe={user.id === targetId}
      myId={user.id}
      isFollowing={followStatus === 'accepted'}
      followStatus={followStatus}
    />
  )
}
