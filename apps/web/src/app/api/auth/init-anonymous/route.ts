import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.is_anonymous) {
    return NextResponse.json({ error: 'not anonymous' }, { status: 401 })
  }

  // 이미 프로필 있으면 스킵
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (existing) return NextResponse.json({ ok: true })

  // 익명 사용자 기본 프로필 생성
  const admin = createAdminClient()
  const shortId = user.id.replace(/-/g, '').slice(0, 6).toUpperCase()
  const nickname = `Guest_${shortId}`

  const { error } = await admin.from('profiles').insert({
    id: user.id,
    nickname,
    nationality: 'OTHER',
    is_public: false,
    role: 'user',
    trust_score: 4,
    onboarded: true,
  })

  if (error) {
    // 닉네임 중복 시 더 긴 ID 사용
    const longId = user.id.replace(/-/g, '').slice(0, 10).toUpperCase()
    const { error: e2 } = await admin.from('profiles').insert({
      id: user.id,
      nickname: `Guest_${longId}`,
      nationality: 'OTHER',
      is_public: false,
      role: 'user',
      trust_score: 4,
      onboarded: true,
    })
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
