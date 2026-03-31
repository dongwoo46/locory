# Map/Feed Optimization Worklog

## 1) Feed Query and Loading
- Reduced duplicate initial fetch behavior.
- Kept initial payload smaller and moved heavy data to incremental loading.
- Tuned page size and load flow to avoid large up-front work.

## 2) Image Delivery
- Standardized major surfaces on `next/image`.
- Prefer `thumbnail` / `medium` variants via `getPostImageUrl`.
- Strengthened `next.config.ts` image settings (`avif/webp`, cache TTL, remote patterns).

## 3) MapClient Refactor
- Split large map logic into components and hooks.
- Main split targets:
  - `src/app/map/components/*`
  - `src/app/map/hooks/*`
  - `src/app/map/map.constants.ts`
  - `src/app/map/map.helpers.ts`
  - `src/app/map/map.types.ts`

## 4) Type Safety
- Reduced `any` usage in map-related modules.
- Normalized Supabase join shapes (`object | object[]`) safely.

## 5) Place Sheet Infinite Scroll
- Changed from one-shot load to incremental paging.
- Applied `useInfiniteQuery` with page-size-based loading.
- Added near-bottom trigger to fetch next page.

## 6) Avatar Fetch Strategy
- Removed `avatar_url` from list query for lighter payload.
- Fetch avatar/profile data lazily on detail open path.

## 7) Place Detail Save Count
- Exposed place save count in `/place/[id]`.
- Applied optimistic update for save toggle.

## 8) Validation
- Ran lint on targeted files.
- Confirmed `npm run build` passes.

## Follow-up
- Replace deprecated middleware convention with proxy convention.
- Address Sentry deprecation config warnings.
