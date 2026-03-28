import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MeetupExploreClient from './MeetupExploreClient'

export default async function MeetupExplorePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, gender, birth_date, nationality, is_public, trust_score, avatar_url')
    .eq('id', session.user.id)
    .single()

  return <MeetupExploreClient userId={session.user.id} profile={profile as any} isAnonymous={session.user.is_anonymous ?? false} />
}
