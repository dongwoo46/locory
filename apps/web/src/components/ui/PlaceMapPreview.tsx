'use client'

import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps'

interface Props {
  lat: number
  lng: number
}

export default function PlaceMapPreview({ lat, lng }: Props) {
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <Map
        defaultCenter={{ lat, lng }}
        defaultZoom={16}
        gestureHandling="greedy"
        disableDefaultUI
        mapId="place-detail"
      >
        <AdvancedMarker position={{ lat, lng }} />
      </Map>
    </APIProvider>
  )
}
