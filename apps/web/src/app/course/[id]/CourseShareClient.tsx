'use client'

import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useRef, useState } from 'react'

const DAY_COLORS = ['#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#BE185D', '#1D4ED8']

interface CourseDayPlace {
  place_id: string
  order: number
  estimated_arrival: string
  duration_min: number
  activity: string
  tip: string
}

interface CourseDay {
  day: number
  theme: string
  places: CourseDayPlace[]
}

interface CourseData {
  title: string
  summary: string
  days: CourseDay[]
}

interface Place {
  id: string
  name: string
  lat: number
  lng: number
  category: string
  city: string
  district: string | null
}

interface Props {
  course: {
    id: string
    title: string
    city: string | null
    days: number
    transport: string
    style: string
    companion: string
    course_data: CourseData
    place_ids: string[]
    created_at: string
  }
  places: Place[]
}

function RoutePolyline({ points, color = '#1a1a1a' }: { points: { lat: number; lng: number }[], color?: string }) {
  const map = useMap()
  const polylineRef = useRef<any>(null)

  useEffect(() => {
    if (!map || !points.length) return
    if (polylineRef.current) polylineRef.current.setMap(null)
    polylineRef.current = new (window as any).google.maps.Polyline({
      path: points,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.85,
      strokeWeight: 5,
    })
    polylineRef.current.setMap(map)
    return () => { if (polylineRef.current) polylineRef.current.setMap(null) }
  }, [map, points, color])

  return null
}

function transportLabel(t: string) {
  if (t === 'transit') return '🚇 대중교통'
  if (t === 'walking') return '🚶 도보'
  if (t === 'driving') return '🚗 자동차'
  return t
}

export default function CourseShareClient({ course, places }: Props) {
  const courseData = course.course_data
  const [viewingDay, setViewingDay] = useState(1)
  const [expandedPlace, setExpandedPlace] = useState<string | null>(null)

  // Center map on first place of first day
  const firstPlace = (() => {
    const firstDayPlaces = courseData.days[0]?.places.sort((a, b) => a.order - b.order) || []
    const firstId = firstDayPlaces[0]?.place_id
    return places.find(p => p.id === firstId)
  })()

  const mapCenter = firstPlace
    ? { lat: firstPlace.lat, lng: firstPlace.lng }
    : { lat: 36.5, lng: 127.8 }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <Map
          defaultCenter={mapCenter}
          defaultZoom={13}
          mapId="locory-course-share"
          gestureHandling="greedy"
          disableDefaultUI
          className="w-full h-full"
        >
          {/* Polylines per day */}
          {courseData.days.map((day) => {
            const dayPlaces = day.places
              .sort((a, b) => a.order - b.order)
              .map(p => places.find(pl => pl.id === p.place_id))
              .filter(Boolean) as Place[]
            if (dayPlaces.length < 2) return null
            const color = DAY_COLORS[(day.day - 1) % DAY_COLORS.length]
            return (
              <RoutePolyline
                key={day.day}
                points={dayPlaces.map(p => ({ lat: p.lat, lng: p.lng }))}
                color={color}
              />
            )
          })}

          {/* Numbered markers */}
          {courseData.days.flatMap(day =>
            day.places
              .sort((a, b) => a.order - b.order)
              .map(p => {
                const place = places.find(pl => pl.id === p.place_id)
                if (!place) return null
                const color = DAY_COLORS[(day.day - 1) % DAY_COLORS.length]
                return (
                  <AdvancedMarker
                    key={`${day.day}-${p.place_id}`}
                    position={{ lat: place.lat, lng: place.lng }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      backgroundColor: color, border: '2.5px solid white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: 12,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}>
                      {p.order}
                    </div>
                  </AdvancedMarker>
                )
              })
          )}
        </Map>
      </APIProvider>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="max-w-lg mx-auto px-3 pt-3">
          <div className="bg-white rounded-2xl shadow-lg px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{courseData.title}</p>
                {courseData.summary && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{courseData.summary}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                  {course.days}일 여행
                </span>
                <span className="text-xs text-gray-400">{transportLabel(course.transport)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 flex justify-center"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="bg-white w-full max-w-lg rounded-t-2xl shadow-xl" style={{ maxHeight: '50vh' }}>
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-8 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Day tabs */}
          <div className="flex gap-0 border-b border-gray-100 shrink-0 px-4">
            {courseData.days.map(day => (
              <button
                key={day.day}
                onClick={() => setViewingDay(day.day)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                  viewingDay === day.day
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-400'
                }`}
              >
                Day {day.day}
              </button>
            ))}
          </div>

          {/* Place list */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(50vh - 100px)' }}>
            {(() => {
              const dayData = courseData.days.find(d => d.day === viewingDay)
              if (!dayData) return null
              const color = DAY_COLORS[(viewingDay - 1) % DAY_COLORS.length]
              return (
                <>
                  <p className="text-[10px] text-gray-400 px-4 pt-2 pb-1">{dayData.theme}</p>
                  {dayData.places.sort((a, b) => a.order - b.order).map(p => {
                    const place = places.find(pl => pl.id === p.place_id)
                    if (!place) return null
                    const isExpanded = expandedPlace === p.place_id
                    return (
                      <button
                        key={p.place_id}
                        onClick={() => setExpandedPlace(isExpanded ? null : p.place_id)}
                        className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                            style={{ backgroundColor: color }}
                          >
                            {p.order}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                              <span className="text-xs text-gray-400 shrink-0">{p.estimated_arrival}</span>
                            </div>
                            {isExpanded && (
                              <div className="mt-2 flex flex-col gap-1.5">
                                <p className="text-xs text-gray-700 leading-relaxed">{p.activity}</p>
                                {p.tip && (
                                  <div className="flex items-start gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1.5">
                                    <span className="text-amber-500 text-xs shrink-0">💡</span>
                                    <p className="text-xs text-amber-800">{p.tip}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <svg
                            className="shrink-0 mt-1 transition-transform"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                            width="14" height="14" fill="none" stroke="#9CA3AF" strokeWidth={2} viewBox="0 0 24 24"
                          >
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" />
                          </svg>
                        </div>
                      </button>
                    )
                  })}
                </>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
