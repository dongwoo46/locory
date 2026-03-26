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

