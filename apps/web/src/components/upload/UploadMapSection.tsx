'use client'

import { useState, useEffect } from 'react'
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'

interface PickResult {
  lat: number
  lng: number
  name?: string
  address?: string
}

function MapPicker({ onPick }: { onPick: (result: PickResult) => void }) {
  const map = useMap()
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!map) return
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      setMarkerPos({ lat, lng })

      const iconEvent = e as google.maps.IconMouseEvent
      if (iconEvent.placeId) {
        // POI 클릭 — 기본 infowindow 막고 Places API로 이름/주소 가져오기
        e.stop()
        const service = new google.maps.places.PlacesService(map as unknown as HTMLDivElement)
        service.getDetails(
          { placeId: iconEvent.placeId, fields: ['name', 'formatted_address'] },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              onPick({ lat, lng, name: place.name ?? undefined, address: place.formatted_address ?? undefined })
            } else {
              onPick({ lat, lng })
            }
          }
        )
      } else {
        onPick({ lat, lng })
      }
    })
    return () => google.maps.event.removeListener(listener)
  }, [map, onPick])

  return markerPos ? <AdvancedMarker position={markerPos} /> : null
}

interface Props {
  center: { lat: number; lng: number }
  onPick: (result: PickResult) => void
}

export default function UploadMapSection({ center, onPick }: Props) {
  return (
    <div className="rounded-xl overflow-hidden h-52">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!} libraries={['places']}>
        <Map
          defaultCenter={center}
          defaultZoom={15}
          mapId="locory-upload"
          gestureHandling="greedy"
          disableDefaultUI
        >
          <MapPicker onPick={onPick} />
        </Map>
      </APIProvider>
    </div>
  )
}
