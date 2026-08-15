# Migration Strategy

## What changed on disk

| Path | Action |
|---|---|
| `index.html` (legacy app) | Moved to `legacy/index.html` — kept for reference |
| `QA auto tracker` (stale duplicate) | Moved to `legacy/QA auto tracker (old copy).html` |
| `CPI.JO-7f69f481.png` (logo) | Moved to `public/CPI.JO-7f69f481.png` (served at `/CPI.JO-7f69f481.png`) |
| `src/` | New React + TypeScript application (see ARCHITECTURE.md) |
| `docs/` | Architecture, UX plan, migration, roadmap |

The legacy app is **not deleted** — it lives in `legacy/` and can be diffed or re-served at any time.

## Business-rule parity (verified)

- Same 11 checklist categories and phrases (see `src/lib/checklist.ts`).
- Same scoring: `score = round(completed / 11 * 100)`, Pulse is tracked separately and excluded from the score.
- Same speech keyword map (`en-ZA`, auto-tick, auto-restart, Chrome/Edge only).
- Same teams (`CCS01–CCS12`), first-account-becomes-admin rule.
- Same record fields (`dateTime`, `isoDate`, `savedAt`, `checkedItems`, `missedItems`, `pulseCompleted`, `dropped`).

## Data migration

### Local-only data (localStorage)
Old keys: plain preference keys + `cache:*` engagement records. The v2 store uses a single namespaced key `qe-platform-v2`. **One-time migration options:**

1. **Manual (recommended for pilots):** open the legacy `legacy/index.html` directly, export via the leader dashboard CSV, then import the CSV records into v2 — or simply re-enter a week's data and use v2 going forward.
2. **Automatic:** a short script can read `localStorage['cache:...']` keys and emit the v2 state shape. Not shipped to keep v2 free of legacy parsing; contact the maintainer if automated import of existing local data is required.

### Cloud (Firebase) data
The v2 Settings → Cloud sync panel accepts the same `firebaseConfig` object. On connect it pulls all documents from the `engagements` collection and imports those not already present; **Push local records** uploads local engagements. Field names are compatible with v1 records (score, completed, checkedItems, missedItems, pulseCompleted, dropped, savedAt…).

## Rollout plan

1. **Pilot (this release):** run local-first on a few devices; validate scoring parity against the legacy app with side-by-side calls.
2. **Cloud enable:** connect the Firebase project (enable Email/Password auth if used, publish Firestore rules) and verify two-device sync.
3. **Full team:** train on the new UI; archive the legacy entry point; keep `legacy/` until the team is confident.
4. **Server-side hardening (later):** move auth/roles into Firestore rules or a server so role checks are enforced outside the browser (see ROADMAP.md).

## Rollback

- v2 writes to a separate storage key, so reverting to the legacy app loses nothing: open `legacy/index.html` and the old data is untouched.
