import { GoogleGenerativeAI } from '@google/generative-ai'
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

async function detectLanguageWithGemini(text: string): Promise<string | null> {
  const geminiApiKey = process.env.GEMINI_API_KEY
  if (!geminiApiKey) return null

  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: modelName })
    const prompt = [
      'Detect the language of the following text.',
      'Return only the ISO-639-1 language code in lowercase.',
      'If you are not sure, return "und".',
      '',
      text,
    ].join('\n')
    const result = await model.generateContent(prompt)
    const detected = normalizeLanguage(result.response.text())
    return detected || null
  } catch (error) {
    console.error('Gemini detect fallback error:', error)
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

  let detectedLanguage: string | null = null
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY

  if (apiKey) {
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
    detectedLanguage = json?.data?.detections?.[0]?.[0]?.language ?? null
  } else {
    detectedLanguage = await detectLanguageWithGemini(text)
    if (!detectedLanguage) {
      return NextResponse.json({ error: 'Translate API not configured' }, { status: 500 })
    }
  }

  return NextResponse.json({
    detectedLanguage,
    sameLanguage: isSameLanguage(detectedLanguage, target),
  })
}
