import { NextResponse } from 'next/server'

function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : (result >> 1)
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : (result >> 1)
    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return points
}

export async function POST(request: Request) {
  const { origin, destination, waypoints, transport } = await request.json()

  const mode = transport === 'walking' ? 'walking' : transport === 'transit' ? 'transit' : 'driving'

  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    mode,
    language: 'ko',
    key: process.env.GOOGLE_PLACES_API_KEY!,
  })

  if (waypoints?.length > 0) {
    params.set('waypoints', waypoints.map((w: any) => `${w.lat},${w.lng}`).join('|'))
  }

  const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`)
  const data = await res.json()

  if (data.status !== 'OK') {
    return NextResponse.json({ error: data.status }, { status: 400 })
  }

  const route = data.routes[0]
  const points = decodePolyline(route.overview_polyline.points)

  const legs = route.legs.map((leg: any) => ({
    duration: leg.duration.text,
    distance: leg.distance.text,
  }))

  const totalDuration = route.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0)

  return NextResponse.json({ points, legs, totalDuration })
}
