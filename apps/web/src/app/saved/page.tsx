import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SavedClient from './SavedClient'

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: followingData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .eq('status', 'accepted')

  const followingIds = (followingData || []).map((f: any) => f.following_id as string)

  const [{ data: savedPlaces }, { data: savedPosts }] = await Promise.all([
    supabase
      .from('place_saves')
      .select(`id, created_at, places!place_id (id, name, category, city, district, place_type, lat, lng)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('post_saves')
      .select(`
        id, created_at,
        posts!post_id (
          id, type, rating, memo, photos, created_at,
          profiles!user_id (id, nickname, nationality, avatar_url, trust_score),
          places!place_id (id, name, category, district, city, place_type),
          post_likes (count)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  let followingPlaces: any[] = []
  if (followingIds.length > 0) {
    const { data: fData } = await supabase
      .from('place_saves')
      .select(`
        id, user_id, created_at,
        places!place_id (id, name, category, city, district, place_type),
        profiles!user_id (id, nickname, avatar_url)
      `)
      .in('user_id', followingIds)
      .order('created_at', { ascending: false })
      .limit(50)

    followingPlaces = (fData || [])
      .filter((s: any) => s.places)
      .map((s: any) => ({ ...s.places, savedBy: s.profiles }))
  }

  const places = (savedPlaces || []).map((s: any) => s.places).filter(Boolean)
  const posts = (savedPosts || []).map((s: any) => s.posts).filter(Boolean)
  const savedPostIds = new Set(posts.map((p: any) => p.id as string))

  return (
    <SavedClient
      places={places}
      posts={posts}
      userId={user.id}
      savedPostIds={savedPostIds}
      followingPlaces={followingPlaces}
    />
  )
}
