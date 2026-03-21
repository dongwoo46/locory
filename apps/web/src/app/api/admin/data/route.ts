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

export async function GET() {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()

  const [reportsRes, inquiriesRes] = await Promise.all([
    adminClient
      .from('reports')
      .select(`
        id, target_type, target_id, reason, status, admin_note, created_at, resolved_at,
        reporter:profiles!reporter_id(id, nickname, avatar_url, trust_score)
      `)
      .order('created_at', { ascending: false })
      .limit(100),

    adminClient
      .from('inquiries')
      .select(`
        id, title, content, status, response, created_at, resolved_at,
        user:profiles!user_id(id, nickname, avatar_url, trust_score)
      `)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return NextResponse.json({
    reports: reportsRes.data || [],
    inquiries: inquiriesRes.data || [],
  })
}
