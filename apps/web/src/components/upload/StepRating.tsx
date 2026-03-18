'use client'

import { useTranslations } from 'next-intl'
import type { Rating } from '@/types/database'

const RATING_OPTIONS: { value: Rating; color: string }[] = [
  { value: 'must_go',  color: '#B090D4' },
  { value: 'worth_it', color: '#6AC0D4' },
  { value: 'neutral',  color: '#90C490' },
  { value: 'not_great', color: '#E8C070' },
]

interface Props {
  rating: Rating | null
  onSelect: (rating: Rating) => void
  onNext: () => void
}

export default function StepRating({ rating, onSelect, onNext }: Props) {
  const t = useTranslations('upload')
  const tPost = useTranslations('post')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('rating.title')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('rating.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-2">
        {RATING_OPTIONS.map(r => (
          <button
            key={r.value}
            onClick={() => onSelect(r.value)}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-colors ${
              rating === r.value ? 'border-gray-900' : 'border-gray-100'
            }`}
          >
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
            <span className="text-sm font-semibold text-gray-900">{tPost(`rating.${r.value}`)}</span>
            {rating === r.value && (
              <svg className="ml-auto" width="16" height="16" fill="none" stroke="#111" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={!rating}
        className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
      >
        {t('rating.next')}
      </button>
    </div>
  )
}
