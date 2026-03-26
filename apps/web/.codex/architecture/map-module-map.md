# Map Module Map

## Main Entry

- `src/app/map/MapClient.tsx`

## Components

- `src/app/map/components/MapTopControls.tsx`
- `src/app/map/components/MapFilterModal.tsx`
- `src/app/map/components/PlaceFeedSheet.tsx`
- `src/app/map/components/CourseBuildModals.tsx`
- `src/app/map/components/RecommendBuildSheet.tsx`

## Hooks

- `src/app/map/hooks/useMapFilters.ts`
- `src/app/map/hooks/usePlacePostsSheet.ts`
- `src/app/map/hooks/useSavedCoursesState.ts`
- `src/app/map/hooks/usePolylineTooltip.ts`
- `src/app/map/hooks/useRecommendBuildState.ts`

## Supporting Files

- `src/app/map/map.constants.ts`
- `src/app/map/map.helpers.ts`
- `src/app/map/map.overlays.tsx`
- `src/app/map/map.types.ts`

## Key Runtime Behaviors

- Place posts in map sheet: paginated infinite loading (`PAGE_SIZE` based).
- Place posts UI: photo-first grid with scroll-triggered load more.
- Avatar loading: deferred to detail-open path for lighter list payloads.

