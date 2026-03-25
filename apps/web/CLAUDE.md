# Locory — Claude 지침

## 서비스 개요
한국을 여행하는 외국인 + 한국 로컬이 함께 쓰는 장소 기반 여행 기록 + 커뮤니티 플랫폼.
방문 장소를 사진으로 기록하고 피드 공유 → 타 여행자 여행 계획 활용.

**타겟**: 한국 여행 외국인(JP/TW/US/RU/ES) + 한국 로컬(숨은 장소 공유)

## 기술 스택
- Next.js 16 App Router + TypeScript + Tailwind CSS v4
- Supabase (DB + Auth + Storage), Google Maps API, Gemini 2.5 Flash Lite, Google Translate API v2
- next-intl (7개 언어: ko/en/ja/zh-TW/zh-CN/es/ru), @tanstack/react-query v5, Zustand
- 배포: Vercel

## 협업 방식
- **설계 먼저, 코딩 나중**: 새 기능 구현 전 설계상 결정 포인트 먼저 질문하고 합의 후 구현
- **파일 수정 후 저장 여부 묻지 말 것** — 바로 저장

## i18n 필수 규칙
- **모든 UI 텍스트**: `useTranslations` 훅 사용 — 한국어 하드코딩 절대 금지
- 새 키 추가 시 ko/en/ja/zh-TW/es/ru **+ zh-CN** 7개 파일 모두 동시 업데이트
- zh-CN.json은 번역 불완전 — 해당 섹션 없을 수 있음, 파일 끝에 추가
- 카테고리/도시/평점 라벨도 `post.category.*`, `cities.*` 네임스페이스 활용

## API 엔드포인트
- `/api/places/search` — Google Places 텍스트 검색 (regionCode: 'KR', pageSize: 10)
- `/api/places/from-url` — 네이버/구글맵 URL → 장소 정보
- `/api/places/geocode` — 역지오코딩 (lat/lng → address)
- `/api/course` — Gemini 동선 생성
- `/api/directions` — Google Directions 경로
- `/api/translate` — Google Translate v2 (POST `{text, target}` → `{translated, remaining}`), 하루 5회 제한
- `/api/posts/[id]/comments` — GET 댓글 목록 / POST 댓글 작성
- `/api/comments/[id]` — DELETE 댓글 소프트삭제

## 어드민 계정
- `siwol406@gmail.com` → DB 트리거(`handle_new_user`)에서 자동 role='admin', trust_score=8000

## 환경변수 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, GOOGLE_PLACES_API_KEY
NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT
GEMINI_API_KEY
GOOGLE_TRANSLATE_API_KEY
```

## DB 마이그레이션 (최신)
- 030: place_meetups.title 컬럼, post_comments 테이블, notifications 타입 확장(post_liked/post_saved), DB 트리거 4개
- 031: translate_usage 테이블 + increment_translate_usage() SECURITY DEFINER RPC

## 세부 규칙 파일
@.claude/rules/db.md
@.claude/rules/ui.md
@.claude/rules/features.md
