'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

interface MeetupItem {
  id: string
  scheduled_at: string
  status: string
  role: 'organizer' | 'applicant'
  joinStatus?: 'pending' | 'accepted' | 'rejected' | 'unmatched'
  place: { id: string; name: string; city: string } | null
  organizer: { id: string; nickname: string; avatar_url: string | null } | null
  participants: { id: string; nickname: string; avatar_url: string | null }[]
  unreadCount: number
}

const CITY_LABEL: Record<string, string> = {
  seoul: '서울', busan: '부산', jeju: '제주', gyeongju: '경주',
  jeonju: '전주', gangneung: '강릉', sokcho: '속초', yeosu: '여수', incheon: '인천',
}

const supabase = createClient()
type Tab = 'my' | 'applied' | 'connected'

export default function MeetupsClient({ userId }: { userId: string }) {
  const router = useRouter()
  const t = useTranslations('meetup.inbox')
  const tStatus = useTranslations('meetup.status')
  const [tab, setTab] = useState<Tab>('connected')
  const [myMeetups, setMyMeetups] = useState<MeetupItem[]>([])
  const [appliedMeetups, setAppliedMeetups] = useState<MeetupItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()

    const channel = supabase
      .channel(`meetups_inbox:${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, loadAll)
      .subscribe()

    const onVisible = () => { if (document.visibilityState === 'visible') loadAll() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadMyMeetups(), loadAppliedMeetups()])
    setLoading(false)
  }

  async function loadMyMeetups() {
    const { data: meetups } = await supabase
      .from('place_meetups')
      .select('id, scheduled_at, status, places!place_id(id, name, city), profiles!organizer_id(id, nickname, avatar_url)')
      .eq('organizer_id', userId)
      .order('scheduled_at', { ascending: false })
      .limit(30)

    if (!meetups) { setMyMeetups([]); return }

    const meetupIds = meetups.map(m => m.id)
    const { data: joins } = await supabase
      .from('meetup_joins')
      .select('meetup_id, profiles!applicant_id(id, nickname, avatar_url)')
      .in('meetup_id', meetupIds)
      .eq('status', 'accepted')

    const participantMap: Record<string, { id: string; nickname: string; avatar_url: string | null }[]> = {}
    for (const j of joins ?? []) {
      const p = j.profiles as any
      if (!p) continue
      if (!participantMap[j.meetup_id]) participantMap[j.meetup_id] = []
      participantMap[j.meetup_id].push(p)
    }

    const unreadMap = await getUnreadMap(meetupIds)

    setMyMeetups(meetups.map(m => ({
      id: m.id,
      scheduled_at: m.scheduled_at,
      status: m.status,
      role: 'organizer',
      place: (m.places as any) || null,
      organizer: (m.profiles as any) || null,
      participants: participantMap[m.id] ?? [],
      unreadCount: unreadMap[m.id] ?? 0,
    })))
  }

  async function loadAppliedMeetups() {
    const { data: joins } = await supabase
      .from('meetup_joins')
      .select('id, status, meetup_id, place_meetups!meetup_id(id, scheduled_at, status, places!place_id(id, name, city), profiles!organizer_id(id, nickname, avatar_url))')
      .eq('applicant_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (!joins) { setAppliedMeetups([]); return }

    const meetupIds = joins.map(j => (j.place_meetups as any)?.id).filter(Boolean)
    const unreadMap = await getUnreadMap(meetupIds)

    setAppliedMeetups(joins.map(j => {
      const m = j.place_meetups as any
      return {
        id: m?.id,
        scheduled_at: m?.scheduled_at,
        status: m?.status,
        role: 'applicant' as const,
        joinStatus: j.status as any,
        place: m?.places || null,
        organizer: m?.profiles || null,
        participants: [],
        unreadCount: unreadMap[m?.id] ?? 0,
      }
    }).filter(m => m.id))
  }

  async function getUnreadMap(meetupIds: string[]): Promise<Record<string, number>> {
    if (!meetupIds.length) return {}

    const { data: reads } = await supabase
      .from('meetup_chat_reads')
      .select('meetup_id, last_read_at')
      .eq('user_id', userId)
      .in('meetup_id', meetupIds)

    const readMap: Record<string, string> = {}
    for (const r of reads ?? []) readMap[r.meetup_id] = r.last_read_at

    const counts: Record<string, number> = {}
    await Promise.all(meetupIds.map(async (meetupId) => {
      const lastRead = readMap[meetupId]
      let query = supabase
        .from('meetup_messages')
        .select('id', { count: 'exact', head: true })
        .eq('meetup_id', meetupId)
        .neq('sender_id', userId)
      if (lastRead) query = query.gt('created_at', lastRead)
      const { count } = await query
      counts[meetupId] = count ?? 0
    }))

    return counts
  }

  const connectedMeetups = [
    ...myMeetups.filter(m => m.status === 'open'),
    ...appliedMeetups.filter(m => m.joinStatus === 'accepted'),
  ].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  const listMap: Record<Tab, MeetupItem[]> = {
    connected: connectedMeetups,
    my: myMeetups,
    applied: appliedMeetups,
  }
  const currentList = listMap[tab]
  const totalUnread = [...myMeetups, ...appliedMeetups].reduce((sum, m) => sum + m.unreadCount, 0)

  const tabs: { key: Tab; label: string; items: MeetupItem[] }[] = [
    { key: 'connected', label: t('tabConnected'), items: connectedMeetups },
    { key: 'my', label: t('tabMy'), items: myMeetups },
    { key: 'applied', label: t('tabApplied'), items: appliedMeetups },
  ]

  const joinStatusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: t('pendingLabel'), color: 'text-yellow-600 bg-yellow-50' },
    accepted: { label: tStatus('accepted'), color: 'text-green-600 bg-green-50' },
    rejected: { label: tStatus('rejected'), color: 'text-gray-400 bg-gray-50' },
    unmatched: { label: tStatus('unmatched'), color: 'text-gray-400 bg-gray-50' },
  }

  function canChat(item: MeetupItem) {
    if (item.role === 'organizer') return item.status === 'open'
    return item.joinStatus === 'accepted'
  }

  function formatDateTime(iso: string) {
    const d = new Date(iso)
    const date = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    return `${date} ${time}`
  }

  function getOpponentLabel(item: MeetupItem): string | null {
    if (item.role === 'organizer') {
      if (item.participants.length === 0) return null
      if (item.participants.length === 1) return item.participants[0].nickname
      return `${item.participants[0].nickname} 외 ${item.participants.length - 1}명`
    }
    return item.organizer?.nickname ?? null
  }

  const emptyLabel: Record<Tab, string> = {
    connected: t('emptyConnected'),
    my: t('emptyMy'),
    applied: t('emptyApplied'),
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-40">
        <div className="max-w-lg mx-auto flex items-center h-14 px-4 gap-2">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-gray-500">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="flex-1 text-base font-bold text-gray-900">
            {t('title')}
            {totalUnread > 0 && (
              <span className="ml-2 text-xs font-medium text-white bg-red-500 rounded-full px-1.5 py-0.5">
                {totalUnread}
              </span>
            )}
          </h1>
        </div>
        <div className="flex max-w-lg mx-auto border-b border-gray-100">
          {tabs.map(tab_ => (
            <button
              key={tab_.key}
              onClick={() => setTab(tab_.key)}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === tab_.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
              }`}
            >
              {tab_.label}
              {tab_.items.some(m => m.unreadCount > 0) && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-red-500 inline-block align-middle" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-lg mx-auto pt-[104px] pb-20">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <svg width="36" height="36" fill="none" stroke="#D1D5DB" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm text-gray-400">{emptyLabel[tab]}</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {currentList.map(item => {
              const opponent = getOpponentLabel(item)
              return (
                <div
                  key={`${item.role}-${item.id}`}
                  className="px-4 py-4 flex items-center gap-3 active:bg-gray-50 cursor-pointer"
                  onClick={() => canChat(item) ? router.push(`/chat/${item.id}`) : router.push(`/place/${item.place?.id}`)}
                >
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0 text-xl">
                    ⚡
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.place?.name ?? '장소 없음'}</p>
                      {item.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {item.unreadCount > 9 ? '9+' : item.unreadCount}
                        </span>
                      )}
                    </div>

                    {opponent && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {item.role === 'organizer' ? t('participantLabel') : t('organizerLabel')}: {opponent}
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-0.5">
                      {CITY_LABEL[item.place?.city ?? ''] ?? ''} · {formatDateTime(item.scheduled_at)}
                    </p>

                    <div className="mt-1 flex gap-1 flex-wrap">
                      {item.role === 'applicant' && item.joinStatus && (
                        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${joinStatusConfig[item.joinStatus]?.color}`}>
                          {joinStatusConfig[item.joinStatus]?.label}
                        </span>
                      )}
                      {item.role === 'organizer' && (
                        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          item.status === 'open' ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'
                        }`}>
                          {item.status === 'open' ? t('organizerOpen') : t('organizerClosed')}
                        </span>
                      )}
                    </div>
                  </div>

                  <svg width="16" height="16" fill="none" stroke="#9CA3AF" strokeWidth={2} viewBox="0 0 24 24" className="shrink-0">
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
