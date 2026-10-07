'use client'
/**
 * Audit & Traceability Module — every number traceable to source.
 *
 * Endpoints used:
 *   GET /api/audit?action=&entityType=&entityId=   — audit log (100 most recent)
 *   GET /api/audit/trace/[id]?type=                — vertical traceability tree:
 *        SOURCE → EVIDENCE → VALIDATION → CALCULATION → SUBMISSION
 *        → APPROVAL_HISTORY → CORRECTIONS → BRSR_MAPPING
 *
 * Click any audit log row to trace its entity; or enter an entity id + type
 * manually in the search bar above the tree panel.
 */
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  History, Search, AlertOctagon, RefreshCw, Loader2, GitBranch, ShieldCheck,
  Database, Link2, Calculator, Send, FileCheck2, AlertTriangle, ArrowDown,
  ChevronRight, Building2, User, Clock, Filter, FileText, ArrowRight, Leaf
} from 'lucide-react'
import { useApp } from '@/lib/auth-context'

// ============================================================
// Types
// ============================================================
interface AuditLogItem {
  id: string
  actorId: string
  actorName: string
  actorRole: string
  actorEmail: string | null
  actorEmployeeCode: string | null
  actorRoles: Array<{ key: string; name: string }>
  action: string
  entityType: string
  entityId: string
  oldState: string | null
  newState: string | null
  reason: string | null
  metadata: string | null
  ipAddress: string | null
  createdAt: string
}

interface AuditResponse {
  user: { id: string; name: string }
  total: number
  count: number
  items: AuditLogItem[]
}

interface TraceNode {
  id: string
  type: string
  label: string
  data?: unknown
  children?: TraceNode[]
}

interface TraceResponse {
  user: { id: string; name: string }
  entity: { id: string; type: string; label: string }
  tree: TraceNode[]
  summary: Record<string, number>
}

