import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PostDetailClient from './PostDetailClient'

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  const { data: post } = await supabase
    .from('posts')
    .select(`
      id, user_id, type, rating, memo, recommended_menu, photos, photo_variants, created_at, is_public,
      places!place_id (id, name, category, district, city, place_type),
      profiles!user_id (id, nickname, nationality, avatar_url, trust_score),
      post_likes (count), post_saves (count)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!post) redirect('/feed')
  if (!post.is_public && post.user_id !== user.id) redirect('/feed')

  const [{ data: likeRow }, { data: saveRow }, { data: comments }] = await Promise.all([
    supabase.from('post_likes').select('id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
    supabase.from('post_saves').select('id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
    supabase
      .from('post_comments')
      .select('id, body, created_at, user_id, profiles(nickname, avatar_url)')
      .eq('post_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
  ])

  return (
    <PostDetailClient
      userId={user.id}
      post={post}
      initialLiked={!!likeRow}
      initialSaved={!!saveRow}
      initialComments={comments ?? []}
    />
  )
}

