# Task 2 — ExecutiveDashboard (EXECUTIVE / SUPER_ADMIN)

**Agent**: UI builder (amber/gold premium theme)
**File**: `src/components/dashboard/executive-dashboard.tsx` (~560 lines)
**Exports**: `ExecutiveDashboard` (named + default), client component

## What was built

A UNIQUE premium C-suite briefing dashboard with an **amber/gold color theme** (NOT sky-blue, NOT indigo, NOT slate). Distinct visual identity from `OverviewDashboard` and `SiteUserOverview`.

### Layout
1. **Top header strip** — Crown icon tile + "Executive Briefing" title + Live pill + Refresh button (warm amber-bordered).
2. **Hero section (~180px)** — 120px SVG radial gauge with amber→gold gradient stroke (`#fbbf24` → `#f59e0b` → `#d4a017`), animated `strokeDasharray` via framer-motion, drop-shadow glow. Center overlay shows composite ESG score (28px black) + letter grade in amber pill. Right side: "Composite ESG Score" tag + grade label (Award icon) + one-line executive summary ("ESG performance is B+ with X% BRSR readiness · Y% reporting completion · Z open exceptions") + supporting stats line (groups/projects/submissions/renewable/water).
3. **2×4 compact KPI grid** (each card max 118px tall) — 8 cards: Emissions, Energy, Water, Waste Rec., Workforce, Safety · LTIFR, BRSR Ready, Completion. Each card: 28px amber-gradient icon tile + 10px label + 20px bold value + 9px trend pill. **No sparklines** — clean executive style. Trend pills: real MoM deltas (from `overview.trends`) for Emissions/Energy/Water/Waste with good/bad color logic based on ESG direction; status words (Strong / On Track / Watch / At Risk / Complete) for Workforce/Safety/BRSR/Completion.
4. **Bottom split (50/50)**
   - **Left**: `recharts RadialBarChart` with 8 amber/gold shaded bars (one per ESG dimension: BRSR, Completion, Water, Waste, Renewables, Diversity, Safety, Data Quality) + center composite score overlay + right-side legend with color dot, name, and value.
   - **Right**: Top 3 AI Insights (from `GET /api/insights`), numbered 1–3 in amber-gradient badges, severity icons (TrendingUp / AlertTriangle / AlertOctagon), title, insight text, action line with chevron.

### Data sources (real, no hardcode)
- `GET /api/overview` → `kpis` (8 ESG dimensions, workforce, safety, submissions, exceptions) + `trends` for MoM deltas.
- `GET /api/insights` → LLM-generated insights array (`{ title, severity, category, insight, action }[]`).

### ESG composite score formula
Identical to `OverviewDashboard`:
```
dims = [
  brsrReadiness, completion, waterRecycledShare, wasteRecycledShare,
  renewableShare, min(femaleShare*2,100), max(0,100-ltifr*20), max(0,100-openExceptions*5)
]
esgScore = round(sum(dims) / 8)
```
Letter grade: A+ ≥90, A ≥80, B+ ≥70, B ≥60, C ≥50, else D.

### Visual identity (amber/gold premium)
- Surfaces: warm cream gradients `rgba(255,251,235,..)` → `rgba(254,243,199,..)` → `rgba(251,191,36,..)`
- Borders: `border-amber-200/60`
- Accent tiles: `bg-gradient-to-br from-amber-400 to-amber-600 text-white`
- Ink: `text-amber-950` for headings/values, `text-amber-700/80` for secondary text
- Shadows: `rgba(180,83,9,..)` warm-toned
- Decorative warm orbs (amber-300 / yellow-200 blurred) in the hero
- 8-color amber/gold palette for the radial breakdown: `#f59e0b #d97706 #fbbf24 #f97316 #eab308 #ca8a04 #fcd34d #b45309`

### UX
- framer-motion staggered entrance on KPI cards (`delay: 0.05 * i`) and insight rows (`delay: 0.2 + i*0.08`).
- Hero gauge animates `strokeDasharray` over 1.1s with cubic-bezier ease; score number and grade fade/scale in after.
- Refresh button: spins `RefreshCw` while `refreshing`. Effect uses `cancelled` flag to prevent setState after unmount.
- Loading: full amber-tinted skeleton (header / hero / 8 KPI tiles / 2 split panels).
- Error: amber gradient alert tile with retry button calling `load()`.

### Rules respected
- `'use client'` at top, TypeScript strict.
- Only created `executive-dashboard.tsx` — touched no other files.
- `bun run lint` → clean (0 errors in this file; one unrelated warning in `auditor-dashboard.tsx`).
- `bunx tsc --noEmit` → clean for `executive-dashboard.tsx` (no output).
- Dev server: `✓ Compiled in 439ms` — no errors.
- Icons from lucide-react: Award, Crown, Flame, Zap, Droplet, Recycle, Users, ShieldCheck, FileCheck2, Gauge, TrendingUp, TrendingDown, Sparkles, AlertTriangle, AlertOctagon, RefreshCw, Activity, ChevronRight.

## Next step suggestion
Wire `ExecutiveDashboard` into `src/app/page.tsx` role routing for `EXECUTIVE` and `SUPER_ADMIN` users (currently they see `OverviewDashboard`). This is left to the orchestrator as it requires touching `page.tsx` (out of scope for this task).
