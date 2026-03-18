import { createClient } from '@/lib/supabase/server'
import FeedClient from './FeedClient'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: following }] = await Promise.all([
    supabase.from('profiles').select('nickname, nationality, avatar_url, id').eq('id', user!.id).single(),
    supabase.from('follows').select('following_id').eq('follower_id', user!.id).eq('status', 'accepted'),
  ])

  const followingUserIds = (following || []).map((f: any) => f.following_id)

  return <FeedClient profile={profile} userId={user!.id} followingUserIds={followingUserIds} />
}
