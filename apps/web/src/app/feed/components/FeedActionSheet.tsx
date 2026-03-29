'use client'

type TranslateFn = (key: string) => string

type Props = {
  open: boolean
  onClose: () => void
  onUpload: () => void
  onAddPlace: () => void
  t: TranslateFn
}

export default function FeedActionSheet({
  open,
  onClose,
  onUpload,
  onAddPlace,
  t,
}: Props) {
  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-60" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-70 bg-white rounded-t-2xl pb-10 pt-3 max-w-lg mx-auto">
        <div className="flex justify-center mb-4">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex flex-col gap-2 px-4">
          <button
            onClick={onUpload}
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
              <p className="text-sm font-semibold text-gray-900">{t('addFeed')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('addFeedDesc')}</p>
            </div>
          </button>
          <button
            onClick={onAddPlace}
            className="flex items-center gap-4 px-4 py-4 bg-gray-50 rounded-2xl text-left"
          >
            <div className="w-11 h-11 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
              <svg width="20" height="20" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{t('addPlace')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t('addPlaceDesc')}</p>
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
