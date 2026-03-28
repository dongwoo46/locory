import { NextResponse } from 'next/server'

type GeocodeAddressComponent = {
  long_name?: string
  short_name?: string
  types?: string[]
}

function getAddressPart(components: GeocodeAddressComponent[] | undefined, type: string, mode: 'long' | 'short' = 'long'): string | null {
  if (!components) return null
  const component = components.find(c => c.types?.includes(type))
  if (!component) return null
  if (mode === 'short') return component.short_name || null
  return component.long_name || null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ address: '' })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ko&key=${apiKey}`

  const res = await fetch(url, { next: { revalidate: 86400 } }) // 24시간 캐싱
  const data = await res.json()

  const result = data.results?.[0]
  const address = result?.formatted_address || ''

  // 동네 수준 이름 추출 (sublocality_level_2 → sublocality_level_1 → locality 순)
  const components = (result?.address_components || []) as GeocodeAddressComponent[]
  const find = (...types: string[]) =>
    types.reduce<string>((acc, t) => acc || components.find((c) => c.types?.includes(t))?.long_name || '', '')
  const placeName = find('sublocality_level_2', 'sublocality_level_1', 'neighborhood', 'sublocality', 'locality')

  const locality =
    getAddressPart(components, 'locality') ||
    getAddressPart(components, 'postal_town') ||
    getAddressPart(components, 'administrative_area_level_2')
  const sublocality =
    getAddressPart(components, 'sublocality_level_1') ||
    getAddressPart(components, 'sublocality') ||
    getAddressPart(components, 'neighborhood') ||
    getAddressPart(components, 'administrative_area_level_3')

  return NextResponse.json({
    address,
    placeName,
    countryCode: getAddressPart(components, 'country', 'short'),
    adminAreaLevel1: getAddressPart(components, 'administrative_area_level_1'),
    adminAreaLevel2: getAddressPart(components, 'administrative_area_level_2'),
    locality,
    sublocality,
    postalCode: getAddressPart(components, 'postal_code'),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  })
}
