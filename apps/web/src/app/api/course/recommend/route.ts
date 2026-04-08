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

  const { districts, cities, startDate, endDate, timeRange, styles, companion, extraConditions } = await request.json()

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const days = Math.max(1, Math.round(
    (new Date(endDate || startDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1)

  // RAG: 선택된 동네의 장소 조회
  let placesQuery = supabase
    .from('places')
    .select('id, name, category, district, city, lat, lng, avg_rating, place_type')
    .order('avg_rating', { ascending: false, nullsFirst: false })
    .limit(80)

  if (districts && districts.length > 0) {
    placesQuery = placesQuery.in('district', districts)
  } else if (cities && cities.length > 0) {
    placesQuery = placesQuery.in('city', cities)
  }

  // 여행 스타일(카테고리)로 필터 — styles가 있으면 해당 카테고리 우선 (OR 조건)
  const { data: allPlaces, error: placesError } = await placesQuery
  if (placesError) {
    return NextResponse.json({ error: '장소 조회 실패' }, { status: 500 })
  }

  const places = allPlaces || []
  const placeCount = places.length

  // 유저 프로필 조회 (개인화용)
  let userContext = ''
  if (authUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nationality, gender, birth_date, trust_score')
      .eq('id', authUserId)
      .single()

    if (profile) {
      const age = profile.birth_date
        ? new Date().getFullYear() - new Date(profile.birth_date).getFullYear()
        : null
      userContext = `\n[여행자 정보 — 장소 선택 시 참고]\n`
      if (profile.nationality) userContext += `- 국적: ${profile.nationality}\n`
      if (age) userContext += `- 나이: ${age}세\n`
      if (profile.gender) userContext += `- 성별: ${profile.gender}\n`
    }

    // 유저의 좋아요/저장 이력에서 선호 카테고리 추출
    const { data: likedPosts } = await supabase
      .from('post_likes')
      .select('posts!post_id(places!place_id(category))')
      .eq('user_id', authUserId)
      .limit(30)

    const categoryCounts: Record<string, number> = {}
    likedPosts?.forEach((l: any) => {
      const cat = l.posts?.places?.category
      if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
    })

    const topCats = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c)

    if (topCats.length > 0) {
      userContext += `- 좋아요 기록 기반 선호 카테고리: ${topCats.join(', ')}\n`
    }
  }

  const startTime = Array.isArray(timeRange) ? slotToTime(timeRange[0]) : '10:00'
  const endTime = Array.isArray(timeRange) ? slotToTime(timeRange[1]) : '22:00'
  const companionKo = companion === 'solo' ? '혼자' : companion === 'couple' ? '커플' : companion === 'friends' ? '친구들' : '가족'
  const stylesKo = styles && styles.length > 0
    ? styles.join(', ')
    : '제한 없음'

  // 카테고리 필터링: styles에 있는 카테고리 우선 정렬
  const prioritizedPlaces = styles && styles.length > 0
    ? [
        ...places.filter((p: any) => styles.includes(p.category)),
        ...places.filter((p: any) => !styles.includes(p.category)),
      ]
    : places

  const placesDesc = prioritizedPlaces.map((p: any) =>
    `- id: "${p.id}", 이름: "${p.name}", 카테고리: ${p.category}, 위치: ${p.district || p.city} (위도 ${p.lat}, 경도 ${p.lng}), 평균평점: ${p.avg_rating ?? 'N/A'}${p.place_type === 'hidden_spot' ? ', [현지인 추천]' : ''}`
  ).join('\n')

  const prompt = `당신은 한국 여행 코스 전문가입니다. 아래 Locory DB 장소 목록에서 여행자에게 맞는 장소를 선택하고 ${days}일 최적 동선을 짜주세요.
${extraConditions ? `\n[최우선 조건]\n${extraConditions}\n` : ''}
${userContext}
[선택 가능한 장소 목록 — 여기서 적합한 것만 선택]
${placesDesc || '(등록된 장소 없음)'}

[여행 조건]
- 여행 기간: ${startDate} ~ ${endDate || startDate} (${days}일)
- 활동 시간: ${startTime} ~ ${endTime}
- 여행 스타일(선호 카테고리): ${stylesKo}
- 동반자: ${companionKo}

[코스 구성 규칙]
- 여행자 정보와 선호 스타일에 맞는 장소를 우선 선택
- 카페/브런치: 오전~오후 2시 배치
- 포토스팟: 오전 또는 일몰 1시간 전
- 맛집: 점심(12-14시), 저녁(18-20시)
- 바/유흥: 저녁 20시 이후
- 자연/뷰: 오전 또는 일몰
- 활동 종료 시간(${endTime}) 이후 일정 배치 금지
- 지리적으로 가까운 장소끼리 같은 날에 배치
- 하루 장소 수: 4~6개 (활동 시간에 맞게 조정)
- [현지인 추천] 장소는 가능하면 포함
- 여행 시작일 기준 공휴일·연휴 여부를 tip에 안내

각 장소마다 "여기서 뭐할지" 한두 문장 activity를 반드시 포함하세요.

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
      placeCount,
      remaining: remaining === null ? null : remaining - 1,
    })
  } catch (e) {
    console.error('Gemini recommend error:', e)
    return NextResponse.json({ error: '코스 추천에 실패했어요' }, { status: 500 })
  }
}
