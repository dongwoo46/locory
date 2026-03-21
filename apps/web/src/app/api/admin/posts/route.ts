import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET(req: Request) {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const showDeleted = searchParams.get('deleted') === 'true'

  const adminClient = createAdminClient()

  let query = adminClient
    .from('posts')
    .select('id, type, rating, memo, photos, created_at, deleted_at, is_public, places!place_id(id, name, city), profiles!user_id(id, nickname, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (showDeleted) {
    query = query.not('deleted_at', 'is', null)
  } else {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filtered = search
    ? (data || []).filter((p: any) =>
        p.places?.name?.includes(search) ||
        p.profiles?.nickname?.includes(search) ||
        p.memo?.includes(search)
      )
    : data || []

  return NextResponse.json({ posts: filtered })
}
