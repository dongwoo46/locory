# Locory Web

Location-based travel 기록/추천/만남 기능을 제공하는 Locory 웹 앱입니다.

## Tech Stack
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Supabase (PostgreSQL/Auth/Storage)
- Zustand
- TanStack Query v5
- next-intl (`ko`, `en`, `ja`, `zh-TW`, `zh-CN`, `es`, `ru`)
- Google Maps API
- Google Translate API v2
- Gemini API

## Core Features
- 피드/지도 기반 장소 탐색
- 장소 중심 여행 기록 (사진/메모/평점)
- 댓글/좋아요/저장 인터랙션
- 장소 기반 모임 생성/참여
- 번역 기능
  - 일반 사용자: 하루 5회 제한
  - 관리자: 제한 없음

## Local Setup
```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Environment Variables
Set values in `.env.local`:

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

## Directories
- `src/app`: App Router pages and API routes
- `src/components`: shared UI components
- `src/app/feed`: feed UI
- `src/app/map`: map UI
- `supabase/migrations`: DB migrations

## Docs
- `MAP_OPTIMIZATION_WORKLOG.md`
- `AGENTS.md`
- `CLAUDE.md`
