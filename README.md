# Client Engagement Tracker

Enterprise-grade QA platform for contact-centre client engagements. Agents score live calls against an 11-step Capitec rubric (with a speech-assistant that auto-detects quality phrases), team leaders get a full analytics dashboard, managers run an engagement console with disputes and a complete audit trail, and admins manage users, teams and roles.

Built with **React + TypeScript + Vite**. No runtime dependencies beyond React — icons and charts are hand-rolled SVG. Data persists in the browser (localStorage) with an optional Firebase cloud sync adapter.

## Commands

```bash
npm install        # install
npm run dev        # dev server (0.0.0.0, port from $PORT or 5173)
npm run build      # production build → dist/
npm run typecheck  # tsc -b --noEmit
```

## Quick start

1. Open the app → create the first account (becomes Administrator) or sign in as an existing user.
2. Settings (or Administration → Data & backup) → **Load sample data** to explore every dashboard instantly.
3. Use the sidebar to switch roles: My Tracker, Team Dashboard, Engagements, Manager Console, Administration, Reports, Settings.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — as-is review and target architecture
- [UI/UX plan](docs/UI-UX-PLAN.md) — design system and wireframes
- [Migration](docs/MIGRATION.md) — legacy app (kept in `legacy/`) and data migration
- [Roadmap](docs/ROADMAP.md) — recommended next steps (server auth, scheduled reports, AI insights)
