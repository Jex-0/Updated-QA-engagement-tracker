# UI/UX Redesign Plan

## 1. Design principles

- **Executive-ready, enterprise visual language** inspired by Power BI / Salesforce / Zendesk: calm surfaces, strong data hierarchy, restrained colour.
- **Brand consistency:** Capitec navy `#003865` as the primary, cyan `#00a3e0` as the accent, red `#e31b23` reserved for risk/danger — the palette stays on-brand while the layout modernizes.
- **Glassmorphism where it helps:** frosted top bar (`backdrop-filter: blur`), translucent surfaces, layered shadows — applied sparingly so data stays readable.
- **Type hierarchy:** Inter/Segoe UI system stack; `800` weights for KPI values, `11–13px` UI text, tabular-friendly mono for timestamps and audit logs.

## 2. Design tokens

Defined in `src/index.css` under `:root` and `[data-theme="dark"]`:

- Surfaces: `--bg`, `--surface`, `--surface-2/3`, `--border`, `--border-strong`
- Text: `--text`, `--text-muted`, `--text-faint`
- Semantic: `--primary`, `--accent`, `--success`, `--warning`, `--danger`, `--info` (each with a soft tint for badges/backgrounds)
- Charts: `--chart-grid`, `--heat-low/mid/high`
- Radii (`8/12/18px`) and three shadow elevations; dark mode flips all tokens with zero component changes.

## 3. Components & patterns

| Pattern | Implementation |
|---|---|
| Navigation | Fixed sidebar (collapses to an overlay drawer < 900 px), role-filtered items, user chip |
| Cards | Rounded-18px surfaces, subtle border + shadow, header/actions slot |
| Data | `StatCard`, score ring (conic gradient), badges, tables with hover states |
| Feedback | Toast stack (success/error/info), inline empty states with icons, skeleton loaders |
| Forms | Focus rings in accent colour, consistent field/hint/error layout |
| Charts | Dependency-free SVG: line+area with 7-call rolling average, sparklines, heatmap, bar lists |
| Motion | 150–250 ms micro-transitions, `prefers-reduced-motion` honoured |

## 4. Page wireframes

### Agent — My Tracker
```
┌──────────────────────────────┬──────────────────────┐
│ Warm note                    │  Live speech card     │
│ [Progress bar  score ]       │  [▶ Start listening]  │
│ ┌ checklist item ✓ ────────┐ │  transcript box       │
│ ┌ checklist item ──────────┐ │ ─────────────────────│
│ Pulse adoption  Notes      │ │  Remaining steps      │
│ [Save] [Dropped] [History] │ │  (coaching focus)     │
└──────────────────────────────┴──────────────────────┘
```

### Leader — Team Dashboard
```
[Daily|Weekly|Monthly] [range] [team]        [Export report]
[Agents] [Active] [Avg score] [Compliance]
┌ Performance trend ────────────┐ ┌ Leaderboard ──────┐
│ line chart + 7-avg            │ │ 1. agent  92%     │
└───────────────────────────────┘ │ 2. agent  88%     │
┌ Team comparison (bars) ───────┐ └───────────────────┘
┌ Agent × day heatmap ──────────┐
┌ Agent overview table (trend, coaching, reviewed) ───┐
```

### Engagement detail
```
[back]                    [review] [dispute] [correct] [archive] [delete]
Agent name  badges          Score ring (conic)
[Quality] [Compliance] [Pulse] [Agent avg] mini-stats
┌ Timeline ────────────┐ ┌ AI insights ────────────┐
│ 00:00:22 ● Greeting  │ │ Strengths / Improvements│
│ 00:03:15 ● Empathy   │ │ Coaching recommendations│
│ 00:07:42 ● Compliance│ │ Historical comparison   │
│ search + filter      │ │ Coaching history        │
└──────────────────────┘ │ Transcript              │
                         └─────────────────────────┘
```

### Manager console
```
[Engagements | Disputes (n) | Audit log]
Engagements: filters + table (view / archive / restore / delete)
Disputes:    status cards → resolve modal (approve+adjust | reject)
Audit log:   time · actor · action · entity · old → new
```

## 5. Accessibility

- Visible `:focus-visible` rings, `aria-label`s on icon buttons, `role=tablist/tab`, `aria-live` toast region, semantic tables with `<th scope>`.
- Contrast ratios meet AA on both themes; interactive targets ≥ 34 px.

## 6. Responsive behaviour

- `< 1180px`: 4-col KPI grid → 2-col, detail grids stack.
- `< 900px`: sidebar becomes drawer, auth becomes single column, brand panel hides.
- `< 640px`: single-column everything, compact paddings.
