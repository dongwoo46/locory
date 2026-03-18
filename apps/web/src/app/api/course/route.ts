import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: Request) {
  const { places, days, transport, style, companion, startDate, startHour, startLocation, endLocation, extraConditions } = await request.json()

  const transportKo = transport === 'walking' ? '도보' : transport === 'transit' ? '대중교통' : '자동차'
  const styleKo = style === 'relaxed' ? '느긋하게' : style === 'packed' ? '알차게' : style === 'food' ? '맛집 위주' : style === 'photo' ? '포토스팟 위주' : '힐링'
  const companionKo = companion === 'solo' ? '혼자' : companion === 'couple' ? '커플' : companion === 'friends' ? '친구들' : '가족'

  const placesDesc = places.map((p: any) =>
    `- id: "${p.id}", 이름: "${p.name}", 카테고리: ${p.category}, 위치: ${p.district || p.city} (위도 ${p.lat}, 경도 ${p.lng}), 평균평점: ${p.avg_rating ?? 'N/A'}${p.recommended_menu ? `, 추천메뉴: ${p.recommended_menu}` : ''}`
  ).join('\n')

  const dailyCount = style === 'relaxed' ? '3-4' : style === 'packed' ? '6-8' : '4-6'

  const prompt = `당신은 한국 여행 코스 전문가입니다. 아래 장소들로 ${days}일 최적 동선을 짜주세요.
${extraConditions ? `\n[최우선 조건 - 아래 모든 규칙보다 반드시 우선 적용]\n${extraConditions}\n` : ''}

[장소 목록]
${placesDesc}

[여행 조건]
- 여행 시작일: ${startDate || '미지정'}${startDate ? ` (${new Date(startDate).toLocaleDateString('ko-KR', { weekday: 'long' })})` : ''}
- 여행 일수: ${days}일
- 이동수단: ${transportKo}
- 여행 스타일: ${styleKo}
- 동반자: ${companionKo}
- 하루 시작 시간: ${startHour}:00
- 출발지: ${startLocation || '미지정'}
- 도착지: ${endLocation || '미지정'}

[배치 규칙]
- 카페/브런치: 오전~오후 2시
- 포토스팟: 오전 또는 일몰 1시간 전
- 맛집: 점심(12-14시), 저녁(18-20시)
- 바/유흥: 저녁 20시 이후
- 자연/뷰: 오전 또는 일몰
- 지리적으로 가까운 장소끼리 같은 날에 배치
- 하루 장소 수: ${dailyCount}개
- 출발지가 있으면 출발지와 가까운 장소부터 시작하고 도착지와 가까운 장소로 마무리
- 여행 시작일 기준으로 공휴일·연휴·설날·추석 등 한국 특수일 여부를 판단하고, 해당 날에 혼잡하거나 휴무인 장소 유형을 tip에 반드시 안내
- 주말/연휴에는 인기 장소 대기 시간을 고려해 여유 시간을 추가하고, 평일에는 점심 직장인 혼잡 시간(12-13시) 카페/맛집 회피 권장
- 추천 메뉴가 있는 카페/음식점은 tip에 언급

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

    return NextResponse.json(parsed)
  } catch (e) {
    console.error('Gemini error:', e)
    return NextResponse.json({ error: '코스 생성에 실패했어요' }, { status: 500 })
  }
}
