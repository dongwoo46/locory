import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const RESTORABLE = ['/feed', '/map', '/saved', '/profile', '/place', '/notifications']

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (user) {
    const cookieStore = await cookies()
    const lastRoute = cookieStore.get('last-route')?.value
    const target = lastRoute && RESTORABLE.some(p => lastRoute.startsWith(p)) ? lastRoute : '/feed'
    redirect(target)
  } else {
    redirect('/login')
  }
}
