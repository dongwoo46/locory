import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ address: '' })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ko&key=${apiKey}`

  const res = await fetch(url)
  const data = await res.json()

  const result = data.results?.[0]
  const address = result?.formatted_address || ''

  // 동네 수준 이름 추출 (sublocality_level_2 → sublocality_level_1 → locality 순)
  const components: any[] = result?.address_components || []
  const find = (...types: string[]) =>
    types.reduce<string>((acc, t) => acc || components.find((c: any) => c.types.includes(t))?.long_name || '', '')
  const placeName = find('sublocality_level_2', 'sublocality_level_1', 'neighborhood', 'sublocality', 'locality')

  return NextResponse.json({ address, placeName })
}
