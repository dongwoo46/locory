import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MapClient from './MapClient'

export default async function MapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 공개 포스트 있는 장소 + 포스트 수 + 대표 사진 + 국적 집계
  const { data: posts } = await supabase
    .from('posts')
    .select('place_id, photos, type, rating, profiles!user_id(nationality, gender), places!place_id(id, name, lat, lng, category, city, district, place_type, avg_rating)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  interface PlaceEntry {
    id: string
    name: string
    lat: number
    lng: number
    category: string
    city: string
    district: string | null
    place_type: string
    postCount: number
    photoUrl: string | null
    rating: string | null
    avg_rating: number | null
    google_rating: number | null
    hasVisited: boolean
    hasWant: boolean
    nationalities: string[]
    genders: string[]
    _nationalitySet: Set<string>
    _genderSet: Set<string>
    _ratingCounts: Record<string, number>
  }

  const placeMap = new Map<string, PlaceEntry>()
  for (const post of posts || []) {
    const place = post.places as any
    if (!place) continue
    if (!placeMap.has(place.id)) {
      placeMap.set(place.id, {
        ...place,
        postCount: 0,
        photoUrl: null,
        rating: null,
        avg_rating: place.avg_rating ?? null,
        google_rating: place.google_rating ?? null,
        hasVisited: false,
        hasWant: false,
        nationalities: [],
        genders: [],
        _nationalitySet: new Set<string>(),
        _genderSet: new Set<string>(),
        _ratingCounts: {},
      })
    }
    const entry = placeMap.get(place.id)!
    entry.postCount++
    if (!entry.photoUrl && (post.photos as string[])?.length > 0) {
      entry.photoUrl = (post.photos as string[])[0]
    }
    const nationality = (post.profiles as any)?.nationality
    if (nationality) entry._nationalitySet.add(nationality)
    const gender = (post.profiles as any)?.gender
    if (gender) entry._genderSet.add(gender)

    const postType = (post as any).type
    if (postType === 'visited') {
      entry.hasVisited = true
      const r = (post as any).rating as string
      if (r) entry._ratingCounts[r] = (entry._ratingCounts[r] || 0) + 1
    } else if (postType === 'want') {
      entry.hasWant = true
    }
  }

  const allPlaces = Array.from(placeMap.values()).map(entry => {
    const { _nationalitySet, _genderSet, _ratingCounts, ...rest } = entry
    const dominantRating = Object.entries(_ratingCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    return { ...rest, nationalities: Array.from(_nationalitySet), genders: Array.from(_genderSet), rating: dominantRating }
  })

  const [{ data: savedRows }, { data: savedCourses }] = await Promise.all([
    supabase.from('place_saves').select('place_id').eq('user_id', user.id),
    supabase.from('saved_courses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])
  const savedPlaceIds = new Set((savedRows || []).map(r => r.place_id))

  return (
    <MapClient
      allPlaces={allPlaces}
      savedPlaceIds={savedPlaceIds}
      userId={user.id}
      savedCourses={savedCourses || []}
    />
  )
}
