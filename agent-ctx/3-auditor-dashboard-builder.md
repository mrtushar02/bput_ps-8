# Task ID 3 — Auditor Dashboard Builder

**Agent:** Auditor Dashboard Builder
**Task:** Build `src/components/dashboard/auditor-dashboard.tsx` — a premium slate/steel assurance console for the AUDITOR role.

## Context absorbed

Read `/home/z/my-project/worklog.md` (last 20 lines) + `src/components/dashboard/site-user-overview.tsx` + `src/components/modules/audit.tsx` (actionPill helper) + `prisma/schema.prisma` (EmissionFactor / Evidence / ValidationResult / AuditLog models) + `prisma/seed.ts` (factor inventory) + API routes:
- `GET /api/overview` → returns `kpis` (evidenceTotal, evidenceVerified, openExceptions, completion, totalSubs, projects, sources.* counts) + `sources` object with per-table counts
- `GET /api/audit?take=20` → returns `items[]` with `id, actorId, actorName, actorRole, actorEmail, actorRoles[], action, entityType, entityId, oldState, newState, reason, metadata, ipAddress, createdAt`
- `GET /api/evidence?take=200` → returns `items[]` with `status` (REQUIRED | UPLOADED | UNDER_REVIEW | VERIFIED | REJECTED | EXPIRED)
- `GET /api/submissions?take=50` → returns `items[]` with `validationErrors`, `validationPassed`, `module`, `project`, `reportingPeriod`

Action-type conventions from `audit.tsx`:
- `CREATE` → blue
- `SUBMIT` / `RESUBMIT` / `REVIEW` → cyan
- `VALIDATE` → violet
- `APPROVE` / `EVIDENCE_VERIFY` → emerald
- `REJECT` / `CORRECTION_REQUEST` → rose
- `LOCK` → slate

Glass classes available in `globals.css`: `.glass`, `.glass-strong`, `.glass-subtle`, `.glass-nav`, `.glass-gradient-border`, `.glass-sky`, `.status-pill` + variants (`.status-submitted`, `.status-approved`, `.status-locked`, `.status-error`, `.status-review`, `.status-warning`, `.status-verified`).

Auth context: `useApp()` returns `{ user, activeModule, setActiveModule }` with `ModuleKey` union ('overview' | 'my-project' | 'data-entry' | 'evidence' | 'submissions' | 'reports' | 'analytics' | 'audit' | 'brsr' | 'admin').

## What was built

