# GoldGuard AI — Build Plan (v2, expanded)

Frontend-only gold loan inspection & fraud prevention platform. Visual direction: **Liquid Aurum Spatial UI** (chosen).

## UI Mandate (read first)

Design like **Apple Wallet / Apple Health / Apple Vision Pro / a premium private-banking terminal**. NOT like ChatGPT, Notion, Linear, or a generic SaaS admin. This means:

- Layered frosted glass surfaces on a warm cream canvas (`#FAFAF8`), not flat white cards on a gray app shell.
- Floating, detached panels with soft drop shadows and 20–28px radii. No edge-to-edge rectangles.
- Hero numerics in large display weights (Wallet-style amount typography); secondary data in small mono-ish labels with wide tracking.
- Gold (#D4AF37) used as a precious accent — hairlines, single chips, gauge fills — never as broad fills.
- Micro-interactions: gentle lift on hover, gauge fill-in, soft blur transitions, no bouncy SaaS animations.
- Every screen has at least one "hero card" (gauge, balance, score) treated like a physical object, not a data row.

## Tech

TanStack Start + TS + Tailwind v4 + shadcn/ui. State: Zustand. Charts: Recharts. Forms: RHF + Zod. Toasts: sonner. All data in-memory mock.

## Design Tokens (src/styles.css)

`@theme` tokens for gold, cream, surface, accent, text, success, warning, risk. Map shadcn `--background/--primary/...` via `@theme inline`. Load **Public Sans** + **Instrument Serif** (for hero numerics, Wallet feel) via `<link>` in `__root.tsx`. Shared `.glass` utility.

## Routes (src/routes/)

```
__root.tsx                 Shell + floating sidebar + Toaster
index.tsx                  Operator Dashboard
manager.tsx                Branch Manager Dashboard          [USP #2]
inspection.new.tsx         Guided 8-step workflow
inspection.$id.tsx         Tabs: Results | Risk | Replay | Loan Decision | Evidence Vault | Audit Trail
escalations.tsx            Case Escalation Workflow          [USP #7]
history.tsx                Inspection History
analytics.tsx              Analytics Center + Fraud Heat Map [USP #4]
employees.tsx              Employee Productivity Analytics   [USP #3]
portfolio.tsx              Gold Portfolio View               [USP #9]
branches.tsx               Multi-Branch Monitoring
reports.tsx                Reports Center + Executive Summary[USP #6]
notifications.tsx          Notification Center
profile.tsx                Profile
settings.tsx               Settings
```

## Sidebar Sections (grouped, Wallet-style)

- **Operations**: Dashboard, New Inspection, History, Escalations
- **Management**: Manager View, Branches, Employees, Portfolio
- **Insights**: Analytics, Reports, Notifications
- **Account**: Profile, Settings
- Bottom pill: Online/Offline toggle + sync badge.

## Mock Data Seeds (src/lib/mock-data.ts)

- 4 branches: Nashik, Pune, Mumbai, Aurangabad — with KPIs, today's gold value, gold processed kg, avg purity, risk score.
- 8 employees (appraisers) with inspection counts, flagged counts, accuracy, branch.
- 80 inspections across 90 days with: customer, jewelry type, purity, weight, dimensions, 5 angle images + reflection + touchstone slots, scores, risk factors, status, branch, appraiser, audit events, loan decision.
- 12 escalation cases with status (Suspicious → Escalated → Manager Review → Final Decision).
- 12 notifications, 8 reports incl. monthly Executive Summary.
- Audit event log per inspection.

## Section Implementations

### 1. Operator Dashboard (`/`)
7 KPI glass tiles, branch performance bars, fraud-trend line, status donut, recent inspections table (sortable, header-search filtered), date-range filter, working "Export CSV" download.

### 2. Branch Manager Dashboard (`/manager`)  [USP #2]
Distinct hero layout — Apple Health style. Hero card: **Branch Risk Score** ring gauge with today's headline. KPI strip: Today's Inspections, Pending Reviews, Fraud Cases, Employee Performance index, Branch Risk Score. Mini Top-Appraisers list + Today's Escalations + Fraud-by-hour sparkline. Branch selector chip.

### 3. Guided Inspection (8 steps)
Stepper pills. Each step glass card; image tiles use FileReader (preview / replace / remove / status). Live **Inspection Quality Score** floating panel (image quality, lighting, focus, angle coverage, missing requirements). Step 8 review → submit → store + navigate to inspection detail. Drafts persisted to store; restore on revisit. Every action appends to that inspection's **audit trail** (10:01 Created, 10:05 Weight entered, …).

### 4. Inspection Detail (`/inspection/$id`) — Tabbed
- **Results**: Radial authenticity gauge, risk score, confidence, approval-readiness, category chip.
- **Explainable Risk**: 5 factor rows (Density / Surface / Reflection / Touchstone / Visual Defect) with score, bar, impact %.
- **Replay**: Vertical step timeline w/ images + measurements + notes + Prev/Next.
- **Loan Decision Center**  [USP #1] — Hero "loan recommendation" card (Wallet-style): Authenticity %, Recommended LTV %, **Suggested Loan Amount ₹** (large Instrument Serif display), Risk Level chip, Recommended Action button (Approve / Hold / Reject). Editable LTV slider recomputes amount. Actions: Approve / Send to Manager (creates escalation) / Reject.
- **Evidence Vault**  [USP #8] — Single tile grouping all artifacts: angle images, reflection, touchstone, weight & dimensions, notes, timeline snapshot, generated report PDF placeholder, audit log. "Download Vault" → ZIP-named CSV bundle simulation.
- **Audit Trail**  [USP #5] — Chronological event list with timestamp, actor, action, before/after diff where relevant. Filter by actor/action.
- **AI Readiness Layer**  [USP #10] — Subtle inline section on Results tab: "AI Analysis Engine — Awaiting Backend" placeholder cards for Computer Vision Score, Reflection Analysis Score, Density Analysis Score (greyed glass with "Coming from Backend" badges, but values shown as preview).

### 5. Escalations (`/escalations`)  [USP #7]
Kanban: **Suspicious → Escalated → Manager Review → Final Decision**. Cards draggable across columns (simple click-to-advance fallback). Each card opens inspection detail. Manager Review column gates an "Approve / Reject with note" action — writes to audit trail + notification.

### 6. History (`/history`)
Search, status multi-select, date range, jewelry-type filter, sortable columns, pagination 10/page, row → detail, CSV export.

### 7. Analytics (`/analytics`)
Recharts: fraud trend, risk distribution, jewelry categories, monthly inspections, branch performance, approval trends. Date-range + branch filter affect all.
**Fraud Heat Map**  [USP #4] — Stylized India map block with the 4 branch cities as glowing dots sized/colored by fraud rate; hover popover with stats. Implemented as SVG with positioned hotspots (no map library).

### 8. Employees (`/employees`)  [USP #3]
Leaderboard of appraisers (avatar, name, branch, inspections, flagged, accuracy %, trend sparkline). Sort + branch filter. Click → drawer with per-employee chart & recent inspections.

### 9. Portfolio (`/portfolio`)  [USP #9]
Wallet-card hero: **Today's Total Gold Value ₹1.2 Cr** with subtle shimmering gold gradient. Sub-cards: Gold Processed (kg), Average Purity, Active Loans Value. Branch breakdown table + 30-day value sparkline.

### 10. Branches (`/branches`)
4 branch glass cards (KPIs + risk ring) + multi-select comparison chart.

### 11. Reports (`/reports`)
Cards grid, search, type filter, preview Dialog, Download (CSV), Print (`window.print()` on a print-friendly route).
**Executive Summary Report**  [USP #6] — Featured "Monthly Fraud Summary" card → opens full-screen boardroom report view: Total Inspections, Fraud Rate, High-Risk Cases, Branch Ranking, top fraud patterns, exec sign-off block. Print-optimized.

### 12. Notifications
Filterable list, mark read/unread, delete, mark-all-read, header bell popover preview.

### 13. Offline Mode
Sidebar toggle; offline shows banner, pending-sync count, drafts list. "Sync Now" simulated with progress.

### 14. Profile & Settings
Editable profile, avatar upload, designation, branch, prefs. Settings: language, density, default branch, report format, notification channels.

## Shared Components (src/components/)

`app-sidebar`, `app-header`, `glass-card`, `wallet-card` (hero numeric card), `kpi-tile`, `radial-gauge`, `risk-factor-bar`, `image-upload-tile`, `step-indicator`, `data-table` (sort/search/paginate), `notification-bell`, `branch-card`, `audit-trail`, `loan-decision-card`, `evidence-vault`, `escalation-kanban`, `fraud-heatmap`, `employee-leaderboard`, `executive-summary`, `ai-readiness-panel`.

## State (src/stores/app-store.ts)

Zustand: `inspections`, `addInspection`, `updateInspection`, `appendAuditEvent`, `escalations`, `advanceEscalation`, `notifications`, `markRead/delete`, `branches`, `employees`, `profile`, `settings`, `mode`, `drafts`, `saveDraft`, `syncDrafts`, `decideLoan(id, decision)`.

## Quality Bar

- Every filter/search/sort/pagination wired to real state.
- Every button = real action or sonner toast (no dead UI).
- Responsive: sidebar collapses to bottom tab bar < md.
- Realistic Indian gold-loan domain copy throughout.
- Replace `index.tsx` placeholder entirely.

## Out of Scope

No backend, no auth, no real AI — scoring is deterministic pseudo-random per inspection ID. AI Readiness panels are explicitly labeled placeholders.
