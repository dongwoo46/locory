import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { incrementGeminiUsage, requireGeminiAccess } from '@/lib/utils/geminiUsage'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

function slotToTime(slot: number): string {
  const totalMinutes = 6 * 60 + slot * 30
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function POST(request: Request) {
  const access = await requireGeminiAccess()
  if (!access.ok) return access.response
  const { user, supabase: authSupabase, today, isAdmin, remaining } = access
  const authUserId = user.id

  const {
    places, startDate, endDate, transport, vibe, companion,
    timeRange, startLocation, endLocation, extraConditions, ragEnabled, ragMaxPlaces,
  } = await request.json()

  // 날짜 범위에서 일수 계산
  const days = Math.max(1, Math.round(
    (new Date(endDate || startDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1)

  const transportKo = transport === 'walking' ? '도보' : transport === 'transit' ? '대중교통' : '자동차'
  const vibeKo = vibe === 'recording' ? '기록·사진 위주 (각 장소에서 충분한 시간)'
    : vibe === 'foodie' ? '먹거리 탐방 (식사·카페 장소에 시간 집중)'
    : vibe === 'explorer' ? '빠른 탐험 (여러 곳 짧게 체크인)'
    : '여유로운 산책 (이동 여유 있게, 페이스 느리게)'
  const companionKo = companion === 'solo' ? '혼자' : companion === 'couple' ? '커플' : companion === 'friends' ? '친구들' : '가족'
  const startTime = Array.isArray(timeRange) ? slotToTime(timeRange[0]) : '10:00'
  const endTime = Array.isArray(timeRange) ? slotToTime(timeRange[1]) : '22:00'

  const placesDesc = places.map((p: any) =>
    `- id: "${p.id}", 이름: "${p.name}", 카테고리: ${p.category}, 위치: ${p.district || p.city} (위도 ${p.lat}, 경도 ${p.lng}), 평균평점: ${p.avg_rating ?? 'N/A'}${p.recommended_menu ? `, 추천메뉴: ${p.recommended_menu}` : ''}`
  ).join('\n')

  // RAG: 동선에 추가할 장소 조회
  let ragPlacesDesc = ''
  if (ragEnabled && authUserId) {
    try {
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      // 선택된 장소들의 district 목록
      const districts = [...new Set(places.map((p: any) => p.district).filter(Boolean))]
      const cities = [...new Set(places.map((p: any) => p.city).filter(Boolean))]
      const selectedIds = places.map((p: any) => p.id)

      // 유저 프로필 조회
      await supabase
        .from('profiles')
        .select('nationality, gender, birth_date')
        .eq('id', authUserId)
        .single()

      // 같은 district의 장소 조회 (이미 선택된 장소 제외)
      let query = supabase
        .from('places')
        .select('id, name, category, district, city, lat, lng, avg_rating')
        .not('id', 'in', `(${selectedIds.join(',')})`)
        .order('avg_rating', { ascending: false })
        .limit(ragMaxPlaces > 0 ? ragMaxPlaces * 3 : 20)

      if (districts.length > 0) {
        query = query.in('district', districts)
      } else {
        query = query.in('city', cities)
      }

      const { data: ragPlaces } = await query

      if (ragPlaces && ragPlaces.length > 0) {
        const maxAdd = ragMaxPlaces > 0 ? ragMaxPlaces : undefined
        const candidates = maxAdd ? ragPlaces.slice(0, maxAdd * 3) : ragPlaces
        ragPlacesDesc = `\n[추가 추천 후보 장소 (Locory DB — 동선에 맞으면 자연스럽게 삽입, 억지로 넣지 말 것)]\n` +
          candidates.map((p: any) =>
            `- id: "${p.id}", 이름: "${p.name}", 카테고리: ${p.category}, 위치: ${p.district || p.city} (위도 ${p.lat}, 경도 ${p.lng}), 평균평점: ${p.avg_rating ?? 'N/A'}`
          ).join('\n') +
          (maxAdd ? `\n→ 추가 장소는 최대 ${maxAdd}개만 삽입 가능합니다.` : '\n→ 몇 개 삽입할지는 AI가 동선 흐름에 맞게 재량으로 결정합니다.')
      }
    } catch (e) {
      console.error('RAG fetch error:', e)
    }
  }

  const prompt = `당신은 한국 여행 코스 전문가입니다. 아래 장소들로 ${days}일 최적 동선을 짜주세요.
${extraConditions ? `\n[최우선 조건 - 아래 모든 규칙보다 반드시 우선 적용]\n${extraConditions}\n` : ''}

[선택된 장소 목록 — 반드시 모두 포함]
${placesDesc}
${ragPlacesDesc}

[여행 조건]
- 여행 기간: ${startDate} ~ ${endDate || startDate} (${days}일)
- 이동수단: ${transportKo}
- 여행 분위기: ${vibeKo}
- 동반자: ${companionKo}
- 활동 시간: ${startTime} ~ ${endTime}
- 출발지: ${startLocation || '미지정'}
- 도착지: ${endLocation || '미지정'}

[배치 규칙]
- 카페/브런치: 오전~오후 2시
- 포토스팟: 오전 또는 일몰 1시간 전
- 맛집: 점심(12-14시), 저녁(18-20시)
- 바/유흥: 저녁 20시 이후
- 자연/뷰: 오전 또는 일몰
- 활동 종료 시간(${endTime}) 이후로 일정 배치 금지
- 지리적으로 가까운 장소끼리 같은 날에 배치
- 출발지가 있으면 출발지와 가까운 장소부터 시작
- 여행 시작일 기준으로 공휴일·연휴 여부를 tip에 안내
- 추천 메뉴가 있는 장소는 tip에 언급

JSON만 반환 (마크다운 없이):
{
  "title": "코스 제목",
  "summary": "전체 코스 한줄 요약",
  "days": [
    {
      "day": 1,
      "theme": "Day 1 테마",
      "places": [
        {
          "place_id": "uuid",
          "order": 1,
          "estimated_arrival": "10:00",
          "duration_min": 60,
          "activity": "여기서 할 것 한두 문장",
          "tip": "실용적인 팁"
        }
      ]
    }
  ]
}`

  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
    const model = genAI.getGenerativeModel({ model: modelName })
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    const cleaned = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned)

    if (!isAdmin) {
      await incrementGeminiUsage(authSupabase, authUserId, today)
    }

    return NextResponse.json({
      ...parsed,
      remaining: remaining === null ? null : remaining - 1,
    })
  } catch (e) {
    console.error('Gemini error:', e)
    return NextResponse.json({ error: '코스 생성에 실패했어요' }, { status: 500 })
  }
}
