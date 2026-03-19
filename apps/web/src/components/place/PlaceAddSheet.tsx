'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { inferCityFromAddress, inferDistrictFromAddress } from '@/lib/utils/districts'
import type { Category, City } from '@/types/database'

const CATEGORY_EMOJIS: Record<Category, string> = {
  cafe: '☕', restaurant: '🍽️', photospot: '📸', street: '🚶',
  bar: '🍻', culture: '🎨', nature: '🌿', shopping: '🛍️',
}
const CATEGORY_VALUES: Category[] = ['cafe', 'restaurant', 'photospot', 'street', 'bar', 'culture', 'nature', 'shopping']

function detectCity(lat: number, lng: number): City {
  if (lat >= 33.0 && lat <= 34.0) return 'jeju'
  if (lat >= 34.8 && lat <= 35.4 && lng >= 128.8) return 'busan'
  if (lat >= 35.6 && lat <= 36.1 && lng >= 128.9 && lng <= 129.4) return 'gyeongju'
  if (lat >= 35.7 && lat <= 35.9 && lng >= 127.0 && lng <= 127.3) return 'jeonju'
  if (lat >= 37.7 && lat <= 37.9 && lng >= 128.8 && lng <= 129.0) return 'gangneung'
  if (lat >= 38.1 && lat <= 38.3 && lng >= 128.5 && lng <= 128.7) return 'sokcho'
  if (lat >= 34.6 && lat <= 34.9 && lng >= 127.5 && lng <= 127.8) return 'yeosu'
  if (lat >= 37.3 && lat <= 37.6 && lng >= 126.5 && lng <= 126.8) return 'incheon'
  return 'seoul'
}

interface FoundPlace {
  name: string
  address: string
  lat: number
  lng: number
  googlePlaceId?: string | null
  googleRating?: number | null
  googleReviewCount?: number | null
}

interface Props {
  userId: string
  onClose: () => void
  onSaved: (place: { id: string; name: string; category: string; city: string; district: string | null }) => void
}

