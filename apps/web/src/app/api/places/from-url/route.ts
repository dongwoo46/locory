import { NextResponse } from 'next/server'

type AddressComponent = {
  longText?: string
  shortText?: string
  long_name?: string
  short_name?: string
  types?: string[]
}

type PlaceApiResult = {
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  addressComponents?: AddressComponent[]
}

function getAddressPart(components: AddressComponent[] | undefined, type: string, mode: 'long' | 'short' = 'long'): string | null {
  if (!components) return null
  const component = components.find(c => c.types?.includes(type))
  if (!component) return null
  if (mode === 'short') return component.shortText || component.short_name || null
  return component.longText || component.long_name || null
}

function mapPlacePayload(p: PlaceApiResult) {
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
    countryCode: getAddressPart(components, 'country', 'short'),
    adminAreaLevel1: getAddressPart(components, 'administrative_area_level_1'),
    adminAreaLevel2: getAddressPart(components, 'administrative_area_level_2'),
    locality,
    sublocality,
    postalCode: getAddressPart(components, 'postal_code'),
  }
}

// Google Maps URL에서 장소 정보 추출
async function resolveUrl(url: string): Promise<string> {
  try {
    // HEAD는 일부 서버에서 막히므로 GET 사용
    const res = await fetch(url, {
      redirect: 'follow',
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    return res.url
  } catch {
    return url
  }
}

function extractFromGoogleMapsUrl(url: string): { name?: string; lat?: number; lng?: number; placeId?: string } {
  try {
    const u = new URL(url)

    // place ID 추출: /maps/place/NAME/data=...!0x...:0x...
    // CID 방식: data=!4m2!3m1!1s<placeId>
    const placeIdMatch = url.match(/!1s(ChIJ[^!&]+)/)
    if (placeIdMatch) return { placeId: decodeURIComponent(placeIdMatch[1]) }

    // 좌표 추출: /@lat,lng,zoom
    const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    const lat = coordMatch ? parseFloat(coordMatch[1]) : undefined
    const lng = coordMatch ? parseFloat(coordMatch[2]) : undefined

    // 장소명 추출: /maps/place/NAME/
    const nameMatch = u.pathname.match(/\/maps\/place\/([^/]+)/)
    const name = nameMatch ? decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')) : undefined

    return { name, lat, lng }
  } catch {
    return {}
  }
}

function extractFromNaverUrl(url: string): { placeId?: string; lat?: number; lng?: number } {
  const match = url.match(/entry\/place\/(\d+)/)
  const placeId = match?.[1]

  // 쿼리 파라미터에서 좌표 추출 (신형 URL: /p/entry/place/ID?lat=...&lng=...)
  try {
    const u = new URL(url)
    const lat = u.searchParams.get('lat')
    const lng = u.searchParams.get('lng')
    if (lat && lng) return { placeId, lat: parseFloat(lat), lng: parseFloat(lng) }
  } catch {}

  return { placeId }
}

export async function POST(request: Request) {
  const { url } = await request.json()
  if (!url) return NextResponse.json({ error: '링크를 입력해주세요' }, { status: 400 })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API 키가 설정되지 않았어요' }, { status: 500 })

  // 단축 URL 펼치기
  const resolvedUrl = await resolveUrl(url)
  console.log('[from-url] input:', url, '→ resolved:', resolvedUrl)

  const isGoogle = resolvedUrl.includes('google.com/maps') || resolvedUrl.includes('goo.gl/maps')
    || resolvedUrl.includes('maps.app.goo.gl') || url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')

  // Google Maps
  if (isGoogle) {
    const { name, lat, lng, placeId } = extractFromGoogleMapsUrl(resolvedUrl)

    // Place ID로 직접 조회
    if (placeId && placeId.startsWith('ChIJ')) {
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'displayName,formattedAddress,location,addressComponents',
          'Accept-Language': 'ko',
        },
        next: { revalidate: 86400 },
      })
      const data = await res.json()
      if (data.displayName) {
        return NextResponse.json(mapPlacePayload(data))
      }
    }

    // 좌표 + 이름으로 텍스트 검색
    const query = name || (lat && lng ? `${lat},${lng}` : null)
    if (query) {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.addressComponents',
        },
        body: JSON.stringify({ textQuery: query, maxResultCount: 1, languageCode: 'ko' }),
      })
      const data = await res.json()
      const p = data.places?.[0]
      if (p) {
        return NextResponse.json(mapPlacePayload(p))
      }
    }
  }

  // 네이버 지도
  if (resolvedUrl.includes('naver.me') || resolvedUrl.includes('map.naver.com')) {
    const { placeId: naverPlaceId, lat: naverLat, lng: naverLng } = extractFromNaverUrl(resolvedUrl)

    // 네이버 장소 요약 API로 이름 조회
    let naverName: string | undefined
    if (naverPlaceId) {
      try {
        const summaryRes = await fetch(
          `https://map.naver.com/v5/api/sites/summary/${naverPlaceId}?lang=ko`,
          { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://map.naver.com/' } }
        )
        if (summaryRes.ok) {
          const json = await summaryRes.json()
          naverName = json.name || json.title
        }
      } catch {}
    }

    if (naverName) {
      const body: Record<string, unknown> = { textQuery: naverName, maxResultCount: 1, languageCode: 'ko' }
      if (naverLat && naverLng) {
        body.locationBias = {
          circle: { center: { latitude: naverLat, longitude: naverLng }, radius: 500 },
        }
      }
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.addressComponents',
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      const p = data.places?.[0]
      if (p) {
        return NextResponse.json(mapPlacePayload(p))
      }
    }
  }

  console.log('[from-url] 422 - could not extract place from:', resolvedUrl)
  return NextResponse.json({ error: '장소 정보를 가져올 수 없어요. 검색으로 찾아보세요.' }, { status: 422 })
}
