'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function MeetupInboxIcon({ userId }: { userId: string }) {
  const router = useRouter()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    load()

    const channel = supabase
      .channel(`meetup_inbox:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function load() {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'message_new')
      .is('read_at', null)
    setUnread(count ?? 0)
  }

  return (
    <button
      onClick={() => router.push('/meetups')}
      className="relative w-8 h-8 flex items-center justify-center text-gray-500"
    >
      {/* 번개 아이콘 */}
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {unread > 0 && (
        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white leading-none">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
