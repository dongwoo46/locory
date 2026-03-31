# Locory

**한국을 여행하는 외국인과 한국 로컬이 함께 만드는 장소 기반 여행 커뮤니티**

> 기획 · 디자인 · 풀스택 개발 1인 진행

---

## 왜 만들었나

한국을 찾는 외국인 여행자들이 가장 어려워하는 것은 **"현지인처럼 여행하는 것"** 입니다.

TripAdvisor나 Google Maps는 리뷰가 있지만 진짜 현지인의 목소리가 없고, 인스타그램은 장소 정보가 단편적입니다. 반대로 한국 로컬은 자신만 아는 숨은 장소를 공유할 공간이 없습니다.

Locory는 이 갭을 해결합니다.

- **외국인**: 국적별 현지인이 직접 추천한 장소를 발견하고, 여행 동선을 AI로 짤 수 있다
- **한국 로컬**: 내가 아는 진짜 명소를 공유하고, 같은 취향의 외국인 여행자를 만날 수 있다

---

## 핵심 기능

### 장소 기반 여행 기록

사진 + 평점 + 메모로 방문한 장소를 기록하고 공개 피드로 공유합니다.  
평점은 `must_go / worth_it / neutral / not_great` 4단계로 직관적으로 표현합니다.

### 현지인 추천 (Local Recommendation)

**국적 매칭 기반**으로 현지인 인증 뱃지를 부여합니다.  
한국 장소는 한국 국적 사용자만, 일본 장소는 일본 국적 사용자만 현지인 추천을 활성화할 수 있습니다.  
피드 카드에는 별 아이콘으로 표시됩니다.

### 피드 & 지도 탐색

- **3열 그리드 피드**: 전체/팔로잉 탭, 카테고리·국적·평점·나이대·성별 다중 필터
- **동네 검색**: 65개 인기 동네(서울 22, 부산 13, 도쿄 13 등) 다중 선택, union bounding box로 지도 RPC 실행
- **지도 뷰**: 저장한 장소를 지도에서 탐색, 검색 핀 하이라이트, 필터 패널

### AI 동선 짜기

Google Gemini를 활용한 두 가지 동선 생성 방식:

- **직접선택형**: 저장한 장소 중 선택 → 최적 동선 추천
- **AI 추천형**: 동네 선택 → DB에서 실제 장소 최대 80개 RAG → 동선 생성

### 번개 모임 (Flash Meetup)

장소 기반 번개 모임 주최/신청 시스템:

- Trust Score 3 이상(무취) + 공개 프로필 조건
- 수락된 신청자-주최자 간 실시간 채팅
- 알림 시스템: 좋아요/저장/신청/수락/거절 실시간 알림

### 신뢰도(향도) 시스템

활동량과 신뢰도를 냄새 단계로 표현하는 독자적인 레벨 시스템:

| 레벨   | Trust Score | 설명                |
| ------ | ----------- | ------------------- |
| 악취   | < 3         | 번개 참여 불가      |
| 무취   | 3+          | 기본                |
| 풀냄새 | ~           | 활발한 기록자       |
| 꽃향기 | ~           | 믿을 수 있는 추천자 |
| 나무향 | ~           |                     |
| 바다향 | ~           |                     |
| 향수향 | 최상위      |                     |

포인트: 방문 기록 +1, 현지인 추천 +2, 다른 사람이 저장 +1, 번개 매칭 +2, 허위 장소 -10

### 익명 로그인

진입 장벽을 낮추기 위한 Guest 접속:

- `supabase.auth.signInAnonymously()` → 즉시 피드 접근
- 추후 Google 계정 연결 시 `linkIdentity()`로 동일 user.id 유지, 데이터 보존
- 번개 모임을 제외한 모든 기능 사용 가능

### 6개 언어 지원

`next-intl` 기반 완전한 다국어: **한국어 · English · 日本語 · 繁體中文 · Español · Русский**

---

## 기술 스택

| 분류                | 기술                                                 |
| ------------------- | ---------------------------------------------------- |
| Frontend            | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| State               | Zustand (UI state), TanStack Query v5 (server state) |
| Backend             | Next.js API Routes (서버리스)                        |
| DB / Auth / Storage | Supabase (PostgreSQL + RLS + Realtime)               |
| 지도                | Google Maps API (`@vis.gl/react-google-maps`)        |
| AI                  | Google Gemini 2.5 Flash Lite                         |
| i18n                | next-intl (6개 언어)                                 |
| 모니터링            | Sentry                                               |
| 광고                | Google AdSense                                       |
| 배포                | Vercel                                               |

---

## 아키텍처 & 기술적 의사결정

### 서버 컴포넌트 역할 분리

```
page.tsx (Server)      → auth check + 최소 필수 데이터 (빠른 응답)
ClientComponent        → 무거운 데이터는 useQuery로 client fetch → React Query 캐시 재활용
```

| 페이지   | 서버 fetch                      | 클라이언트 useQuery           |
| -------- | ------------------------------- | ----------------------------- |
| /feed    | profile + followingIds          | feed-posts, user-interactions |
| /map     | auth only                       | map-data, user-interactions   |
| /saved   | auth + followingIds             | saved-data (병렬)             |
| /profile | profile + counts + followStatus | profile-posts                 |

### React Query 최적화

- **useUserInteractions hook**: Supabase RPC `get_user_interactions` 1번 호출로 post_likes/post_saves/place_likes/place_saves 4개 테이블 통합 조회 → DB 왕복 최소화
- **낙관적 업데이트**: 좋아요/저장 즉시 UI 반영 후 DB 동기화
- **Zustand likeStore**: 클로저 stale 문제 방지를 위해 toggle 핸들러에서 항상 `getState()`로 최신값 읽기

### Google Maps 번들 최적화

```typescript
const UploadMapSection = dynamic(
  () => import('./UploadMapSection'),
  { ssr: false, loading: () => <Skeleton /> }
)
```

`@vis.gl/react-google-maps` 라이브러리 크기로 인한 페이지 이동 속도 저하를 `dynamic import + ssr: false`로 해결

### 피드 geo-search RPC

```sql
-- get_feed_with_interactions(p_lat_min, p_lat_max, p_lng_min, p_lng_max, ...)
-- 동네 union bounding box를 RPC 파라미터로 전달
-- p_lat_min IS NULL이면 geo 필터 미적용 (전체 피드)
```

클라이언트에서 다중 선택된 동네의 min/max 좌표를 합산(union bbox)하여 단일 RPC 호출로 지역 필터링

### Auth 패턴 (요청당 1회 검증)

```
middleware.ts → getUser()    # Auth 서버에 1회 검증
page.tsx      → getSession() # 미들웨어 검증 완료 후 쿠키에서 빠르게 읽기
```

### Supabase RLS + 익명 사용자

```sql
-- 익명도 auth.role() = 'authenticated' 이므로 기존 RLS 그대로 적용
-- 추가 제한이 필요한 경우에만:
AND (auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE
```

### 장소 중복 방지 로직

```
google_place_id 조회 → 없으면 name + lat/lng ±0.0001° 범위 조회 → 없으면 insert
```

### District 자동감지

업로드 시 역지오코딩 주소에서 동네를 자동 추출(`inferDistrictFromAddress()`).  
감지 실패 시에만 동네 선택 UI 노출 — UX 마찰 최소화.

---
