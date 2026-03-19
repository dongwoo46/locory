import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const url = new URL('/login', request.url)
  const response = NextResponse.redirect(url)
  response.cookies.set('onboarded', '', { path: '/', maxAge: 0 })
  return response
}