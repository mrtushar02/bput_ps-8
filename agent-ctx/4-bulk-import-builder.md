# Task 4 — Bulk Import Builder

## Summary
Built a premium glass-strong CSV import wizard for the MEIL ESG platform's Data Entry module (Energy / Water / Waste). Two files touched:

1. **NEW** `src/components/modules/csv-import-dialog.tsx` (~1060 lines, exports `CsvImportDialog` + `ImportCsvButton`)
2. **EDIT** `src/components/modules/data-entry.tsx` (~12 lines added: import, state, header button, dialog mount)

## Architecture
- **CSV parser** — tiny inline RFC-4180-ish parser (handles quoted fields with embedded commas, escaped `""`, CRLF/CR/LF endings, BOM strip, trailing-empty-row cleanup).
- **Auto-map** — case-insensitive header matching with alias support (`meter ref` / `meter reference` / `meter id` all map to `meterRef`).
- **Validation** — required-field + numeric/boolean parsing, mirrors server-side rules (e.g. waste: `hazardous ⇒ manifestRef required`).
- **Sequential POST import** — for each valid row, builds the body, POSTs to `/api/{module}`, captures `record.id` or error, updates progress bar.
- **`onImported`** — wired to parent's existing `refreshExistingRecords` so the records list refreshes after import.

## 4-step wizard
1. **Upload** — drag-drop zone + file picker + "Download template" link + expected-format table + sample-row preview.
2. **Preview & Map** — file name + row count + target project + reporting period selectors + per-field column-mapping dropdowns + 5-row preview table with staggered framer-motion row entrance.
3. **Validate** — 3 summary tiles (Total / Valid / Issues) + amber banner + scrollable row-by-row validation table.
4. **Import** — animated Progress bar + "X of Y processed" + 2-card summary (Created / Failed) + failure-detail list.

## Templates (download)
- Energy: `source,quantity,sourceUnit,vendor,meterRef` → `Grid Electricity,384000,KWH,TSSPDCL,MTR-01`
- Water: `source,withdrawal,consumption,discharge,recycledReused,treatment,destination,sourceUnit` → `Ground Water,4200,1260,800,2140,STP,Irrigation,KL`
- Waste: `wasteType,hazardous,generatedQty,recoveredQty,recycledQty,disposedQty,disposalRoute,vendor,manifestRef,sourceUnit` → `E-waste,true,0.8,0.75,0.75,0.05,Authorised Recycler,Ecoreco,EWM-01,TON`

## Role gating
- `ImportCsvButton` is `disabled` for read-only roles (BU_REVIEWER/SUBSIDIARY_REVIEWER/GROUP_REVIEWER/AUDITOR/EXECUTIVE) with a Radix Tooltip "Your role does not permit data entry".
- Button + dialog only mount for energy/water/waste (workforce/safety/travel out of scope).

## Verification
- `bun run lint` → clean (exit 0)
- `bunx tsc --noEmit | grep csv-import|data-entry` → empty (zero TS errors in my files)
- agent-browser verified:
  - Dialog opens for Energy / Water / Waste (heading flips per sub-module)
  - Downloaded all 3 templates (correct headers + sample rows)
  - Workforce tab correctly hides the button (out-of-scope gating)
  - BU Reviewer sees button as `disabled` (role gating)
  - Full end-to-end test: uploaded meil-energy-template.csv → step 2 auto-mapped all 5 columns + defaulted to Gayatri Solar Plant · June 2026 → step 3 showed "1 valid" → step 4 imported: `POST /api/energy 201 in 93ms` → summary "Created 1 · Failed 0" → "View records" closed dialog → records list bumped to "3 record(s)" (was 2 before — the imported Grid Electricity row is now visible)
- Dev log: zero new errors/warnings. Only new lines are `POST /api/energy 201` + follow-up `GET /api/energy 200`.
- Screenshots: `/tmp/csv-import-dialog-energy.png`, `/tmp/csv-import-records-refreshed.png`

## Design system tokens used
`.glass-strong`, `.glass-shimmer`, `.glass-subtle`, `.status-pill` + status-approved/status-warning/status-error/status-submitted/status-locked variants, `.btn-glass-primary`, `.kpi-tile` (via gradient tiles), `.scroll-elegant`, `.tabular-nums`, `.animate-pulse-ring` (stepper), staggered framer-motion entrance, blue→cyan gradient accent, `@/components/ui/{dialog,progress,tooltip}` (Radix wrappers).
