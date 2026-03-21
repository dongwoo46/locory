import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SavedClient from './SavedClient'

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const [followingData, profileData] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', user.id).eq('status', 'accepted'),
    supabase.from('profiles').select('avatar_url').eq('id', user.id).single(),
  ])
  const followingUserIds = (followingData.data || []).map((f: any) => f.following_id as string)
  const avatarUrl = profileData.data?.avatar_url ?? null

  return <SavedClient userId={user.id} followingUserIds={followingUserIds} avatarUrl={avatarUrl} />
}
