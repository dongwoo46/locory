import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SavedClient from './SavedClient'

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) redirect('/login')

  return <SavedClient userId={user.id} />
}
