'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import type { SelectedPlace } from './types'
import type { Category, City } from '@/types/database'
import { getDistricts, inferCityFromAddress, inferDistrictFromAddress } from '@/lib/utils/districts'

const CATEGORY_VALUES: Category[] = ['cafe', 'restaurant', 'photospot', 'street', 'bar', 'culture', 'nature', 'shopping']

const UploadMapSection = dynamic(() => import('./UploadMapSection'), {
  ssr: false,
  loading: () => <div className="rounded-xl overflow-hidden h-52 bg-gray-200 animate-pulse" />,
})

// 좌표로 도시 자동 감지
function detectCity(lat: number, lng: number): City {
  if (lat >= 33.0 && lat <= 34.0) return 'jeju'
  if (lat >= 34.8 && lat <= 35.4 && lng >= 128.8) return 'busan'
  if (lat >= 35.6 && lat <= 36.1 && lng >= 128.9 && lng <= 129.4) return 'gyeongju'
  return 'seoul'
}

interface LocationInfo {
  name: string
  lat: number
  lng: number
  address: string
  existingId?: string
}

interface Props {
  onSelect: (place: SelectedPlace) => void
}

export default function StepPlace({ onSelect }: Props) {
  const t = useTranslations('upload')
  const tPost = useTranslations('post')
  const [mode, setMode] = useState<'search' | 'map' | 'gps'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ name: string; address: string; lat: number; lng: number }[]>([])
  const [location, setLocation] = useState<LocationInfo | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [district, setDistrict] = useState<string | null>(null)
  const [isHidden, setIsHidden] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [placeName, setPlaceName] = useState('')
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.978 })
  const searchCache = useRef<Record<string, { name: string; address: string; lat: number; lng: number }[]>>({})
  const isSearching = useRef(false)

  const executeSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) return
    if (isSearching.current) return

    if (searchCache.current[query]) {
      setSearchResults(searchCache.current[query])
      return
    }

    isSearching.current = true
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      const results = data.places || []
      searchCache.current[query] = results
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
      isSearching.current = false
    }
  }, [])

  function handleSearch(query: string) {
    setSearchQuery(query)
    setLocation(null)
    setSearchResults([])
  }

  function handleSearchSubmit() {
    executeSearch(searchQuery)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') executeSearch(searchQuery)
  }

  function handlePickSearchResult(result: { name: string; address: string; lat: number; lng: number }) {
    setLocation({ name: result.name, lat: result.lat, lng: result.lng, address: result.address })
    setSearchResults([])
    setSearchQuery(result.name)
    if (result.address) {
      const detectedCity = inferCityFromAddress(result.address) || detectCity(result.lat, result.lng)
      const detectedDistrict = inferDistrictFromAddress(result.address, detectedCity)
      if (detectedDistrict) setDistrict(detectedDistrict)
    }
  }

  async function handleGPS() {
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setMapCenter({ lat, lng })
        setMode('map')
        try {
          const res = await fetch(`/api/places/geocode?lat=${lat}&lng=${lng}`)
          const data = await res.json()
          setLocation({ name: placeName || t('place.currentLocation'), lat, lng, address: data.address || '' })
        } catch {
          setLocation({ name: t('place.currentLocation'), lat, lng, address: '' })
        }
        setGpsLoading(false)
      },
      () => { alert(t('place.gpsError')); setGpsLoading(false) }
    )
  }

  function handleMapPick(lat: number, lng: number) {
    setLocation({ name: placeName || t('place.selectedLocation'), lat, lng, address: '' })
  }

  function handleConfirm() {
    if (!location || !category || !district) return
    const city = detectCity(location.lat, location.lng)
    onSelect({
      id: location.existingId,
      name: location.name,
      lat: location.lat,
      lng: location.lng,
      address: location.address,
      city,
      district,
      category,
      place_type: isHidden ? 'hidden_spot' : 'normal',
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('place.title')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('place.subtitle')}</p>
      </div>

      {/* 모드 탭 */}
      <div className="flex gap-2">
        {([
          { key: 'search', label: t('place.tabSearch') },
          { key: 'map', label: t('place.tabMap') },
          { key: 'gps', label: t('place.tabGps') },
        ] as const).map(m => (
          <button
            key={m.key}
            onClick={() => m.key === 'gps' ? handleGPS() : setMode(m.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {gpsLoading && m.key === 'gps' ? t('place.gpsLoading') : m.label}
          </button>
        ))}
      </div>

      {/* 검색 */}
      {mode === 'search' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('place.searchPlaceholder')}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
            />
            <button
              onClick={handleSearchSubmit}
              disabled={searchLoading || searchQuery.length < 2}
              className="px-4 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40 shrink-0"
            >
              {searchLoading ? '...' : t('place.search')}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="flex flex-col border border-gray-100 rounded-xl overflow-hidden">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handlePickSearchResult(r)}
                  className="flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <span className="text-sm font-medium text-gray-900">{r.name}</span>
                  <span className="text-xs text-gray-400">{r.address}</span>
                </button>
              ))}
            </div>
          )}
          {/* 선택된 장소 표시 */}
          {location && (
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl">
              <svg width="14" height="14" fill="none" stroke="#6B7280" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              </svg>
              <span className="text-sm text-gray-700 font-medium">{location.name}</span>
            </div>
          )}
        </div>
      )}

      {/* 지도 핀 */}
      {(mode === 'map' || mode === 'gps') && (
        <div className="flex flex-col gap-3">
          <UploadMapSection center={mapCenter} onPick={handleMapPick} />
          <p className="text-xs text-gray-400 text-center">{t('place.mapInstruction')}</p>
          <input
            type="text"
            value={placeName}
            onChange={e => {
              setPlaceName(e.target.value)
              if (location) setLocation({ ...location, name: e.target.value })
            }}
            placeholder={t('place.placeNamePlaceholder')}
            className="px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
          />
        </div>
      )}

      {/* 카테고리 + 히든스팟 - 장소 선택 후 표시 */}
      {(location || (mode !== 'search')) && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">{t('place.categoryLabel')}</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORY_VALUES.map(val => (
                <button
                  key={val}
                  onClick={() => setCategory(val)}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                    category === val ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tPost(`category.${val}`)}
                </button>
              ))}
            </div>
          </div>

          {/* 동네 선택 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">{t('place.neighborhoodLabel')}</label>
            {(() => {
              const districtList = getDistricts(location ? detectCity(location.lat, location.lng) : 'seoul')
              const isCustom = district === '__custom__' || (district != null && !districtList.find(d => d.value === district))
              return (
                <>
                  <div className="flex gap-2 flex-wrap">
                    {districtList.map(d => (
                      <button
                        key={d.value}
                        onClick={() => setDistrict(d.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          district === d.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setDistrict('__custom__')}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isCustom ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t('place.customInput')}
                    </button>
                  </div>
                  {isCustom && (
                    <input
                      type="text"
                      value={district === '__custom__' ? '' : district ?? ''}
                      onChange={e => setDistrict(e.target.value || '__custom__')}
                      placeholder={t('place.neighborhoodPlaceholder')}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
                      autoFocus
                    />
                  )}
                </>
              )
            })()}
          </div>

          <button
            onClick={() => setIsHidden(!isHidden)}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
              isHidden ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
            }`}
          >
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-gray-900">{t('place.hiddenSpotLabel')}</span>
              <span className="text-xs text-gray-400">{t('place.hiddenSpotDesc')}</span>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 transition-colors ${
              isHidden ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
            }`} />
          </button>

          <button
            onClick={handleConfirm}
            disabled={!location || !category || !district}
            className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
          >
            {t('place.next')}
          </button>
        </div>
      )}
    </div>
  )
}
