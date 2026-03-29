# Map/Feed Optimization Worklog

## 1) Feed query and loading
- Feed 초기 로딩에서 중복 요청이 발생하던 흐름을 정리했습니다.
- 초기 로딩량을 줄이고, 필요한 데이터만 단계적으로 가져오도록 조정했습니다.
- 페이지 단위 로딩 개수를 튜닝해 과도한 선조회 비용을 낮췄습니다.

## 2) Image delivery
- 주요 화면의 이미지 렌더를 `next/image` 중심으로 통일했습니다.
- `thumbnail`/`medium` 변형 URL을 우선 사용하도록 정리했습니다.
- `next.config.ts` 이미지 설정(`avif/webp`, 캐시 TTL, remotePatterns)을 보강했습니다.

## 3) MapClient 구조 분리
- 대형 단일 파일을 컴포넌트/훅 중심으로 분리해 유지보수성을 개선했습니다.
- 분리 대상:
  - `src/app/map/components/*`
  - `src/app/map/hooks/*`
  - `src/app/map/map.constants.ts`
  - `src/app/map/map.helpers.ts`
  - `src/app/map/map.types.ts`

## 4) Type safety 강화
- 맵 모듈에서 `any` 사용을 줄이고 조인 타입(`object | object[]`)을 안전하게 처리했습니다.
- 단일 객체 정규화 헬퍼를 도입해 타입 캐스팅 오류를 줄였습니다.

## 5) Place sheet infinite scroll
- 장소 피드 시트를 one-shot 로딩에서 점진 로딩으로 전환했습니다.
- `useInfiniteQuery` + 페이지 사이즈 기반 페이징을 적용했습니다.
- 스크롤 하단 근접 시 다음 페이지를 가져오도록 변경했습니다.

## 6) Avatar fetch 전략
- 목록 조회에서는 `avatar_url`을 제외해 payload를 경량화했습니다.
- 상세 진입 시점에만 프로필 정보를 lazy fetch 하도록 분리했습니다.

## 7) Place detail save count
- `/place/[id]`에 장소 저장 수를 노출하고 토글 시 낙관적 업데이트를 적용했습니다.
- 헤더 액션과 저장 카운트 표시를 일관되게 맞췄습니다.

## 8) Validation
- 주요 변경 파일 대상 lint 수행
- 최종 `npm run build` 통과 확인

## Follow-up
- middleware/proxy deprecation 경고 대응
- Sentry deprecation 옵션 정리
