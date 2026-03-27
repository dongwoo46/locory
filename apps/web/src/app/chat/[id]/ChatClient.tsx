'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { containsProfanity } from '@/lib/utils/profanity'
import { useLocale, useTranslations } from 'next-intl'

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
  profiles: { id: string; nickname: string; avatar_url: string | null }
  optimistic?: boolean
}

interface ThreadRead {
  user_id: string
  last_read_at: string
}

interface Props {
  meetupId: string
  userId: string
  meetup: {
    id: string
    organizer_id: string
    scheduled_at: string
    places: { id: string; name: string; city: string } | null
    profiles: { id: string; nickname: string; avatar_url: string | null } | null
  }
  isOrganizer: boolean
}

const supabase = createClient()

export default function ChatClient({ meetupId, userId, meetup, isOrganizer }: Props) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('meetup.chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [threadReads, setThreadReads] = useState<ThreadRead[]>([])
  const [isBlocked, setIsBlocked] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [myProfile, setMyProfile] = useState<{ nickname: string; avatar_url: string | null } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadAll()

    // 메시지 실시간 구독
    const msgChannel = supabase
      .channel(`chat:${meetupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'meetup_messages',
        filter: `meetup_id=eq.${meetupId}`,
      }, (payload) => {
        supabase
          .from('meetup_messages')
          .select('*, profiles!sender_id(id, nickname, avatar_url)')
          .eq('id', payload.new.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setMessages(prev => {
                // 내가 보낸 optimistic 메시지가 있으면 교체
                if (data.sender_id === userId) {
                  const idx = prev.findIndex(m => m.optimistic && m.content === data.content)
                  if (idx !== -1) {
                    const next = [...prev]
                    next[idx] = data as any
                    return next
                  }
                }
                return [...prev, data as any]
              })
              // 새 메시지 받으면 읽음 처리
              markAsRead()
            }
          })
      })
      .subscribe()

    // 읽음 상태 실시간 구독
    const readChannel = supabase
      .channel(`chat_reads:${meetupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meetup_chat_reads',
        filter: `meetup_id=eq.${meetupId}`,
      }, () => {
        loadThreadReads()
      })
      .subscribe()

    // 페이지 포커스 시 읽음 처리
    const onFocus = () => markAsRead()
    window.addEventListener('focus', onFocus)

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(readChannel)
      window.removeEventListener('focus', onFocus)
    }
  }, [meetupId])

  async function loadAll() {
    await Promise.all([
      loadMessages(),
      loadThreadReads(),
      loadMyProfile(),
      checkBlock(),
      markAsRead(),
    ])
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('meetup_messages')
      .select('*, profiles!sender_id(id, nickname, avatar_url)')
      .eq('meetup_id', meetupId)
      .order('created_at', { ascending: true })
    setMessages((data as any[]) ?? [])
  }

  async function loadThreadReads() {
    const { data } = await supabase
      .from('meetup_chat_reads')
      .select('user_id, last_read_at')
      .eq('meetup_id', meetupId)
    setThreadReads((data as ThreadRead[]) ?? [])
  }

  async function loadMyProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', userId)
      .single()
    if (data) setMyProfile(data)
  }

  async function checkBlock() {
    // 상대방 ID 파악 (주최자면 수락된 참가자 중 첫번째, 참가자면 주최자)
    const otherUserId = isOrganizer ? null : meetup.organizer_id
    if (!otherUserId) return

    const { data } = await supabase
      .from('blocks')
      .select('id')
      .or(`and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`)
      .maybeSingle()
    setIsBlocked(!!data)
  }

  async function markAsRead() {
    await supabase
      .from('meetup_chat_reads')
      .upsert({ meetup_id: meetupId, user_id: userId, last_read_at: new Date().toISOString() })
    // 알림도 읽음 처리
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('type', 'message_new')
      .contains('data', { meetup_id: meetupId })
      .is('read_at', null)
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending || isBlocked) return
    if (containsProfanity(trimmed)) {
      setSendError(t('profanityError'))
      return
    }
    setSendError('')

    // Optimistic update: 즉시 표시
    const tempId = `temp-${Date.now()}`
    const optimisticMsg: Message = {
      id: tempId,
      sender_id: userId,
      content: trimmed,
      created_at: new Date().toISOString(),
      profiles: { id: userId, nickname: myProfile?.nickname ?? '', avatar_url: myProfile?.avatar_url ?? null },
      optimistic: true,
    }
    setMessages(prev => [...prev, optimisticMsg])
    setText('')

    setSending(true)
    const { error } = await supabase.from('meetup_messages').insert({
      meetup_id: meetupId,
      sender_id: userId,
      content: trimmed,
    })

    if (error) {
      // 실패하면 optimistic 메시지 제거
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setText(trimmed)
      if (error.code === '42501') setSendError(t('permissionError'))
      else setSendError(t('sendFailed'))
    }
    setSending(false)
    inputRef.current?.focus()
  }

  async function handleBlock() {
    const otherUserId = isOrganizer ? null : meetup.organizer_id
    if (!otherUserId) return
    setShowMenu(false)

    if (isBlocked) {
      await supabase.from('blocks').delete()
        .eq('blocker_id', userId).eq('blocked_id', otherUserId)
      setIsBlocked(false)
    } else {
      if (!confirm(t('blockConfirm'))) return
      await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: otherUserId })
      setIsBlocked(true)
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  // 메시지별 읽음 여부: 내가 보낸 마지막 메시지에만 표시
  // 다른 참가자들의 last_read_at 중 가장 오래된 것 기준
  const otherReads = threadReads.filter(r => r.user_id !== userId)
  const oldestOtherRead = otherReads.length > 0
    ? otherReads.reduce((min, r) => r.last_read_at < min ? r.last_read_at : min, otherReads[0].last_read_at)
    : null

  // 내 마지막 메시지 중 읽힌 것
  const myMessages = messages.filter(m => m.sender_id === userId && !m.optimistic)
  const lastReadMyMsgIdx = myMessages.reduce((lastIdx, msg, i) => {
    if (oldestOtherRead && msg.created_at <= oldestOtherRead) return i
    return lastIdx
  }, -1)
  const lastReadMyMsgId = lastReadMyMsgIdx >= 0 ? myMessages[lastReadMyMsgIdx]?.id : null

  const placeName = (meetup.places as any)?.name ?? t('fallbackTitle')

  return (
    <div className="flex flex-col h-dvh bg-white">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white z-10">
        <button onClick={() => router.back()} className="text-gray-500 p-1 -ml-1">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{t('headerTitle', { name: placeName })}</p>
          <p className="text-xs text-gray-400">
            {new Date(meetup.scheduled_at).toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        </div>
        {/* 3-dot 메뉴 */}
        {!isOrganizer && (
          <div className="relative">
            <button onClick={() => setShowMenu(v => !v)} className="p-1 text-gray-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-w-[120px]">
                  <button
                    onClick={handleBlock}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-500 hover:bg-red-50"
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" /><path d="M4.93 4.93l14.14 14.14" strokeLinecap="round" />
                    </svg>
                    {isBlocked ? t('unblockUser') : t('blockUser')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm">{t('emptyState')}</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.sender_id === userId
          const isLastMine = isMine && msg.id === lastReadMyMsgId

          return (
            <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isMine && (
                <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden shrink-0 self-end">
                  {msg.profiles?.avatar_url
                    ? <img src={msg.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">{msg.profiles?.nickname?.[0]}</div>
                  }
                </div>
              )}
              <div className={`flex flex-col gap-0.5 max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                {!isMine && i === 0 || (!isMine && messages[i - 1]?.sender_id !== msg.sender_id) ? (
                  <p className="text-[10px] text-gray-400 px-1">{msg.profiles?.nickname}</p>
                ) : null}
                <div className="flex items-end gap-1.5">
                  {isMine && (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] text-gray-400">{formatTime(msg.created_at)}</span>
                      {isLastMine && (
                        <span className="text-[10px] text-blue-400">{t('read')}</span>
                      )}
                      {msg.optimistic && (
                        <span className="text-[10px] text-gray-300">{t('sending')}</span>
                      )}
                    </div>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    isMine
                      ? 'bg-gray-900 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                  } ${msg.optimistic ? 'opacity-60' : ''}`}>
                    {msg.content}
                  </div>
                  {!isMine && (
                    <span className="text-[10px] text-gray-400 self-end">{formatTime(msg.created_at)}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* 차단 상태 안내 */}
      {isBlocked && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-center text-gray-400">{t('blockedMessage')}</p>
        </div>
      )}

      {/* 입력 */}
      {!isBlocked && (
        <div className="px-4 py-3 border-t border-gray-100 bg-white pb-safe">
          {sendError && <p className="text-xs text-red-500 mb-1.5">{sendError}</p>}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => { setText(e.target.value); setSendError('') }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder={t('placeholder')}
              rows={1}
              maxLength={300}
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-2xl text-sm outline-none focus:border-gray-400 resize-none leading-relaxed"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
