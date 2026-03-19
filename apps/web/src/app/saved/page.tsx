import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SavedClient from './SavedClient'

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: followingData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .eq('status', 'accepted')
  const followingUserIds = (followingData || []).map((f: any) => f.following_id as string)

  return <SavedClient userId={user.id} followingUserIds={followingUserIds} />
}
