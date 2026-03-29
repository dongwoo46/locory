import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function toNumberOrNull(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: Request) {
  const startedAt = performance.now()
  const url = new URL(request.url)
  const searchParams = url.searchParams

  const feedTab = searchParams.get('feedTab') === 'following' ? 'following' : 'all'
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 15), 1), 50)
  const latMin = toNumberOrNull(searchParams.get('latMin'))
  const latMax = toNumberOrNull(searchParams.get('latMax'))
  const lngMin = toNumberOrNull(searchParams.get('lngMin'))
  const lngMax = toNumberOrNull(searchParams.get('lngMax'))
  const cursorCreatedAt = searchParams.get('cursorCreatedAt')
  const cursorId = searchParams.get('cursorId')

  const supabase = await createClient()

  const authStartedAt = performance.now()
  const { data: { session } } = await supabase.auth.getSession()
  const authMs = performance.now() - authStartedAt
  const user = session?.user ?? null

  if (!user) {
    const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Server-Timing', `feed_auth;dur=${authMs.toFixed(1)},feed_total;dur=${(performance.now() - startedAt).toFixed(1)}`)
    return response
  }

  let followingIds: string[] = []
  let followingMs = 0
  if (feedTab === 'following') {
    const followingStartedAt = performance.now()
    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .eq('status', 'accepted')
    if (error) {
      return NextResponse.json({ error: 'Failed to load following ids' }, { status: 500 })
    }
    followingIds = (data ?? []).map((item: { following_id: string }) => item.following_id)
    followingMs = performance.now() - followingStartedAt
  }

  const feedStartedAt = performance.now()
  const { data, error } = await supabase.rpc('get_feed_with_interactions', {
    p_user_id: user.id,
    p_feed_tab: feedTab,
    p_following_ids: followingIds,
    p_lat_min: latMin,
    p_lat_max: latMax,
    p_lng_min: lngMin,
    p_lng_max: lngMax,
    p_limit: limit,
    p_cursor_created_at: cursorCreatedAt,
    p_cursor_id: cursorId,
  })
  const feedFetchMs = performance.now() - feedStartedAt

  if (error) {
    const response = NextResponse.json({ error: 'Failed to load feed' }, { status: 500 })
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set(
      'Server-Timing',
      `feed_auth;dur=${authMs.toFixed(1)},feed_following;dur=${followingMs.toFixed(1)},feed_fetch;dur=${feedFetchMs.toFixed(1)},feed_total;dur=${(performance.now() - startedAt).toFixed(1)}`
    )
    return response
  }

  const serializeStartedAt = performance.now()
  const payload = data ?? { posts: [], interactions: { savedPostIds: [], savedPlaceIds: [], likedPostIds: [], likedPlaceIds: [] } }
  const serializeMs = performance.now() - serializeStartedAt

  const response = NextResponse.json(payload)
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set(
    'Server-Timing',
    `feed_auth;dur=${authMs.toFixed(1)},feed_following;dur=${followingMs.toFixed(1)},feed_fetch;dur=${feedFetchMs.toFixed(1)},feed_render;dur=${serializeMs.toFixed(1)},feed_total;dur=${(performance.now() - startedAt).toFixed(1)}`
  )
  return response
}
