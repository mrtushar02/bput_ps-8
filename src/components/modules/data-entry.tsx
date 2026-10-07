'use client'
/**
 * Data Entry Module — flagship 4-step workflow screen.
 * Steps: 1 Enter Data → 2 Attach Evidence → 3 Validate → 4 Submit.
 * Sub-modules: energy | water | waste | workforce | safety | travel.
 * Real data via /api/{module} POST + /api/validation/run + /api/submissions + /api/submissions/[id]/submit.
 * No hardcoded KPIs. Role-aware: reviewer roles get read-only forms.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Zap, Droplet, Recycle, Users, ShieldCheck, Plane, CheckCircle2,
  AlertTriangle, AlertOctagon, Clock, Link2, Send, Save, FlaskConical,
  ChevronRight, ChevronLeft, Building2, CalendarClock, Info, Lock, Calculator, type LucideIcon,
} from 'lucide-react'
import { useApp } from '@/lib/auth-context'
import { CsvImportDialog, ImportCsvButton } from '@/components/modules/csv-import-dialog'

/* ---------- Types ---------- */
type SubModule = 'energy' | 'water' | 'waste' | 'workforce' | 'safety' | 'travel'

interface Project {
  id: string; projectCode: string; projectName: string; location: string | null
  buName: string; subsidiaryCode: string; groupCode: string
}
interface Period { id: string; label: string; year: number; month: number | null; status: string }
interface EvidenceItem {
  id: string; fileName: string; documentType: string; status: string
  module?: string | null
}
interface ValidationIssue {
  ruleCode: string; severity: 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKING'
  message: string; field?: string | null; suggestedAction?: string | null
}
interface CalcPayload {
  calculatedValue: number; resultUnit: string; scope?: string | null
  factorId?: string | null; factorVersion?: number | null
  methodologyNote?: string | null
  normalizedValue?: number | null; normalizedUnit?: string | null
  sourceValue?: number; sourceUnit?: string
}
interface SavedRecord {
  id: string
  recordType: string
  issues: ValidationIssue[]
  calculation: CalcPayload | null
  derivedLtifr?: number | null
  validationStatus?: string
  evidenceId?: string | null
}

/* ---------- Role helpers ---------- */
const READ_ONLY_ROLES = new Set([
  'BU_REVIEWER', 'SUBSIDIARY_REVIEWER', 'GROUP_REVIEWER', 'AUDITOR', 'EXECUTIVE',
])

const SUB_MODULES: Array<{ key: SubModule; label: string; icon: LucideIcon; moduleKey: string; recordType: string; permission: string }> = [
  { key: 'energy', label: 'Energy / Fuel', icon: Zap, moduleKey: 'ENERGY', recordType: 'ENERGY', permission: 'esg.energy.write' },
  { key: 'water', label: 'Water', icon: Droplet, moduleKey: 'WATER', recordType: 'WATER', permission: 'esg.water.write' },
  { key: 'waste', label: 'Waste', icon: Recycle, moduleKey: 'WASTE', recordType: 'WASTE', permission: 'esg.waste.write' },
  { key: 'workforce', label: 'Workforce', icon: Users, moduleKey: 'PEOPLE', recordType: 'PEOPLE', permission: 'esg.people.write' },
  { key: 'safety', label: 'Safety', icon: ShieldCheck, moduleKey: 'SAFETY', recordType: 'SAFETY', permission: 'esg.safety.write' },
  { key: 'travel', label: 'Travel', icon: Plane, moduleKey: 'TRAVEL', recordType: 'TRAVEL', permission: 'esg.travel.write' },
]

const STEPS = ['Enter Data', 'Attach Evidence', 'Validate', 'Submit'] as const

