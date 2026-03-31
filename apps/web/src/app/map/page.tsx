import { createClient } from '@/lib/supabase/server'
import MapClient from './MapClient'

export default async function MapPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  return <MapClient userId={user?.id ?? null} />
}
