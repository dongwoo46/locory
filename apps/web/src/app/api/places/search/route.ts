import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) return NextResponse.json({ places: [] })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey!,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({
      textQuery: query + ' 한국',
      languageCode: 'ko',
      maxResultCount: 5,
    }),
  })

  const data = await res.json()
  console.log('[Places Search] error:', data.error?.message)

  const places = (data.places || []).map((p: any) => ({
    name: p.displayName?.text || '',
    address: p.formattedAddress || '',
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    googlePlaceId: p.id || null,
    googleRating: p.rating || null,
    googleReviewCount: p.userRatingCount || null,
  }))

  return NextResponse.json({ places })
}
