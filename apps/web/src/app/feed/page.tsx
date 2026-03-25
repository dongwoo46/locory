import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FeedClient from './FeedClient'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, nationality, avatar_url, id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/api/auth/signout')

  return <FeedClient profile={profile} userId={user.id} />
}
