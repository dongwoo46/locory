# Codex Worklog

## 2026-03-27

- Login in-app browser notice: changed app names and fallback text to English in `src/app/login/page.tsx`.
  - Example: `KakaoTalk`, `Instagram`, fallback `In-app browser`
  - Purpose: prevent mixed Korean text in messages like "Google login unavailable in {app}".

- Feed infinite scroll loading UI: replaced dark loading text/button style with spinner in `src/app/feed/FeedClient.tsx`.
  - During `isFetchingNextPage`, show `animate-spin` circular loader.
  - Keep `Load more` button only when not fetching.

- Organized `.codex` notes structure:
  - Added `rules/`, `features/`, `architecture/`, `logs/`
  - Added summaries based on `MAP_OPTIMIZATION_WORKLOG.md` and `AGENTS.md`

## 2026-04-01

- Map-first UX updates:
  - Root redirect to `/map`, removed feed entry from bottom navigation flow.
  - Kept feed page code, but removed direct client routing emphasis to feed.

- Map visualization redesigned into zoom stages in `src/app/map/MapClient.tsx`:
  - Far zoom: circular count markers.
  - Mid zoom: neighborhood/administrative cluster count markers.
  - Deep zoom: latest feed-photo markers (photo-first) + lightweight place markers.
  - Added overlap spread logic for nearby markers to reduce "count mismatch vs visible markers".

- Map search behavior:
  - Search submit now uses places API fallback and pans to searched location.
  - Local match first, API result second.

- Recommended neighborhoods UI:
  - Removed top city/district chip rows from `MapTopControls`.
  - Added toggle button beside `all/saved`.
  - Opened compact recommendation panel from top area, with city -> district selection and place-count sorting.
  - Replaced hardcoded English strings with translation keys where applicable.

- Anonymous and access flow:
  - Kept map/upload usable without mandatory login.
  - Meetup routes remain login-required (anonymous blocked).
  - Removed guest-feed scroll login gate behavior.

- District normalization/storage direction:
  - Shifted from repeated UI-side mapping toward save-time normalization.
  - Updated upload/place save paths to normalize `district` using address/admin-area data.
  - Added address-admin extraction path (`adminAreaLevel2`) to upload selection flow.

- Backfill for existing DB records:
  - Added migration `supabase/migrations/043_backfill_places_district_to_gu.sql`.
  - Backfills KR rows to gu/gun-level `district` from address/raw fields and normalizes existing rows.

- Map place detail translation behavior updates:
  - Re-added memo translation controls in map place post detail sheet (`PlaceFeedSheet`).
  - Added language-detection gate:
    - hide translate action when memo language already matches current locale
    - show login-required hint for logged-out users when language differs
    - keep translate action available for logged-in users only
  - Opened `/api/translate/detect` for unauthenticated language detection only.
  - Kept `/api/translate` login-required for actual translation and quota tracking.

- Map empty-state and header polish:
  - Suppressed initial "no places" flash on first map enter; empty-state now appears only when active filters are applied and result is empty.
  - Improved map top header readability over map tiles (translucent white + blur + border/shadow).
  - Reduced header vertical size for less visual weight.
  - Added logged-out top-right auth actions on map header (`Sign up` / `Log in` linking to `/login?next=/map`).

- Validation:
  - Targeted lint passed for:
    - `src/app/api/translate/detect/route.ts`
    - `src/app/map/components/PlaceFeedSheet.tsx`
    - `src/app/map/MapClient.tsx`
    - `src/app/map/components/MapTopControls.tsx`

- Map top controls behavior fixes:
  - Changed header `+` action from opening route/course picker to opening create action sheet (feed/place creation).
  - Kept route/course picker accessible from its dedicated right-side button only.
  - Added map create flow wiring:
    - feed creation -> `/upload`
    - place creation -> `PlaceAddSheet` (logged-in only), logged-out redirects to `/login?next=/map`.

- Map UI cleanup:
  - Removed top-center map place total badge (e.g., "66 places").

- i18n bug fix on map create sheet:
  - Fixed missing message error `map.addFeed` by using `feed` namespace keys for create action sheet labels.

- City count marker reliability fix (non-Seoul/Busan):
  - Improved far-zoom city aggregation with coordinate-based city bucket fallback.
  - Added nearest-city assignment for mismatched/missing city data.
  - Included additional KR city buckets for aggregation fallback (e.g., Daejeon, Gwangju, Daegu, Ulsan, Sejong).
  - Changed city marker click behavior to zoom-in focus without forcing city filter.

- Validation:
  - Targeted lint passed for updated map files after each change.
