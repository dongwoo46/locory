'use client'

import { useTranslations } from 'next-intl'
import { calcScentScore, SCENT_LEVELS } from '@/types/database'

interface Props {
  trustScore: number
  className?: string
}

const GRADIENT = `linear-gradient(90deg,
  #5C3D20 0%,
  #7A5535 12%,
  #9B7B5A 24%,
  #B8A898 36%,
  #C8D0C0 48%,
  #A8C8D8 62%,
  #98A8D8 74%,
  #B8A0D8 86%,
  #C8A8E8 100%
)`

export default function ScentBar({ trustScore, className = '' }: Props) {
  const t = useTranslations('scent')
  const score = calcScentScore(trustScore)
  const current = SCENT_LEVELS.find(l => score >= l.min && score <= l.max) ?? SCENT_LEVELS[0]

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-bold" style={{ color: current.color }}>
          {t(`levels.${current.id}`)}
        </span>
        <span className="text-xs text-gray-400">{t('label')} {score}%</span>
      </div>

      <div className="relative h-2.5 rounded-full overflow-hidden bg-gray-100">
        <div className="absolute inset-0" style={{ background: GRADIENT, opacity: 0.15 }} />
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: GRADIENT }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md border-2 transition-all duration-500"
          style={{ left: `calc(${score}% - 7px)`, borderColor: current.color }}
        />
      </div>
    </div>
  )
}
