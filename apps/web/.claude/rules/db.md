# DB 스키마 & 백엔드 패턴

## Enums
- `nationality`: KR | JP | US | CN | ES | RU | OTHER
- `city`: seoul | busan | jeju | gyeongju | jeonju | gangneung | sokcho | yeosu | incheon
- `category`: cafe | restaurant | photospot | street | bar | culture | nature | shopping
- `rating`: must_go | worth_it | neutral | not_great | never
- `post_type`: visited | want

## 핵심 테이블
- `places`: place_type enum('normal','hidden_spot'), avg_rating(트리거 자동계산)
- `posts`: type(visited/want), rating(visited만 필수), is_local_recommendation BOOLEAN, photos TEXT[]
- `post_comments`: id/post_id/user_id/body(1~200자)/created_at/deleted_at — RLS: 누구나 읽기, 본인 쓰기/소프트삭제
- `post_likes`: user_id, post_id — INSERT 시 post_liked 알림 트리거
- `post_saves`: user_id, post_id — INSERT 시 post_saved 알림 트리거
- `profiles`: trust_score, nationality, is_public, is_admin, accommodation_name/address, gender, birth_date, bio
- `place_meetups`: title TEXT(필수), deleted_at TIMESTAMPTZ (soft delete), status
- `meetup_joins`: applicant_id, meetup_id, status — INSERT 시 join_new, UPDATE 시 join_status 알림 트리거
- `notifications`: type(meetup_today/join_new/join_accepted/join_rejected/join_unmatched/message_new/post_deleted/post_liked/post_saved), data JSONB(post_id/actor_id/meetup_id/join_id)

## Trust Score (향도)
- `profiles.trust_score`: raw 포인트, 악취(< 3) → 번개 참여/주최 불가
- 표시: `calcScentScore()` log 환산 0~100, 레벨명만 (악취→무취→풀냄새→꽃향기→나무향→바다향→향수향)
- 포인트 (migration 029): visited_post=1, want_post=1, local_recommendation_post=2, post_saved_by_other=1, meetup_created=1, meetup_matched=2, daily_bonus=1, reported=-5, fake_place=-10

## createAdminClient 패턴 ⚠️ 중요
반드시 `@supabase/supabase-js`의 `createClient` 사용 — `@supabase/ssr` 사용 금지
```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
export function createAdminClient() {  // async 아님!
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```
> `@supabase/ssr`은 service role key여도 쿠키 세션이 우선되어 RLS 우회 불가

## Auth 패턴
- `middleware.ts`: `getUser()` — Auth 서버 검증 1회
- `page.tsx` 전체: `getSession()` — 미들웨어 검증 후 쿠키에서 빠르게 읽기만
- 요청당 Auth 서버 호출 1회만 발생

## RLS 핵심 패턴
- nationality 비교: `nationality::TEXT = ANY(...)` — enum→TEXT 캐스트 필수
- pg_cron 내부 SQL: `$cron$...$cron$` (외부 `$outer$`와 구분자 분리)

## 보안/필터링
- 닉네임: `validateNickname()` — `src/lib/utils/profanity.ts` + `src/lib/utils/nickname.ts`
  - 최소 2자 최대 16자, 한글/영문/숫자/_/-/공백만, 예약어(admin/locory 등) 차단
  - 어드민(siwol406@gmail.com)은 제한 없음
- 포스팅 메모, 번개 설명/신청메시지/채팅: `containsProfanity()` 체크 후 차단

## Places 중복 방지
google_place_id 우선 조회 → 없으면 name+lat/lng ±0.0001° 범위 조회 → 없으면 insert

## Google Places API (장소 검색)
- `/api/places/search`: `textQuery=query` + `regionCode: 'KR'` + `cache: 'no-store'` + `pageSize: 10`
  - ⚠️ 쿼리에 '한국' 붙이지 말 것 (결과 오염됨)
- UploadMapSection: `libraries={['places']}`, POI 탭 → `google.maps.IconMouseEvent.placeId` → `PlacesService.getDetails()`

## 마이그레이션 현황
- 000_baseline.sql: 현재 DB 전체 스키마 (supabase db dump, 2026-03-19)
- 021~028: 기능별 추가 마이그레이션
- 029_local_rec_and_trust_rebalance.sql: is_local_recommendation, place_meetups.deleted_at, 포인트 재조정
- 030_comments_notifications_meetup_title.sql: post_comments 테이블, place_meetups.title, notifications 타입 추가(post_liked/post_saved), DB 트리거 7개 (post_liked/post_saved/join_new/join_status)
- ⚠️ 029, 030 모두 Dashboard SQL Editor에서 직접 실행 필요
- pg_cron (028): 미활성화 상태 — 활성화 시 Dashboard → Database → Extensions → pg_cron ON
