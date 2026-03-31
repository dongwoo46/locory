import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DAILY_LIMIT = 5

function normalizeTranslatedText(value: string): string {
  return value.trim()
}

async function translateWithGemini(text: string, target: string): Promise<string | null> {
  const geminiApiKey = process.env.GEMINI_API_KEY
  if (!geminiApiKey) return null

  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: modelName })
    const prompt = [
      'You are a translation API.',
      `Translate the following text into "${target}".`,
      'Return only the translated text with no extra explanation.',
      '',
      text,
    ].join('\n')
    const result = await model.generateContent(prompt)
    const translated = result.response.text()
    return normalizeTranslatedText(translated)
  } catch (error) {
    console.error('Gemini translate fallback error:', error)
    return null
  }
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

  const today = new Date().toISOString().slice(0, 10)
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const isAdmin = myProfile?.role === 'admin'

  let remaining: number | null = null

  if (!isAdmin) {
    const { data: usage } = await supabase
      .from('translate_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    const usedCount = usage?.count ?? 0
    remaining = DAILY_LIMIT - usedCount

    if (remaining <= 0) {
      return NextResponse.json({ error: 'daily_limit', remaining: 0 }, { status: 429 })
    }
  }

  let translated = ''
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY

  if (apiKey) {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, target, format: 'text' }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Translation failed', detail: err }, { status: 502 })
    }

    const json = await res.json()
    translated = json.data?.translations?.[0]?.translatedText ?? ''
  } else {
    const geminiTranslated = await translateWithGemini(text, target)
    if (!geminiTranslated) {
      return NextResponse.json({ error: 'Translate API not configured' }, { status: 500 })
    }
    translated = geminiTranslated
  }

  if (!isAdmin) {
    await supabase.rpc('increment_translate_usage', { p_user_id: user.id, p_date: today })
  }

  return NextResponse.json({
    translated,
    remaining: remaining === null ? null : remaining - 1,
  })
}
