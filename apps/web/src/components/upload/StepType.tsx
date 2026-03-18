'use client'

import type { PostType } from '@/types/database'
import type { SelectedPlace } from './types'

interface Props {
  place: SelectedPlace
  onSelect: (type: PostType) => void
}

export default function StepType({ place, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{place.name}</p>
        <h2 className="text-lg font-semibold text-gray-900 mt-0.5">어떤 포스팅인가요?</h2>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => onSelect('visited')}
          className="flex flex-col gap-1 px-5 py-4 border border-gray-200 rounded-xl text-left hover:border-gray-900 hover:bg-gray-50 transition-colors"
        >
          <span className="text-base font-semibold text-gray-900">갔다온 곳</span>
          <span className="text-sm text-gray-500">방문한 장소 후기와 사진을 남겨요</span>
        </button>

        <button
          onClick={() => onSelect('want')}
          className="flex flex-col gap-1 px-5 py-4 border border-gray-200 rounded-xl text-left hover:border-gray-900 hover:bg-gray-50 transition-colors"
        >
          <span className="text-base font-semibold text-gray-900">가고싶은 곳</span>
          <span className="text-sm text-gray-500">언젠가 꼭 가보고 싶은 장소를 공유해요</span>
        </button>
      </div>
    </div>
  )
}
