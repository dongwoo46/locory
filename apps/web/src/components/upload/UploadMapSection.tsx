'use client'

import { useState, useEffect } from 'react'
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'

function MapPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const map = useMap()
  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!map) return
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      setMarkerPos({ lat, lng })
      onPick(lat, lng)
    })
    return () => google.maps.event.removeListener(listener)
  }, [map, onPick])

  return markerPos ? <AdvancedMarker position={markerPos} /> : null
}

interface Props {
  center: { lat: number; lng: number }
  onPick: (lat: number, lng: number) => void
}

export default function UploadMapSection({ center, onPick }: Props) {
  return (
    <div className="rounded-xl overflow-hidden h-52">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
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
