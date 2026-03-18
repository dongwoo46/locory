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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { action, admin_note } = await req.json()
  // action: 'resolve' | 'dismiss'

  const adminClient = await createAdminClient()

  const { error } = await adminClient.from('reports').update({
    status: action === 'resolve' ? 'resolved' : 'dismissed',
    admin_note: admin_note || null,
    resolved_at: new Date().toISOString(),
    resolved_by: admin.id,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