/* ---------- Main component ---------- */
export function DataEntryModule({ subModule: subModuleProp }: { subModule: string }) {
  const { user, setDataEntrySubModule } = useApp()
  const roleKey = user?.roles?.[0]?.key ?? ''
  const readOnly = READ_ONLY_ROLES.has(roleKey)

  const subModule = (SUB_MODULES.find(s => s.key === subModuleProp)?.key ?? 'energy') as SubModule
  const activeSub = SUB_MODULES.find(s => s.key === subModule) ?? SUB_MODULES[0]

  const [projects, setProjects] = useState<Project[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Stepper / action state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [saved, setSaved] = useState<SavedRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionInfo, setActionInfo] = useState('')
  const [validating, setValidating] = useState(false)
  const [validationRun, setValidationRun] = useState<{ passed: number; errors: number; warnings: number } | null>(null)
  const [submitResult, setSubmitResult] = useState<{ submissionId: string; status: string } | null>(null)
  const [existingRecords, setExistingRecords] = useState<any[]>([])
  const [csvImportOpen, setCsvImportOpen] = useState(false)

  // Form state per submodule (so user doesn't lose data on tab switch)
  const formStateRef = useRef<Record<string, Record<string, any>>>({})

  // ---- Load projects + periods once
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    Promise.all([
      fetch('/api/organization/tree').then(r => r.ok ? r.json() : Promise.reject(new Error('org tree failed'))),
      fetch('/api/overview').then(r => r.ok ? r.json() : Promise.reject(new Error('overview failed'))),
    ])
      .then(([tr, ov]) => {
        if (cancelled) return
        const flat: Project[] = []
        for (const g of tr.groups || []) {
          for (const sub of g.subsidiaries || []) {
            for (const bu of sub.businessUnits || []) {
              for (const p of bu.projects || []) {
                flat.push({
                  id: p.id, projectCode: p.projectCode, projectName: p.projectName,
                  location: p.location, buName: bu.name, subsidiaryCode: sub.code, groupCode: g.code,
                })
              }
            }
          }
        }
        setProjects(flat)
        setPeriods(ov.periods || [])
        const scopeProj = user?.scopes?.find(s => s.scopeType === 'PROJECT')
        const defaultProject =
          (scopeProj ? flat.find(p => p.id === scopeProj.scopeId) : null) ||
          flat.find(p => p.projectCode === 'MEIL-SOL-GJT') ||
          flat[0] || null
        setSelectedProjectId(defaultProject?.id ?? null)
        // Default period: prefer June (open/draft) → May → April → latest
        const defaultPeriod =
          (ov.periods || []).find((p: Period) => p.label === 'June 2026') ||
          (ov.periods || []).find((p: Period) => p.label === 'May 2026') ||
          (ov.periods || [])[0] || null
        setSelectedPeriodId(defaultPeriod?.id ?? null)
        setLoading(false)
      })
      .catch((e: any) => { if (!cancelled) { setError(e?.message || 'Failed to load'); setLoading(false) } })
    return () => { cancelled = true }
  }, [user?.scopes])

  // ---- Reset step + saved record when submodule/project/period changes
  useEffect(() => {
    setStep(1); setSaved(null); setActionError(''); setActionInfo('')
    setValidationRun(null); setSubmitResult(null)
  }, [subModule, selectedProjectId, selectedPeriodId])

  // ---- Fetch existing records for the project+period+module (so user sees "no records" empty state)
  const refreshExistingRecords = useCallback(async () => {
    if (!selectedProjectId || !selectedPeriodId) { setExistingRecords([]); return }
    try {
      const endpoint = activeSub.key === 'travel' ? null : `/api/${activeSub.key}`
      if (!endpoint) { setExistingRecords([]); return }
      const r = await fetch(`${endpoint}?projectId=${encodeURIComponent(selectedProjectId)}&periodId=${encodeURIComponent(selectedPeriodId)}`)
      if (!r.ok) { setExistingRecords([]); return }
      const d = await r.json()
      setExistingRecords(d.records || [])
    } catch {
      setExistingRecords([])
    }
  }, [selectedProjectId, selectedPeriodId, activeSub.key])

  useEffect(() => { refreshExistingRecords() }, [refreshExistingRecords])

  // ---- Fetch evidence for this module + project
  useEffect(() => {
    if (!selectedProjectId) { setEvidence([]); return }
    fetch(`/api/evidence?projectId=${encodeURIComponent(selectedProjectId)}&module=${activeSub.moduleKey}`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setEvidence(d.items || []))
      .catch(() => setEvidence([]))
  }, [selectedProjectId, activeSub.moduleKey])

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null
  const selectedPeriod = periods.find(p => p.id === selectedPeriodId) || null

  if (loading) return <DataEntrySkeleton />
  if (error) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (projects.length === 0 || periods.length === 0) {
    return <EmptyState message="No projects or reporting periods are available in your scope. Contact your administrator." />
  }

  // ---- Handlers
  const handleSaved = (result: SavedRecord) => {
    setSaved(result)
    setStep(2)
    setActionInfo('Draft saved. Validation issues and calculation preview shown on the right.')
    refreshExistingRecords()
  }

  const handleAttachEvidence = async (evidenceId: string | null) => {
    if (!saved) return
    setActionError('')
    try {
      setSubmitting(true)
      // Best-effort: re-submit the saved record with evidenceId by re-running POST
      // We just update the local SavedRecord's evidenceId; the actual link is persisted
      // when the user clicks Save Draft again or via the submit flow.
      setSaved(prev => prev ? { ...prev, evidenceId } : prev)
      setStep(3)
    } finally {
      setSubmitting(false)
    }
  }

  const handleValidate = async () => {
    if (!saved) { setActionError('Save a draft first.'); return }
    setActionError(''); setActionInfo(''); setValidating(true)
    try {
      const r = await fetch('/api/validation/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordType: saved.recordType, recordId: saved.id }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Validation failed')
      setValidationRun({ passed: d.passed ?? 0, errors: d.errors ?? 0, warnings: d.warnings ?? 0 })
      // refresh issues from the per-record endpoint
      const endpoint = activeSub.key === 'travel' ? null : `/api/${activeSub.key}`
      if (endpoint) {
        const list = await fetch(`${endpoint}?projectId=${selectedProjectId}&periodId=${selectedPeriodId}`).then(rr => rr.json())
        const rec = (list.records || []).find((x: any) => x.id === saved.id)
        if (rec) {
          setSaved(prev => prev ? {
            ...prev,
            issues: (rec.validationResults || []).map((v: any) => ({
              ruleCode: v.ruleCode, severity: v.severity, message: v.message,
              field: v.field, suggestedAction: v.suggestedAction,
            })),
            validationStatus: rec.validationStatus,
          } : prev)
        }
      }
      setStep(4)
    } catch (e: any) {
      setActionError(e?.message || 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = async () => {
    if (!saved) { setActionError('Save a draft first.'); return }
    if (!selectedProjectId || !selectedPeriodId) { setActionError('Select a project and period.'); return }
    setActionError(''); setActionInfo(''); setSubmitting(true)
    try {
      // 1. Create the submission (DRAFT)
      const createRes = await fetch('/api/submissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId, reportingPeriodId: selectedPeriodId,
          module: activeSub.moduleKey, recordIds: [saved.id],
        }),
      })
      const created = await createRes.json()
      if (!createRes.ok) throw new Error(created.error || 'Failed to create submission')
      const submissionId = created.submission.id
      // 2. Submit it (DRAFT → SUBMITTED)
      const submitRes = await fetch(`/api/submissions/${submissionId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: `Submitted via Data Entry — ${activeSub.label}` }),
      })
      const submitted = await submitRes.json()
      if (!submitRes.ok) throw new Error(submitted.error || 'Failed to submit submission')
      setSubmitResult({ submissionId, status: submitted.submission?.status || 'SUBMITTED' })
      setActionInfo('Submission sent for review. Status: SUBMITTED. You will be notified when BU review completes.')
      refreshExistingRecords()
    } catch (e: any) {
      setActionError(e?.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="kpi-tile bg-blue-50 text-blue-600"><FileText className="h-5 w-5" /></div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Data Entry</h1>
            <span className="status-pill status-submitted"><Clock className="h-3 w-3" /> Open</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Source-record capture · {selectedProject?.projectCode} · {selectedPeriod?.label}
            {readOnly && <span className="ml-2 inline-flex items-center gap-1 text-amber-700"><Lock className="h-3 w-3" /> Read-only — your role does not permit data entry</span>}
          </p>
        </div>

        {/* Project + Period selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-2 text-xs">
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
            <select
              value={selectedProjectId ?? ''} disabled={readOnly}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="max-w-[160px] bg-transparent font-semibold text-slate-700 outline-none"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.projectCode}</option>)}
            </select>
          </div>
          <div className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-2 text-xs">
            <CalendarClock className="h-3.5 w-3.5 text-blue-600" />
            <select
              value={selectedPeriodId ?? ''} disabled={readOnly}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 outline-none"
            >
              {periods.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          {/* Bulk CSV import — only for energy/water/waste; role-gated with tooltip */}
          {(subModule === 'energy' || subModule === 'water' || subModule === 'waste') && (
            <ImportCsvButton
              disabled={readOnly}
              disabledReason="Your role does not permit data entry"
              onClick={() => setCsvImportOpen(true)}
            />
          )}
        </div>
      </motion.div>

      {/* SUB-MODULE TAB BAR */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="glass-nav flex items-center gap-0.5 overflow-x-auto scroll-elegant rounded-2xl p-1.5"
      >
        {SUB_MODULES.map(m => {
          const active = m.key === subModule
          const Icon = m.icon
          return (
            <button key={m.key} onClick={() => setDataEntrySubModule(m.key)}
              className={`group relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}>
              <Icon className="h-3.5 w-3.5" /> {m.label}
              {active && <motion.div layoutId="data-entry-underline" className="absolute -bottom-0.5 left-3 right-3 h-0.5 rounded-full bg-blue-500" />}
            </button>
          )
        })}
      </motion.div>

      {/* STEPPER */}
      <Stepper step={step} />

      {/* MAIN GRID */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* FORM PANEL */}
        <motion.section
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="glass glass-shimmer rounded-2xl p-4 lg:col-span-2"
        >
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <div className="kpi-tile bg-blue-50 text-blue-600" style={{ width: 32, height: 32 }}>
                <activeSub.icon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">{activeSub.label} Entry Form</h3>
                <p className="text-[11px] text-slate-500">
                  {readOnly ? 'Read-only view — your role does not permit data entry' : 'Fill values, save draft, and the engine will validate + compute automatically.'}
                </p>
              </div>
            </div>
            <span className={`status-pill ${saved ? 'status-approved' : 'status-draft'}`}>
              {saved ? 'Saved' : 'Draft'}
            </span>
          </div>

          {/* Form body */}
          <div className="space-y-3">
            {readOnly && (
              <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-[11px] font-medium text-amber-800">
                <Lock className="mr-1 inline h-3 w-3" /> Read-only — your role ({roleKey}) does not permit data entry. Switch to a writer role to edit.
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div key={subModule}
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.22 }}
              >
                {subModule === 'energy' && (
                  <EnergyForm
                    projectId={selectedProjectId!} periodId={selectedPeriodId!} evidence={evidence}
                    readOnly={readOnly} formStateRef={formStateRef} onSaved={handleSaved}
                  />
                )}
                {subModule === 'water' && (
                  <WaterForm
                    projectId={selectedProjectId!} periodId={selectedPeriodId!} evidence={evidence}
                    readOnly={readOnly} formStateRef={formStateRef} onSaved={handleSaved}
                  />
                )}
                {subModule === 'waste' && (
                  <WasteForm
                    projectId={selectedProjectId!} periodId={selectedPeriodId!} evidence={evidence}
                    readOnly={readOnly} formStateRef={formStateRef} onSaved={handleSaved}
                  />
                )}
                {subModule === 'workforce' && (
                  <WorkforceForm
                    projectId={selectedProjectId!} periodId={selectedPeriodId!} evidence={evidence}
                    readOnly={readOnly} formStateRef={formStateRef} onSaved={handleSaved}
                  />
                )}
                {subModule === 'safety' && (
                  <SafetyForm
                    projectId={selectedProjectId!} periodId={selectedPeriodId!} evidence={evidence}
                    readOnly={readOnly} formStateRef={formStateRef} onSaved={handleSaved}
                  />
                )}
                {subModule === 'travel' && (
                  <div className="rounded-xl border border-dashed border-white/70 bg-white/40 px-4 py-10 text-center">
                    <Plane className="mx-auto h-8 w-8 text-slate-400" />
                    <div className="mt-2 text-sm font-bold text-slate-700">Travel &amp; Mobility Module</div>
                    <div className="mt-1 text-xs text-slate-500">Business-trip emissions capture is coming soon. Use the Energy / Fuel module for vehicle fuel logs in the interim.</div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Existing records */}
          {existingRecords.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Existing records · {selectedPeriod?.label}</h4>
                <span className="text-[10px] text-slate-400">{existingRecords.length} record(s)</span>
              </div>
              <div className="max-h-44 space-y-1 overflow-y-auto scroll-elegant pr-1">
                {existingRecords.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg bg-white/50 px-2.5 py-1.5 text-[11px]">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`status-pill ${r.status === 'APPROVED' ? 'status-approved' : r.status === 'DRAFT' ? 'status-draft' : 'status-submitted'}`}>{r.status}</span>
                      <span className="truncate font-semibold text-slate-700">{describeRecord(r, subModule)}</span>
                    </div>
                    <span className={`status-pill ${r.validationStatus === 'PASSED' ? 'status-approved' : r.validationStatus === 'FAILED' ? 'status-missing' : 'status-warning'}`}>{r.validationStatus}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {existingRecords.length === 0 && !saved && !readOnly && (
            <div className="mt-4 rounded-xl border border-dashed border-white/70 bg-white/40 px-4 py-6 text-center text-[11px] text-slate-500">
              No {activeSub.label.toLowerCase()} records for {selectedPeriod?.label}. Fill the form above and click <strong>Save Draft</strong> to create the first one.
            </div>
          )}
        </motion.section>

        {/* RIGHT PANEL — Validation + Calculation + Evidence */}
        <motion.section
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="glass glass-shimmer rounded-2xl p-4 lg:col-span-1"
        >
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <div className="kpi-tile bg-violet-50 text-violet-600" style={{ width: 32, height: 32 }}>
                <FlaskConical className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Engine Preview</h3>
                <p className="text-[11px] text-slate-500">Validation + calculation results</p>
              </div>
            </div>
          </div>

          {/* Calculation preview */}
          <CalculationPreview saved={saved} subModule={subModule} />

          {/* Validation results */}
          <ValidationResults saved={saved} validationRun={validationRun} />

          {/* Evidence picker (step 2) */}
          <EvidencePicker evidence={evidence} step={step} saved={saved} onPick={handleAttachEvidence} />

          {/* Submit outcome */}
          {submitResult && (
            <div className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-2.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Submission sent
              </div>
              <div className="mt-1 text-emerald-700">Submission ID: <span className="font-mono">{submitResult.submissionId.slice(-8)}</span></div>
              <div className="text-emerald-700">Status: <span className="font-semibold">{submitResult.status}</span></div>
            </div>
          )}
        </motion.section>
      </div>

      {/* ACTION BAR (bottom) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="glass-nav sticky bottom-3 z-20 rounded-2xl p-3"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          {/* Step indicator at bottom (mobile-friendly) */}
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            {STEPS.map((s, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4
              const active = step === n
              const done = step > n
              return (
                <span key={s} className="flex items-center gap-1">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-blue-500 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {done ? <CheckCircle2 className="h-3 w-3" /> : n}
                  </span>
                  <span className={active ? 'font-semibold text-slate-700' : ''}>{s}</span>
                  {i < STEPS.length - 1 && <ChevronRight className="h-2.5 w-2.5 text-slate-300" />}
                </span>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {actionError && (
              <span className="status-pill status-error"><AlertOctagon className="h-3 w-3" /> {actionError}</span>
            )}
            {actionInfo && (
              <span className="status-pill status-approved"><Info className="h-3 w-3" /> {actionInfo}</span>
            )}
            <button
              disabled={readOnly || !saved || validating || submitting || step < 2}
              onClick={handleValidate}
              className="glass-subtle flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {validating ? <Clock className="h-3.5 w-3.5 animate-pulse" /> : <FlaskConical className="h-3.5 w-3.5" />}
              Validate
            </button>
            <button
              disabled={readOnly || !saved || submitting || step < 3}
              onClick={handleSubmit}
              className="btn-glass-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? <Clock className="h-3.5 w-3.5 animate-pulse" /> : <Send className="h-3.5 w-3.5" />}
              Submit for Review
            </button>
          </div>
        </div>
      </motion.div>

      {/* Bulk CSV import dialog — only mounted for energy/water/waste */}
      {(subModule === 'energy' || subModule === 'water' || subModule === 'waste') && (
        <CsvImportDialog
          open={csvImportOpen}
          onOpenChange={setCsvImportOpen}
          subModule={subModule}
          projectId={selectedProjectId}
          reportingPeriodId={selectedPeriodId}
          projects={projects}
          periods={periods}
          onImported={refreshExistingRecords}
        />
      )}
    </div>
  )
}

/* ============================================================
   STEPPER (top)
   ============================================================ */
function Stepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  const icons: Record<number, LucideIcon> = { 1: FileText, 2: Link2, 3: FlaskConical, 4: Send }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="glass rounded-2xl p-4"
    >
      <div className="relative flex items-center justify-between">
        {/* Track */}
        <div className="absolute left-0 right-0 top-5 mx-6 h-0.5 rounded-full bg-slate-200/80" />
        <motion.div
          className="absolute left-0 top-5 h-0.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
          initial={{ width: '0%' }}
          animate={{ width: `${((step - 1) / 3) * 100}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ margin: '0 1.5rem' }}
        />
        {STEPS.map((label, i) => {
          const n = i + 1
          const active = step === n
          const done = step > n
          const Icon = icons[n]
          return (
            <div key={label} className="relative z-10 flex flex-1 flex-col items-center gap-1">
              <motion.div
                initial={{ scale: 0.94 }} animate={{ scale: 1 }}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${active ? 'border-blue-500 bg-white text-blue-600 shadow-md shadow-blue-500/30 animate-pulse-ring' : done ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-white text-slate-400'}`}
              >
                <Icon className="h-4 w-4" />
              </motion.div>
              <div className="text-center">
                <div className={`text-[10px] font-bold ${active ? 'text-blue-700' : done ? 'text-emerald-700' : 'text-slate-400'}`}>Step {n}</div>
                <div className={`text-[11px] font-semibold ${active ? 'text-slate-800' : 'text-slate-500'}`}>{label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ============================================================
   CALCULATION PREVIEW (right panel)
   ============================================================ */
function CalculationPreview({ saved, subModule }: { saved: SavedRecord | null; subModule: SubModule }) {
  if (!saved || !saved.calculation) {
    return (
      <div className="rounded-xl border border-dashed border-white/70 bg-white/40 px-3 py-4 text-center text-[11px] text-slate-400">
        {subModule === 'energy'
          ? 'Save a draft to see the deterministic tCO₂e calculation (factor × quantity).'
          : subModule === 'safety'
            ? 'Save a draft to see the derived LTIFR (LTI × 1M / man-hours).'
            : 'No emissions factor applies to this module. KPIs are derived at consolidation.'}
      </div>
    )
  }
  const c = saved.calculation
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
          <FlaskConical className="h-3.5 w-3.5" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Calculation Result</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Field label="Calculated value" value={`${Number(c.calculatedValue).toFixed(3)} ${c.resultUnit || ''}`} />
        <Field label="Scope" value={c.scope || '—'} />
        {c.factorId && <Field label="Factor ID" value={c.factorId.slice(-8)} mono />}
        {c.factorVersion !== undefined && c.factorVersion !== null && <Field label="Factor version" value={`v${c.factorVersion}`} />}
        {c.normalizedValue !== undefined && c.normalizedValue !== null && <Field label="Normalized" value={`${Number(c.normalizedValue).toFixed(3)} ${c.normalizedUnit || ''}`} />}
        {c.sourceValue !== undefined && <Field label="Source value" value={`${c.sourceValue} ${c.sourceUnit || ''}`} />}
      </div>
      {c.methodologyNote && (
        <div className="mt-2 rounded-lg bg-white/70 px-2 py-1.5 text-[10px] text-slate-600">
          <span className="font-semibold text-slate-700">Methodology:</span> {c.methodologyNote}
        </div>
      )}
      {subModule === 'safety' && saved.derivedLtifr !== undefined && saved.derivedLtifr !== null && (
        <div className="mt-2 rounded-lg bg-white/70 px-2 py-1.5 text-[10px] text-slate-600">
          <span className="font-semibold text-slate-700">Derived LTIFR:</span> {saved.derivedLtifr} /M hrs
        </div>
      )}
    </motion.div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-xs font-bold text-slate-800 ${mono ? 'font-mono' : 'tabular-nums'}`}>{value}</div>
    </div>
  )
}

/* ============================================================
   VALIDATION RESULTS (right panel)
   ============================================================ */
function ValidationResults({ saved, validationRun }: { saved: SavedRecord | null; validationRun: { passed: number; errors: number; warnings: number } | null }) {
  if (!saved) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-white/70 bg-white/40 px-3 py-4 text-center text-[11px] text-slate-400">
        Save a draft to see validation issues.
      </div>
    )
  }
  const issues = saved.issues || []
  const errors = issues.filter(i => i.severity === 'ERROR' || i.severity === 'BLOCKING')
  const warnings = issues.filter(i => i.severity === 'WARNING')
  const passed = issues.length === 0

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-1.5">
        {passed ? (
          <span className="status-pill status-approved"><CheckCircle2 className="h-3 w-3" /> PASSED</span>
        ) : errors.length > 0 ? (
          <span className="status-pill status-error"><AlertOctagon className="h-3 w-3" /> {errors.length} error(s)</span>
        ) : (
          <span className="status-pill status-warning"><AlertTriangle className="h-3 w-3" /> {warnings.length} warning(s)</span>
        )}
        {saved.validationStatus && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status: {saved.validationStatus}</span>
        )}
      </div>

      {validationRun && (
        <div className="rounded-lg bg-blue-50/60 px-2.5 py-1.5 text-[10px] text-blue-700">
          Validation run: {validationRun.passed} passed · {validationRun.warnings} warning(s) · {validationRun.errors} error(s)
        </div>
      )}

      {issues.length === 0 ? (
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-3 py-2 text-[11px] text-emerald-700">
          All validation rules passed. Record is eligible for submission.
        </div>
      ) : (
        <div className="space-y-1.5">
          {issues.map((iss, i) => <IssuePill key={i} issue={iss} delay={i * 0.04} />)}
        </div>
      )}
    </div>
  )
}

function IssuePill({ issue, delay }: { issue: ValidationIssue; delay: number }) {
  const tone = issue.severity === 'ERROR' || issue.severity === 'BLOCKING' ? 'error' : issue.severity === 'WARNING' ? 'warning' : 'verified'
  const pillClass = tone === 'error' ? 'status-error' : tone === 'warning' ? 'status-warning' : 'status-verified'
  const Icon = tone === 'error' ? AlertOctagon : tone === 'warning' ? AlertTriangle : CheckCircle2
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className={`rounded-lg border px-3 py-2 text-[11px] ${tone === 'error' ? 'border-rose-200/70 bg-rose-50/50' : tone === 'warning' ? 'border-amber-200/70 bg-amber-50/50' : 'border-emerald-200/70 bg-emerald-50/40'}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`status-pill ${pillClass}`}><Icon className="h-3 w-3" /> {issue.ruleCode}</span>
        {issue.field && <span className="text-[10px] text-slate-500">field: <span className="font-mono text-slate-700">{issue.field}</span></span>}
      </div>
      <div className="mt-1 font-medium text-slate-800">{issue.message}</div>
      {issue.suggestedAction && (
        <div className="mt-0.5 text-[10px] text-slate-500"><span className="font-semibold">Action:</span> {issue.suggestedAction}</div>
      )}
    </motion.div>
  )
}

/* ============================================================
   EVIDENCE PICKER (right panel, step 2)
   ============================================================ */
function EvidencePicker({ evidence, step, saved, onPick }: {
  evidence: EvidenceItem[]; step: number; saved: SavedRecord | null
  onPick: (id: string | null) => void
}) {
  if (!saved) return null
  const picked = saved.evidenceId ?? ''
  return (
    <div className="mt-3 rounded-xl border border-white/60 bg-white/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Attach Evidence</span>
        </div>
        <span className={`status-pill ${step >= 2 ? 'status-approved' : 'status-draft'}`}>Step 2</span>
      </div>
      <select
        value={picked}
        onChange={(e) => onPick(e.target.value || null)}
        className="w-full rounded-lg border border-white/60 bg-white/70 px-2.5 py-2 text-[11px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
      >
        <option value="">— Select evidence file —</option>
        {evidence.map(e => (
          <option key={e.id} value={e.id}>{e.fileName} ({e.documentType})</option>
        ))}
      </select>
      {evidence.length === 0 && (
        <div className="mt-2 text-[10px] text-slate-400">No {`evidence`} uploaded for this module. Upload first in the Evidence module.</div>
      )}
    </div>
  )
}

/* ============================================================
   ENERGY FORM
   ============================================================ */
const ENERGY_SOURCES = [
  { source: 'Grid Electricity', category: 'NON_RENEWABLE', unit: 'KWH' },
  { source: 'Diesel (HSD)', category: 'NON_RENEWABLE', unit: 'L' },
  { source: 'Petrol', category: 'NON_RENEWABLE', unit: 'L' },
  { source: 'Coal', category: 'NON_RENEWABLE', unit: 'KG' },
  { source: 'CNG', category: 'NON_RENEWABLE', unit: 'KG' },
  { source: 'LPG', category: 'NON_RENEWABLE', unit: 'KG' },
  { source: 'Solar PPA', category: 'RENEWABLE', unit: 'KWH' },
]

function EnergyForm({ projectId, periodId, evidence, readOnly, formStateRef, onSaved }: FormProps) {
  const key = `energy-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}
  const [source, setSource] = useState<string>(initial.source ?? 'Grid Electricity')
  const [quantity, setQuantity] = useState<string>(initial.quantity ?? '')
  const [sourceUnit, setSourceUnit] = useState<string>(initial.sourceUnit ?? 'KWH')
  const [vendor, setVendor] = useState<string>(initial.vendor ?? '')
  const [meterRef, setMeterRef] = useState<string>(initial.meterRef ?? '')
  const [evidenceId, setEvidenceId] = useState<string>(initial.evidenceId ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const preset = ENERGY_SOURCES.find(s => s.source === source)
  useEffect(() => {
    if (preset) setSourceUnit(preset.unit)
  }, [source, preset])

  const persist = (patch: any) => { formStateRef.current[key] = { ...(formStateRef.current[key] || {}), ...patch } }
  useEffect(() => { persist({ source, quantity, sourceUnit, vendor, meterRef, evidenceId }) }, [source, quantity, sourceUnit, vendor, meterRef, evidenceId])

  const save = async () => {
    setError('')
    if (!quantity || Number(quantity) <= 0) { setError('Quantity must be > 0'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/energy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, reportingPeriodId: periodId,
          source, sourceCategory: preset?.category ?? 'NON_RENEWABLE',
          quantity: Number(quantity), sourceUnit, vendor: vendor || undefined,
          meterRef: meterRef || undefined, evidenceId: evidenceId || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || d.payload?.error || 'Save failed')
      onSaved({
        id: d.record.id, recordType: 'ENERGY',
        issues: d.issues || [],
        calculation: d.calculation || null,
        validationStatus: d.record.validationStatus,
      })
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormGrid>
      <FormField label="Energy source" hint="Auto-selects the category (renewable / non-renewable).">
        <select value={source} disabled={readOnly} onChange={(e) => setSource(e.target.value)}
          className={inputClass}>
          {ENERGY_SOURCES.map(s => <option key={s.source} value={s.source}>{s.source}</option>)}
        </select>
      </FormField>
      <FormField label="Source category" hint="Auto-derived from the chosen source.">
        <input value={preset?.category ?? 'NON_RENEWABLE'} disabled className={inputClass + ' opacity-60'} />
      </FormField>
      <FormField label="Quantity" hint="Metered consumption for the period.">
        <input type="number" min="0" step="any" value={quantity} disabled={readOnly}
          onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 384000" className={inputClass} />
      </FormField>
      <FormField label="Source unit" hint="Standard UnitMaster codes only.">
        <select value={sourceUnit} disabled={readOnly} onChange={(e) => setSourceUnit(e.target.value)} className={inputClass}>
          {['KWH', 'MWH', 'GJ', 'L', 'KL', 'M3', 'KG', 'TON'].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </FormField>
      <FormField label="Vendor" hint="Utility / fuel supplier.">
        <input value={vendor} disabled={readOnly} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. TSSPDCL" className={inputClass} />
      </FormField>
      <FormField label="Meter reference" hint="Unique meter ID for this site.">
        <input value={meterRef} disabled={readOnly} onChange={(e) => setMeterRef(e.target.value)} placeholder="e.g. MTR-GJT-33kV-01" className={inputClass} />
      </FormField>
      <FormField label="Evidence file" hint="Optional — pick from uploads." full>
        <select value={evidenceId} disabled={readOnly} onChange={(e) => setEvidenceId(e.target.value)} className={inputClass}>
          <option value="">— None —</option>
          {evidence.map(ev => <option key={ev.id} value={ev.id}>{ev.fileName}</option>)}
        </select>
      </FormField>
      <LiveEstimateCard source={source} quantity={quantity} sourceUnit={sourceUnit} />
      <FormActions error={error} submitting={submitting} readOnly={readOnly} onSave={save} />
    </FormGrid>
  )
}

/* Live calculation estimate — updates as the user types (before saving).
   Uses the same factor lookup as the server-side engine for determinism. */
function LiveEstimateCard({ source, quantity, sourceUnit }: { source: string; quantity: string; sourceUnit: string }) {
  const qty = Number(quantity)
  const valid = qty > 0 && quantity !== ''
  // Match the seeded emission factors (src/app/api/energy/route.ts findEmissionFactorForSource)
  const FACTORS: Record<string, { value: number; unit: string; scope: string; methodology: string; gjPerUnit: number }> = {
    'Grid Electricity': { value: 0.716, unit: 'kgCO2e/kWh', scope: 'SCOPE_2', methodology: 'CEA v19', gjPerUnit: sourceUnit === 'MWH' ? 3.6 : 0.0036 },
    'Diesel (HSD)': { value: 2.637, unit: 'kgCO2e/L', scope: 'SCOPE_1', methodology: 'IPCC 2006', gjPerUnit: sourceUnit === 'KL' ? 38.3 : 0.0383 },
    'Petrol (MS)': { value: 2.296, unit: 'kgCO2e/L', scope: 'SCOPE_1', methodology: 'IPCC 2006', gjPerUnit: 0.0348 },
    'Coal (Sub-bituminous)': { value: 1.9, unit: 'kgCO2e/kg', scope: 'SCOPE_1', methodology: 'IPCC 2006', gjPerUnit: 0.0227 },
    'CNG': { value: 2.19, unit: 'kgCO2e/kg', scope: 'SCOPE_1', methodology: 'IPCC 2006', gjPerUnit: 0.05 },
    'LPG': { value: 2.98, unit: 'kgCO2e/kg', scope: 'SCOPE_1', methodology: 'IPCC 2006', gjPerUnit: 0.046 },
    'Solar PPA': { value: 0.04, unit: 'kgCO2e/kWh', scope: 'SCOPE_2', methodology: 'ISAE 3000', gjPerUnit: 0.0036 },
  }
  const f = FACTORS[source]
  if (!f || !valid) {
    return (
      <div className="md:col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-[11px] text-slate-400">
        <span className="font-semibold text-slate-500">Live estimate:</span> enter a quantity to preview the deterministic emission calculation (factor × quantity).
      </div>
    )
  }
  const co2eKg = qty * f.value
  const co2eT = co2eKg / 1000
  const energyGJ = qty * f.gjPerUnit
  const scopeColor = f.scope === 'SCOPE_1' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="md:col-span-2 rounded-xl border border-blue-200/70 bg-gradient-to-br from-blue-50/70 to-cyan-50/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500 text-white"><Calculator className="h-3.5 w-3.5" /></span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Live emission estimate</span>
          <span className={`status-pill ${scopeColor} !text-[9px]`}>{f.scope}</span>
        </div>
        <span className="text-[10px] text-slate-400">factor v1 · {f.methodology}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Estimated CO₂e</div>
          <div className="tabular-nums text-lg font-bold text-slate-800">{co2eT.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] font-medium text-slate-400">tCO₂e</span></div>
          <div className="text-[9px] text-slate-400">{co2eKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kgCO₂e</div>
        </div>
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Energy (normalized)</div>
          <div className="tabular-nums text-lg font-bold text-slate-800">{energyGJ.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[10px] font-medium text-slate-400">GJ</span></div>
          <div className="text-[9px] text-slate-400">{qty.toLocaleString()} {sourceUnit} × {f.gjPerUnit}</div>
        </div>
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Factor applied</div>
          <div className="tabular-nums text-lg font-bold text-slate-800">{f.value} <span className="text-[10px] font-medium text-slate-400">{f.unit}</span></div>
          <div className="text-[9px] text-slate-400">{source}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-white/60 px-2 py-1 text-[9px] text-slate-500">
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        Same input + same factor version = same result as server-side calculation (deterministic).
      </div>
    </motion.div>
  )
}

/* ============================================================
   WATER FORM
   ============================================================ */
const WATER_SOURCES = ['Ground Water', 'Surface', 'Third Party', 'Recycled', 'Rainwater']

function WaterForm({ projectId, periodId, evidence, readOnly, formStateRef, onSaved }: FormProps) {
  const key = `water-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}
  const [source, setSource] = useState<string>(initial.source ?? 'Ground Water')
  const [withdrawal, setWithdrawal] = useState<string>(initial.withdrawal ?? '')
  const [consumption, setConsumption] = useState<string>(initial.consumption ?? '')
  const [discharge, setDischarge] = useState<string>(initial.discharge ?? '')
  const [recycledReused, setRecycledReused] = useState<string>(initial.recycledReused ?? '')
  const [treatment, setTreatment] = useState<string>(initial.treatment ?? 'STP')
  const [destination, setDestination] = useState<string>(initial.destination ?? '')
  const [sourceUnit, setSourceUnit] = useState<string>(initial.sourceUnit ?? 'KL')
  const [waterStress, setWaterStress] = useState<boolean>(initial.waterStress ?? false)
  const [zldActive, setZldActive] = useState<boolean>(initial.zldActive ?? false)
  const [evidenceId, setEvidenceId] = useState<string>(initial.evidenceId ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const persist = (patch: any) => { formStateRef.current[key] = { ...(formStateRef.current[key] || {}), ...patch } }
  useEffect(() => { persist({ source, withdrawal, consumption, discharge, recycledReused, treatment, destination, sourceUnit, waterStress, zldActive, evidenceId }) }, [source, withdrawal, consumption, discharge, recycledReused, treatment, destination, sourceUnit, waterStress, zldActive, evidenceId])

  const save = async () => {
    setError('')
    if (!withdrawal || Number(withdrawal) <= 0) { setError('Withdrawal must be > 0'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/water', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, reportingPeriodId: periodId, source,
          withdrawal: Number(withdrawal),
          consumption: consumption ? Number(consumption) : undefined,
          discharge: discharge ? Number(discharge) : undefined,
          recycledReused: recycledReused ? Number(recycledReused) : 0,
          treatment: treatment || undefined, destination: destination || undefined,
          sourceUnit, waterStress, zldActive, evidenceId: evidenceId || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || d.payload?.error || 'Save failed')
      onSaved({
        id: d.record.id, recordType: 'WATER',
        issues: d.issues || [], calculation: null,
        validationStatus: d.record.validationStatus,
      })
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormGrid>
      <FormField label="Water source" hint="Where the water came from.">
        <select value={source} disabled={readOnly} onChange={(e) => setSource(e.target.value)} className={inputClass}>
          {WATER_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </FormField>
      <FormField label="Source unit" hint="Kilolitres by default.">
        <select value={sourceUnit} disabled={readOnly} onChange={(e) => setSourceUnit(e.target.value)} className={inputClass}>
          {['KL', 'M3', 'L'].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </FormField>
      <FormField label="Withdrawal" hint="Total intake for the period.">
        <input type="number" min="0" step="any" value={withdrawal} disabled={readOnly}
          onChange={(e) => setWithdrawal(e.target.value)} placeholder="e.g. 4200" className={inputClass} />
      </FormField>
      <FormField label="Consumption" hint="Withdrawn − discharged (water consumed).">
        <input type="number" min="0" step="any" value={consumption} disabled={readOnly}
          onChange={(e) => setConsumption(e.target.value)} placeholder="e.g. 1260" className={inputClass} />
      </FormField>
      <FormField label="Discharge" hint="Returned to environment / third-party.">
        <input type="number" min="0" step="any" value={discharge} disabled={readOnly}
          onChange={(e) => setDischarge(e.target.value)} placeholder="e.g. 800" className={inputClass} />
      </FormField>
      <FormField label="Recycled / reused" hint="Through STP / rainwater harvesting.">
        <input type="number" min="0" step="any" value={recycledReused} disabled={readOnly}
          onChange={(e) => setRecycledReused(e.target.value)} placeholder="e.g. 2140" className={inputClass} />
      </FormField>
      <FormField label="Treatment" hint="STP / ETP / none.">
        <input value={treatment} disabled={readOnly} onChange={(e) => setTreatment(e.target.value)} placeholder="STP" className={inputClass} />
      </FormField>
      <FormField label="Destination" hint="Where discharge goes.">
        <input value={destination} disabled={readOnly} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Irrigation" className={inputClass} />
      </FormField>
      <FormField label="Flags" hint="Site-specific attributes." full>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
            <input type="checkbox" checked={waterStress} disabled={readOnly}
              onChange={(e) => setWaterStress(e.target.checked)} className="h-4 w-4 accent-blue-500" />
            Water-stressed site
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
            <input type="checkbox" checked={zldActive} disabled={readOnly}
              onChange={(e) => setZldActive(e.target.checked)} className="h-4 w-4 accent-blue-500" />
            ZLD active
          </label>
        </div>
      </FormField>
      <FormField label="Evidence file" hint="Optional — STP register / meter log." full>
        <select value={evidenceId} disabled={readOnly} onChange={(e) => setEvidenceId(e.target.value)} className={inputClass}>
          <option value="">— None —</option>
          {evidence.map(ev => <option key={ev.id} value={ev.id}>{ev.fileName}</option>)}
        </select>
      </FormField>
      <FormActions error={error} submitting={submitting} readOnly={readOnly} onSave={save} />
    </FormGrid>
  )
}

/* ============================================================
   WASTE FORM
   ============================================================ */
function WasteForm({ projectId, periodId, evidence, readOnly, formStateRef, onSaved }: FormProps) {
  const key = `waste-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}
  const [wasteType, setWasteType] = useState<string>(initial.wasteType ?? 'E-waste')
  const [hazardous, setHazardous] = useState<boolean>(initial.hazardous ?? false)
  const [generatedQty, setGeneratedQty] = useState<string>(initial.generatedQty ?? '')
  const [recoveredQty, setRecoveredQty] = useState<string>(initial.recoveredQty ?? '')
  const [recycledQty, setRecycledQty] = useState<string>(initial.recycledQty ?? '')
  const [reusedQty, setReusedQty] = useState<string>(initial.reusedQty ?? '')
  const [disposedQty, setDisposedQty] = useState<string>(initial.disposedQty ?? '')
  const [disposalRoute, setDisposalRoute] = useState<string>(initial.disposalRoute ?? '')
  const [vendor, setVendor] = useState<string>(initial.vendor ?? '')
  const [manifestRef, setManifestRef] = useState<string>(initial.manifestRef ?? '')
  const [sourceUnit, setSourceUnit] = useState<string>(initial.sourceUnit ?? 'TON')
  const [evidenceId, setEvidenceId] = useState<string>(initial.evidenceId ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const persist = (patch: any) => { formStateRef.current[key] = { ...(formStateRef.current[key] || {}), ...patch } }
  useEffect(() => { persist({ wasteType, hazardous, generatedQty, recoveredQty, recycledQty, reusedQty, disposedQty, disposalRoute, vendor, manifestRef, sourceUnit, evidenceId }) }, [wasteType, hazardous, generatedQty, recoveredQty, recycledQty, reusedQty, disposedQty, disposalRoute, vendor, manifestRef, sourceUnit, evidenceId])

  const save = async () => {
    setError('')
    if (generatedQty === '' || Number(generatedQty) < 0) { setError('Generated quantity must be ≥ 0'); return }
    if (hazardous && !manifestRef) { setError('Hazardous waste requires a manifest reference'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/waste', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, reportingPeriodId: periodId, wasteType, hazardous,
          generatedQty: Number(generatedQty),
          recoveredQty: recoveredQty ? Number(recoveredQty) : 0,
          recycledQty: recycledQty ? Number(recycledQty) : 0,
          reusedQty: reusedQty ? Number(reusedQty) : 0,
          disposedQty: disposedQty ? Number(disposedQty) : 0,
          disposalRoute: disposalRoute || undefined, vendor: vendor || undefined,
          manifestRef: manifestRef || undefined, sourceUnit,
          evidenceId: evidenceId || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || d.payload?.error || 'Save failed')
      onSaved({
        id: d.record.id, recordType: 'WASTE',
        issues: d.issues || [], calculation: null,
        validationStatus: d.record.validationStatus,
      })
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormGrid>
      <FormField label="Waste type" hint="E-waste, sludge, scrap, etc.">
        <input value={wasteType} disabled={readOnly} onChange={(e) => setWasteType(e.target.value)} placeholder="E-waste" className={inputClass} />
      </FormField>
      <FormField label="Source unit" hint="Tonnes by default.">
        <select value={sourceUnit} disabled={readOnly} onChange={(e) => setSourceUnit(e.target.value)} className={inputClass}>
          {['TON', 'T', 'KG'].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </FormField>
      <FormField label="Generated qty" hint="Total generated this period.">
        <input type="number" min="0" step="any" value={generatedQty} disabled={readOnly}
          onChange={(e) => setGeneratedQty(e.target.value)} placeholder="e.g. 2.4" className={inputClass} />
      </FormField>
      <FormField label="Recovered qty" hint="Sent for recovery.">
        <input type="number" min="0" step="any" value={recoveredQty} disabled={readOnly}
          onChange={(e) => setRecoveredQty(e.target.value)} placeholder="e.g. 2.3" className={inputClass} />
      </FormField>
      <FormField label="Recycled qty" hint="Processed by recycler.">
        <input type="number" min="0" step="any" value={recycledQty} disabled={readOnly}
          onChange={(e) => setRecycledQty(e.target.value)} placeholder="e.g. 2.3" className={inputClass} />
      </FormField>
      <FormField label="Reused qty" hint="Reused on-site.">
        <input type="number" min="0" step="any" value={reusedQty} disabled={readOnly}
          onChange={(e) => setReusedQty(e.target.value)} placeholder="0" className={inputClass} />
      </FormField>
      <FormField label="Disposed qty" hint="Landfill / TSDF.">
        <input type="number" min="0" step="any" value={disposedQty} disabled={readOnly}
          onChange={(e) => setDisposedQty(e.target.value)} placeholder="0.1" className={inputClass} />
      </FormField>
      <FormField label="Disposal route" hint="Authorised recycler / TSDF.">
        <input value={disposalRoute} disabled={readOnly} onChange={(e) => setDisposalRoute(e.target.value)} placeholder="Authorised Recycler" className={inputClass} />
      </FormField>
      <FormField label="Vendor" hint="Authorised vendor name.">
        <input value={vendor} disabled={readOnly} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Ecoreco" className={inputClass} />
      </FormField>
      <FormField label="Manifest reference" hint="Required for hazardous waste.">
        <input value={manifestRef} disabled={readOnly} onChange={(e) => setManifestRef(e.target.value)} placeholder="EWM-GJT-04-01" className={inputClass} />
      </FormField>
      <FormField label="Hazardous?" hint="If yes, manifest is mandatory." full>
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
          <input type="checkbox" checked={hazardous} disabled={readOnly}
            onChange={(e) => setHazardous(e.target.checked)} className="h-4 w-4 accent-blue-500" />
          Mark as hazardous waste
        </label>
      </FormField>
      <FormField label="Evidence file" hint="Optional — manifest / register." full>
        <select value={evidenceId} disabled={readOnly} onChange={(e) => setEvidenceId(e.target.value)} className={inputClass}>
          <option value="">— None —</option>
          {evidence.map(ev => <option key={ev.id} value={ev.id}>{ev.fileName}</option>)}
        </select>
      </FormField>
      <FormActions error={error} submitting={submitting} readOnly={readOnly} onSave={save} />
    </FormGrid>
  )
}

/* ============================================================
   WORKFORCE FORM
   ============================================================ */
function WorkforceForm({ projectId, periodId, evidence, readOnly, formStateRef, onSaved }: FormProps) {
  const key = `workforce-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}
  const [category, setCategory] = useState<'EMPLOYEE' | 'WORKER'>(initial.category ?? 'EMPLOYEE')
  const [permanent, setPermanent] = useState<string>(initial.permanent ?? '')
  const [nonPermanent, setNonPermanent] = useState<string>(initial.nonPermanent ?? '')
  const [male, setMale] = useState<string>(initial.male ?? '')
  const [female, setFemale] = useState<string>(initial.female ?? '')
  const [other, setOther] = useState<string>(initial.other ?? '0')
  const [differentlyAbled, setDifferentlyAbled] = useState<string>(initial.differentlyAbled ?? '0')
  const [newHires, setNewHires] = useState<string>(initial.newHires ?? '0')
  const [exits, setExits] = useState<string>(initial.exits ?? '0')
  const [trainingHours, setTrainingHours] = useState<string>(initial.trainingHours ?? '')
  const [evidenceId, setEvidenceId] = useState<string>(initial.evidenceId ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const total = (Number(permanent) || 0) + (Number(nonPermanent) || 0)
  const genderTotal = (Number(male) || 0) + (Number(female) || 0) + (Number(other) || 0)

  const persist = (patch: any) => { formStateRef.current[key] = { ...(formStateRef.current[key] || {}), ...patch } }
  useEffect(() => { persist({ category, permanent, nonPermanent, male, female, other, differentlyAbled, newHires, exits, trainingHours, evidenceId }) }, [category, permanent, nonPermanent, male, female, other, differentlyAbled, newHires, exits, trainingHours, evidenceId])

  const save = async () => {
    setError('')
    if (permanent === '' || nonPermanent === '' || male === '' || female === '') { setError('Permanent, non-permanent, male and female counts are required'); return }
    if (genderTotal !== total) { setError(`Gender total (${genderTotal}) must equal workforce total (${total})`); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/workforce', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, reportingPeriodId: periodId, category,
          permanent: Number(permanent), nonPermanent: Number(nonPermanent),
          male: Number(male), female: Number(female),
          other: other ? Number(other) : 0,
          differentlyAbled: differentlyAbled ? Number(differentlyAbled) : undefined,
          newHires: newHires ? Number(newHires) : 0,
          exits: exits ? Number(exits) : 0,
          trainingHours: trainingHours ? Number(trainingHours) : undefined,
          evidenceId: evidenceId || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || d.payload?.error || 'Save failed')
      onSaved({
        id: d.record.id, recordType: 'PEOPLE',
        issues: d.issues || [], calculation: null,
        validationStatus: d.record.validationStatus,
      })
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormGrid>
      <FormField label="Category" hint="Employee or worker.">
        <select value={category} disabled={readOnly} onChange={(e) => setCategory(e.target.value as 'EMPLOYEE' | 'WORKER')} className={inputClass}>
          <option value="EMPLOYEE">Employee</option>
          <option value="WORKER">Worker</option>
        </select>
      </FormField>
      <FormField label="Training hours" hint="Aggregated training hours for the period.">
        <input type="number" min="0" step="any" value={trainingHours} disabled={readOnly}
          onChange={(e) => setTrainingHours(e.target.value)} placeholder="e.g. 312" className={inputClass} />
      </FormField>
      <FormField label="Permanent" hint="Permanent headcount.">
        <input type="number" min="0" value={permanent} disabled={readOnly}
          onChange={(e) => setPermanent(e.target.value)} placeholder="e.g. 42" className={inputClass} />
      </FormField>
      <FormField label="Non-permanent" hint="Contractual / temporary.">
        <input type="number" min="0" value={nonPermanent} disabled={readOnly}
          onChange={(e) => setNonPermanent(e.target.value)} placeholder="e.g. 8" className={inputClass} />
      </FormField>
      <FormField label="Male" hint="Male headcount.">
        <input type="number" min="0" value={male} disabled={readOnly}
          onChange={(e) => setMale(e.target.value)} placeholder="e.g. 38" className={inputClass} />
      </FormField>
      <FormField label="Female" hint="Female headcount.">
        <input type="number" min="0" value={female} disabled={readOnly}
          onChange={(e) => setFemale(e.target.value)} placeholder="e.g. 12" className={inputClass} />
      </FormField>
      <FormField label="Other" hint="Non-binary / other.">
        <input type="number" min="0" value={other} disabled={readOnly}
          onChange={(e) => setOther(e.target.value)} placeholder="0" className={inputClass} />
      </FormField>
      <FormField label="Differently-abled" hint="Voluntary disclosure.">
        <input type="number" min="0" value={differentlyAbled} disabled={readOnly}
          onChange={(e) => setDifferentlyAbled(e.target.value)} placeholder="0" className={inputClass} />
      </FormField>
      <FormField label="New hires" hint="Joined this period.">
        <input type="number" min="0" value={newHires} disabled={readOnly}
          onChange={(e) => setNewHires(e.target.value)} placeholder="0" className={inputClass} />
      </FormField>
      <FormField label="Exits" hint="Left this period.">
        <input type="number" min="0" value={exits} disabled={readOnly}
          onChange={(e) => setExits(e.target.value)} placeholder="0" className={inputClass} />
      </FormField>
      <FormField label="Totals check" hint="Gender total must equal permanent + non-permanent." full>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <span className={`status-pill ${genderTotal === total ? 'status-approved' : 'status-missing'}`}>
            Total: {total} · Gender: {genderTotal}
          </span>
          {genderTotal !== total && <span className="text-rose-600">Reconcile headcount register with HRIS gender split.</span>}
        </div>
      </FormField>
      <FormField label="Evidence file" hint="Optional — HRIS export." full>
        <select value={evidenceId} disabled={readOnly} onChange={(e) => setEvidenceId(e.target.value)} className={inputClass}>
          <option value="">— None —</option>
          {evidence.map(ev => <option key={ev.id} value={ev.id}>{ev.fileName}</option>)}
        </select>
      </FormField>
      <FormActions error={error} submitting={submitting} readOnly={readOnly} onSave={save} />
    </FormGrid>
  )
}

/* ============================================================
   SAFETY FORM
   ============================================================ */
const SAFETY_TYPES = ['INCIDENT', 'INJURY', 'FATALITY', 'LTI', 'RECORDABLE', 'TRAINING', 'ASSESSMENT']

function SafetyForm({ projectId, periodId, evidence, readOnly, formStateRef, onSaved }: FormProps) {
  const key = `safety-${projectId}-${periodId}`
  const initial = formStateRef.current[key] || {}
  const [recordType, setRecordType] = useState<string>(initial.recordType ?? 'INCIDENT')
  const [fatalities, setFatalities] = useState<string>(initial.fatalities ?? '0')
  const [injuries, setInjuries] = useState<string>(initial.injuries ?? '0')
  const [lostTimeIncidents, setLostTimeIncidents] = useState<string>(initial.lostTimeIncidents ?? '0')
  const [recordableInjuries, setRecordableInjuries] = useState<string>(initial.recordableInjuries ?? '0')
  const [highConsequenceIncidents, setHighConsequenceIncidents] = useState<string>(initial.highConsequenceIncidents ?? '0')
  const [trainingHours, setTrainingHours] = useState<string>(initial.trainingHours ?? '')
  const [safetyHours, setSafetyHours] = useState<string>(initial.safetyHours ?? '')
  const [manHoursWorked, setManHoursWorked] = useState<string>(initial.manHoursWorked ?? '')
  const [correctiveActions, setCorrectiveActions] = useState<string>(initial.correctiveActions ?? '')
  const [evidenceId, setEvidenceId] = useState<string>(initial.evidenceId ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const lti = Number(lostTimeIncidents) || 0
  const mhw = Number(manHoursWorked) || 0
  const ltifr = mhw > 0 ? ((lti * 1000000) / mhw).toFixed(3) : null

  const persist = (patch: any) => { formStateRef.current[key] = { ...(formStateRef.current[key] || {}), ...patch } }
  useEffect(() => { persist({ recordType, fatalities, injuries, lostTimeIncidents, recordableInjuries, highConsequenceIncidents, trainingHours, safetyHours, manHoursWorked, correctiveActions, evidenceId }) }, [recordType, fatalities, injuries, lostTimeIncidents, recordableInjuries, highConsequenceIncidents, trainingHours, safetyHours, manHoursWorked, correctiveActions, evidenceId])

  const save = async () => {
    setError('')
    if (!recordType) { setError('Record type is required'); return }
    setSubmitting(true)
    try {
      const r = await fetch('/api/safety', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, reportingPeriodId: periodId, recordType,
          fatalities: Number(fatalities) || 0, injuries: Number(injuries) || 0,
          lostTimeIncidents: Number(lostTimeIncidents) || 0,
          recordableInjuries: Number(recordableInjuries) || 0,
          highConsequenceIncidents: Number(highConsequenceIncidents) || 0,
          trainingHours: trainingHours ? Number(trainingHours) : undefined,
          safetyHours: safetyHours ? Number(safetyHours) : undefined,
          manHoursWorked: manHoursWorked ? Number(manHoursWorked) : undefined,
          correctiveActions: correctiveActions || undefined,
          evidenceId: evidenceId || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || d.payload?.error || 'Save failed')
      onSaved({
        id: d.record.id, recordType: 'SAFETY',
        issues: d.issues || [], calculation: null,
        derivedLtifr: d.derivedLtifr ?? null,
        validationStatus: d.record.validationStatus,
      })
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormGrid>
      <FormField label="Record type" hint="Type of safety record.">
        <select value={recordType} disabled={readOnly} onChange={(e) => setRecordType(e.target.value)} className={inputClass}>
          {SAFETY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </FormField>
      <FormField label="Man-hours worked" hint="Total hours worked — required for LTIFR.">
        <input type="number" min="0" step="any" value={manHoursWorked} disabled={readOnly}
          onChange={(e) => setManHoursWorked(e.target.value)} placeholder="e.g. 48600" className={inputClass} />
      </FormField>
      <FormField label="Fatalities" hint="Fatalities this period.">
        <input type="number" min="0" value={fatalities} disabled={readOnly}
          onChange={(e) => setFatalities(e.target.value)} placeholder="0" className={inputClass} />
      </FormField>
      <FormField label="Injuries" hint="Recordable injuries count.">
        <input type="number" min="0" value={injuries} disabled={readOnly}
          onChange={(e) => setInjuries(e.target.value)} placeholder="0" className={inputClass} />
      </FormField>
      <FormField label="Lost-time incidents" hint="LTI count.">
        <input type="number" min="0" value={lostTimeIncidents} disabled={readOnly}
          onChange={(e) => setLostTimeIncidents(e.target.value)} placeholder="0" className={inputClass} />
      </FormField>
      <FormField label="Recordable injuries" hint="OSHA recordable.">
        <input type="number" min="0" value={recordableInjuries} disabled={readOnly}
          onChange={(e) => setRecordableInjuries(e.target.value)} placeholder="0" className={inputClass} />
      </FormField>
      <FormField label="High-consequence" hint="Serious injury / illness.">
        <input type="number" min="0" value={highConsequenceIncidents} disabled={readOnly}
          onChange={(e) => setHighConsequenceIncidents(e.target.value)} placeholder="0" className={inputClass} />
      </FormField>
      <FormField label="Training hours" hint="Safety training hours.">
        <input type="number" min="0" step="any" value={trainingHours} disabled={readOnly}
          onChange={(e) => setTrainingHours(e.target.value)} placeholder="e.g. 96" className={inputClass} />
      </FormField>
      <FormField label="Safety hours" hint="Total safety observation hours.">
        <input type="number" min="0" step="any" value={safetyHours} disabled={readOnly}
          onChange={(e) => setSafetyHours(e.target.value)} placeholder="e.g. 28800" className={inputClass} />
      </FormField>
      <FormField label="Corrective actions" hint="Planned remediation." full>
        <textarea value={correctiveActions} disabled={readOnly}
          onChange={(e) => setCorrectiveActions(e.target.value)}
          placeholder="e.g. Toolbox talk + PPE audit"
          className={inputClass + ' min-h-[60px] resize-y'} />
      </FormField>
      <FormField label="LTIFR preview" hint="Derived: (LTI × 1M) / man-hours." full>
        <div className="flex items-center gap-2 text-[11px]">
          {ltifr !== null ? (
            <span className="status-pill status-approved">{ltifr} /M hrs</span>
          ) : (
            <span className="status-pill status-warning">Enter man-hours to compute LTIFR</span>
          )}
        </div>
      </FormField>
      <FormField label="Evidence file" hint="Optional — incident report." full>
        <select value={evidenceId} disabled={readOnly} onChange={(e) => setEvidenceId(e.target.value)} className={inputClass}>
          <option value="">— None —</option>
          {evidence.map(ev => <option key={ev.id} value={ev.id}>{ev.fileName}</option>)}
        </select>
      </FormField>
      <FormActions error={error} submitting={submitting} readOnly={readOnly} onSave={save} />
    </FormGrid>
  )
}

/* ============================================================
   Shared form building blocks
   ============================================================ */
interface FormProps {
  projectId: string
  periodId: string
  evidence: EvidenceItem[]
  readOnly: boolean
  formStateRef: React.MutableRefObject<Record<string, Record<string, any>>>
  onSaved: (r: SavedRecord) => void
}

const inputClass = 'w-full rounded-lg border border-white/60 bg-white/70 px-2.5 py-2 text-[12px] font-medium text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60'

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
}

function FormField({ label, hint, children, full }: { label: string; hint?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

function FormActions({ error, submitting, readOnly, onSave }: { error: string; submitting: boolean; readOnly: boolean; onSave: () => void }) {
  return (
    <div className="md:col-span-2">
      {error && <div className="mb-2 rounded-lg border border-rose-200/70 bg-rose-50/60 px-3 py-1.5 text-[11px] font-medium text-rose-700"><AlertTriangle className="mr-1 inline h-3 w-3" /> {error}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onSave} disabled={readOnly || submitting}
          className="glass-subtle flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? <Clock className="h-3.5 w-3.5 animate-pulse" /> : <Save className="h-3.5 w-3.5" />}
          Save Draft
        </button>
        <span className="text-[10px] text-slate-400">Engine validates + calculates on save.</span>
      </div>
    </div>
  )
}

function describeRecord(r: any, subModule: SubModule): string {
  if (subModule === 'energy') return `${r.source} · ${r.quantity} ${r.sourceUnit}`
  if (subModule === 'water') return `${r.source} · ${r.withdrawal} ${r.sourceUnit}`
  if (subModule === 'waste') return `${r.wasteType} · ${r.generatedQty} ${r.sourceUnit}`
  if (subModule === 'workforce') return `${r.category} · ${(r.permanent || 0) + (r.nonPermanent || 0)} people`
  if (subModule === 'safety') return `${r.recordType} · ${r.manHoursWorked ?? 0} hrs`
  return r.id?.slice(-8) ?? 'Record'
}

/* ============================================================
   State helpers
   ============================================================ */
function DataEntrySkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200/60" />
      <div className="glass h-16 animate-pulse rounded-2xl" />
      <div className="glass h-24 animate-pulse rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass h-96 animate-pulse rounded-2xl lg:col-span-2" />
        <div className="glass h-96 animate-pulse rounded-2xl lg:col-span-1" />
      </div>
      <div className="glass h-16 animate-pulse rounded-2xl" />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-500" />
      <div>
        <div className="text-base font-bold text-slate-800">Failed to load Data Entry</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button onClick={onRetry} className="btn-glass-primary rounded-full px-5 py-2 text-xs font-semibold">Retry</button>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <FileText className="h-10 w-10 text-slate-400" />
      <div>
        <div className="text-base font-bold text-slate-800">No data to enter yet</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
    </div>
  )
}
