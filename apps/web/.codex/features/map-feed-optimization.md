# Map/Feed Optimization Summary

Source: `MAP_OPTIMIZATION_WORKLOG.md`

## 1) Feed Query & Loading

- Prepared RPC direction to unify `get_user_interactions + posts` flow.
- Reduced duplicate initial feed loading behavior.
- Tuned page-size based fetch to avoid heavy first payloads.

## 2) Image Delivery

- Shifted major surfaces to `next/image`.
- Applied lazy/eager priorities by surface (card/grid/detail).
- Hardened image config in `next.config.ts`:
  - `avif`, `webp`
  - `minimumCacheTTL`
  - Supabase `remotePatterns`

## 3) MapClient Refactor

- Split large map file into components:
  - `MapTopControls`, `MapFilterModal`, `PlaceFeedSheet`
  - `CourseBuildModals`, `RecommendBuildSheet`
  - `map.constants`, `map.helpers`, `map.overlays`, `map.types`
- Split logic into hooks:
  - `useMapFilters`, `usePlacePostsSheet`, `useSavedCoursesState`
  - `usePolylineTooltip`, `useRecommendBuildState`

## 4) Type Safety

- Reduced/removed `any` in map flow.
- Added handling for Supabase join results (`object | object[]`).
- Added normalization utility flow for single-object conversion issues.
- Fixed setter type mismatch (`SetStateAction<T>` support path).

## 5) Place Feed UX

- Place feed switched to infinite scroll:
  - `useQuery` -> `useInfiniteQuery`
  - page-size incremental loading
  - bottom-near trigger for next page
- Kept detail modal image optimization.
- Added likes/saves display in detail modal.

## 6) Avatar Fetch Strategy

- Excluded `avatar_url` in list query for lighter payload.
- Fetch avatar lazily on detail open.

## 7) Place Detail Save Count

- Added `place_saves` count on `/place/[id]`.
- Header save count updates optimistically on toggle.

## 8) Validation Status

- Targeted lint passed for major changed files.
- Final `npm run build` passed.
- Remaining items mainly warning-level messages.

