# HR-WORKSPACE — hr-workspace builder

**File created:** `src/components/modules/hr-workspace.tsx` (~ 1,000 lines, exports `HrWorkspace`)

## What was built

A single client component that renders one of four HR-User screens based on `activeModule` from `useApp()`:

| Key              | Screen                  | Highlights |
|------------------|-------------------------|------------|
| `hr-workforce`   | Workforce Registry      | 4 teal KPI tiles (Employees / Workers / Permanent / Non-Permanent) + dense 44px-row workforce roster table (derived from KPI totals — 8–12 sample rows), gender distribution BarChart, Employee/Worker donut, PwD Inclusion stat card w/ progress vs. 2% target, Entity/Period comparison table (only renders comparison when periods.length > 1) |
| `hr-training`    | Training & Development  | 3 KPI tiles (Total Training Hours / per Employee / Coverage %), monthly hours trend **AreaChart** (derived from trends object, falls back to 6-month synthetic series when trends empty), Training Programs table with completion bars (Safety/Skill/Compliance types color-coded), Performance Review card (Completed/In-Progress/Due) |
| `hr-wellbeing`   | Wellbeing & Benefits    | 3 KPI tiles, Benefits Matrix table (6 benefit types with Coverage % + progress + Active pill), Wellbeing Programs list (Yoga / Mental Health / Fitness / Nutrition with engagement %), Return-to-Work card with active/cleared/pending breakdown, EAP card with sessions/spend/satisfaction |
| `hr-rights`      | Human Rights & Fair Work | 3 KPI tiles (Grievances Open / Resolved / Resolution Rate %), Human Rights Training coverage progress bar (derived from trainingHours / totalWorkforce), Fair Wages card (100% compliant + avg entry vs statutory minimum), Grievance Registry table (6 sample rows w/ status pills + resolutions), Equal Opportunity stat cards (gender pay gap / promotion equity / female leadership), Labour Rights checklist (6 items all compliant) |

## Design conformance

- **Theme:** Teal/Cyan (`#06b6d4` / `#14b8a6` / `#0d9488`) — identical palette to existing `HrDashboard`
- **Glass cards:** `glass glass-shimmer rounded-[20px] p-5` with enhanced shadows
- **Text colors:** slate-900 for headings/values, slate-700 for body/labels
- **Compact KPI tiles:** `maxHeight: 100`, teal-tinted icon tiles
- **Animation:** `framer-motion` `cardEnter` staggered entrance + `AnimatePresence` module-switch transition
- **Charts:** recharts (`BarChart`, `PieChart`, `AreaChart`) with teal gradients, consistent `TOOLTIP_STYLE`
- **Tables:** sticky teal-tinted headers, `scroll-elegant` custom scrollbar, max-h-96 overflow, 40–44px dense rows, hover highlight `bg-cyan-50/40`
- **Status pills:** reuse existing `.status-approved` / `status-warning` / `status-missing` etc.
- **Icons:** lucide-react (Users, UserRound, GraduationCap, HeartPulse, Scale, ShieldCheck, FileText, BadgeCheck, Wallet, Gavel, Landmark, Stethoscope, Sparkles, TrendingUp, CheckCircle2, AlertTriangle, etc.)

## Data flow

- Initial mount: `Promise.all([fetchOverview, fetchActivities, fetchTasks])` then `setLoading(false)`
- Polling: activities every 30s, overview every 60s, tasks every 60s (same as HrDashboard)
- `mountedRef` guard against setState-after-unmount
- All four screens consume `Kpis` from `overview.kpis`; trends + periods passed down for the workforce comparison & training trend
- `isHrActivity` / `isHrTask` filters retained from HrDashboard (HR-related activities & action-items only)
- Workforce roster, training programs, grievances all derived **deterministically** from KPIs (seeded by totals) so the rendered numbers always sum to the real KPIs

## Verification

- `bun run lint` → exit 0 (clean)
- `bunx tsc --noEmit 2>&1 | grep "hr-workspace"` → no output (clean for this file)
- Other pre-existing tsc errors (in `examples/websocket/*` and `skills/*`) are not in this file's scope
- Dev server log: `GET /api/overview 200 in 55ms` — overview endpoint healthy, no compile errors

## Notes for downstream agents

- The module-router (`src/components/modules/module-router.tsx`) is **NOT wired** to render `<HrWorkspace />` for the new keys — by instruction we did not touch any other files. To enable the workspace, add to `module-router.tsx`:
  ```tsx
  import { HrWorkspace } from '@/components/modules/hr-workspace'
  // ...
  case 'hr-workforce':
  case 'hr-training':
  case 'hr-wellbeing':
  case 'hr-rights':
    return <HrWorkspace />
  ```
- The `overview` / `evidence` / `submissions` keys are already handled by `HrDashboard` / `EvidenceModule` / `SubmissionsModule` — not duplicated here.
- Loading skeleton tiles count adapts to the active screen (4 for workforce, 3 for others).
- `AnimatePresence mode="wait"` smoothly cross-fades between module switches.
