# Map/Feed Optimization Worklog

## 1) Feed query & loading behavior
- `get_user_interactions + posts` 흐름을 통합하는 방향으로 RPC 작업 기반 마련.
- 피드 초기 과다 요청(초기 2회 로드) 이슈 완화.
- 페이지당 로드 개수 조정(대용량 초기 로드 방지).

## 2) Image delivery 개선
- `next/image` 기반 로딩 흐름으로 전환(썸네일/중간 이미지 우선 활용).
- 카드/그리드/상세 이미지에 lazy/eager 우선순위 분리 적용.
- `next.config.ts` 이미지 포맷/캐시 설정 보강:
  - `avif`, `webp`
  - `minimumCacheTTL`
  - `supabase` remote pattern

## 3) MapClient 구조 정리
- 대형 파일 분해:
  - `src/app/map/components/MapTopControls.tsx`
  - `src/app/map/components/MapFilterModal.tsx`
  - `src/app/map/components/PlaceFeedSheet.tsx`
  - `src/app/map/components/CourseBuildModals.tsx`
  - `src/app/map/components/RecommendBuildSheet.tsx`
  - `src/app/map/map.constants.ts`
  - `src/app/map/map.helpers.ts`
  - `src/app/map/map.overlays.tsx`(또는 overlays 분리 파일)
  - `src/app/map/map.types.ts`
- 훅 분리:
  - `src/app/map/hooks/useMapFilters.ts`
  - `src/app/map/hooks/usePlacePostsSheet.ts`
  - `src/app/map/hooks/useSavedCoursesState.ts`
  - `src/app/map/hooks/usePolylineTooltip.ts`
  - `src/app/map/hooks/useRecommendBuildState.ts`

## 4) 타입 안정화(TypeScript)
- `MapClient.tsx`의 `any` 제거/축소.
- Supabase join 결과(`object | object[]`) 대응 타입 추가:
  - `MapQueryPost`, `MapQueryPlace`, `MapProfileLite`, `SavedCourseRecord` 등.
- `TS2352`(배열/단일 객체 변환) 이슈 해결:
  - `asSinglePlace`, `asSingleProfile` 정규화 유틸 적용.
- `RecommendBuildSheet`와 setter 타입 불일치 해결:
  - `SetStateAction<T>` 지원하도록 reducer wrapper 정리.

## 5) Map 장소 피드 UX 변경
- 장소 피드(그리드) 무한 스크롤 적용:
  - `useQuery` → `useInfiniteQuery`
  - 페이지 사이즈 기반(`PAGE_SIZE`) 점진 로딩
  - 하단 근접 시 다음 페이지 요청
- 상세 모달 이미지 최적화 로딩 유지.
- 상세 모달에서 좋아요/저장 수 표시 추가.

## 6) avatar_url 로딩 전략
- 목록 조회 시 `avatar_url` 제외(경량화).
- 상세 진입 시점에만 프로필 아바타 지연 조회.

## 7) Place detail 저장 수 반영
- 장소 상세(`/place/[id]`)에서 `place_saves` count 조회 추가.
- 헤더 북마크 옆 저장 수 표시 및 저장/해제 시 즉시 증감.
- 관련 타입 에러(예: rating null index) 빌드 기준 해결.

## 8) 빌드/검증 상태
- `npm run lint` 주요 변경 파일 통과.
- `npm run build` 최종 통과 확인.
- 남은 것은 경고성 메시지(예: middleware deprecation, sentry deprecation) 중심.

---

필요하면 다음 단계로 이 파일을 기준으로
- 릴리즈 노트 버전(`vX.Y.Z`) 형식
- 포트폴리오용 성능 개선 Before/After 형식
으로 변환 가능.
