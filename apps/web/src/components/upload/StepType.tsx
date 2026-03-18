'use client'

import { useTranslations } from 'next-intl'
import type { PostType } from '@/types/database'
import type { SelectedPlace } from './types'

interface Props {
  place: SelectedPlace
  onSelect: (type: PostType) => void
}

export default function StepType({ place, onSelect }: Props) {
  const t = useTranslations('upload')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{place.name}</p>
        <h2 className="text-lg font-semibold text-gray-900 mt-0.5">{t('type.title')}</h2>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => onSelect('visited')}
          className="flex flex-col gap-1 px-5 py-4 border border-gray-200 rounded-xl text-left hover:border-gray-900 hover:bg-gray-50 transition-colors"
        >
          <span className="text-base font-semibold text-gray-900">{t('type.visitedTitle')}</span>
          <span className="text-sm text-gray-500">{t('type.visitedDesc')}</span>
        </button>

        <button
          onClick={() => onSelect('want')}
          className="flex flex-col gap-1 px-5 py-4 border border-gray-200 rounded-xl text-left hover:border-gray-900 hover:bg-gray-50 transition-colors"
        >
          <span className="text-base font-semibold text-gray-900">{t('type.wantTitle')}</span>
          <span className="text-sm text-gray-500">{t('type.wantDesc')}</span>
        </button>
      </div>
    </div>
  )
}
