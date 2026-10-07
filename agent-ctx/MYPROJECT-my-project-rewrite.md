# MYPROJECT — My Project Module Rewrite

**Task ID:** MYPROJECT
**Agent:** Lead Architect (main)
**File:** `src/components/modules/my-project.tsx` (completely overwritten)

## Reference Design Goal
Replicate the dashboard-style split-screen architecture from the uploaded reference image:
- LEFT (~70%): 4 KPI cards + filter bar + project table + 3 widget cards
- RIGHT (~30%): Sticky project detail panel with hero banner + metadata + mini KPIs + tabs

## What Was Built

### Layout (2-column split)
- `grid-cols-1 lg:grid-cols-[1fr_360px]` — responsive, collapses to single column on mobile
- Sticky right panel: `sticky top-14` with `max-h-[calc(100vh-7rem)] overflow-y-auto`
- Glass cards throughout using existing `.glass`, `.glass-subtle`, `.glass-shimmer` classes from `globals.css`

### LEFT COLUMN (3 sections)

**1. 4 KPI Cards Row** (`grid-cols-2 md:grid-cols-4`)
- Total Projects (count from `flattenProjects(tree).length`)
- Data Completion % (from `kpis.completion`)
- Current Emissions (from `kpis.totalEmissions`, trend derived from monthly trend last-vs-prev)
- Open Issues (`kpis.openExceptions + kpis.corrections`)
- Each card: icon tile + label + value + trend pill, `maxHeight: 100`

**2. Filter Bar** (`glass-subtle rounded-2xl`)
- Search input (filters by name, code, location)
- Status filter dropdown (All / Active / Inactive / On Hold / Completed)
- "Add Project" button → navigates to admin module

**3. Project Table** (`glass rounded-[20px]`)
- Columns: Project Name (icon + name + location), Code (monospace), Status (pill), ESG Completion (progress bar), Period, Actions (View/Edit icons)
- Dense rows (44px height), clickable, selected row highlighted
- Completion per project computed from `/api/submissions?take=200` (grouped by projectId → max completionPct)

**4. 3 Widget Cards Row** (`grid-cols-1 md:grid-cols-3`)
- **Project ESG Progress**: recharts BarChart with 5 colored bars (Energy/Water/Waste/Safety/Workforce)
- **Submission Status**: recharts PieChart donut (Approved/Draft/Pending) with center %
- **Upcoming Deadlines**: list of next 3 reporting periods with completion % + status pill

### RIGHT COLUMN (Sticky Project Detail Panel)

**Hero gradient banner** (`h-20`, sky-blue gradient `from-sky-400 via-sky-500 to-blue-600`)
- Project name overlaid (bottom-left, white text with drop-shadow)
- BU name (top-left, white/80)
- Status pill (top-right)

**Metadata grid** (`grid-cols-2`)
- Code (monospace), Location, Business Unit, Subsidiary

**Mini KPI row** (`grid-cols-3`)
- Emissions (`kpis.totalEmissions`), Energy (`kpis.energyGJ`), Water (`kpis.waterWithdrawalKL`)
- Each: small icon tile + label + bold value

**Tabs** (Overview | ESG | Activity | Team | Docs)
- Overview: project info grid + 3 mini tiles + recent submissions
- ESG Progress: bar chart + per-module progress bars
- Activity: last 5 project-scoped activities with avatar + title + time-ago
- Team: 6 seeded MEIL team member mini-cards (avatars, roles, active pills)
- Documents: evidence list (project-scoped) with file icon + status pill

**Project change behavior**
- Parent passes `key={selectedProject?.id ?? 'none'}` to force remount on project change → tab state resets to "overview" automatically (avoids setState-in-effect lint error)

### APIs Called
- `GET /api/overview` → kpis, periods, trends, activities
- `GET /api/organization/tree` → groups → subsidiaries → BUs → projects (flattened)
- `GET /api/activity?take=5` → global recent activities (fallback for Activity tab)
- `GET /api/submissions?take=200` → all submissions (for project completion + submission status donut + ESG progress)
- `GET /api/activity?projectId={id}&take=5` → project-scoped activities (Activity tab)
- `GET /api/submissions?projectId={id}` → project-scoped submissions (Overview tab + ESG Progress tab)
- `GET /api/evidence?projectId={id}` → project-scoped evidence (Documents tab)

### States
- **Loading**: `MyProjectSkeleton` with animated pulse placeholders matching the final layout
- **Error**: `ErrorState` with AlertOctagon icon + Retry button
- **Empty**: `EmptyState` with Building2 icon + message
- **No project selected**: ProjectDetailPanel renders "No project selected" empty state

## Premium Styling
- `text-slate-900` for headings, `text-slate-700` for body (darker, more readable)
- 16-20px border radius (`rounded-2xl` for inner, `rounded-[20px]` for premium cards)
- Enhanced shadows from `.glass` class (soft sky-blue shadow stack)
- framer-motion staggered entrance (delay: 0.05 → 0.30s for the 4 KPI cards and widgets)
- `tabular-nums` for all numeric KPI values
- `scroll-elegant` for scrollable areas

## TypeScript Strict Compliance
- All API responses typed with strict interfaces (`OverviewData`, `OrgTree`, `ActivityItem`, `SubmissionItem`, `EvidenceItem`)
- No implicit `any` (eslint config has `no-explicit-any: off` so explicit `any` would be OK, but none used)
- `LucideIcon` type for icon props
- `React.CSSProperties` for tooltip style constant
- Proper `as const` for cubic-bezier easing

## Lint Rule Fixes Applied
1. **`react-hooks/set-state-in-effect`** at line 776 (setTab in useEffect when project changes):
   - Removed the `useEffect` that called `setTab('overview')` synchronously
   - Replaced with `key={selectedProject?.id ?? 'none'}` on `<ProjectDetailPanel>` from parent → React remounts the component on project change → `useState('overview')` initializes fresh

2. **`react-hooks/set-state-in-effect`** at line 1260 (setProjectActivity([]) in early return):
   - Removed the synchronous `setState` calls in the `if (!selectedProjectId)` early-return branch
   - Now just `if (!selectedProjectId) return` — previous project-scoped state remains, but the right panel's "No project selected" empty state takes over rendering when `selectedProject` is null

## Verification
- `cd /home/z/my-project && bun run lint 2>&1 | tail -10` → **clean** (exit 0, no errors)
- `cd /home/z/my-project && bunx tsc --noEmit 2>&1 | grep "my-project" | head -5` → **clean** (no type errors)
- Dev server log shows successful API calls: `GET /api/overview 200 in 95ms`, plus organization/tree, activity, submissions, evidence queries all running (no errors)
- No console errors

## File Stats
- 1,440 lines total (vs 735 in previous version — doubled due to richer tab content, 3 widget charts, expanded metadata)
- 26 functions: 7 helpers + 9 sub-components + 3 tab bodies + 3 state components + 1 main export
- All real data — no hardcoded KPI numbers (only seeded team list reused from existing convention)
