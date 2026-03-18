'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type NotifType =
  | 'meetup_today'
  | 'join_new'
  | 'join_accepted'
  | 'join_rejected'
  | 'join_unmatched'
  | 'message_new'

interface Notification {
  id: string
  type: NotifType
  title: string
  body: string
  data: { meetup_id?: string; join_id?: string; message_id?: string; place_id?: string } | null
  read_at: string | null
  created_at: string
}

interface Props {
  userId: string
  onClose: () => void
}

const TYPE_ICON: Record<NotifType, React.ReactNode> = {
  meetup_today: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  join_new: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
      <path d="M19 3v4M17 5h4" strokeLinecap="round" />
    </svg>
  ),
  join_accepted: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  join_rejected: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  ),
  join_unmatched: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  ),
  message_new: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
}

const TYPE_COLOR: Record<NotifType, string> = {
  meetup_today:   'bg-yellow-100 text-yellow-600',
  join_new:       'bg-blue-100 text-blue-600',
  join_accepted:  'bg-green-100 text-green-600',
  join_rejected:  'bg-gray-100 text-gray-500',
  join_unmatched: 'bg-gray-100 text-gray-500',
  message_new:    'bg-purple-100 text-purple-600',
}

export default function NotificationSheet({ userId, onClose }: Props) {
  const router = useRouter()
  const t = useTranslations('notifications')
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  function timeAgo(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime()
    const diffM = Math.floor(diffMs / 60000)
    if (diffM < 1) return t('just')
    if (diffM < 60) return t('minutesAgo', { m: diffM })
    const diffH = Math.floor(diffM / 60)
    if (diffH < 24) return t('hoursAgo', { h: diffH })
    return t('daysAgo', { d: Math.floor(diffH / 24) })
  }

  useEffect(() => {
    load()

    // Realtime: 새 알림 실시간 수신
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setNotifs(prev => [payload.new as Notification, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifs((data as Notification[]) ?? [])
    setLoading(false)
  }

  async function markRead(id: string) {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
  }

  async function markAllRead() {
    const unreadIds = notifs.filter(n => !n.read_at).map(n => n.id)
    if (!unreadIds.length) return
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
    setNotifs(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
  }

  async function handleClick(notif: Notification) {
    if (!notif.read_at) await markRead(notif.id)
    const meetupId = notif.data?.meetup_id
    if (meetupId) {
      // 번개가 있는 장소로 이동 — 향후 deep link 확장 가능
      // 지금은 그냥 닫기 (장소 상세는 별도 UX 설계 필요)
    }
    onClose()
  }

  const unreadCount = notifs.filter(n => !n.read_at).length

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[70] flex flex-col justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg mx-auto rounded-t-2xl overflow-hidden"
        style={{ maxHeight: '75vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">{t('title')}</h2>
            {unreadCount > 0 && (
              <span className="text-xs font-medium text-white bg-red-500 rounded-full px-1.5 py-0.5 leading-none">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {t('markAllRead')}
            </button>
          )}
        </div>

        {/* 목록 */}
        <div className="overflow-y-auto pb-8" style={{ maxHeight: 'calc(75vh - 80px)' }}>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <svg width="32" height="32" fill="none" stroke="#D1D5DB" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <p className="text-sm text-gray-400">{t('empty')}</p>
            </div>
          ) : (
            notifs.map(notif => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  notif.read_at ? 'bg-white' : 'bg-gray-50'
                }`}
                onClick={() => handleClick(notif)}
              >
                {/* 아이콘 */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${TYPE_COLOR[notif.type]}`}>
                  {TYPE_ICON[notif.type]}
                </div>

                {/* 텍스트 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${notif.read_at ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                      {notif.title}
                    </p>
                    <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                      {timeAgo(notif.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{notif.body}</p>
                </div>

                {/* 안읽음 dot */}
                {!notif.read_at && (
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
