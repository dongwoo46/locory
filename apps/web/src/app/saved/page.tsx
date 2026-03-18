import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SavedClient from './SavedClient'

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <SavedClient userId={user.id} />
}