export default function PlaceAddSheet({ userId, onClose, onSaved }: Props) {
  const supabase = createClient()
  const t = useTranslations('placeAdd')
  const tPost = useTranslations('post')

  const [tab, setTab] = useState<'search' | 'gps' | 'link'>('search')
  const [linkInput, setLinkInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoundPlace[]>([])
  const [found, setFound] = useState<FoundPlace | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [district, setDistrict] = useState<string | null>(null)
  const [saveType, setSaveType] = useState<'want' | 'visited' | 'hidden_spot'>('want')
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [customDistrict, setCustomDistrict] = useState('')
  const searchCache = useRef<Record<string, FoundPlace[]>>({})

  async function handleGPS() {
    setGpsLoading(true)
    setError('')
    setFound(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res = await fetch(`/api/places/geocode?lat=${lat}&lng=${lng}`)
          const data = await res.json()
          selectPlace({ name: data.placeName || t('currentLocation'), address: data.address || '', lat, lng })
        } catch {
          selectPlace({ name: t('currentLocation'), address: '', lat, lng })
        } finally {
          setGpsLoading(false)
        }
      },
      () => { setError(t('gpsError')); setGpsLoading(false) }
    )
  }

  async function handleLinkSubmit() {
    if (!linkInput.trim()) return
    setLoading(true)
    setError('')
    setFound(null)
    try {
      const res = await fetch('/api/places/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkInput.trim() }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      selectPlace(data)
    } catch {
      setError(t('errorGeneral'))
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) return
    if (searchCache.current[query]) { setSearchResults(searchCache.current[query]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      searchCache.current[query] = data.places || []
      setSearchResults(data.places || [])
    } finally {
      setLoading(false)
    }
  }, [])

  function selectPlace(r: FoundPlace) {
    setFound(r)
    setDistrict(null)
    if (r.address) {
      const detectedCity = inferCityFromAddress(r.address) || detectCity(r.lat, r.lng)
      const detectedDistrict = inferDistrictFromAddress(r.address, detectedCity)
      if (detectedDistrict) setDistrict(detectedDistrict)
    }
  }

  async function handleSave() {
    if (!found || !category) return
    const effectiveDistrict = district || customDistrict.trim() || null
    setSaving(true)
    try {
      const city = detectCity(found.lat, found.lng)

      // places 테이블에 저장 (기존 장소 있으면 재사용)
      let placeId = ''
      if (found.googlePlaceId) {
        const { data: existing } = await supabase
          .from('places')
          .select('id')
          .eq('google_place_id', found.googlePlaceId)
          .maybeSingle()
        placeId = existing?.id ?? ''
      }
      if (!placeId) {
        // lat/lng 근처 동일 장소명으로 조회
        const { data: existing } = await supabase
          .from('places')
          .select('id')
          .eq('name', found.name)
          .gte('lat', found.lat - 0.0001)
          .lte('lat', found.lat + 0.0001)
          .gte('lng', found.lng - 0.0001)
          .lte('lng', found.lng + 0.0001)
          .maybeSingle()
        placeId = existing?.id ?? ''
      }
      if (!placeId) {
        const { data: inserted, error: insertErr } = await supabase
          .from('places')
          .insert({
            name: found.name,
            lat: found.lat,
            lng: found.lng,
            address: found.address,
            city,
            district: effectiveDistrict,
            category,
            place_type: saveType === 'hidden_spot' ? 'hidden_spot' : 'normal',
            created_by: userId,
            ...(found.googlePlaceId && { google_place_id: found.googlePlaceId }),
            ...(found.googleRating != null && { google_rating: found.googleRating }),
            ...(found.googleReviewCount != null && { google_review_count: found.googleReviewCount }),
          })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        placeId = inserted.id
      }
      const place = { id: placeId }

      // place_saves에 저장
      await supabase
        .from('place_saves')
        .upsert({ user_id: userId, place_id: place.id }, { onConflict: 'user_id,place_id', ignoreDuplicates: true })

      onSaved({ id: place.id, name: found.name, category, city, district: effectiveDistrict })
      onClose()
    } catch (e) {
      setError(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const canSave = found && category

  return (
    <div className="fixed inset-0 bg-black/60 z-60 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-2xl overflow-hidden max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-4 pb-8">
          <h2 className="text-base font-bold text-gray-900 mb-4 mt-2">{t('title')}</h2>

          {/* 탭 */}
          <div className="flex border-b border-gray-100 mb-4">
            {([
              { key: 'search', label: t('tabSearch') },
              { key: 'gps', label: t('tabGps') },
              { key: 'link', label: t('tabLink') },
            ] as const).map(item => (
              <button
                key={item.key}
                onClick={() => { setTab(item.key); setFound(null); setError('') }}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === item.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* 내 위치 탭 */}
          {tab === 'gps' && (
            <div className="flex flex-col gap-3">
              {!found ? (
                <button
                  onClick={handleGPS}
                  disabled={gpsLoading}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
                  </svg>
                  {gpsLoading ? t('gpsLoading') : t('gpsButton')}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl">
                  <svg width="14" height="14" fill="none" stroke="#6B7280" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{found.name}</p>
                    {found.address && <p className="text-xs text-gray-400">{found.address}</p>}
                  </div>
                </div>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          )}

          {/* 링크 탭 */}
          {tab === 'link' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-400">{t('linkHint')}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={linkInput}
                  onChange={e => setLinkInput(e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                />
                <button
                  onClick={handleLinkSubmit}
                  disabled={loading || !linkInput.trim()}
                  className="px-4 py-2.5 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-40 shrink-0"
                >
                  {loading ? '...' : t('confirm')}
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          )}

          {/* 검색 탭 */}
          {tab === 'search' && !found && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch(searchQuery)}
                  placeholder={t('searchPlaceholder')}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                />
                <button
                  onClick={() => handleSearch(searchQuery)}
                  disabled={loading || searchQuery.length < 2}
                  className="px-4 py-2.5 bg-gray-900 text-white text-sm rounded-xl disabled:opacity-40 shrink-0"
                >
                  {loading ? '...' : t('search')}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="flex flex-col border border-gray-100 rounded-xl overflow-hidden">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { selectPlace(r); setSearchResults([]) }}
                      className="flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <span className="text-sm font-medium text-gray-900">{r.name}</span>
                      <span className="text-xs text-gray-400">{r.address}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 선택된 장소 + 카테고리/동네 선택 */}
          {found && (
            <div className="flex flex-col gap-4 mt-4">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                </svg>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{found.name}</p>
                  <p className="text-xs text-gray-400">{found.address}</p>
                </div>
              </div>

              {/* 저장 타입 */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500">{t('typeLabel')}</p>
                <div className="flex gap-2">
                  {([
                    { key: 'want', label: t('typeWant') },
                    { key: 'visited', label: t('typeVisited') },
                    { key: 'hidden_spot', label: t('typeHidden') },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setSaveType(opt.key)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                        saveType === opt.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 카테고리 */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500">{t('categoryLabel')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORY_VALUES.map(val => (
                    <button
                      key={val}
                      onClick={() => setCategory(val)}
                      className={`py-2 rounded-xl text-xs font-medium flex flex-col items-center gap-0.5 transition-colors ${
                        category === val ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <span>{CATEGORY_EMOJIS[val]}</span>
                      <span>{tPost(`category.${val}`)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 동네 — 자동 추출 실패 시만 입력 */}
              {!district && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-gray-400">{t('neighborhoodNotFound')}</p>
                  <input
                    type="text"
                    value={customDistrict}
                    onChange={e => setCustomDistrict(e.target.value)}
                    placeholder={t('neighborhoodPlaceholder')}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                  />
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