// ============================================================
// Module
// ============================================================
export function AuditModule() {
  const { user } = useApp()
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ action: '', entityType: '', entityId: '' })
  const [trace, setTrace] = useState<TraceResponse | null>(null)
  const [traceLoading, setTraceLoading] = useState(false)
  const [traceError, setTraceError] = useState('')
  const [manualId, setManualId] = useState('')
  const [manualType, setManualType] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.action) params.set('action', filters.action)
      if (filters.entityType) params.set('entityType', filters.entityType)
      if (filters.entityId) params.set('entityId', filters.entityId)
      params.set('take', '100')
      const data = await fetch(`/api/audit?${params.toString()}`).then(r => r.json())
      setLogs((data as AuditResponse).items ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { load() }, [load])

  const loadTrace = useCallback(async (entityId: string, type?: string) => {
    if (!entityId) return
    setTraceLoading(true)
    setTraceError('')
    setTrace(null)
    try {
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      const res = await fetch(`/api/audit/trace/${entityId}?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setTraceError(data?.error ?? 'Trace failed')
      } else {
        setTrace(data as TraceResponse)
      }
    } catch (e: any) {
      setTraceError(e?.message ?? 'Network error')
    } finally {
      setTraceLoading(false)
    }
  }, [])

  // Auto-load trace from the first audit log entry on initial mount
  useEffect(() => {
    if (!trace && !traceLoading && logs.length > 0 && !manualId) {
      const first = logs[0]
      loadTrace(first.entityId, mapEntityType(first.entityType))
    }
  }, [logs])

  const handleManualTrace = () => {
    if (!manualId.trim()) {
      toast.error('Enter an entity ID to trace')
      return
    }
    loadTrace(manualId.trim(), manualType || undefined)
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Audit &amp; Traceability</h1>
            <span className="status-pill status-approved"><ShieldCheck className="h-3 w-3" /> {logs.length} entries</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Every number is traceable to source — pick any entity and follow the chain end-to-end.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh log
          </button>
        </div>
      </div>

      {/* MAIN LAYOUT — log (left) + trace (right) */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr,1fr]">
        {/* AUDIT LOG */}
        <div className="glass glass-shimmer rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">Audit Log</h3>
              <span className="status-pill status-submitted">{logs.length} of 100</span>
            </div>
            <span className="text-[10px] text-slate-400">Sorted by timestamp desc</span>
          </div>

          {/* Filters */}
          <div className="mb-3 grid grid-cols-3 gap-2">
            <input
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              placeholder="Action (e.g. SUBMIT)"
              className="rounded-lg border border-white/60 bg-white/70 px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-blue-300"
            />
            <input
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
              placeholder="Entity Type"
              className="rounded-lg border border-white/60 bg-white/70 px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-blue-300"
            />
            <input
              value={filters.entityId}
              onChange={(e) => setFilters({ ...filters, entityId: e.target.value })}
              placeholder="Entity ID"
              className="rounded-lg border border-white/60 bg-white/70 px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-blue-300"
            />
          </div>

          {loading ? (
            <LogSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <AlertOctagon className="h-7 w-7 text-rose-500" />
              <div className="text-xs font-semibold text-slate-700">Failed to load audit log</div>
              <div className="text-[11px] text-slate-500">{error}</div>
              <button onClick={load} className="btn-glass-primary rounded-full px-3 py-1.5 text-[11px] font-semibold">Retry</button>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <History className="h-8 w-8 text-slate-300" />
              <div className="text-xs font-semibold text-slate-500">No audit log entries match these filters</div>
            </div>
          ) : (
            <div className="max-h-[640px] space-y-1 overflow-y-auto scroll-elegant pr-1">
              {logs.map((l, i) => (
                <LogRow key={l.id} log={l} delay={Math.min(i * 0.015, 0.6)} onClick={() => loadTrace(l.entityId, mapEntityType(l.entityType))} />
              ))}
            </div>
          )}
        </div>

        {/* TRACE TREE */}
        <div className="glass glass-shimmer rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">Traceability Tree</h3>
              {trace && <span className="status-pill status-verified">{trace.summary ? Object.values(trace.summary).reduce((s, n) => s + n, 0) : 0} nodes</span>}
            </div>
          </div>

          {/* Manual trace input */}
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/40 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
            <input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Entity ID…"
              className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-700 outline-none"
            />
            <select
              value={manualType}
              onChange={(e) => setManualType(e.target.value)}
              className="bg-transparent text-[11px] text-slate-500 outline-none"
            >
              <option value="">Auto-detect</option>
              <option value="Submission">Submission</option>
              <option value="EnergyRecord">EnergyRecord</option>
              <option value="WaterRecord">WaterRecord</option>
              <option value="WasteRecord">WasteRecord</option>
              <option value="WorkforceRecord">WorkforceRecord</option>
              <option value="SafetyRecord">SafetyRecord</option>
              <option value="BrsbAnswer">BrsrAnswer</option>
            </select>
            <button
              onClick={handleManualTrace}
              className="btn-glass-primary flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
            >
              Trace
            </button>
          </div>

          {traceLoading ? (
            <TraceSkeleton />
          ) : traceError ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <AlertTriangle className="h-7 w-7 text-amber-500" />
              <div className="text-xs font-semibold text-slate-700">{traceError}</div>
              <div className="text-[11px] text-slate-500">Try another entity ID — auto-detect scans all source tables.</div>
            </div>
          ) : !trace ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <GitBranch className="h-10 w-10 text-slate-300" />
              <div className="text-xs font-semibold text-slate-500">No entity selected</div>
              <div className="max-w-xs text-[11px] text-slate-400">Click any audit log row, or enter an entity ID above to trace its full lineage.</div>
            </div>
          ) : (
            <TraceTree trace={trace} />
          )}
        </div>
      </div>

      {/* ROLE NOTICE */}
      {user && user.roles[0]?.key !== 'SUPER_ADMIN' && !user.roles.some(r => r.key === 'AUDITOR') && (
        <div className="glass-subtle flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
          <span>Read-only audit access — all mutations are logged immutably. Auditor / Super Admin roles have full audit-read access.</span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Log row
// ============================================================
function LogRow({ log, delay, onClick }: { log: AuditLogItem; delay: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="w-full rounded-xl bg-white/40 px-3 py-2 text-left transition hover:bg-white/70"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`status-pill ${actionPill(log.action)}`}>{log.action}</span>
          <span className="truncate text-[11px] font-semibold text-slate-700">{log.actorName}</span>
          {log.actorRoles[0] && <span className="text-[10px] text-slate-400">· {log.actorRoles[0].name}</span>}
        </div>
        <span className="flex-shrink-0 text-[10px] text-slate-400 tabular-nums">{new Date(log.createdAt).toLocaleString()}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{log.entityType}</span>
        <code className="truncate font-mono text-[10px] text-slate-400">{log.entityId}</code>
        <ChevronRight className="ml-auto h-3 w-3 text-blue-500" />
      </div>
      {log.reason && <div className="mt-1 truncate text-[11px] text-slate-500">{log.reason}</div>}
    </motion.button>
  )
}

// ============================================================
// Trace tree
// ============================================================
function TraceTree({ trace }: { trace: TraceResponse }) {
  return (
    <div className="space-y-2">
      {/* Entity banner */}
      <div className="rounded-xl border border-blue-200/50 bg-blue-50/50 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Tracing entity</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{trace.entity.type}</span>
          <code className="font-mono text-[11px] text-slate-600">{trace.entity.id}</code>
        </div>
        <div className="mt-1 text-xs text-slate-600">{trace.entity.label}</div>
      </div>

      {/* Summary chips */}
      {trace.summary && Object.keys(trace.summary).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(trace.summary).map(([k, v]) => (
            <div key={k} className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] text-slate-500">
              <span className="font-semibold text-slate-700">{k}</span>
              <span className="ml-1 tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Vertical stages */}
      <div className="relative space-y-2 pl-5">
        {/* Vertical line */}
        <div className="absolute left-[10px] top-2 bottom-2 w-px bg-gradient-to-b from-blue-300 via-blue-200 to-transparent" />
        <AnimatePresence>
          {trace.tree.map((stage, idx) => (
            <StageNode key={stage.id} stage={stage} index={idx} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StageNode({ stage, index }: { stage: TraceNode; index: number }) {
  const [expanded, setExpanded] = useState(true)
  const childCount = stage.children?.length ?? 0
  const StageIcon = STAGE_ICONS[stage.label] ?? Database
  const toneClass = STAGE_TONES[stage.label] ?? 'bg-slate-100 text-slate-600'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      {/* Node dot */}
      <div className={`absolute -left-5 top-2 flex h-5 w-5 items-center justify-center rounded-full ${toneClass}`}>
        <StageIcon className="h-2.5 w-2.5" />
      </div>

      {/* Stage header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-xl bg-white/60 px-3 py-2 text-left transition hover:bg-white/80"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{stage.label}</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 tabular-nums">{childCount}</span>
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition ${expanded ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {expanded && childCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-1 space-y-1 overflow-hidden pl-1"
          >
            {stage.children!.map((child, i) => (
              <ChildNode key={child.id} child={child} delay={i * 0.03} />
            ))}
          </motion.div>
        )}
        {expanded && childCount === 0 && (
          <div className="mt-1 rounded-lg bg-white/30 px-3 py-1.5 text-[10px] text-slate-400">No {stage.label.toLowerCase()} for this entity.</div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ChildNode({ child, delay }: { child: TraceNode; delay: number }) {
  const data = (child.data ?? {}) as Record<string, any>
  const summary = summarize(child.type, data)

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="rounded-lg bg-white/50 px-2.5 py-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-blue-700">{child.type}</span>
          <span className="truncate text-[11px] font-semibold text-slate-700">{child.label}</span>
        </div>
        <code className="flex-shrink-0 truncate font-mono text-[9px] text-slate-400" style={{ maxWidth: 80 }}>{child.id}</code>
      </div>
      {summary.length > 0 && (
        <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
          {summary.map(({ k, v }) => (
            <div key={k} className="flex items-center justify-between">
              <span className="truncate">{k}</span>
              <span className="ml-1 truncate font-medium text-slate-700">{v}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ============================================================
// Helpers — turn arbitrary data objects into 2-4 summary rows.
// ============================================================
function summarize(type: string, d: Record<string, any>): Array<{ k: string; v: string }> {
  if (!d || typeof d !== 'object') return []
  const out: Array<{ k: string; v: string }> = []
  const push = (k: string, v: unknown) => {
    if (v === null || v === undefined || v === '') return
    out.push({ k, v: String(v).slice(0, 40) })
  }

  // Source-record-ish fields
  if (d.project?.projectName) push('Project', d.project.projectName)
  if (d.project?.projectCode) push('Code', d.project.projectCode)
  if (d.source) push('Source', d.source)
  if (d.sourceCategory) push('Category', d.sourceCategory)
  if (d.quantity != null) push('Quantity', d.quantity)
  if (d.sourceUnit) push('Unit', d.sourceUnit)
  if (d.normalizedValue != null) push('GJ', d.normalizedValue)
  if (d.calculatedValue != null) push('tCO2e', d.calculatedValue)
  if (d.scope) push('Scope', d.scope)
  if (d.factorVersion) push('Factor v', d.factorVersion)
  if (d.methodologyNote) push('Method', d.methodologyNote.slice(0, 30))

  // Water
  if (d.withdrawal != null) push('Withdrawal', d.withdrawal)
  if (d.recycledReused != null) push('Recycled', d.recycledReused)
  if (d.zldActive != null) push('ZLD', d.zldActive ? 'Yes' : 'No')
  if (d.waterStress != null) push('Stress', d.waterStress ? 'Yes' : 'No')

  // Waste
  if (d.generatedQty != null) push('Generated', d.generatedQty)
  if (d.recoveredQty != null) push('Recovered', d.recoveredQty)
  if (d.hazardous != null) push('Hazardous', d.hazardous ? 'Yes' : 'No')
  if (d.wasteType) push('Type', d.wasteType)

  // Workforce
  if (d.category) push('Category', d.category)
  if (d.permanent != null) push('Perm', d.permanent)
  if (d.nonPermanent != null) push('NonPerm', d.nonPermanent)
  if (d.female != null) push('Female', d.female)
  if (d.trainingHours != null) push('Train Hrs', d.trainingHours)

  // Safety
  if (d.recordType) push('RecType', d.recordType)
  if (d.fatalities != null) push('Fatalities', d.fatalities)
  if (d.injuries != null) push('Injuries', d.injuries)
  if (d.lostTimeIncidents != null) push('LTI', d.lostTimeIncidents)
  if (d.manHoursWorked != null) push('ManHrs', d.manHoursWorked)
  if (d.ltifr != null) push('LTIFR', d.ltifr)

  // Evidence
  if (d.fileName) push('File', d.fileName)
  if (d.status) push('Status', d.status)
  if (d.documentType) push('DocType', d.documentType)
  if (d.verifiedAt) push('Verified', new Date(d.verifiedAt).toLocaleDateString())
  if (d.verifiedBy) push('By', d.verifiedBy)

  // Validation
  if (d.ruleCode) push('Rule', d.ruleCode)
  if (d.severity) push('Severity', d.severity)
  if (d.detectedAt) push('At', new Date(d.detectedAt).toLocaleDateString())
  if (d.message) push('Msg', String(d.message).slice(0, 30))

  // Calculation
  if (d.resultUnit) push('Unit', d.resultUnit)
  if (d.factorId) push('FactorId', String(d.factorId).slice(0, 8))

  // Submission
  if (d.title) push('Title', d.title)
  if (d.module) push('Module', d.module)
  if (d.currentReviewer?.name) push('Reviewer', d.currentReviewer.name)
  if (d.reportingPeriod?.periodLabel) push('Period', d.reportingPeriod.periodLabel)

  // History
  if (d.fromStatus) push('From', d.fromStatus)
  if (d.toStatus) push('To', d.toStatus)
  if (d.actorName) push('Actor', d.actorName)
  if (d.comment) push('Comment', String(d.comment).slice(0, 30))

  // Corrections
  if (d.field) push('Field', d.field)
  if (d.resolutionComment) push('Resolved', String(d.resolutionComment).slice(0, 30))
  if (d.resolvedAt) push('At', new Date(d.resolvedAt).toLocaleDateString())

  // BRSR mapping
  if (d.question?.questionCode) push('Q', d.question.questionCode)
  if (d.question?.principle?.code) push('Principle', d.question.principle.code)
  if (d.question?.section?.code) push('Section', d.question.section.code)
  if (d.answerValue) push('Answer', String(d.answerValue).slice(0, 30))
  if (d.numericValue != null) push('Numeric', d.numericValue)
  if (d.sourceType) push('SrcType', d.sourceType)

  // Cap at 6
  return out.slice(0, 6)
}

function mapEntityType(t: string): string {
  if (!t) return ''
  const lower = t.toLowerCase()
  if (lower.includes('submission')) return 'Submission'
  if (lower.includes('energy')) return 'EnergyRecord'
  if (lower.includes('water')) return 'WaterRecord'
  if (lower.includes('waste')) return 'WasteRecord'
  if (lower.includes('workforce') || lower.includes('people')) return 'WorkforceRecord'
  if (lower.includes('safety')) return 'SafetyRecord'
  if (lower.includes('travel')) return 'TravelRecord'
  if (lower.includes('brsr') || lower.includes('answer')) return 'BrsbAnswer'
  return ''
}

const STAGE_ICONS: Record<string, any> = {
  'SOURCE RECORDS': Database,
  'EVIDENCE': Link2,
  'VALIDATION': ShieldCheck,
  'CALCULATION': Calculator,
  'SUBMISSION': Send,
  'APPROVAL HISTORY': FileCheck2,
  'CORRECTIONS': AlertTriangle,
  'BRSR MAPPING': Leaf,
}

const STAGE_TONES: Record<string, string> = {
  'SOURCE RECORDS': 'bg-blue-100 text-blue-700',
  'EVIDENCE': 'bg-violet-100 text-violet-700',
  'VALIDATION': 'bg-amber-100 text-amber-700',
  'CALCULATION': 'bg-emerald-100 text-emerald-700',
  'SUBMISSION': 'bg-cyan-100 text-cyan-700',
  'APPROVAL HISTORY': 'bg-teal-100 text-teal-700',
  'CORRECTIONS': 'bg-rose-100 text-rose-700',
  'BRSR MAPPING': 'bg-blue-100 text-blue-700',
}

function actionPill(action: string): string {
  const a = action.toUpperCase()
  if (['CREATE', 'GENERATE', 'UPLOAD'].some(x => a.includes(x))) return 'status-submitted'
  if (['APPROVE', 'VERIFY', 'LOCK', 'COMPLETE'].some(x => a.includes(x))) return 'status-approved'
  if (['REJECT', 'CORRECTION', 'FAIL', 'ERROR'].some(x => a.includes(x))) return 'status-error'
  if (['SUBMIT', 'RESUBMIT', 'REVIEW'].some(x => a.includes(x))) return 'status-review'
  if (['UPDATE', 'PATCH'].some(x => a.includes(x))) return 'status-warning'
  return 'status-draft'
}

// ============================================================
// Skeletons
// ============================================================
function LogSkeleton() {
  return (
    <div className="space-y-1.5">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-white/40" />
      ))}
    </div>
  )
}

function TraceSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-16 animate-pulse rounded-xl bg-white/50" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-5 w-5 animate-pulse rounded-full bg-white/50" />
          <div className="h-10 flex-1 animate-pulse rounded-xl bg-white/40" />
        </div>
      ))}
    </div>
  )
}
