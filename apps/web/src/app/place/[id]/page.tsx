import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlaceClient from './PlaceClient'

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const [{ data: place }, { data: posts }, { data: myProfile }] = await Promise.all([
    supabase
      .from('places')
      .select('id, name, lat, lng, address, city, district, category, place_type, avg_rating')
      .eq('id', id)
      .single(),
    supabase
      .from('posts')
      .select(`
        id, type, rating, memo, photos, created_at,
        profiles!user_id (id, nickname, nationality, avatar_url),
        post_likes (count)
      `)
      .eq('place_id', id)
      .eq('is_public', true)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('gender, birth_date, nationality, is_public, trust_score').eq('id', user.id).single(),
  ])

  if (!place) redirect('/feed')

  const [
    { data: savedPosts },
    { data: likedPosts },
    { data: placeSave },
    { data: placeLikeRow },
    { count: placeLikeCount },
    { count: placeSaveCount },
  ] = await Promise.all([
    supabase.from('post_saves').select('post_id').eq('user_id', user.id),
    supabase.from('post_likes').select('post_id').eq('user_id', user.id),
    supabase.from('place_saves').select('id').eq('user_id', user.id).eq('place_id', id).maybeSingle(),
    supabase.from('place_likes').select('id').eq('user_id', user.id).eq('place_id', id).maybeSingle(),
    supabase.from('place_likes').select('*', { count: 'exact', head: true }).eq('place_id', id),
    supabase.from('place_saves').select('*', { count: 'exact', head: true }).eq('place_id', id),
  ])

  const savedPostIds = new Set((savedPosts || []).map(s => s.post_id))
  const likedPostIds = new Set((likedPosts || []).map(l => l.post_id))

  return (
    <PlaceClient
      place={place}
      posts={(posts || []).map(p => ({ ...p, places: place }))}
      userId={user.id}
      savedPostIds={savedPostIds}
      likedPostIds={likedPostIds}
      isPlaceSaved={!!placeSave}
      isPlaceLiked={!!placeLikeRow}
      placeLikeCount={placeLikeCount ?? 0}
      placeSaveCount={placeSaveCount ?? 0}
      userGender={myProfile?.gender ?? null}
      userBirthDate={myProfile?.birth_date ?? null}
      userNationality={myProfile?.nationality ?? null}
      userIsPublic={myProfile?.is_public ?? false}
      userTrustScore={myProfile?.trust_score ?? 1}
    />
  )
}
