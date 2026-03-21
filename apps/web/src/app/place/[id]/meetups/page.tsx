import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlaceMeetupsClient from './PlaceMeetupsClient'

export default async function PlaceMeetupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const [placeRes, profileRes] = await Promise.all([
    supabase.from('places').select('id, name, city, category').eq('id', id).single(),
    supabase
      .from('profiles')
      .select('id, gender, birth_date, nationality, is_public, trust_score')
      .eq('id', session.user.id)
      .single(),
  ])

  if (!placeRes.data) redirect('/feed')

  return (
    <PlaceMeetupsClient
      placeId={id}
      place={placeRes.data as any}
      userId={session.user.id}
      profile={profileRes.data as any}
    />
  )
}
