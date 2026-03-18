'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StepPlace from './StepPlace'
import StepType from './StepType'
import StepPhotos from './StepPhotos'
import StepRating from './StepRating'
import StepMemo from './StepMemo'
import { INITIAL_STATE, type UploadState } from './types'
import type { Rating } from '@/types/database'

const STEP_LABELS = ['장소', '타입', '사진', '평점', '메모']

export default function UploadFlow() {
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<UploadState>(INITIAL_STATE)
  const [loading, setLoading] = useState(false)

  // 계정 공개 여부에 따라 포스팅 기본값 설정
  useEffect(() => {
    supabase.from('profiles')
      .select('is_public')
      .single()
      .then(({ data }) => {
        if (data) setState(prev => ({ ...prev, isPublic: data.is_public }))
      })
  }, [])

  function update(patch: Partial<UploadState>) {
    setState(prev => ({ ...prev, ...patch }))
  }

  function goNext() {
    setState(prev => ({ ...prev, step: (prev.step + 1) as UploadState['step'] }))
  }

  function goBack() {
    if (state.step === 1) {
      router.back()
      return
    }
    setState(prev => ({ ...prev, step: (prev.step - 1) as UploadState['step'] }))
  }

  async function handleSubmit() {
    if (!state.place || !state.postType) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요해요')

      // 1. 장소 upsert (기존 장소도 district/category 업데이트)
      let placeId = state.place.id
      if (!placeId) {
        const { data: place, error: placeError } = await supabase
          .from('places')
          .upsert({
            name: state.place.name,
            lat: state.place.lat,
            lng: state.place.lng,
            address: state.place.address,
            city: state.place.city,
            district: state.place.district,
            category: state.place.category,
            place_type: state.place.place_type,
            created_by: user.id,
          }, { onConflict: 'name,lat,lng', ignoreDuplicates: false })
          .select('id')
          .single()

        if (placeError) throw placeError
        placeId = place.id
      }

      // 2. 사진 업로드
      const photoUrls: string[] = []
      for (const photo of state.photos) {
        const ext = photo.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(path, photo, { contentType: photo.type })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(path)
        photoUrls.push(publicUrl)
      }

      // 3. 포스팅 생성
      const { error: postError } = await supabase.from('posts').insert({
        user_id: user.id,
        place_id: placeId,
        type: state.postType,
        rating: state.rating,
        memo: state.memo || null,
        recommended_menu: state.recommendedMenu || null,
        photos: photoUrls,
        is_public: state.isPublic,
      })

      if (postError) throw postError

      // 4. 방문/가고싶은 장소 자동 저장
      await supabase.from('place_saves')
        .upsert({ user_id: user.id, place_id: placeId }, { onConflict: 'user_id,place_id', ignoreDuplicates: true })

      // 5. 트러스트 포인트 적립
      const action = state.postType === 'visited' ? 'visited_post' : 'want_post'
      await supabase.rpc('apply_trust_points', {
        p_user_id: user.id,
        p_action: action,
        p_ref_id: placeId,
      })

      // 히든스팟이면 추가 포인트
      if (state.place.place_type === 'hidden_spot') {
        await supabase.rpc('apply_trust_points', {
          p_user_id: user.id,
          p_action: 'hidden_spot_registered',
          p_ref_id: placeId,
        })
      }

      router.push('/feed')
    } catch (err) {
      console.error(err)
      alert('포스팅에 실패했어요. 다시 시도해주세요')
    } finally {
      setLoading(false)
    }
  }

  // visited면 5단계, want면 4단계 (평점 없음)
  const totalSteps = state.postType === 'want' ? 4 : 5
  const visibleStep = state.postType === 'want' && state.step >= 4
    ? state.step - 1
    : state.step

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-gray-100">
        <button onClick={goBack} className="text-gray-600">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">포스팅</h1>

        {/* 스텝 인디케이터 */}
        <div className="ml-auto flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < visibleStep ? 'w-6 bg-gray-900' : i === visibleStep - 1 ? 'w-4 bg-gray-900' : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>
      </header>

      {/* 컨텐츠 */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6 overflow-y-auto">
        {state.step === 1 && (
          <StepPlace
            onSelect={place => {
              update({ place })
              goNext()
            }}
          />
        )}
        {state.step === 2 && state.place && (
          <StepType
            place={state.place}
            onSelect={postType => {
              update({ postType })
              goNext()
            }}
          />
        )}
        {state.step === 3 && (
          <StepPhotos
            postType={state.postType!}
            photos={state.photos}
            onChange={photos => update({ photos })}
            onNext={goNext}
          />
        )}
        {state.step === 4 && state.postType === 'visited' && (
          <StepRating
            rating={state.rating}
            onSelect={rating => update({ rating })}
            onNext={goNext}
          />
        )}
        {(state.step === 4 && state.postType === 'want') || state.step === 5 ? (
          <StepMemo
            memo={state.memo}
            recommendedMenu={state.recommendedMenu}
            isPublic={state.isPublic}
            placeCategory={state.place?.category}
            onMemoChange={memo => update({ memo })}
            onMenuChange={recommendedMenu => update({ recommendedMenu })}
            onPublicChange={isPublic => update({ isPublic })}
            onSubmit={handleSubmit}
            loading={loading}
          />
        ) : null}
      </main>
    </div>
  )
}
