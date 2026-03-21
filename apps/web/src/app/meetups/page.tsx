import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MeetupsClient from './MeetupsClient'

export default async function MeetupsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  return <MeetupsClient userId={session.user.id} />
}
