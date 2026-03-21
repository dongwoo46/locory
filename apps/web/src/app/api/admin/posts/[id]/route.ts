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

// Soft delete post
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()

  // 삭제 전 작성자 조회
  const { data: post } = await adminClient
    .from('posts')
    .select('user_id, places!place_id(name)')
    .eq('id', id)
    .single()

  const { error } = await adminClient.from('posts').update({
    deleted_at: new Date().toISOString(),
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 작성자에게 알림 발송
  if (post?.user_id) {
    const placeName = (post.places as any)?.name ?? ''
    await adminClient.from('notifications').insert({
      user_id: post.user_id,
      type: 'post_deleted',
      title: '포스팅이 삭제되었어요',
      body: placeName ? `"${placeName}" 포스팅이 신고로 인해 삭제되었어요.` : '포스팅이 신고로 인해 삭제되었어요.',
      data: { post_id: id },
    })
  }

  return NextResponse.json({ ok: true })
}

// Restore post
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { error } = await adminClient.from('posts').update({ deleted_at: null }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
