import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MeetupDetailClient from './MeetupDetailClient'

export default async function MeetupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || session.user.is_anonymous) redirect('/login')

  const [meetupRes, profileRes, joinRes] = await Promise.all([
    supabase
      .from('place_meetups')
      .select(`
        id, organizer_id, scheduled_at, status, host_count, host_gender, host_age_groups,
        activities, vibe, description, wanted_gender, wanted_age_groups, wanted_count, wanted_nationalities,
        places!place_id (id, name, city, district, category),
        profiles!organizer_id (id, nickname, avatar_url, gender, birth_date)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('profiles')
      .select('id, gender, birth_date, nationality, is_public, trust_score')
      .eq('id', session.user.id)
      .single(),
    supabase
      .from('meetup_joins')
      .select('id, status')
      .eq('meetup_id', id)
      .eq('applicant_id', session.user.id)
      .maybeSingle(),
  ])

  if (!meetupRes.data) redirect('/meetup')

  return (
    <MeetupDetailClient
      meetup={meetupRes.data}
      userId={session.user.id}
      profile={profileRes.data}
      myJoin={joinRes.data}
    />
  )
}
