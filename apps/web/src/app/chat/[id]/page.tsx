import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatClient from './ChatClient'

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const userId = session.user.id

  const { data: meetup } = await supabase
    .from('place_meetups')
    .select('id, scheduled_at, organizer_id, places!place_id(id, name, city), profiles!organizer_id(id, nickname, avatar_url)')
    .eq('id', id)
    .single()

  if (!meetup) redirect('/meetups')

  const isOrganizer = meetup.organizer_id === userId
  if (!isOrganizer) {
    const { data: join } = await supabase
      .from('meetup_joins')
      .select('id')
      .eq('meetup_id', id)
      .eq('applicant_id', userId)
      .eq('status', 'accepted')
      .maybeSingle()
    if (!join) redirect('/meetups')
  }

  return (
    <ChatClient
      meetupId={id}
      userId={userId}
      meetup={meetup as any}
      isOrganizer={isOrganizer}
    />
  )
}
