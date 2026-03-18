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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { points } = await req.json()
  const deduct = Math.abs(Number(points) || 10)

  const adminClient = await createAdminClient()

  // 현재 점수 조회
  const { data: profile } = await adminClient
    .from('profiles')
    .select('trust_score')
    .eq('id', id)
    .single()
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const newScore = Math.max(0, profile.trust_score - deduct)

  // 점수 업데이트
  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ trust_score: newScore })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // 로그 기록
  await adminClient.from('trust_logs').insert({
    user_id: id,
    action_type: 'reported',
    points: -deduct,
  })

  return NextResponse.json({ ok: true, new_score: newScore })
}
