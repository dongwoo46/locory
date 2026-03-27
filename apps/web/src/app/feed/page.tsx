import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FeedClient from './FeedClient'
import GuestFeedClient from './GuestFeedClient'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) {
    const { data: guestPosts } = await supabase
      .from('posts')
      .select('id, type, rating, created_at, photos, photo_variants, places(name, category), post_likes(count), post_saves(count)')
      .eq('is_public', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(30)

    return <GuestFeedClient posts={guestPosts ?? []} />
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, nationality, avatar_url, id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/api/auth/signout')

  return <FeedClient profile={profile} userId={user.id} />
}
