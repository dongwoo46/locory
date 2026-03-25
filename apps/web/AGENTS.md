# AGENTS.md

This file is for future Codex sessions.  
Scope: entire repository.

## Project context (recent decisions)
- Keep map place posts UI as **photo-first grid** (not legacy feed-card list).
- In map place sheet, place posts use **infinite scroll**.
- Do not re-introduce heavy initial loading behavior.
- Feed/map/performance work was already optimized; preserve current direction unless user asks rollback.

## Key implemented behaviors
- Map place post sheet pagination:
  - `src/app/map/hooks/usePlacePostsSheet.ts`
  - Uses `useInfiniteQuery`, page size = 15.
- Map sheet wiring:
  - `src/app/map/MapClient.tsx`
  - `fetchPostsByPlace(placeId, offset, limit)` with Supabase `.range(...)`.
- Place sheet UI:
  - `src/app/map/components/PlaceFeedSheet.tsx`
  - Grid thumbnails + scroll-triggered load more.
  - Post detail modal shows likes and saves.
- Avatar strategy:
  - Do **not** fetch `avatar_url` in list query for map place posts.
  - Fetch avatar on detail-open path (lazy profile fetch).

## Performance optimizations already applied
- Feed query/request flow tuned to reduce duplicate initial fetches.
- Feed/map list loading tuned to smaller paged fetches (avoid large up-front payload).
- Image delivery strategy improved:
  - Prefer variant URLs (`thumbnail`/`medium`) via `getPostImageUrl`.
  - `next/image` usage expanded for major feed/map surfaces.
  - `next.config.ts` image optimization/caching configured (`avif/webp`, remotePatterns, TTL).
- Third-party scripts strategy adjusted to avoid blocking initial render path.
- Large map client logic split into hooks/components to reduce maintenance risk and regressions.
- Map place sheet changed from one-shot load to incremental infinite scroll.

## Type safety notes
- Avoid `any` in map modules.
- Supabase join fields may come as object or array; normalize safely.
- Relevant types:
  - `src/app/map/map.types.ts`

## Place detail page (`/place/[id]`)
- Place save count is shown in header near bookmark.
- Save count updates optimistically on toggle.
- Files:
  - `src/app/place/[id]/page.tsx`
  - `src/app/place/[id]/PlaceClient.tsx`

## Database / migration context
- Feed + interactions unification work exists around Supabase RPC/migrations.
- Photo variants migration/backfill path exists; do not remove related migration history.
- Be careful with backfill scripts: they are for one-time migration but should remain reproducible.

## Guardrails (important)
- Do not change design/UX unless user explicitly asks.
- Prefer extraction/splitting and performance improvements without visual regressions.
- Preserve i18n usage patterns; avoid hardcoded Korean/English labels when translation keys exist.
- Keep map marker/place card visual style stable (previous accidental visual drift was a regression).
- When optimizing, prefer “same UI, less payload/less blocking” over redesign.

## Validation commands
- Lint targeted files first:
  - `npm run lint -- <files...>`
- Final sanity:
  - `npm run build`
