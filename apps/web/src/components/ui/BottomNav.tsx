'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import PlaceAddSheet from '@/components/place/PlaceAddSheet'

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('nav')

  const [showActionSheet, setShowActionSheet] = useState(false)
  const [showPlaceAdd, setShowPlaceAdd] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const NAV_ITEMS = [
    {
      href: '/feed',
      label: t('feed'),
      icon: (active: boolean) => (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      href: '/map',
      label: t('map'),
      icon: (active: boolean) => (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      ),
    },
    null, // + 버튼 자리
    {
      href: '/saved',
      label: t('saved'),
      icon: (active: boolean) => (
        <svg width="24" height="24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} viewBox="0 0 24 24">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      href: '/profile/me',
      label: t('profile'),
      icon: (active: boolean) => (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
        </svg>
      ),
    },
  ]

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 pb-safe">
          {NAV_ITEMS.map((item, i) => {
            if (!item) {
              return (
                <button
                  key="plus"
                  onClick={() => setShowActionSheet(true)}
                  className="flex flex-col items-center gap-0.5 py-3 px-3"
                >
                  <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center -mt-5 shadow-lg">
                    <svg width="22" height="22" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </div>
                </button>
              )
            }
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-3 px-3 transition-colors ${
                  active ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                {item.icon(active)}
                {item.label && <span className="text-[10px] font-medium">{item.label}</span>}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* 액션 시트 */}
      {showActionSheet && (
        <div
          className="fixed inset-0 bg-black/40 z-60 flex items-end justify-center"
          onClick={() => setShowActionSheet(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl pb-10 pt-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className="w-8 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="flex flex-col gap-2 px-4">
              {/* 포스팅 */}
              <button
                onClick={() => { setShowActionSheet(false); router.push('/upload') }}
                className="flex items-center gap-4 px-4 py-4 bg-gray-50 rounded-2xl text-left"
              >
                <div className="w-11 h-11 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
                  <svg width="20" height="20" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">포스팅 올리기</p>
                  <p className="text-xs text-gray-400 mt-0.5">방문한 장소나 가고 싶은 곳을 공유해요</p>
                </div>
              </button>

              {/* 장소 저장 */}
              <button
                onClick={() => { setShowActionSheet(false); setShowPlaceAdd(true) }}
                className="flex items-center gap-4 px-4 py-4 bg-gray-50 rounded-2xl text-left"
              >
                <div className="w-11 h-11 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
                  <svg width="20" height="20" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                    <circle cx="12" cy="9" r="2.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">장소 저장하기</p>
                  <p className="text-xs text-gray-400 mt-0.5">링크나 검색으로 장소를 내 리스트에 담아요</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 장소 저장 시트 */}
      {showPlaceAdd && userId && (
        <PlaceAddSheet
          userId={userId}
          onClose={() => setShowPlaceAdd(false)}
          onSaved={() => setShowPlaceAdd(false)}
        />
      )}
    </>
  )
}