Created only one new file: `src/components/dashboard/auditor-dashboard.tsx` (~770 lines). All other files untouched.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Page header: ShieldCheck icon + "Assurance Console" +       │
│ Live indicator + last-sync + Refresh button                  │
├─────────────────────────────────────────────────────────────┤
│ TOP STATUS BAR (4 compact stat tiles, 80px each)             │
│ [Data Completeness] [Evidence Verified]                       │
│ [Audit Trail Coverage] [Exceptions]                          │
├──────────────────────┬──────────────────────────────────────┤
│ LEFT (50%)           │ RIGHT (50%)                           │
│                      │                                       │
│ Audit Trail          │ ┌────────────────────────────────┐    │
│ Timeline            │ │ Evidence Status donut (h-32)  │    │
│ (scrollable          │ │ Verified / Pending / Rejected │    │
│  max-h-96)           │ └────────────────────────────────┘    │
│                      │ ┌────────────────────────────────┐    │
│ • CREATE blue dot   │ │ Top Exceptions                │    │
│ • SUBMIT cyan dot   │ │ severity pill + source link   │    │
│ • VALIDATE violet   │ └────────────────────────────────┘    │
│ • APPROVE emerald   │ ┌────────────────────────────────┐    │
│ • REJECT rose       │ │ Factor Version Inventory       │    │
│ • LOCK slate        │ │ Grid Electricity v1 0.716      │    │
│                      │ │ Diesel (HSD) v1 2.637         │    │
│ Each row ≤ 60px      │ │ Petrol v1, Coal v1, etc.       │    │
│                      │ └────────────────────────────────┘    │
└──────────────────────┴──────────────────────────────────────┘
```

### Key design decisions

1. **Slate/Steel premium theme** — `slate-600` (#475569) + `slate-500` (#64748b = steel-blue) + cool gray gradients via `.glass` / `.glass-subtle`. Header icon uses `from-slate-600 to-slate-800` gradient. NO sky-blue, NO amber, NO indigo as primary accents. Action-type pills retain their semantic colors per audit-log convention (blue/cyan/violet/emerald/rose/slate).

2. **4 compact stat tiles (max 80px each)** — Data Completeness % (`kpis.completion`), Evidence Verified % (`evidenceVerified/evidenceTotal`), Audit Trail Coverage % (derived: unique entityIds in audit log ÷ total source records from `overview.sources.*` + `totalSubs`), Exceptions count (`openExceptions` + sub line with anomalies + corrections).

3. **Audit Trail Timeline** — vertical timeline with gradient line (`from-slate-300 via-slate-200 to-transparent`), color-coded dots per action type, max-h-96 scroll, each row max-h-60px. Shows: action pill, actor name + role, timestamp (time + date), entity type pill, brief reason (parsed from `log.reason` or `defaultReason(action, entityType)` fallback), IP address.

4. **Evidence Status donut (h-32)** — recharts PieChart with innerRadius=36, outerRadius=56. Three slices: Verified (emerald #10b981), Pending (steel #64748b), Rejected (rose #e11d48). Center label shows verified % as large number. Right side has compact legend with counts + percentages. Falls back to /api/overview totals when /api/evidence list is shorter than total.

5. **Top Exceptions list** — derived from `/api/submissions` filtered by `validationErrors > 0`, sorted desc, top 5. Severity pill derived from count (≥5=BLOCKING, ≥2=ERROR, else WARNING). Each row has source record link to `/api/submissions/[id]` (ExternalLink icon). Empty state shows CheckCircle2 + "No open validation errors".

6. **Factor Version Inventory** — compact list of 7 seeded emission factors (Grid Electricity 0.716 kgCO2e/kWh CEA v19, Diesel 2.637 IPCC 2006, Petrol 2.296, Coal 1.9, Natural Gas 2.0, LPG 1.85, Solar PPA 0.0). Each row shows: name, scope pill (S1/S2/S3), methodology with BookOpen icon, factor value (3 decimals), unit, version badge (v1 with Hash icon). Header has global "v1" badge indicating all factors are version 1.

7. **framer-motion staggered entrance** — header (y=-8), stat tiles (y=8, staggered 0.04s apart), left column (x=-10), right column children (y=8, staggered 0.05s). Each timeline row and factor item has its own staggered delay.

8. **Real-time polling** — audit every 30s, overview every 60s, evidence every 90s. Live indicator with ping animation. Refresh button triggers all 4 fetchers.

9. **Loading skeleton + error + empty states** — DashboardSkeleton mirrors layout (header + 4 tiles + 2-col with 96/44/64/56 heights). ErrorState shows AlertOctagon + message + Retry button. EmptyState shows Database icon + "No assurance data available".

10. **lucide-react icons used** — ShieldCheck, FileSearch, Fingerprint, History, Eye, AlertTriangle, AlertOctagon, CheckCircle2, XCircle, Clock, ChevronRight, Database, Layers, Activity, RefreshCw, Lock, ScrollText, ExternalLink, Gauge, Hash, BookOpen, Cpu, Boxes.

## API contracts used

- `GET /api/overview` → `{ kpis: { completion, evidenceTotal, evidenceVerified, openExceptions, anomalies, corrections, totalSubs, approvedSubs, projects, ... }, sources: { energyRecords, waterRecords, wasteRecords, workforceRecords, safetyRecords, brsrAnswers, calculationResults }, periods: [...] }`
- `GET /api/audit?take=20` → `{ total, count, items: AuditLogItem[] }`
- `GET /api/evidence?take=200` → `{ total, count, items: EvidenceItem[] }` (for donut breakdown)
- `GET /api/submissions?take=50` → `{ total, count, items: SubmissionItem[] }` (for Top Exceptions)

## Verification

- `bun run lint` → **clean** (exit 0, 0 errors 0 warnings)
- `bunx tsc --noEmit | grep auditor-dashboard` → **clean** (no errors in this file)
- File: `src/components/dashboard/auditor-dashboard.tsx` (~770 lines)
- `'use client'` directive at top
- TypeScript strict throughout (typed all API responses, all sub-component props, action-style map)
- No other files modified — `src/app/page.tsx` not touched (Auditor role routing will be wired up by integrator agent separately)

## Note on page.tsx routing

`src/app/page.tsx` currently routes AUDITOR role to `<OverviewDashboard />` (falls into the else branch since `isSiteUser` only matches PROJECT_USER / HR_USER / EHS_USER / PROCUREMENT_USER / CSR_USER / COMPLIANCE_USER). To wire up the new AuditorDashboard, page.tsx would need:

```tsx
const isAuditor = roleKey === 'AUDITOR'
...
{isAuditor ? <AuditorDashboard /> : isSiteUser ? <SiteUserOverview /> : <OverviewDashboard />}
```

This was NOT done per the task instruction "Do NOT touch any other files."
