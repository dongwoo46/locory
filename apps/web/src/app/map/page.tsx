import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MapClient from './MapClient'

export default async function MapPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  return <MapClient userId={user.id} />
}
