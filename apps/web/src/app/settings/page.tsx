import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // birth_year/role 컬럼이 없는 환경(migration 미적용)에서도 fallback
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, nickname, nationality, avatar_url, is_public, role, birth_date, gender, gender_changed_at, bio')
    .eq('id', user.id)
    .single()

  // 컬럼 에러(42703)는 fallback 쿼리로 재시도
  if (error?.code === '42703' || (!profile && !error)) {
    const { data: fallback } = await supabase
      .from('profiles')
      .select('id, nickname, nationality, avatar_url, is_public')
      .eq('id', user.id)
      .single()
    if (!fallback) redirect('/login')
    const locale = await getLocale()
    return <SettingsClient profile={{ ...fallback, birth_date: null, gender: null, gender_changed_at: null, bio: null, role: 'user' }} currentLocale={locale} isAdmin={false} />
  }

  if (!profile) redirect('/login')

  const locale = await getLocale()

  return <SettingsClient profile={profile} currentLocale={locale} isAdmin={profile.role === 'admin'} />
}
