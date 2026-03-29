# Locory Claude Guide

## Service Overview
Locory는 여행 기록, 장소 추천, 소셜 만남을 결합한 장소 기반 플랫폼입니다.

## Stack
- Next.js 16 App Router + TypeScript + Tailwind CSS v4
- Supabase (DB/Auth/Storage)
- Google Maps API, Gemini API, Google Translate API v2
- next-intl (ko/en/ja/zh-TW/zh-CN/es/ru)
- Zustand, TanStack Query v5

## Working Rules
- 구현 전 설계/영향 범위를 먼저 확인합니다.
- UI 문자열은 하드코딩하지 말고 i18n 키를 사용합니다.
- 성능 최적화는 "같은 UI, 더 적은 payload/대기시간"을 우선합니다.

## i18n Notes
- 지원 언어: `ko`, `en`, `ja`, `zh-TW`, `zh-CN`, `es`, `ru`
- 번역 키 추가 시 다국어 파일을 함께 업데이트합니다.

## API Notes
- `/api/translate`: 텍스트 번역
  - 일반 사용자: 하루 5회 제한
  - 관리자: 제한 없음
- `/api/translate/detect`: 텍스트 언어 감지

## Env
필수 환경 변수는 `README.md`의 Environment Variables 섹션을 따릅니다.

## Related Docs
- `AGENTS.md`
- `MAP_OPTIMIZATION_WORKLOG.md`
- `.claude/rules/*.md`
