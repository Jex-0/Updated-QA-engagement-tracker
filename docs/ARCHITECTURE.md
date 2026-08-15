# Architecture Review — Client Engagement Tracker

## 1. As-is architecture (v1, legacy)

The original application was a **single 2,265-line HTML file** (`index.html`, plus a stale duplicate `QA auto tracker`) containing all CSS, markup and JavaScript:

- **Runtime model:** Vanilla JS, DOM manipulation, global functions, `window.onload` bootstrap.
- **Persistence:** `localStorage` (records cached under `cache:` keys, preferences under plain keys) with an optional **Firebase** cloud layer (Firestore + Email/Password auth, compat SDK loaded from CDN, embedded `firebaseConfig` constant).
- **Domain model:** `engagementItems` (11 categories), a single `Pulse` checkbox, engagement records with `score = round(checked/11*100)`, teams `CCS01–CCS12`, roles `agent / leader / admin` (first account becomes admin).
- **Key behaviours:** keyword-mapped Web Speech API auto-ticking, per-call history, leader dashboard with team/date filters and a hand-drawn canvas chart with a 7-call rolling average, CSV export, admin role/team management, 30-second presence heartbeat.

### Strengths preserved
- Simple to deploy (static), zero dependencies, works offline, no server required.
- Thoughtful business rules (11-step QA rubric, pulse adoption, dropped-call flagging).

### Weaknesses addressed by v2
| Area | v1 problem | v2 solution |
|---|---|---|
| Maintainability | One 150 KB file, global state, DOM-string rendering | React + TypeScript, typed modules, component tree, central store |
| Roles | `agent/leader/admin` only; no manager | Added `manager` role with its own console and permissions |
| Accountability | No audit trail, no disputes, score edits not possible | Audit log on every mutation; dispute workflow; score corrections |
| Analytics | Single canvas chart, no heatmap/leaderboard/compliance | SVG line/bar/heatmap charts, leaderboard, compliance & pulse metrics |
| UX | No dark mode, no responsive nav, no empty/loading states, emoji icons | Full design system, light/dark themes, role-based sidebar, professional icon set, toasts, skeletons, empty states |
| Accessibility | Little semantic structure, focus handling, ARIA | Focus-visible rings, `role`/`aria` attributes, semantic buttons/forms, reduced-motion support |
| Security | Unescaped template strings, no CSV injection guard | React escaping, CSV formula-injection guard, no `innerHTML` with user data |

## 2. Target architecture (v2)

```
src/
├── main.tsx / App.tsx        Bootstrap, providers, hash router, route guards
├── index.css                 Design system (tokens, themes, components)
├── components/
│   ├── icons.tsx             Inline SVG icon set (no icon dependency)
│   ├── ui.tsx                Button, Card, Badge, Modal, Toast, inputs, EmptyState…
│   ├── charts.tsx            LineChart, Sparkline, Heatmap, Bars (dependency-free SVG)
│   └── layout.tsx            App shell, role-based sidebar, topbar, route permissions
├── lib/
│   ├── types.ts              Domain types (records, disputes, audit, notes, users)
│   ├── checklist.ts          QA rubric + keyword map (preserved 1:1)
│   ├── store.tsx             Reducer store, persistence, audit-emitting actions
│   ├── seed.ts               Teams, admin bootstrap, optional sample data
│   ├── timeline.ts           Timeline/event building + coaching recommendations
│   ├── format.ts             Scoring, compliance, aggregation helpers
│   ├── export.ts             CSV (injection-safe) + print-to-PDF reports
│   └── cloud.ts              Optional Firebase sync adapter (restores v1 data path)
├── hooks/
│   └── useSpeech.ts          Web Speech API assistant (v1 behaviour preserved)
└── views/                    Auth, Tracker, Engagement, Agent profile, Leader,
                              Manager, Admin, Reports, Settings, Engagements
```

### Key design decisions

1. **Client-first with pluggable sync.** The store persists to `localStorage` and exposes a `cloud` adapter so the Firebase shared database can be re-enabled from Settings without changing app code. This preserves v1 functionality and keeps the app fully offline-capable.
2. **Single source of truth.** One reducer store; every mutation emits an audit entry. No scattered DOM state.
3. **Role-based routing.** `canAccess(route, role)` guards every view; the shell renders nav filtered by role. Agents only ever see their own data.
4. **Timestamps-first timeline.** Items ticked during a live call record `seconds` since call start; legacy records get a deterministic synthesized timeline. Missed categories become colour-coded coaching events.
5. **Zero runtime dependencies for UI/charts/icons** — fast load, no version churn; React is the only runtime dependency.

## 3. Data model (new entities)

- `EngagementRecord` — extended with `timeline[]`, `transcript?`, `notes?`, `reviewed?`, `status: active|archived`, `corrected?` (score correction), `archivedBy/At`.
- `Dispute` — engagement flagged for manager review: reason, openedBy, status `open|approved|rejected`, resolution, adjusted score.
- `AuditEntry` — actor, action, entity, oldValue, newValue, timestamp (immutable history).
- `CoachingNote` — strengths/improvements per agent with author and date.
- `UserAccount` — name, email, team, `role: agent|leader|manager|admin`.

## 4. Performance & security

- Charts and aggregations are `useMemo`-derived; datasets are small (hundreds of records) and rendered in slices.
- No `innerHTML` with user data; CSV cells starting with `= + - @` are escaped to block spreadsheet formula injection.
- Score corrections, disputes and deletions are reversible where sensible (archive vs delete) and always audited.
- **Note:** role enforcement is client-side by design (local-first). For true multi-user security, enable the cloud adapter and move authorization into Firestore rules / a server (see ROADMAP.md).
