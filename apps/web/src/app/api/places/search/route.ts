import { NextResponse } from 'next/server'

type AddressComponent = {
  longText?: string
  shortText?: string
  long_name?: string
  short_name?: string
  types?: string[]
}

type PlaceApiResult = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  rating?: number
  userRatingCount?: number
  addressComponents?: AddressComponent[]
}

function getAddressPart(components: AddressComponent[] | undefined, type: string, mode: 'long' | 'short' = 'long'): string | null {
  if (!components) return null
  const component = components.find(c => c.types?.includes(type))
  if (!component) return null
  if (mode === 'short') return component.shortText || component.short_name || null
  return component.longText || component.long_name || null
}

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
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.addressComponents',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'ko',
      pageSize: 10,
    }),
    next: { revalidate: 300 },
  })

  const data = await res.json()
  console.log('[Places Search] error:', data.error?.message)

  const places = ((data.places || []) as PlaceApiResult[]).map((p) => {
    const components = (p.addressComponents || []) as AddressComponent[]
    const locality =
      getAddressPart(components, 'locality') ||
      getAddressPart(components, 'postal_town') ||
      getAddressPart(components, 'administrative_area_level_2')
    const sublocality =
      getAddressPart(components, 'sublocality_level_1') ||
      getAddressPart(components, 'sublocality') ||
      getAddressPart(components, 'neighborhood') ||
      getAddressPart(components, 'administrative_area_level_3')

    return {
      name: p.displayName?.text || '',
      address: p.formattedAddress || '',
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      googlePlaceId: p.id || null,
      googleRating: p.rating || null,
      googleReviewCount: p.userRatingCount || null,
      countryCode: getAddressPart(components, 'country', 'short'),
      adminAreaLevel1: getAddressPart(components, 'administrative_area_level_1'),
      adminAreaLevel2: getAddressPart(components, 'administrative_area_level_2'),
      locality,
      sublocality,
      postalCode: getAddressPart(components, 'postal_code'),
    }
  })

  return NextResponse.json({ places })
}
