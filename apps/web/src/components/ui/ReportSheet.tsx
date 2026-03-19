'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  targetType: 'post' | 'place' | 'user'
  targetId: string
  onClose: () => void
}

export default function ReportSheet({ targetType, targetId, onClose }: Props) {
  const t = useTranslations('report')
  const [selected, setSelected] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const PRESET_REASONS = [
    { key: 'spam', label: t('reasons.spam') },
    { key: 'inappropriate', label: t('reasons.inappropriate') },
    { key: 'false', label: t('reasons.false') },
    { key: 'copyright', label: t('reasons.copyright') },
    { key: 'custom', label: t('reasons.custom') },
  ]

  const reason = selected === 'custom' ? custom : PRESET_REASONS.find(r => r.key === selected)?.label ?? null

  async function handleSubmit() {
    if (!reason?.trim()) return
    setLoading(true)
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
    })
    setLoading(false)
    setDone(true)
    setTimeout(onClose, 1500)
  }

  return (
    <>
      {/* 딤 처리 */}
      <div className="fixed inset-0 z-60 bg-black/40" onClick={onClose} />

      {/* 시트 */}
      <div className="fixed bottom-0 left-0 right-0 z-60 bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '85dvh' }}>
        {/* 핸들 */}
        <div className="shrink-0 pt-4 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-8 px-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="#16A34A" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">{t('doneTitle')}</p>
            <p className="text-xs text-gray-400">{t('doneMsg')}</p>
          </div>
        ) : (
          <>
            {/* 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <h2 className="text-base font-bold text-gray-900 mb-4">{t('title')}</h2>

              <div className="flex flex-col gap-2">
                {PRESET_REASONS.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setSelected(r.key)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                      selected === r.key ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    {r.label}
                    {selected === r.key && (
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {selected === 'custom' && (
                <textarea
                  value={custom}
                  onChange={e => setCustom(e.target.value)}
                  placeholder={t('customPlaceholder')}
                  rows={3}
                  className="w-full mt-3 px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 resize-none"
                  autoFocus
                />
              )}
            </div>

            {/* 하단 버튼 - 항상 고정 */}
            <div className="shrink-0 px-4 pt-3 pb-6">
              <button
                onClick={handleSubmit}
                disabled={!reason?.trim() || loading}
                className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-semibold disabled:opacity-40"
              >
                {loading ? t('submitting') : t('submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
