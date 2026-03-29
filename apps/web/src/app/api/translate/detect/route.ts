import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function normalizeLanguage(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace('_', '-')
}

function isSameLanguage(detected: string | null | undefined, target: string | null | undefined): boolean {
  const detectedNorm = normalizeLanguage(detected)
  const targetNorm = normalizeLanguage(target)
  if (!detectedNorm || !targetNorm) return false

  const detectedBase = detectedNorm.split('-')[0]
  const targetBase = targetNorm.split('-')[0]
  return detectedNorm === targetNorm || detectedBase === targetBase
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text, target } = await req.json()
  if (!text || !target) {
    return NextResponse.json({ error: 'text and target required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Translate API not configured' }, { status: 500 })
  }

  const res = await fetch(`https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text }),
  })

  if (!res.ok) {
    const detail = await res.text()
    return NextResponse.json({ error: 'Detect failed', detail }, { status: 502 })
  }

  const json = await res.json()
  const detectedLanguage: string | null = json?.data?.detections?.[0]?.[0]?.language ?? null

  return NextResponse.json({
    detectedLanguage,
    sameLanguage: isSameLanguage(detectedLanguage, target),
  })
}
