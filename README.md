# Client Engagement Tracker

Enterprise-grade QA platform for contact-centre client engagements. Agents capture live calls against the Capitec rubric — the **speech assistant auto-detects quality phrases and stamps the exact time each phrase was said** (`00:00:22 Greeting detected`, `00:03:15 Empathy statement detected`, …). Team leaders get a full analytics dashboard, **managers run an engagement console with a team-leader overview, a fully editable phrases & categories editor, disputes and a complete audit trail**, and admins manage users, teams and roles.

Built with **React + TypeScript + Vite**. No runtime dependencies beyond React — icons and charts are hand-rolled SVG. Data persists in the browser (localStorage) with an optional Firebase cloud sync adapter.

## Key features

- **Timestamped engagement timeline** — every captured phrase records the second it was said; the engagement details page shows a searchable, filterable, colour-coded timeline (speech vs manual capture, chosen variations, missed coaching opportunities).
- **Manager-controlled manual ticking** — manual tick is **off by default** (speech capture only). Managers re-enable it with one click for everyone; when on, agents tap a phrase and pick which variation was actually said from a dropdown — the box still ticks and the variation is recorded.
- **Editable checklist** — managers add, edit, rename and delete **categories and phrases**, including speech keywords and acceptable alternative phrasings. Every change is audited.
- **Team-leader overview** — managers see per-leader stats: agents, engagements, average score, compliance, pulse adoption and 7-day trend, plus a comparison chart.
- **Manager console** — engagement management (correct/archive/restore/delete), full dispute workflow with score adjustment, and a complete audit log.
- **Role-based access** — Agent, Team Leader, Manager, Administrator; light/dark themes; CSV + print-to-PDF reports.

## Commands

```bash
npm install        # install
npm run dev        # dev server (0.0.0.0, port from $PORT or 5173)
npm run build      # production build → dist/
npm run typecheck  # tsc -b --noEmit
npm test           # unit tests (vitest)
npm run test:watch # unit tests in watch mode
npm run test:coverage # unit tests + coverage report for src/lib
```

## Quick start

1. Open the app → create the first account (becomes Administrator) or sign in as an existing user.
2. Settings (or Administration → Data & backup) → **Load sample data** to explore every dashboard instantly.
3. Sign in as a **manager/admin** → Manager Console:
   - **Team leaders** — overview of leader stats.
   - **Phrases** — edit the checklist (categories, phrases, speech keywords, alternative phrasings) and toggle **manual ticking** for everyone.
4. Sign in as an **agent** → My Tracker: start the speech assistant and watch phrases tick automatically with timestamps. If your manager has enabled manual ticking, tap a phrase to pick the variation that was said.

## Deployment (GitHub Pages)

The app is a Vite build, so GitHub cannot serve it from the source files — it must be built first. `.github/workflows/deploy-pages.yml` builds `dist/` and publishes it on every push to `main`. Enable it once in **Settings → Pages → Build and deployment → Source: GitHub Actions**; the live URL is then `https://<owner>.github.io/<repo>/`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — as-is review and target architecture
- [UI/UX plan](docs/UI-UX-PLAN.md) — design system and wireframes
- [Migration](docs/MIGRATION.md) — legacy app (kept in `legacy/`) and data migration
- [Roadmap](docs/ROADMAP.md) — recommended next steps (server auth, scheduled reports, AI insights)
