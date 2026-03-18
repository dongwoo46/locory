'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import type { PostType } from '@/types/database'

interface Props {
  postType: PostType
  photos: File[]
  onChange: (photos: File[]) => void
  onNext: () => void
}

export default function StepPhotos({ postType, photos, onChange, onNext }: Props) {
  const t = useTranslations('upload')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const merged = [...photos, ...files].slice(0, 3)
    onChange(merged)
  }

  function removePhoto(index: number) {
    onChange(photos.filter((_, i) => i !== index))
  }

  const canSkip = postType === 'want'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('photos.title')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {postType === 'visited' ? t('photos.subtitleVisited') : t('photos.subtitleWant')}
        </p>
      </div>

      {/* 사진 그리드 */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((file, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
            <img
              src={URL.createObjectURL(file)}
              alt=""
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => removePhoto(i)}
              className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
            >
              <svg width="10" height="10" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}

        {photos.length < 3 && (
          <button
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 hover:border-gray-400 transition-colors"
          >
            <svg width="24" height="24" fill="none" stroke="#9CA3AF" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            <span className="text-xs text-gray-400">{photos.length}/3</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <div className="flex gap-2">
        {canSkip && (
          <button
            onClick={onNext}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600"
          >
            {t('photos.skip')}
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!canSkip && photos.length === 0}
          className="flex-1 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
        >
          {t('photos.next')}
        </button>
      </div>
    </div>
  )
}
