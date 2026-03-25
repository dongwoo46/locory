# UI/UX 패턴

## 기본 원칙
- **모바일 퍼스트** (max-w-lg) — 데스크탑 반응형 불필요
- **전체 배경: `bg-white`** — gray-50 사용 금지
- **헤더 하단 선 없음** — `border-b` 제거
- 이모지 없음 (카테고리 이모지 제외), 색상 기반 표현 선호
- `<button>` 안에 `<button>` 절대 금지 — hydration 에러

## 헤더 패턴
- **피드/저장**: `[+]` 왼쪽 | Locory 로고(`h-16 w-auto`, `/logo40.png`) 가운데 | 필터+알림벨 오른쪽
- **내 프로필(isMe)**: `[+]` 왼쪽 | 닉네임 가운데 | 알림벨+설정 오른쪽 — 로고 없음
- **타인 프로필**: 뒤로가기 | 닉네임 가운데 | 신고 버튼
- **번개 탐색(/meetup)**: 타이틀 왼쪽 | 내모임+필터+알림벨 오른쪽 + 도시탭(underline)
- 헤더 구조: `fixed top-0 left-0 right-0 bg-white z-40` + 내부 `max-w-lg mx-auto px-4`
  - **헤더 태그 자체에 max-w 없음!**

## z-index 계층
| 요소 | z-index |
|---|---|
| BottomNav | z-50 (최상위) |
| + 액션시트 오버레이 | z-60 |
| + 액션시트 컨테이너 | z-70 |
| PostGrid 상세 모달 | z-60 |
| ReportSheet | z-60 |
| 필터 모달 (피드/저장/지도) | z-40 |
| 동선짜기 피커 | z-40 (컨테이너 z-41, bottom-16) |

## 레이아웃
- `main` 좌우 패딩 없음 (`px-4` 제거) — PostGrid는 화면 끝까지
- 스크롤 콘텐츠: `pb-20` (BottomNav 겹침 방지)
- 필터/피커 모달: `fixed inset-0 z-40 flex items-center justify-center px-4`, maxHeight: 70vh

## BottomNav (5탭)
피드(`/`) | 지도(`/map`) | ⚡번개(`/meetup`) | 저장(`/saved`) | 프로필(`/profile/[id]`)
- 프로필 탭: 유저 아바타 이미지 (없으면 사람 아이콘)
- `avatarUrl` prop 전달 필수 — FeedClient/SavedClient/ProfileClient/MeetupExploreClient/SettingsClient 모두

## PostGrid 규칙
- **항상 3열 그리드**, gap-px (1px 흰 선만), rounded/shadow 없이 플랫
- 좋아요/저장 수: 0개여도 항상 표시, 카드 우하단
- 장소 하트(place_like): **장소 상세 페이지에서만** 클릭 가능 — 그리드 카드에서 불가
- 장소 저장(place_save): PostGrid 모달에서 제거 — **장소 상세 페이지에서만**
- PostGrid 모달 액션: 포스팅 저장 + 포스팅 좋아요만
- PostGrid 모달 사진: 캐러셀 (좌우 화살표 + 점 인디케이터), `photoIndex` state, 열릴 때 0으로 초기화
- PostGrid 모달 댓글: 하단 댓글 목록 + 입력창, Enter 게시, 내 댓글만 삭제(✕)

## + 액션시트
피드/저장/내 프로필 헤더 `[+]` 클릭 → 하단 시트:
1. 피드 생성하기 (`feed.addFeed`) → `/upload`
2. 장소 저장하기 (`feed.addPlace`) → PlaceAddSheet
i18n 키: `feed.addFeed`, `feed.addFeedDesc`, `feed.addPlace`, `feed.addPlaceDesc`

## 지도 필터 UI
- 필터 버튼: normal 모드 + course-build 모드 모두 표시
- 검색바: normal 모드 + course-build 모드 모두 표시
- 검색 결과 선택 → `highlighted` 상태로 핀 강조 (bottom sheet 없음), 지도 panTo
- 핀 탭 → `setHighlighted(null)` + `setSelected(place)` → bottom sheet 열기
- 필터 패널 헤더: [초기화(조건부)] [적용 버튼] — 적용 버튼은 패널 닫기 역할

## 컴포넌트 주의사항
- **신고 버튼**: 흰 카드에 `relative` 필수 — absolute 버튼 overlay 기준 버그 방지
- **ReportSheet**: 모달 내부에서 렌더링 (모달 밖에 두면 z-index로 가려짐)

## React Query 패턴
```ts
// 낙관적 업데이트
queryClient.setQueryData(['user-saved', userId], (old: any) => {
  const newSet = new Set(old.savedPlaceIds)
  saved ? newSet.delete(placeId) : newSet.add(placeId)
  return { ...old, savedPlaceIds: newSet }
})
```
- `useUserInteractions` hook: Supabase RPC `get_user_interactions` 1번 → 4개 테이블 통합
- Zustand likeStore: `toggle` 핸들러에서 항상 `useLikeStore.getState()`로 최신값 읽기 (클로저 stale 방지)

## Google Maps dynamic import (필수)
```ts
const UploadMapSection = dynamic(() => import('./UploadMapSection'), { ssr: false })
```
Google Maps 관련 컴포넌트는 항상 `dynamic import + ssr: false` — 번들 크기 문제
