'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StepPlace from './StepPlace'
import StepType from './StepType'
import StepPhotos from './StepPhotos'
import StepRating from './StepRating'
import StepMemo from './StepMemo'
import { useTranslations } from 'next-intl'
import { INITIAL_STATE, type UploadState } from './types'
import { optimizeImageFile, optimizeImageFileCover } from '@/lib/utils/image'

export default function UploadFlow() {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('upload')
  const [state, setState] = useState<UploadState>(INITIAL_STATE)
  const [loading, setLoading] = useState(false)
  const [userNationality, setUserNationality] = useState<string | null>(null)

  // 계정 공개 여부 + 국적 가져오기
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles')
        .select('is_public, nationality')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setState(prev => ({ ...prev, isPublic: data.is_public }))
            setUserNationality(data.nationality)
          }
        })
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
      if (!user) throw new Error(t('loginRequired'))

      // 1. 장소 upsert
      let placeId = state.place.id
      if (!placeId) {
        const countryCode = (state.place.countryCode || 'KR').toUpperCase()
        const { data: place, error: placeError } = await supabase
          .from('places')
          .upsert({
            name: state.place.name,
            lat: state.place.lat,
            lng: state.place.lng,
            address: state.place.address,
            city: state.place.city,
            country_code: countryCode,
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
      const mediumPhotoUrls: string[] = []
      const photoVariants: Array<{
        thumbnailUrl: string
        mediumUrl: string
        originalUrl: string
      }> = []
      for (const photo of state.photos) {
        const thumbnail = await optimizeImageFileCover(photo, {
          width: 720,
          height: 960,
          quality: 0.78,
          mimeType: 'image/webp',
        })
        const medium = await optimizeImageFile(photo, {
          maxWidth: 1280,
          maxHeight: 1280,
          quality: 0.8,
          mimeType: 'image/webp',
        })
        const optimizedOriginal = await optimizeImageFile(photo, {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 0.88,
          mimeType: 'image/webp',
        })

        const basePath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}`
        const thumbnailPath = `${basePath}_thumb.webp`
        const mediumPath = `${basePath}_medium.webp`
        const originalPath = `${basePath}_original.webp`

        const { error: thumbnailUploadError } = await supabase.storage
          .from('posts')
          .upload(thumbnailPath, thumbnail, { contentType: thumbnail.type, cacheControl: '31536000' })
        if (thumbnailUploadError) throw thumbnailUploadError

        const { error: mediumUploadError } = await supabase.storage
          .from('posts')
          .upload(mediumPath, medium, { contentType: medium.type, cacheControl: '31536000' })
        if (mediumUploadError) throw mediumUploadError

        const { error: originalUploadError } = await supabase.storage
          .from('posts')
          .upload(originalPath, optimizedOriginal, { contentType: optimizedOriginal.type, cacheControl: '31536000' })
        if (originalUploadError) throw originalUploadError

        const { data: { publicUrl: thumbnailUrl } } = supabase.storage.from('posts').getPublicUrl(thumbnailPath)
        const { data: { publicUrl: mediumUrl } } = supabase.storage.from('posts').getPublicUrl(mediumPath)
        const { data: { publicUrl: originalUrl } } = supabase.storage.from('posts').getPublicUrl(originalPath)

        mediumPhotoUrls.push(mediumUrl)
        photoVariants.push({ thumbnailUrl, mediumUrl, originalUrl })
      }

      // 3. 포스팅 생성
      const { error: postError } = await supabase.from('posts').insert({
        user_id: user.id,
        place_id: placeId,
        type: state.postType,
        rating: state.rating,
        memo: state.memo || null,
        recommended_menu: state.recommendedMenu || null,
        photos: mediumPhotoUrls,
        photo_variants: photoVariants,
        is_public: state.isPublic,
        is_local_recommendation: state.isLocalRecommendation,
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

      // 현지인 추천이면 추가 포인트
      if (state.isLocalRecommendation) {
        await supabase.rpc('apply_trust_points', {
          p_user_id: user.id,
          p_action: 'local_recommendation_post',
          p_ref_id: placeId,
        })
      }

      router.push('/feed')
    } catch (err) {
      console.error(err)
      alert(t('failedMsg'))
    } finally {
      setLoading(false)
    }
  }

  // 현지인 추천 가능 여부: 한국 장소 = KR 국적만 (추후 다국가 확장 시 place.country 비교)
  const canLocalRecommend = userNationality === 'KR'

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
        <h1 className="text-base font-semibold text-gray-900">{t('title')}</h1>

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
            isLocalRecommendation={state.isLocalRecommendation}
            canLocalRecommend={canLocalRecommend}
            placeCategory={state.place?.category}
            onMemoChange={memo => update({ memo })}
            onMenuChange={recommendedMenu => update({ recommendedMenu })}
            onPublicChange={isPublic => update({ isPublic })}
            onLocalRecChange={isLocalRecommendation => update({ isLocalRecommendation })}
            onSubmit={handleSubmit}
            loading={loading}
          />
        ) : null}
      </main>
    </div>
  )
}
