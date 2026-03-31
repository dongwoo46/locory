'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import type { SelectedPlace } from './types'
import type { Category, City } from '@/types/database'

const CATEGORY_VALUES: Category[] = ['cafe', 'restaurant', 'photospot', 'street', 'bar', 'culture', 'nature', 'shopping']

const UploadMapSection = dynamic(() => import('./UploadMapSection'), {
  ssr: false,
  loading: () => <div className="rounded-xl overflow-hidden h-52 bg-gray-200 animate-pulse" />,
})

function detectCity(lat: number, lng: number): City {
  if (lat >= 33.0 && lat <= 34.0) return 'jeju'
  if (lat >= 34.8 && lat <= 35.4 && lng >= 128.8) return 'busan'
  if (lat >= 35.6 && lat <= 36.1 && lng >= 128.9 && lng <= 129.4) return 'gyeongju'
  if (lat >= 35.7 && lat <= 35.9 && lng >= 127.0 && lng <= 127.3) return 'jeonju'
  if (lat >= 37.7 && lat <= 37.95 && lng >= 128.8 && lng <= 129.0) return 'gangneung'
  if (lat >= 38.1 && lat <= 38.3 && lng >= 128.5 && lng <= 128.7) return 'sokcho'
  if (lat >= 34.6 && lat <= 34.9 && lng >= 127.5 && lng <= 127.8) return 'yeosu'
  if (lat >= 37.3 && lat <= 37.6 && lng >= 126.5 && lng <= 126.8) return 'incheon'
  return 'seoul'
}

interface LocationInfo {
  name: string
  lat: number
  lng: number
  address: string
  countryCode?: string | null
  adminAreaLevel2?: string | null
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
  const [searchResults, setSearchResults] = useState<Array<{
    name: string
    address: string
    lat: number
    lng: number
    countryCode?: string | null
    adminAreaLevel2?: string | null
  }>>([])
  const [location, setLocation] = useState<LocationInfo | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [placeName, setPlaceName] = useState('')
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.978 })
  const searchCache = useRef<Record<string, Array<{ name: string; address: string; lat: number; lng: number; countryCode?: string | null; adminAreaLevel2?: string | null }>>>({})
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') executeSearch(searchQuery)
  }

  function handlePickSearchResult(result: { name: string; address: string; lat: number; lng: number; countryCode?: string | null; adminAreaLevel2?: string | null }) {
    setLocation({
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      address: result.address,
      countryCode: result.countryCode,
      adminAreaLevel2: result.adminAreaLevel2 ?? null,
    })
    setSearchResults([])
    setSearchQuery(result.name)
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
          setLocation({
            name: placeName || t('place.currentLocation'),
            lat,
            lng,
            address: data.address || '',
            countryCode: data.countryCode ?? null,
            adminAreaLevel2: data.adminAreaLevel2 ?? null,
          })
        } catch {
          setLocation({ name: t('place.currentLocation'), lat, lng, address: '' })
        }
        setGpsLoading(false)
      },
      () => { alert(t('place.gpsError')); setGpsLoading(false) }
    )
  }

  async function handleMapPick({ lat, lng, name: poiName, address: poiAddress }: { lat: number; lng: number; name?: string; address?: string }) {
    if (poiName) {
      setPlaceName(poiName)
      setLocation({ name: poiName, lat, lng, address: poiAddress || '', countryCode: null, adminAreaLevel2: null })
      return
    }
    setLocation({ name: placeName || t('place.selectedLocation'), lat, lng, address: '', adminAreaLevel2: null })
    try {
      const res = await fetch(`/api/places/geocode?lat=${lat}&lng=${lng}`)
      const data = await res.json()
      setLocation({
        name: placeName || t('place.selectedLocation'),
        lat,
        lng,
        address: data.address || '',
        countryCode: data.countryCode ?? null,
        adminAreaLevel2: data.adminAreaLevel2 ?? null,
      })
    } catch {
      // keep existing location
    }
  }

  function handleConfirm() {
    if (!location || !category) return
    const city = detectCity(location.lat, location.lng)
    onSelect({
      id: location.existingId,
      name: location.name,
      lat: location.lat,
      lng: location.lng,
      address: location.address,
      city,
      countryCode: location.countryCode || null,
      adminAreaLevel2: location.adminAreaLevel2 || null,
      category,
      place_type: 'normal',
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('place.title')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('place.subtitle')}</p>
      </div>

      {/* 탭 */}
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
              onClick={() => executeSearch(searchQuery)}
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

      {/* 지도 */}
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

      {/* 카테고리 - 장소 선택 후 표시 */}
      {(location || mode !== 'search') && (
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

          <button
            onClick={handleConfirm}
            disabled={!location || !category}
            className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-40"
          >
            {t('place.next')}
          </button>
        </div>
      )}
    </div>
  )
}
