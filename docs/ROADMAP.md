# Future Enhancement Recommendations

## Backend & security (highest priority)
- **Real server-side auth & roles.** Replace client-side role checks with Firebase Auth (Email/Password, SSO) or Convex Auth; enforce agent/leader/manager/admin permissions in Firestore security rules or Convex middleware so they cannot be bypassed.
- **Scheduled reporting.** Automatic daily/weekly/monthly email delivery of team, compliance and engagement reports needs a server-side scheduler — Firebase Cloud Functions (cron) or Convex `cronJobs`. The on-demand CSV/PDF exports in Reports are ready to be consumed by it.
- **Real-time sync hardening.** Complete the cloud adapter with live subscriptions (Firestore `onSnapshot`) and conflict resolution (server timestamp merging) instead of pull/push.

## Product features
- **Full transcript recording.** Store per-call transcripts server-side; build transcript-anchored timelines so clicking an event seeks the audio/transcript (needs an audio recording pipeline — e.g., S3 + transcription service).
- **AI coaching insights.** Call a transcription/LLM service (e.g., OpenAI/Anthropic via a server function) to generate richer insights: tone analysis, objection-handling quality, sentiment trends, personalized coaching plans.
- **Manager SLA view.** Dispute age, resolution rate, correction frequency per manager/team.
- **Agent self-service.** Goal setting, personal benchmarks, "call of the week" highlights.
- **Multi-period comparison.** Week-over-week and month-over-month deltas across all KPIs (compliance, pulse, dropped rate).

## Reporting & data
- **Native Excel (.xlsx)** exports via a small library (e.g., `xlsx`/`exceljs`) with styled sheets and charts.
- **Pivot-style analytics** (drag a dimension: team × category × week).
- **Data retention & GDPR-style controls**: export-my-data and delete-my-data workflows (audit-safe).

## Engineering
- **E2E tests** with Playwright for the critical flows (save call → leader dashboard → dispute → audit).
- **Component library upgrade** to shadcn/ui-style primitives once the design system stabilizes; storybook for the design tokens.
- **Offline-first with service worker** so the app works fully offline and syncs when back online.

## Suggested sequencing
1. Server auth + Firestore rules (security) — 1 sprint
2. Real-time sync + transcript pipeline — 2 sprints
3. Scheduled reports — 1 sprint
4. AI insights — 2 sprints
