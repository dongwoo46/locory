import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApplyClient from './ApplyClient'

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const [meetupRes, profileRes, existingJoinRes] = await Promise.all([
    supabase
      .from('place_meetups')
      .select('id, status, wanted_gender, wanted_age_groups, scheduled_at, places!place_id (name)')
      .eq('id', id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('profiles')
      .select('id, gender, birth_date')
      .eq('id', session.user.id)
      .single(),
    supabase
      .from('meetup_joins')
      .select('id')
      .eq('meetup_id', id)
      .eq('applicant_id', session.user.id)
      .maybeSingle(),
  ])

  if (!meetupRes.data || meetupRes.data.status !== 'open') redirect(`/meetup`)
  if (existingJoinRes.data) redirect(`/meetup/${id}`)

  return (
    <ApplyClient
      meetupId={id}
      userId={session.user.id}
      profile={profileRes.data as any}
    />
  )
}
