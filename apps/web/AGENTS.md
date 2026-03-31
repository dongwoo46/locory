# AGENTS.md

Scope: entire repository.

## Project Context
- Keep map place posts UI as a photo-first grid.
- Keep place post sheet on infinite scroll.
- Do not re-introduce heavy initial loading behavior.
- Preserve current feed/map optimization direction unless rollback is explicitly requested.

## Implemented Behavior Snapshot
- Map place post sheet paging:
  - `src/app/map/hooks/usePlacePostsSheet.ts`
  - `useInfiniteQuery`, page size 15
- Map sheet wiring:
  - `src/app/map/MapClient.tsx`
  - `fetchPostsByPlace(placeId, offset, limit)` with Supabase `.range(...)`
- Place sheet UI:
  - `src/app/map/components/PlaceFeedSheet.tsx`
  - Grid thumbnails + scroll-triggered load more
  - Post detail modal includes likes and saves
- Avatar strategy:
  - Do not fetch `avatar_url` in map place post list query
  - Fetch avatar lazily on detail-open path

## Existing Optimizations
- Feed query/request flow tuned to reduce duplicate initial fetches.
- Feed/map list loading tuned to smaller paged fetches.
- Image delivery improvements:
  - Variant URLs (`thumbnail`, `medium`) via `getPostImageUrl`
  - Expanded `next/image` usage
  - `next.config.ts` optimization/caching (`avif/webp`, remotePatterns, TTL)
- Third-party scripts adjusted to avoid blocking initial render.
- Large map logic split into hooks/components.
- Map place sheet moved from one-shot load to incremental infinite scroll.

## Type Safety Notes
- Avoid `any` in map modules.
- Supabase join fields may arrive as object or array; normalize safely.
- Related types:
  - `src/app/map/map.types.ts`

## Place Detail (`/place/[id]`)
- Place save count is shown near bookmark in header.
- Save count updates optimistically on toggle.
- Files:
  - `src/app/place/[id]/page.tsx`
  - `src/app/place/[id]/PlaceClient.tsx`

## DB / Migration Context
- Feed + interaction unification exists around Supabase RPC and migrations.
- Photo variant migration/backfill path exists; keep migration history intact.
- One-time backfill scripts should remain reproducible.

## Guardrails
- Do not change design/UX unless explicitly requested.
- Prefer extraction/splitting and performance improvements without visual regressions.
- Preserve i18n patterns; avoid hardcoded labels when translation keys exist.
- Keep map marker/place card visual style stable.
- Prefer "same UI, less payload/less blocking" over redesign.

## Validation Commands
- Targeted lint:
  - `npm run lint -- <files...>`
- Final sanity:
  - `npm run build`
