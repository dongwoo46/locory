'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { containsProfanity } from '@/lib/utils/profanity'

const MENU_CATEGORIES = new Set(['cafe', 'restaurant', 'bar'])

interface Props {
  memo: string
  recommendedMenu: string
  isPublic: boolean
  isLocalRecommendation: boolean
  canLocalRecommend: boolean   // 국적이 장소 국가와 일치할 때만 true
  placeCategory?: string
  onMemoChange: (memo: string) => void
  onMenuChange: (menu: string) => void
  onPublicChange: (isPublic: boolean) => void
  onLocalRecChange: (v: boolean) => void
  onSubmit: () => void
  loading: boolean
}

export default function StepMemo({ memo, recommendedMenu, isPublic, isLocalRecommendation, canLocalRecommend, placeCategory, onMemoChange, onMenuChange, onPublicChange, onLocalRecChange, onSubmit, loading }: Props) {
  const t = useTranslations('upload')
  const tCommon = useTranslations('common')
  const [error, setError] = useState('')
  const showMenu = placeCategory && MENU_CATEGORIES.has(placeCategory)

  function handleSubmit() {
    if (containsProfanity(memo) || containsProfanity(recommendedMenu)) {
      setError(tCommon('profanityError'))
      return
    }
    setError('')
    onSubmit()
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('memo.title')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('memo.subtitle')}</p>
      </div>

      <textarea
        value={memo}
        onChange={e => { onMemoChange(e.target.value); setError('') }}
        placeholder={t('memo.memoPlaceholder')}
        maxLength={500}
        rows={4}
        className="px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 resize-none"
      />
      <p className="text-xs text-gray-400 text-right -mt-3">{memo.length}/500</p>

      {showMenu && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-gray-900">
            {t('memo.menuLabel')} <span className="text-xs font-normal text-gray-400">{t('memo.menuOptional')}</span>
          </label>
          <input
            type="text"
            value={recommendedMenu}
            onChange={e => { onMenuChange(e.target.value); setError('') }}
            placeholder={t('memo.menuPlaceholder')}
            maxLength={100}
            className="px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
          />
        </div>
      )}

      {/* 현지인 추천 — KR 국적만 활성화, 아니면 잠금 표시 */}
      <button
        onClick={() => canLocalRecommend && onLocalRecChange(!isLocalRecommendation)}
        disabled={!canLocalRecommend}
        className={`flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-colors ${
          !canLocalRecommend
            ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
            : isLocalRecommendation
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-gray-200'
        }`}
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-semibold text-gray-900">
            🏠 {t('memo.localRec')}
            {!canLocalRecommend && <span className="ml-1 text-xs text-gray-400">🔒</span>}
          </span>
          <span className="text-xs text-gray-400">
            {canLocalRecommend ? t('memo.localRecDesc') : t('memo.localRecLocked')}
          </span>
        </div>
        <div className={`w-11 h-6 rounded-full transition-colors ${
          !canLocalRecommend ? 'bg-gray-200' : isLocalRecommendation ? 'bg-emerald-500' : 'bg-gray-200'
        }`}>
          <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-transform shadow-sm ${
            isLocalRecommendation && canLocalRecommend ? 'translate-x-5.5' : 'translate-x-0.5'
          }`} />
        </div>
      </button>

      {/* 공개/비공개 */}
      <button
        onClick={() => onPublicChange(!isPublic)}
        className={`flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-colors ${
          isPublic ? 'border-gray-900' : 'border-gray-200'
        }`}
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-semibold text-gray-900">
            {isPublic ? t('memo.public') : t('memo.private')}
          </span>
          <span className="text-xs text-gray-400">
            {isPublic ? t('memo.publicDesc') : t('memo.privateDesc')}
          </span>
        </div>
        <div className={`w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-gray-900' : 'bg-gray-200'}`}>
          <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-transform shadow-sm ${
            isPublic ? 'translate-x-5.5' : 'translate-x-0.5'
          }`} />
        </div>
      </button>

      {error && <p className="text-xs text-red-500 -mt-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
      >
        {loading ? t('memo.submitting') : t('memo.submit')}
      </button>
    </div>
  )
}