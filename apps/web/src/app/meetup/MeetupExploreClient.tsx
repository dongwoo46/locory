'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { APIProvider, AdvancedMarker, Map as GoogleMap } from '@vis.gl/react-google-maps'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/ui/BottomNav'
import NotificationBell from '@/components/ui/NotificationBell'
import { CITIES } from '@/lib/utils/districts'
import { getLocalizedKrDistrictLabel } from '@/lib/utils/administrativeLabels'
import { CameraPanner } from '../map/map-overlays'

const FETCH_LIMIT = 300
const CITY_STAGE_MAX_ZOOM = 8.6
const DETAIL_STAGE_MIN_ZOOM = 12.8

const ACTIVITIES = [
  { value: 'chat' },
  { value: 'food' },
  { value: 'photo' },
  { value: 'tour' },
  { value: 'drink' },
  { value: 'game' },
  { value: 'other' },
] as const
const VIBES = [{ value: 'casual' }, { value: 'fun' }, { value: 'serious' }] as const
const WANTED_GENDER_OPTS = [{ value: 'female' }, { value: 'male' }, { value: 'any' }] as const
const WANTED_AGE_OPTS = [
  { value: 'teens' },
  { value: '20s_early' },
  { value: '20s_mid' },
  { value: '20s_late' },
  { value: '30s_early' },
  { value: '30s_mid' },
  { value: '30s_late' },
  { value: '40s_plus' },
] as const
const DATE_OPTS = ['today', 'week', 'weekend'] as const

type MeetupPlace = {
  id: string
  name: string
  city: string
  district: string | null
  category: string
  lat: number | null
  lng: number | null
}

type MeetupProfile = {
  id: string
  nickname: string | null
  avatar_url: string | null
  gender: string | null
  birth_date: string | null
}

interface MeetupCard {
  id: string
  scheduled_at: string
  status: string
  host_count: number
  host_gender: string
  host_age_groups: string[]
  activities: string[]
  vibe: string
  title: string | null
  description: string | null
  wanted_gender: string
  wanted_age_groups: string[] | null
  wanted_count: number | null
  places: MeetupPlace | MeetupPlace[] | null
  profiles: MeetupProfile | MeetupProfile[] | null
}

type MapBounds = {
  north: number
  south: number
  east: number
  west: number
}

type PlacesSearchResult = {
  name?: string
  address?: string
  lat?: number
  lng?: number
}

type MeetupSearchItem = {
  meetupId: string
  placeName: string
  city: string
  district: string | null
  lat: number
  lng: number
}

interface Props {
  userId: string
  isAnonymous?: boolean
  profile: {
    id: string
    gender: string | null
    birth_date: string | null
    nationality: string | null
    is_public: boolean
    trust_score: number
    avatar_url: string | null
  } | null
}

function asSinglePlace(place: MeetupPlace | MeetupPlace[] | null): MeetupPlace | null {
  if (!place) return null
  return Array.isArray(place) ? (place[0] ?? null) : place
}

function asSingleProfile(profile: MeetupProfile | MeetupProfile[] | null): MeetupProfile | null {
  if (!profile) return null
  return Array.isArray(profile) ? (profile[0] ?? null) : profile
}

function hasCoords(
  place: MeetupPlace | null,
): place is MeetupPlace & { lat: number; lng: number } {
  return place?.lat != null && place?.lng != null
}

