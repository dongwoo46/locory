# Locory Claude Guide

## Overview
Locory is a location-based travel platform that combines record, recommendation, and social meetup features.

## Stack
- Next.js 16 App Router
- TypeScript + Tailwind CSS v4
- Supabase (DB/Auth/Storage)
- Google Maps API
- Google Translate API v2
- Gemini API
- next-intl
- Zustand
- TanStack Query v5

## Working Principles
- Align on design/impact before coding when changes are non-trivial.
- Keep UI text in i18n keys, not hardcoded literals.
- Prefer performance improvements that preserve existing UI.

## i18n
- Supported locales: `ko`, `en`, `ja`, `zh-TW`, `zh-CN`, `es`, `ru`
- Update all locale files when adding keys.

## Translation Policy
- `/api/translate`
  - Regular user: daily limit 5
  - Admin: unlimited
- `/api/translate/detect`
  - Detect language and decide whether translation action should be shown

## Environment
See `README.md` for required environment variables.

## Related
- `AGENTS.md`
- `MAP_OPTIMIZATION_WORKLOG.md`
- `.claude/rules/*.md`
