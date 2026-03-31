'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

export default function BottomNav({ avatarUrl }: { avatarUrl?: string | null }) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const [fetchedAvatar, setFetchedAvatar] = useState<string | null>(null)
  const resolvedAvatar = avatarUrl ?? fetchedAvatar

  useEffect(() => {
    if (avatarUrl !== undefined) return
    createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await createClient()
        .from('profiles').select('avatar_url').eq('id', data.user.id).single()
      setFetchedAvatar(profile?.avatar_url ?? null)
    })
  }, [avatarUrl])

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const NAV_ITEMS = [
    {
      href: '/map',
      label: t('map'),
      icon: (active: boolean) => (
        <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      ),
    },
    {
      href: '/meetup',
      label: t('meetup'),
      icon: (active: boolean) => (
        <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} viewBox="0 0 24 24">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: '/saved',
      label: t('saved'),
      icon: (active: boolean) => (
        <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} viewBox="0 0 24 24">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      href: '/profile/me',
      label: t('profile'),
      icon: (active: boolean) =>
        resolvedAvatar ? (
          <div className={`h-3.5 w-3.5 rounded-full overflow-hidden border transition-colors ${active ? 'border-gray-900' : 'border-transparent'}`}>
            <img src={resolvedAvatar} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <svg width="20" height="20" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
          </svg>
        ),
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 pb-1">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 pb-[calc(env(safe-area-inset-bottom)+4px)]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-2 transition-colors rounded-xl ${
                active ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {item.icon(active)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

