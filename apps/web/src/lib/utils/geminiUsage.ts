import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_DAILY_LIMIT = 5

function resolveDailyLimit(): number {
  const parsed = Number(process.env.GEMINI_DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type GeminiAccessGranted = {
  ok: true
  supabase: SupabaseServerClient
  user: User
  today: string
  remaining: number | null
  isAdmin: boolean
}

type GeminiAccessDenied = {
  ok: false
  response: NextResponse
}

export async function requireGeminiAccess(): Promise<GeminiAccessGranted | GeminiAccessDenied> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (user.is_anonymous) {
    return { ok: false, response: NextResponse.json({ error: 'signup_required' }, { status: 403 }) }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = profile?.role === 'admin'
  const today = new Date().toISOString().slice(0, 10)

  if (isAdmin) {
    return { ok: true, supabase, user, today, remaining: null, isAdmin }
  }

  const dailyLimit = resolveDailyLimit()
  const { data: usage, error } = await supabase
    .from('gemini_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  if (error) {
    console.error('Gemini usage check error:', error)
    return { ok: false, response: NextResponse.json({ error: 'usage_check_failed' }, { status: 500 }) }
  }

  const usedCount = usage?.count ?? 0
  const remaining = dailyLimit - usedCount
  if (remaining <= 0) {
    return { ok: false, response: NextResponse.json({ error: 'daily_limit', remaining: 0 }, { status: 429 }) }
  }

  return { ok: true, supabase, user, today, remaining, isAdmin }
}

export async function incrementGeminiUsage(
  supabase: SupabaseServerClient,
  userId: string,
  today: string
): Promise<void> {
  const { error } = await supabase.rpc('increment_gemini_usage', {
    p_user_id: userId,
    p_date: today,
  })
  if (error) {
    console.error('Gemini usage increment error:', error)
  }
}
