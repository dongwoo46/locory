# Locory Web

장소 기반 여행 기록, 추천, 만남 기능을 한 곳에서 제공하는 Locory 웹 앱입니다.

## Tech Stack
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Supabase (PostgreSQL/Auth/Storage)
- Zustand
- TanStack Query v5
- next-intl (ko/en/ja/zh-TW/zh-CN/es/ru)
- Google Maps API / Google Translate API
- Gemini API

## Core Features
- 피드/지도 기반 장소 탐색
- 장소 중심 여행 기록(사진/메모/평점)
- 댓글/좋아요/저장 인터랙션
- 장소 기반 모임 생성/참여
- 다국어 UI + 텍스트 번역
  - 일반 사용자: 일 5회 제한
  - 관리자: 제한 없음

## Local Setup
```bash
npm install
npm run dev
```

기본 실행 주소: `http://localhost:3000`

## Environment Variables
`.env.local`에 아래 값을 설정하세요.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_PLACES_API_KEY=
GOOGLE_TRANSLATE_API_KEY=

GEMINI_API_KEY=

NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
```

## Scripts
```bash
npm run dev
npm run lint -- <files...>
npm run build
```

## Main Directories
- `src/app`: App Router page/API routes
- `src/components`: 공통 UI 컴포넌트
- `src/app/map`: 지도 화면 및 훅
- `src/app/feed`: 피드 화면
- `supabase/migrations`: DB 마이그레이션

## Notes
- 성능 최적화 이력은 `MAP_OPTIMIZATION_WORKLOG.md` 참고
- 자동화 에이전트 운영 가이드는 `AGENTS.md`, `CLAUDE.md` 참고
