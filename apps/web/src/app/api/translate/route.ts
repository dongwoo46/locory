import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DAILY_LIMIT = 5

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text, target } = await req.json()
  if (!text || !target) return NextResponse.json({ error: 'text and target required' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // 오늘 사용 횟수 조회
  const { data: usage } = await supabase
    .from('translate_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  const usedCount = usage?.count ?? 0
  const remaining = DAILY_LIMIT - usedCount

  if (remaining <= 0) {
    return NextResponse.json({ error: 'daily_limit', remaining: 0 }, { status: 429 })
  }

  // Google Translate API v2 호출
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Translate API not configured' }, { status: 500 })

  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, target, format: 'text' }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: 'Translation failed', detail: err }, { status: 502 })
  }
  const json = await res.json()
  const translated: string = json.data?.translations?.[0]?.translatedText ?? ''

  // 사용 횟수 upsert (increment)
  await supabase.rpc('increment_translate_usage', { p_user_id: user.id, p_date: today })

  return NextResponse.json({ translated, remaining: remaining - 1 })
}
