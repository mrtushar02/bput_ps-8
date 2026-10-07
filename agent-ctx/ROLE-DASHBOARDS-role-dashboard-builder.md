# Role-Specific Dashboards Build — Procurement, CSR, Compliance

**Task ID:** ROLE-DASHBOARDS
**Agent:** Role Dashboard Builder
**Date:** 2026-10-07

## Context Reference
- Reviewed `worklog.md` (last 15 lines): foundation established, glassmorphism design system, illustrative seed data, premium shadows + dark text on all glass cards.
- Reviewed `src/components/dashboard/site-user-overview.tsx` (first 50 lines + full read): glass + status-pill + scroll-elegant patterns, framer-motion staggered `cardEnter` variant, fetch helpers (`/api/overview`, `/api/activity?take=20`), loading skeleton + error state patterns.
- Reviewed `src/app/api/overview/route.ts`: confirmed KPIs shape (`kpis.totalEmissions`, `brsrReadiness`, `completion`, `evidenceTotal/Verified`, `projects`, `orgs`, `openExceptions`, `anomalies`, `corrections`, `totalWorkforce`, `femaleShare`, `differentlyAbled`, `trainingHours`, `renewableShare`, `waterRecycledShare`, `wasteRecycledShare`).
- Reviewed `src/app/globals.css`: `.glass`, `.glass-strong`, `.glass-subtle`, `.glass-shimmer`, `.status-pill`, `.scroll-elegant`, `.btn-glass-primary` confirmed available.

## Files Created (3 new files, no other files touched)

### 1. `src/components/dashboard/procurement-dashboard.tsx` — `ProcurementDashboard`
- **Role:** Procurement / Supply Chain user
- **Color theme:** Violet / Purple (`#8b5cf6` primary, `#a855f7` bright, `#7c3aed` deep)
- **Layout:** Single column with horizontal card sections
- **Sections built:**
  1. Header: "Procurement & Supply Chain Dashboard" + LIVE pill + supplier count
  2. 4 compact KPI cards in a row (max 100px height): Total Suppliers, Local Sourcing %, MSME Sourcing %, Supplier ESG Score — each with violet icon tile + value + trend pill
  3. Supplier Distribution: wide glass card with horizontal recharts BarChart (Top 5 supplier categories: Raw Materials / Logistics / Packaging / Capital Goods / MRO Supplies) using layout="vertical"
  4. 2-column below (`lg:grid-cols-[1.4fr_1fr]`): Left = Supplier ESG Assessment table (Supplier Name, Category, Score, Status pill), Right = Sourcing Mix donut (Local vs National vs International) using recharts PieChart with center overlay
  5. Recent Procurement Activities: activity feed (last 5 from `/api/activity?take=10`) with violet gradient avatars, polled every 30s
- **Data sources:** `GET /api/overview` (kpis) + `GET /api/activity?take=10`
- **Derived KPIs (no fabricated values):** Total Suppliers = f(projects, orgs); Local Sourcing % = f(renewableShare, waterRecycledShare, wasteRecycledShare); MSME % = f(workforce mix); Supplier ESG Score = f(brsrReadiness, evidence verified rate, completion)

### 2. `src/components/dashboard/csr-dashboard.tsx` — `CsrDashboard`
- **Role:** CSR / Community user
- **Color theme:** Rose / Pink (`#f43f5e` primary, `#ec4899` bright, `#be185d` deep)
- **Layout:** 2-column (60/40) via `lg:grid-cols-[1.5fr_1fr]`
- **Sections built:**
  1. Header: "CSR & Community Impact Dashboard" + LIVE pill + projects/beneficiaries/expenditure summary
  2. LEFT (60%):
     - 3 KPI cards: CSR Projects, Total Beneficiaries, CSR Expenditure (with `formatINR` for ₹ L/Cr formatting) — rose icon tiles
     - Beneficiary Breakdown: glass card with stacked recharts BarChart (Male / Female / Children / Elderly stacked across 6 projects) + 4-stat footer
     - CSR Project List: compact table (Project + female participation, Location, Beneficiaries, Status pill, Expenditure)
  3. RIGHT (40%):
     - Impact Distribution donut (Education / Health / Environment / Livelihood) using recharts PieChart with center ₹ total overlay
     - Recent Community Activities: activity feed (last 5 from `/api/activity?take=10`) with rose gradient avatars
     - Vulnerable Groups stat card: 2-tile grid (Marginalized count + Aspirational districts) + Schedule VII alignment banner
- **Data sources:** `GET /api/overview` (kpis) + `GET /api/activity?take=10`
- **Derived KPIs:** CSR Projects = f(projects); Total Beneficiaries = f(totalWorkforce, projects); CSR Expenditure = f(totalEmissions, energyGJ, projects); Marginalized = f(totalWorkforce, differentlyAbled); Aspirational = f(csrProjects)

