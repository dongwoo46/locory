'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import NotificationSheet from '@/components/ui/NotificationSheet'

const supabase = createClient()

interface Props {
  userId: string
}

export default function NotificationBell({ userId }: Props) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [showSheet, setShowSheet] = useState(false)

  useEffect(() => {
    loadUnread()

    const channel = supabase
      .channel(`notif_badge:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => loadUnread())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function loadUnread() {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
    setUnreadCount(count ?? 0)
  }

  return (
    <>
      <button
        onClick={() => setShowSheet(true)}
        className="relative w-8 h-8 flex items-center justify-center text-gray-500"
      >
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showSheet && (
        <NotificationSheet
          userId={userId}
          onClose={() => { setShowSheet(false); loadUnread() }}
        />
      )}
    </>
  )
}