function formatScheduled(iso: string) {
  const d = new Date(iso)
  const mm = d.getMonth() + 1
  const dd = d.getDate()
  const hh = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${mm}/${dd} ${hh}:${min}`
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1
  return age
}

function isToday(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isThisWeek(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 86400000)
  return d >= now && d <= weekFromNow
}

function isWeekend(iso: string) {
  const d = new Date(iso)
  const day = d.getDay()
  return day === 0 || day === 6
}

export default function MeetupExploreClient({ userId, profile, isAnonymous = false }: Props) {
  const router = useRouter()
  const locale = useLocale()
  const supabase = createClient()
  const t = useTranslations('meetup')
  const tFeed = useTranslations('feed')
  const tCommon = useTranslations('common')
  const tMap = useTranslations('map')
  const tCities = useTranslations('cities')
  const tDistricts = useTranslations('districts')
  const filterLabel = tFeed.has('filter') ? tFeed('filter') : 'Filter'
  const filterResetLabel = tFeed.has('filterReset') ? tFeed('filterReset') : 'Reset'
  const filterApplyLabel = tFeed.has('filterApply') ? tFeed('filterApply') : 'Apply'
  const wantedAgeLabel = t.has('wantedLabel') ? t('wantedLabel') : 'Wanted Age'

  const [meetups, setMeetups] = useState<MeetupCard[]>([])
  const [myJoins, setMyJoins] = useState<{ meetup_id: string; status: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filterCity, setFilterCity] = useState<string | null>(null)
  const [filterDistrict, setFilterDistrict] = useState<string | null>(null)
  const [filterActivity, setFilterActivity] = useState<string | null>(null)
  const [filterVibe, setFilterVibe] = useState<string | null>(null)
  const [filterGender, setFilterGender] = useState<string | null>(null)
  const [filterWantedAge, setFilterWantedAge] = useState<string | null>(null)
  const [filterDate, setFilterDate] = useState<string | null>(null)
  const [selectedMeetupId, setSelectedMeetupId] = useState<string | null>(null)
  const [showMeetupModal, setShowMeetupModal] = useState(false)
  const [mapZoom, setMapZoom] = useState(7)
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const [cameraTarget, setCameraTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)

  const activeFilterCount = [filterCity, filterActivity, filterVibe, filterGender, filterWantedAge, filterDate].filter(Boolean).length

  const loadInitial = useCallback(async () => {
    setLoading(true)
    const now = new Date().toISOString()

    const [meetupsRes, joinsRes] = await Promise.all([
      supabase
        .from('place_meetups')
        .select(
          `
            id, title, scheduled_at, status, host_count, host_gender, host_age_groups,
            activities, vibe, description, wanted_gender, wanted_age_groups, wanted_count,
            organizer_id,
            places!place_id (id, name, city, district, category, lat, lng),
            profiles!organizer_id (id, nickname, avatar_url, gender, birth_date)
          `,
        )
        .eq('status', 'open')
        .is('deleted_at', null)
        .gt('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .range(0, FETCH_LIMIT - 1),
      supabase.from('meetup_joins').select('meetup_id, status').eq('applicant_id', userId),
    ])

    if (meetupsRes.error) {
      console.error('meetup explore load failed', meetupsRes.error)
    }
    if (joinsRes.error) {
      console.error('meetup joins load failed', joinsRes.error)
    }
    setMeetups((meetupsRes.data as MeetupCard[]) ?? [])
    setMyJoins((joinsRes.data as { meetup_id: string; status: string }[]) ?? [])
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitial()
  }, [loadInitial])

  const getDistrictLabel = useCallback(
    (city: string, district: string): string => {
      const key = `${city}.${district}` as Parameters<typeof tDistricts>[0]
      if (tDistricts.has(key)) return tDistricts(key)
      return getLocalizedKrDistrictLabel(district, locale) ?? district
    },
    [tDistricts, locale],
  )

  const filtered = useMemo(() => {
    return meetups.filter((m) => {
      const place = asSinglePlace(m.places)
      if (!hasCoords(place)) return false
      if (filterCity && place.city !== filterCity) return false
      if (filterDistrict && place.district !== filterDistrict) return false
      if (filterActivity && !m.activities.includes(filterActivity)) return false
      if (filterVibe && m.vibe !== filterVibe) return false
      if (filterGender && m.wanted_gender !== filterGender) return false
      if (filterWantedAge && !(m.wanted_age_groups ?? []).includes(filterWantedAge)) return false
      if (filterDate === 'today' && !isToday(m.scheduled_at)) return false
      if (filterDate === 'week' && !isThisWeek(m.scheduled_at)) return false
      if (filterDate === 'weekend' && !isWeekend(m.scheduled_at)) return false
      return true
    })
  }, [meetups, filterCity, filterDistrict, filterActivity, filterVibe, filterGender, filterWantedAge, filterDate])

  const mapStage = useMemo<'city' | 'district' | 'detail'>(() => {
    if (mapZoom <= CITY_STAGE_MAX_ZOOM) return 'city'
    if (mapZoom < DETAIL_STAGE_MIN_ZOOM) return 'district'
    return 'detail'
  }, [mapZoom])

  const cityClusters = useMemo(() => {
    const grouped = new Map<string, { city: string; latSum: number; lngSum: number; count: number }>()
    filtered.forEach((m) => {
      const p = asSinglePlace(m.places)
      if (!hasCoords(p)) return
      const g = grouped.get(p.city) ?? { city: p.city, latSum: 0, lngSum: 0, count: 0 }
      g.latSum += p.lat
      g.lngSum += p.lng
      g.count += 1
      grouped.set(p.city, g)
    })
    return Array.from(grouped.values()).map((g) => ({
      city: g.city,
      lat: g.latSum / g.count,
      lng: g.lngSum / g.count,
      count: g.count,
    }))
  }, [filtered])

  const districtClusters = useMemo(() => {
    const grouped = new Map<string, { city: string; district: string; latSum: number; lngSum: number; count: number }>()
    filtered.forEach((m) => {
      const p = asSinglePlace(m.places)
      if (!hasCoords(p) || !p.district || p.district === 'other') return
      const key = `${p.city}.${p.district}`
      const g = grouped.get(key) ?? { city: p.city, district: p.district, latSum: 0, lngSum: 0, count: 0 }
      g.latSum += p.lat
      g.lngSum += p.lng
      g.count += 1
      grouped.set(key, g)
    })
    return Array.from(grouped.values()).map((g) => ({
      city: g.city,
      district: g.district,
      lat: g.latSum / g.count,
      lng: g.lngSum / g.count,
      count: g.count,
    }))
  }, [filtered])

  const inBounds = useCallback(
    (lat: number, lng: number) => {
      if (!mapBounds) return true
      const latPad = (mapBounds.north - mapBounds.south) * 0.08
      const lngPad = (mapBounds.east - mapBounds.west) * 0.08
      return (
        lat <= mapBounds.north + latPad &&
        lat >= mapBounds.south - latPad &&
        lng <= mapBounds.east + lngPad &&
        lng >= mapBounds.west - lngPad
      )
    },
    [mapBounds],
  )

  const visibleDetailMeetups = useMemo(() => {
    return filtered.filter((m) => {
      const p = asSinglePlace(m.places)
      return hasCoords(p) && inBounds(p.lat, p.lng)
    })
  }, [filtered, inBounds])

  const selectedMeetup = useMemo(
    () => filtered.find((m) => m.id === selectedMeetupId) ?? null,
    [filtered, selectedMeetupId],
  )

  const searchResults = useMemo<MeetupSearchItem[]>(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const items: MeetupSearchItem[] = []
    for (const m of meetups) {
      const p = asSinglePlace(m.places)
      if (!hasCoords(p)) continue
      const cityMatched = p.city.toLowerCase().includes(q)
      const districtMatched = (p.district ?? '').toLowerCase().includes(q)
      const placeMatched = p.name.toLowerCase().includes(q)
      if (!cityMatched && !districtMatched && !placeMatched) continue
      items.push({
        meetupId: m.id,
        placeName: p.name,
        city: p.city,
        district: p.district ?? null,
        lat: p.lat,
        lng: p.lng,
      })
      if (items.length >= 8) break
    }
    return items
  }, [meetups, searchQuery])

  function toggleFilter<T extends string>(val: T, current: T | null, set: (v: T | null) => void) {
    set(current === val ? null : val)
  }

  function resetFilters() {
    setFilterCity(null)
    setFilterActivity(null)
    setFilterVibe(null)
    setFilterGender(null)
    setFilterWantedAge(null)
    setFilterDate(null)
    setFilterDistrict(null)
  }

  function getCityLabel(city: string): string {
    const key = city as Parameters<typeof tCities>[0]
    return tCities.has(key) ? tCities(key) : city
  }

  function getActivityLabel(activity: string): string {
    const key = `activity.${activity}` as Parameters<typeof t>[0]
    return t.has(key) ? t(key) : activity
  }

  function getVibeLabel(vibe: string): string {
    const key = `vibe.${vibe}` as Parameters<typeof t>[0]
    return t.has(key) ? t(key) : vibe
  }

  function getGenderLabel(gender: string): string {
    const key = `gender.${gender}` as Parameters<typeof t>[0]
    return t.has(key) ? t(key) : gender
  }

  function getAgeLabel(age: string): string {
    const key = `ageGroup.${age}` as Parameters<typeof t>[0]
    return t.has(key) ? t(key) : age
  }

  function handleSearchSelect(item: MeetupSearchItem) {
    setFilterCity(item.city)
    setFilterDistrict(item.district)
    setSelectedMeetupId(item.meetupId)
    setShowMeetupModal(true)
    setCameraTarget({ lat: item.lat, lng: item.lng, zoom: Math.max(mapZoom, DETAIL_STAGE_MIN_ZOOM + 0.3) })
    setSearchQuery(item.placeName)
    setShowSearchDropdown(false)
  }

  async function handleSearchSubmit() {
    const query = searchQuery.trim()
    if (!query) return
    if (searchResults[0]) {
      handleSearchSelect(searchResults[0])
      return
    }
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`)
      const data = (await res.json()) as { places?: PlacesSearchResult[] }
      const first = data.places?.[0]
      if (!first?.lat || !first?.lng) return
      setSelectedMeetupId(null)
      setShowMeetupModal(false)
      setFilterDistrict(null)
      setCameraTarget({ lat: first.lat, lng: first.lng, zoom: Math.max(mapZoom, DETAIL_STAGE_MIN_ZOOM + 0.2) })
      setShowSearchDropdown(false)
    } catch (error) {
      console.error('meetup map search failed', error)
    }
  }

  if (isAnonymous) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="fixed top-0 left-0 right-0 bg-white z-40">
          <div className="max-w-lg mx-auto px-4">
            <div className="flex items-center h-14">
              <h1 className="text-base font-bold text-gray-900">{t('explore.title')}</h1>
            </div>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5 pt-14">
          <p className="text-base font-bold text-gray-900">{t('anonymousBlockTitle')}</p>
          <p className="text-sm text-gray-400 text-center">{t('anonymousBlockDesc')}</p>
        </div>
        <BottomNav avatarUrl={profile?.avatar_url ?? null} />
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!} language={locale}>
        <GoogleMap
          defaultCenter={{ lat: 36.5, lng: 127.8 }}
          defaultZoom={7}
          mapId="locory-map"
          gestureHandling="greedy"
          disableDefaultUI
          className="w-full h-full"
          onClick={() => {
            if (selectedMeetupId) {
              setSelectedMeetupId(null)
              setShowMeetupModal(false)
              return
            }
            if (filterDistrict) {
              setFilterDistrict(null)
              return
            }
            if (filterCity) setFilterCity(null)
          }}
          onCameraChanged={(event) => {
            const detail = event.detail as { zoom?: number; bounds?: Partial<MapBounds> }
            if (typeof detail.zoom === 'number') {
              if (detail.zoom < DETAIL_STAGE_MIN_ZOOM && filterDistrict) setFilterDistrict(null)
              if (detail.zoom < DETAIL_STAGE_MIN_ZOOM && showMeetupModal) setShowMeetupModal(false)
              if (detail.zoom <= CITY_STAGE_MAX_ZOOM && filterCity) {
                setFilterDistrict(null)
                setFilterCity(null)
              }
              setMapZoom(detail.zoom)
            }
            const bounds = detail.bounds
            if (
              bounds &&
              typeof bounds.north === 'number' &&
              typeof bounds.south === 'number' &&
              typeof bounds.east === 'number' &&
              typeof bounds.west === 'number'
            ) {
              setMapBounds({
                north: bounds.north,
                south: bounds.south,
                east: bounds.east,
                west: bounds.west,
              })
            }
          }}
        >
          <CameraPanner target={cameraTarget} />

          {mapStage === 'city' &&
            cityClusters.map((c) => (
              <AdvancedMarker
                key={`city-${c.city}`}
                position={{ lat: c.lat, lng: c.lng }}
                onClick={() => {
                  setFilterCity(c.city)
                  setFilterDistrict(null)
                  setSelectedMeetupId(null)
                  setShowMeetupModal(false)
                  setCameraTarget({ lat: c.lat, lng: c.lng, zoom: CITY_STAGE_MAX_ZOOM + 1.2 })
                }}
              >
                <button className="h-12 w-12 rounded-full border border-gray-300/70 bg-gray-200/60 text-sm font-bold text-gray-900 shadow-lg backdrop-blur-sm">
                  {c.count}
                </button>
              </AdvancedMarker>
            ))}

          {mapStage === 'district' &&
            districtClusters.map((d) => (
              <AdvancedMarker
                key={`district-${d.city}-${d.district}`}
                position={{ lat: d.lat, lng: d.lng }}
                onClick={() => {
                  setFilterCity(d.city)
                  setFilterDistrict(d.district)
                  setSelectedMeetupId(null)
                  setShowMeetupModal(false)
                  setCameraTarget({ lat: d.lat, lng: d.lng, zoom: DETAIL_STAGE_MIN_ZOOM + 0.2 })
                }}
              >
                <button className="h-11 w-11 rounded-full border border-gray-300/70 bg-gray-200/60 text-sm font-bold text-gray-900 shadow-lg backdrop-blur-sm">
                  {d.count}
                </button>
              </AdvancedMarker>
            ))}

          {mapStage === 'detail' &&
            visibleDetailMeetups.map((m) => {
              const p = asSinglePlace(m.places)
              if (!p?.lat || !p?.lng) return null
              const displayTitle = m.title?.trim() || p.name
              return (
                <AdvancedMarker
                  key={`meetup-${m.id}`}
                  position={{ lat: p.lat, lng: p.lng }}
                  onClick={() => {
                    setSelectedMeetupId(m.id)
                    setShowMeetupModal(true)
                  }}
                >
                  <button
                    className={`w-32 rounded-xl px-2 py-1.5 text-left shadow ${
                      selectedMeetupId === m.id ? 'bg-gray-900 text-white' : 'bg-white/95 text-gray-700 border border-gray-200'
                    }`}
                  >
                    <p className="truncate text-[10px] font-semibold">{displayTitle}</p>
                    <p className={`truncate text-[10px] ${selectedMeetupId === m.id ? 'text-white/90' : 'text-gray-500'}`}>{p.name}</p>
                    <p className={`text-[10px] ${selectedMeetupId === m.id ? 'text-white/90' : 'text-gray-500'}`}>{formatScheduled(m.scheduled_at)}</p>
                  </button>
                </AdvancedMarker>
              )
            })}
        </GoogleMap>
      </APIProvider>

      <header className="absolute top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-lg mx-auto px-3 pt-2 pb-2">
          <div className="flex items-center h-10">
            <h1 className="flex-1 text-base font-bold text-gray-900">{t('explore.title')}</h1>
            <button
              onClick={() => router.push('/meetups')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-gray-200 text-gray-600 bg-white"
            >
              {t('explore.myMeetupsBtn')}
            </button>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`ml-1.5 relative flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                activeFilterCount > 0 ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {filterLabel}
            </button>
            <div className="ml-1.5">
              <NotificationBell userId={userId} />
            </div>
          </div>
          <div className="relative pb-1">
            <div className="flex items-center bg-white rounded-full shadow px-3 py-2 gap-2 border border-gray-100">
              <svg width="14" height="14" fill="none" stroke="#9CA3AF" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSearchDropdown(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearchSubmit()
                  }
                }}
                onFocus={() => setShowSearchDropdown(true)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 150)}
                placeholder={tMap('searchPlaceholder')}
                className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
              />
            </div>
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                {searchResults.map((item) => (
                  <button
                    key={`${item.meetupId}-${item.placeName}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSearchSelect(item)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{item.placeName}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {getCityLabel(item.city)}
                      {item.district ? ` - ${getDistrictLabel(item.city, item.district)}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {showFilters && (
        <div className="absolute inset-0 z-30 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="relative bg-white rounded-t-2xl max-w-lg mx-auto w-full p-4 pb-[calc(env(safe-area-inset-bottom)+96px)] max-h-[80vh] overflow-y-auto">
            <p className="text-sm font-semibold text-gray-900 mb-2">{t('explore.all')}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setFilterCity(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                  filterCity === null ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-600'
                }`}
              >
                {t('explore.all')}
              </button>
              {CITIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setFilterCity(c.value === filterCity ? null : c.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    filterCity === c.value ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {tCities(c.value)}
                </button>
              ))}
            </div>

            <p className="text-sm font-semibold text-gray-900 mb-2">{t('explore.filterActivity')}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {ACTIVITIES.map((a) => (
                <button
                  key={a.value}
                  onClick={() => toggleFilter(a.value, filterActivity, setFilterActivity)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    filterActivity === a.value ? 'bg-blue-600 text-white border-transparent' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {getActivityLabel(a.value)}
                </button>
              ))}
            </div>

            <p className="text-sm font-semibold text-gray-900 mb-2">{t('explore.filterWantedGender')}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {WANTED_GENDER_OPTS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => toggleFilter(g.value, filterGender, setFilterGender)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    filterGender === g.value ? 'bg-pink-600 text-white border-transparent' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {getGenderLabel(g.value)}
                </button>
              ))}
            </div>

            <p className="text-sm font-semibold text-gray-900 mb-2">{wantedAgeLabel}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {WANTED_AGE_OPTS.map((a) => (
                <button
                  key={a.value}
                  onClick={() => toggleFilter(a.value, filterWantedAge, setFilterWantedAge)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    filterWantedAge === a.value ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {getAgeLabel(a.value)}
                </button>
              ))}
            </div>

            <p className="text-sm font-semibold text-gray-900 mb-2">{t('explore.filterDate')}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {DATE_OPTS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleFilter(d, filterDate, setFilterDate)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    filterDate === d ? 'bg-orange-500 text-white border-transparent' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {d === 'today' ? t('explore.dateToday') : d === 'week' ? t('explore.dateWeek') : t('explore.dateWeekend')}
                </button>
              ))}
            </div>

            <p className="text-sm font-semibold text-gray-900 mb-2">{t('explore.filterVibe')}</p>
            <div className="flex flex-wrap gap-2">
              {VIBES.map((v) => (
                <button
                  key={v.value}
                  onClick={() => toggleFilter(v.value, filterVibe, setFilterVibe)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    filterVibe === v.value ? 'bg-purple-600 text-white border-transparent' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {getVibeLabel(v.value)}
                </button>
              ))}
            </div>
            <div className="sticky bottom-0 mt-4 flex gap-2 bg-white pt-2 pb-[calc(env(safe-area-inset-bottom)+4px)]">
              <button onClick={resetFilters} className="flex-1 py-2.5 rounded-xl text-sm bg-gray-100 text-gray-700">
                {filterResetLabel}
              </button>
              <button onClick={() => setShowFilters(false)} className="flex-1 py-2.5 rounded-xl text-sm bg-gray-900 text-white">
                {filterApplyLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMeetupModal && selectedMeetup && (
        <div className="absolute inset-0 z-40 flex items-end">
          <div
            className="absolute inset-0 bg-black/35"
            onClick={() => setShowMeetupModal(false)}
          />
          <div className="relative w-full max-w-lg mx-auto px-3 pb-[calc(env(safe-area-inset-bottom)+84px)]">
            <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-xl">
              <MeetupExploreCard
                meetup={selectedMeetup}
                myJoin={myJoins.find((j) => j.meetup_id === selectedMeetup.id) ?? null}
                userId={userId}
                getDistrictLabel={getDistrictLabel}
                onClick={() => router.push(`/meetup/${selectedMeetup.id}`)}
              />
              <button
                onClick={() => setShowMeetupModal(false)}
                className="mt-2 w-full rounded-xl border border-gray-200 py-2 text-sm text-gray-600 bg-white"
              >
                {tCommon.has('close') ? tCommon('close') : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav avatarUrl={profile?.avatar_url ?? null} />
    </div>
  )
}

function MeetupExploreCard({
  meetup: m,
  myJoin,
  userId,
  getDistrictLabel,
  onClick,
}: {
  meetup: MeetupCard
  myJoin: { meetup_id: string; status: string } | null
  userId: string
  getDistrictLabel: (city: string, district: string) => string
  onClick: () => void
}) {
  const t = useTranslations('meetup')
  const tCities = useTranslations('cities')
  function getCityLabel(city: string): string {
    const key = city as Parameters<typeof tCities>[0]
    return tCities.has(key) ? tCities(key) : city
  }
  function getActivityLabel(activity: string): string {
    const key = `activity.${activity}` as Parameters<typeof t>[0]
    return t.has(key) ? t(key) : activity
  }
  function getVibeLabel(vibe: string): string {
    const key = `vibe.${vibe}` as Parameters<typeof t>[0]
    return t.has(key) ? t(key) : vibe
  }
  function getGenderLabel(gender: string): string {
    const key = `gender.${gender}` as Parameters<typeof t>[0]
    return t.has(key) ? t(key) : gender
  }
  const isMyMeetup = asSingleProfile(m.profiles)?.id === userId
  const place = asSinglePlace(m.places)
  const profile = asSingleProfile(m.profiles)
  const hostAge = calcAge(profile?.birth_date ?? null)
  const hostLabel = t.has('detail.hostInfo') ? t('detail.hostInfo') : 'Host'
  const placeLabel = t.has('detail.placeLabel') ? t('detail.placeLabel') : 'Place'
  const dateLabel = t.has('detail.dateLabel') ? t('detail.dateLabel') : 'Date & Time'
  const viewDetailLabel = t.has('detail.viewButton') ? t('detail.viewButton') : 'View details'
  const cityLabel = place?.city ? getCityLabel(place.city) : null
  const districtLabel = place?.city && place?.district ? getDistrictLabel(place.city, place.district) : null

  return (
    <div onClick={onClick} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm cursor-pointer">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold text-gray-500">{hostLabel}</span>
        {isMyMeetup && <span className="text-xs text-blue-500">{t('myMeetup')}</span>}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 p-2.5">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-400">
            {profile?.nickname?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-900 truncate">{profile?.nickname ?? '-'}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {profile?.gender && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700">
                {getGenderLabel(profile.gender)}
              </span>
            )}
            {hostAge != null && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700">
                {hostAge}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700">{m.host_count}</span>
            {m.activities.slice(0, 2).map((a: string) => (
              <span key={a} className="px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700">
                {getActivityLabel(a)}
              </span>
            ))}
            {m.vibe && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-purple-50 text-purple-700">
                {getVibeLabel(m.vibe)}
              </span>
            )}
          </div>
          {myJoin && (
            <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">
              {myJoin.status === 'accepted'
                ? t('status.accepted')
                : myJoin.status === 'rejected'
                  ? t('status.rejected')
                  : myJoin.status === 'unmatched'
                    ? t('status.unmatched')
                    : t('status.pending')}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-gray-100 p-2.5">
          <p className="text-[11px] font-medium text-gray-500">{placeLabel}</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900 truncate">{place?.name ?? '-'}</p>
          {(cityLabel || districtLabel) && (
            <p className="text-xs text-gray-400 mt-0.5">{[cityLabel, districtLabel].filter(Boolean).join(' - ')}</p>
          )}
        </div>
        <div className="rounded-xl border border-gray-100 p-2.5">
          <p className="text-[11px] font-medium text-gray-500">{dateLabel}</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900">{formatScheduled(m.scheduled_at)}</p>
        </div>
      </div>

      <button className="mt-3 w-full rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white">
        {viewDetailLabel}
      </button>
    </div>
  )
}