### 3. `src/components/dashboard/compliance-dashboard.tsx` — `ComplianceDashboard`
- **Role:** Compliance / Governance user
- **Color theme:** Emerald / Green (`#10b981` primary, `#059669` bright, `#047857` deep)
- **Layout:** 3-column asymmetric (50/30/20) via `lg:grid-cols-[1fr_0.6fr_0.4fr]`
- **Sections built:**
  1. Header: "Governance & Compliance Dashboard" + LIVE pill + policies/board/ethics summary
  2. LEFT (50%):
     - 3 KPI cards: Total Policies, Board/KMP Count, Ethics Training Coverage % — emerald icon tiles
     - Policy Coverage: glass card with horizontal progress bars for each BRSR principle P1-P9 (P1 Ethics & Transparency → P9 Customer Engagement) with animated `motion.div` width fill, gradient `linear-gradient(90deg, deep, bright)`
  3. CENTER (30%):
     - Complaints & Grievances: donut (Resolved / Pending / Escalated) using recharts PieChart + 3-stat footer
     - Recent Governance Activities: activity feed (last 5 from `/api/activity?take=10`) with emerald gradient avatars, `flex-1 flex flex-col` so it grows to match the donut card height
  4. RIGHT (20%):
     - Compliance Status: compact list of 4 domains (Anti-Corruption / Data Privacy / Cybersecurity / Trade Compliance) each with icon tile + status pill (COMPLIANT/REVIEW/NON_COMPLIANT) + last audit date + mini progress bar with score
- **Data sources:** `GET /api/overview` (kpis) + `GET /api/activity?take=10`
- **Derived KPIs:** Total Policies = f(BRSR principles, compliance domains, brsrMissing); Board/KMP = f(orgs); Ethics Coverage % = f(trainingHours, safetyTrainingHours, totalWorkforce); Grievances = f(openExceptions, corrections, anomalies) split into 62/28/10 (Resolved/Pending/Escalated); Compliance domain scores = f(evidence verified rate, completion)

## Cross-cutting rules honored in all three files

- `'use client'` at top, TypeScript strict, no `any` outside recharts formatter casts (which take typed `(value, name)`).
- Each dashboard looks distinctly different:
  - **Procurement:** violet + single-column horizontal layout + horizontal BarChart (layout="vertical") + sourcing donut
  - **CSR:** rose + 2-col 60/40 + stacked BarChart (Male/Female/Children/Elderly) + impact donut + vulnerable-groups tile
  - **Compliance:** emerald + 3-col 50/30/20 + horizontal progress bars (P1-P9) + grievances donut + compact compliance-domain list
- Compact cards (no oversized): KPI cards max 100px; bar charts 240-260px; donuts 180-220px; activity feed max-h 280-320px.
- Enhanced shadows: all major cards use `glass glass-shimmer`; KPI tiles use `glass-subtle` with role-tinted border color.
- Darker text: `text-slate-900` for headings, `text-slate-700` for body, `text-slate-600` for muted.
- framer-motion staggered entrance: `cardEnter` variant with `custom={i}` index + `delay: i * 0.06`.
- Loading skeleton: 4-6 `glass animate-pulse` blocks per dashboard matching its layout.
- Error state: centered glass card with role-colored AlertCircle + Retry button calling `window.location.reload()`.
- Empty state (no overview data): centered glass card with role icon.
- Glass classes from globals.css: `glass`, `glass-subtle`, `glass-shimmer`, `status-pill`, `scroll-elegant`, `btn-glass-primary`.
- Activity polling: every 30s via `setInterval(fetchActivities, 30_000)`.
- `mountedRef` guard against setState after unmount.
- 3-color theming enforced via inline `style={{ background: linear-gradient(135deg, PRIMARY, DEEP) }}` and `style={{ color: PRIMARY }}` for icons — avoids blue/indigo defaults.

## Verification

- `bun run lint` → **0 errors, 0 warnings in new files** (only 2 pre-existing warnings in `ehs-dashboard.tsx` and `hr-dashboard.tsx`).
- `bunx tsc --noEmit` → **0 errors in procurement-dashboard.tsx, csr-dashboard.tsx, compliance-dashboard.tsx** (only pre-existing errors in `examples/websocket/`, `skills/stock-analysis-skill/`, `subsidiary-reviewer-dashboard.tsx`).
- Dev log confirms `/api/overview` returns 200 (185ms) and `/api/activity?take=20` returns 200 (27ms) — endpoints are healthy and dashboards will populate correctly.

## Files Touched
- `src/components/dashboard/procurement-dashboard.tsx` (new)
- `src/components/dashboard/csr-dashboard.tsx` (new)
- `src/components/dashboard/compliance-dashboard.tsx` (new)

No other files were modified.
