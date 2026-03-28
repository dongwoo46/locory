import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

  const key = process.env.GOOGLE_PLACES_API_KEY
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&language=ko&key=${key}`,
    { next: { revalidate: 300 } }
  )
  const data = await res.json()

  if (data.status !== 'OK' || !data.results?.[0]) {
    return NextResponse.json({ bounds: null })
  }

  const { bounds, viewport } = data.results[0].geometry
  const rect = bounds || viewport

  const latMin = rect.southwest.lat
  const latMax = rect.northeast.lat
  const lngMin = rect.southwest.lng
  const lngMax = rect.northeast.lng

  // Enforce minimum radius so point/small-area searches cover the surrounding neighborhood
  const MIN_LAT_SPAN = 0.06  // ~6km
  const MIN_LNG_SPAN = 0.07  // ~6km
  const centerLat = (latMin + latMax) / 2
  const centerLng = (lngMin + lngMax) / 2
  const latSpan = latMax - latMin
  const lngSpan = lngMax - lngMin

  return NextResponse.json({
    bounds: {
      latMin: latSpan < MIN_LAT_SPAN ? centerLat - MIN_LAT_SPAN / 2 : latMin,
      latMax: latSpan < MIN_LAT_SPAN ? centerLat + MIN_LAT_SPAN / 2 : latMax,
      lngMin: lngSpan < MIN_LNG_SPAN ? centerLng - MIN_LNG_SPAN / 2 : lngMin,
      lngMax: lngSpan < MIN_LNG_SPAN ? centerLng + MIN_LNG_SPAN / 2 : lngMax,
    },
  })
}
