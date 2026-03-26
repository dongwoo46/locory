# Project Guardrails

## Product/UX

- Keep map place posts UI as a photo-first grid.
- Keep place sheet posts as infinite scroll.
- Do not re-introduce heavy initial loading behavior.
- Do not change design/UX unless explicitly requested.
- Preserve i18n usage patterns (prefer translation keys over hardcoded labels).
- Keep map marker/place card visual style stable.

## Engineering Direction

- Prefer same UI with less payload/less blocking over redesign.
- Prefer extraction/splitting for large modules to reduce regression risk.
- Avoid `any` in map modules.
- Safely normalize Supabase join fields that may be `object | object[]`.

## Data/Migration Safety

- Keep feed + interactions unification migration history.
- Keep photo variant migration/backfill scripts reproducible.
- Do not remove migration history tied to backfill paths.

## Validation

- Targeted lint first: `npm run lint -- <files...>`
- Final sanity build: `npm run build`

