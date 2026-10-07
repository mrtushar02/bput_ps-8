# Task 7-UI — Workflow UI Builder

## Scope
Built two client-only module screens for the MEIL ESG / BRSR Reporting Platform's single-route SPA:

1. `src/components/modules/evidence.tsx` → `EvidenceModule`
2. `src/components/modules/submissions.tsx` → `SubmissionsModule`

Both are already imported by `src/components/modules/module-router.tsx`.

## API contracts consumed (read from Task 7 backend route files)

### Evidence
- `GET /api/evidence?projectId=&periodId=&module=&status=` → `{ items: EvidenceItem[], total }`
  - `EvidenceItem` includes: id, fileName, documentType, documentDate, projectId, reportingPeriodId, module, sourceRecordId, uploaderId, filePath, fileSize, mimeType, hash, version, status, verificationComment, verifiedBy, verifiedAt, createdAt, updatedAt, uploader{id,name,email,employeeCode}
- `GET /api/evidence/[id]` → `{ evidence, project, reportingPeriod, linkedSourceRecord, auditTrail[] }`
- `POST /api/evidence/[id]/verify` (body `{comment?}`) → `{ evidence }`
- `POST /api/evidence/[id]/reject` (body `{comment}` required) → `{ evidence }`

### Submissions
- `GET /api/submissions?projectId=&periodId=&module=&status=` → `{ items: SubmissionListItem[] }`
  - `SubmissionListItem` includes: id, projectId, reportingPeriodId, module, title, status, completionPct, evidenceCount, validationPassed, validationErrors, submittedBy, submittedAt, currentReviewerId, reviewComment, lockedAt, lockedBy, createdAt, updatedAt, project{...}, reportingPeriod{...}, currentReviewer{id,name,email}, history[], _count.corrections
- `GET /api/submissions/[id]` → `{ submission(+recordIds), sourceRecords, evidence, validationResults, calculationResults, brsrMappings, auditTrail }`
- `POST /api/submissions/[id]/submit` → DRAFT→SUBMITTED (validates every source record has validationStatus PASSED)
- `POST /api/submissions/[id]/review` (body `{comment?}`) → SUBMITTED|RESUBMITTED→UNDER_REVIEW
- `POST /api/submissions/[id]/approve` (body `{comment?, level?}`) → nextApproveStatus advances one level (UNDER_REVIEW→BU_APPROVED→SUBSIDIARY_APPROVED→HQ_REVIEW→LOCKED); on LOCKED sets lockedAt+lockedBy
- `POST /api/submissions/[id]/reject` (body `{fields:[{field,issue,severity,comment}], comment?}`) → CORRECTION_REQUESTED, creates CorrectionRequest per field
- `POST /api/submissions/[id]/resubmit` → CORRECTION_REQUESTED→RESUBMITTED→UNDER_REVIEW in one call, marks OPEN corrections ADDRESSED, bumps revisionNumber on underlying source records
- `POST /api/submissions/[id]/lock` → HQ_REVIEW→LOCKED
- `GET /api/submissions/[id]/history` → full SubmissionStatusHistory with actor details

### Supporting endpoints
- `GET /api/overview` → `kpis{...}` and `periods[]` (for KPI strip + period filter)
- `GET /api/organization/tree` → `groups → subsidiaries → businessUnits → projects` (for project filter)

## Workflow state machine (matches src/lib/workflow.ts)
```
DRAFT → SUBMITTED → UNDER_REVIEW → (CORRECTION_REQUESTED → RESUBMITTED → UNDER_REVIEW) → BU_APPROVED → SUBSIDIARY_APPROVED → HQ_REVIEW → LOCKED
```
Rendered as a 7-step pipeline stepper in the detail sheet. CORRECTION_REQUESTED / RESUBMITTED roll up onto the UNDER_REVIEW slot for visual continuity.

## Role gates (client UX only — server is the security boundary)
| Role | Evidence | Submissions |
|------|----------|-------------|
| SUPER_ADMIN | verify/reject/upload | submit/review/reject/approve/lock |
| PROJECT_USER | upload | submit/resubmit |
| HR_USER / EHS_USER / PROCUREMENT_USER / CSR_USER / COMPLIANCE_USER | upload | (none) |
| BU_REVIEWER | verify/reject | review/reject/approve |
| SUBSIDIARY_REVIEWER | (read-only) | review/approve |
| GROUP_REVIEWER | (read-only) | review/approve/lock |
| ESG_MANAGER / ESG_ANALYST | (read-only) | (read-only) |
| AUDITOR | (read-only) | (read-only) |
| EXECUTIVE | (read-only) | (read-only) |

## Design system classes used
- `.glass` (table cards), `.glass-strong` (sheets/dialogs), `.glass-subtle` (filters/mini-stats), `.glass-shimmer` (hover sweep)
- `.btn-glass-primary` (Upload, Approve confirm, Upload form submit)
- `.kpi-tile` + tone classes for the 6 submission KPIs
- `.status-pill` + all status-* variants for both evidence and submission statuses
- `.animate-fade-up` + `.stagger-1/.stagger-2` for header + filter entrance
- `.scroll-elegant` for sheet content + corrections dialog body
- `.tabular-nums` on every numeric value (versions, %, KPI counts, calculated values)

## Files created
| File | Lines | Export |
|------|-------|--------|
| `src/components/modules/evidence.tsx` | 1125 | `EvidenceModule` |
| `src/components/modules/submissions.tsx` | 1430 | `SubmissionsModule` |
| Total | 2555 | |

## Validation status
- `bun run lint` exits 0 for both files (zero new errors introduced; the only remaining `react-hooks/set-state-in-effect` warnings live in `my-project.tsx` and `data-entry.tsx` — other agents' files, not touched).
- `bunx tsc --noEmit` shows zero TS errors in either file.
- `tail dev.log` shows evidence + submissions modules compile cleanly when imported by module-router; only the admin module (another agent's responsibility) remains unresolved.

## Notable UX decisions
1. **Pipeline stepper** — visually maps the 7 canonical workflow stages with the current step highlighted (primary blue, white icon, blue shadow), completed steps in emerald (check icon), and LOCKED step showing a Lock icon. CORRECTION_REQUESTED / RESUBMITTED (the loop-back states) roll up onto the UNDER_REVIEW slot for visual continuity so the stepper never has out-of-band states.
2. **Permitted-actions matrix** — every action button is computed from `(role, status)` so the same component adapts to every logged-in role without changing code. Read-only roles see a "View" button instead of action buttons.
3. **Correction request form** — fully dynamic. Each field is a card with Field/Severity/Issue/Comment, plus "Add another field" and per-row Remove. Mirrors the backend's `CorrectionInput[]` shape exactly. Validation requires at least one field+issue.
4. **Auto-refresh cascade** — every workflow mutation calls `fetchList()` to refresh the table, and if the detail sheet for that submission is open, calls `refreshDetail()` to reload the detail too. This keeps the UI in sync with the server state machine without a manual reload.
5. **No hardcoded values** — KPI counts, status chips, action labels, role names, project lists, period lists all come from real API responses.
