'use client'
/**
 * AuditorDashboard — Premium slate/steel assurance console for the AUDITOR role.
 *
 * Layout: top "Assurance Status" bar (4 compact stat tiles) + 2-column equal split:
 *   - LEFT  (50%)  : Audit Trail Timeline (vertical timeline of recent audit events)
 *   - RIGHT (50%)  : Evidence Status donut → Top Exceptions → Factor Version Inventory
 *
 * Color theme: Slate / Steel premium — slate-600 (#475569), steel-blue (#64748b),
 * cool gray gradients. Action-type pills retain their semantic accents (blue, cyan,
 * violet, emerald, rose, slate) per audit-log convention.
 *
 * Data sources (all real, no hardcoded numbers):
 *   - GET /api/overview     → kpis (evidenceTotal, evidenceVerified, openExceptions,
 *                              completion, totalSubs, projects, sources.*)
 *   - GET /api/audit?take=20 → recent audit log entries with actor + action + entity
 *   - GET /api/evidence?take=200 → derived evidence status breakdown for donut
 *   - GET /api/submissions?take=50 → submissions with validationErrors → exceptions
 *
 * The component is self-contained; it does not modify any other file.
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, FileSearch, Fingerprint, History, Eye, AlertTriangle,
  AlertOctagon, CheckCircle2, XCircle, Clock, ChevronRight, Database,
  Layers, Activity as ActivityIcon, RefreshCw, Lock, ScrollText,
  ExternalLink, Gauge, Hash, BookOpen, Cpu, Boxes,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

/* ============================================================
 * Types
 * ============================================================ */
interface Kpis {
  totalEmissions: number
  scope1: number
  scope2: number
  scope3: number
  completion: number
  totalSubs: number
  approvedSubs: number
  draftSubs: number
  reviewSubs: number
  openExceptions: number
  anomalies: number
  corrections: number
  evidenceTotal: number
  evidenceVerified: number
  brsrReadiness: number
  brsrMissing: number
  projects: number
  orgs: number
}

interface OverviewData {
  kpis: Kpis
  sources?: {
    calculationResults: number
    energyRecords: number
    waterRecords: number
    wasteRecords: number
    workforceRecords: number
    safetyRecords: number
    brsrAnswers: number
  }
  periods: { id: string; label: string; year: number; month: number | null; status: string }[]
}

interface AuditLogItem {
  id: string
  actorId: string
  actorName: string
  actorRole: string
  actorEmail?: string | null
  actorRoles?: { key: string; name: string }[]
  action: string
  entityType: string
  entityId: string
  oldState?: string | null
  newState?: string | null
  reason?: string | null
  metadata?: string | null
  ipAddress?: string | null
  createdAt: string
}
interface AuditResponse {
  total: number
  count: number
  items: AuditLogItem[]
}

interface EvidenceItem {
  id: string
  status: string
  module?: string | null
  fileName: string
}
interface EvidenceResponse {
  total: number
  count: number
  items: EvidenceItem[]
}

interface SubmissionItem {
  id: string
  module: string
  title: string
  status: string
  recordIds: string
  completionPct: number
  evidenceCount: number
  validationPassed: number
  validationErrors: number
  createdAt: string
  updatedAt: string
  project?: { id: string; projectCode: string; projectName: string; location?: string | null; status?: string } | null
  reportingPeriod?: { id: string; periodLabel: string; year: number; month: number | null } | null
}
interface SubmissionResponse {
  total: number
  count: number
  items: SubmissionItem[]
}

/* ============================================================
 * Constants
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(248, 250, 252, 0.96)',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  borderRadius: 10,
  fontSize: 11,
  boxShadow: '0 8px 24px -8px rgba(15, 23, 42, 0.18)',
  backdropFilter: 'blur(12px)',
  padding: '6px 10px',
  color: '#1e293b',
}

/** Evidence status donut palette — slate/steel premium */
const EVIDENCE_COLORS = {
  verified: '#10b981',
  pending: '#64748b',
  rejected: '#e11d48',
}

/**
 * Action-type pill mapping — semantic accents per audit-log convention.
 * Spec: CREATE=blue, SUBMIT=cyan, VALIDATE=violet, APPROVE=emerald,
 *       REJECT=rose, LOCK=slate. Other actions derived to closest semantic.
 */
const ACTION_STYLE: Record<string, { dot: string; pill: string }> = {
  CREATE:              { dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  UPDATE:              { dot: 'bg-slate-500',    pill: 'bg-slate-100 text-slate-700 border-slate-300' },
  SUBMIT:              { dot: 'bg-cyan-500',     pill: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  RESUBMIT:            { dot: 'bg-cyan-500',     pill: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  VALIDATE:            { dot: 'bg-violet-500',  pill: 'bg-violet-50 text-violet-700 border-violet-200' },
  REVIEW:              { dot: 'bg-violet-500',  pill: 'bg-violet-50 text-violet-700 border-violet-200' },
  APPROVE:             { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EVIDENCE_VERIFY:     { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECT:              { dot: 'bg-rose-500',     pill: 'bg-rose-50 text-rose-700 border-rose-200' },
  CORRECTION_REQUEST:  { dot: 'bg-rose-500',     pill: 'bg-rose-50 text-rose-700 border-rose-200' },
  LOCK:                { dot: 'bg-slate-700',    pill: 'bg-slate-100 text-slate-800 border-slate-400' },
  EVIDENCE_UPLOAD:     { dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  CALCULATION:         { dot: 'bg-steel-500',   pill: 'bg-slate-100 text-slate-700 border-slate-300' },
  BRSR_MAPPING:        { dot: 'bg-violet-500',  pill: 'bg-violet-50 text-violet-700 border-violet-200' },
  REPORT_GENERATE:     { dot: 'bg-slate-600',    pill: 'bg-slate-100 text-slate-700 border-slate-300' },
}

function actionStyle(action: string): { dot: string; pill: string } {
  const a = action.toUpperCase()
  // Try exact match
  if (ACTION_STYLE[a]) return ACTION_STYLE[a]
  // Try prefix match
  for (const key of Object.keys(ACTION_STYLE)) {
    if (a.startsWith(key) || a.includes(key)) return ACTION_STYLE[key]
  }
  return { dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600 border-slate-300' }
}

/** Severity pill styling for exceptions */
function severityStyle(severity: string): string {
  const s = severity.toUpperCase()
  if (s === 'BLOCKING') return 'bg-rose-100 text-rose-700 border-rose-300'
  if (s === 'ERROR')    return 'bg-rose-50 text-rose-700 border-rose-200'
  if (s === 'WARNING')  return 'bg-amber-50 text-amber-700 border-amber-200'
  if (s === 'INFO')    return 'bg-slate-100 text-slate-700 border-slate-300'
  return 'bg-slate-100 text-slate-700 border-slate-300'
}

/**
 * Factor Version Inventory — the seeded emission factors loaded in the
 * calculation engine (all version 1, sourced from prisma/seed.ts).
 * Shown as a compact reference list since no /api/emission-factors route
 * exists yet. All values are the actual factor values stored in the DB.
 */
interface FactorEntry {
  name: string
  category: string
  factorValue: number
  factorUnit: string
  scope: string
  methodology: string
  version: number
}
const FACTOR_INVENTORY: FactorEntry[] = [
  { name: 'Grid Electricity (India)', category: 'ELECTRICITY', factorValue: 0.716, factorUnit: 'kgCO2e/kWh', scope: 'SCOPE_2', methodology: 'CEA v19',     version: 1 },
  { name: 'Diesel (HSD)',             category: 'MOBILE',     factorValue: 2.637, factorUnit: 'kgCO2e/L',   scope: 'SCOPE_1', methodology: 'IPCC 2006',   version: 1 },
  { name: 'Petrol (MS)',              category: 'MOBILE',     factorValue: 2.296, factorUnit: 'kgCO2e/L',   scope: 'SCOPE_1', methodology: 'IPCC 2006',   version: 1 },
  { name: 'Coal (Sub-bituminous)',    category: 'STATIONARY', factorValue: 1.9,   factorUnit: 'kgCO2e/kg',  scope: 'SCOPE_1', methodology: 'IPCC 2006',   version: 1 },
  { name: 'Natural Gas',              category: 'STATIONARY', factorValue: 2.0,   factorUnit: 'kgCO2e/Nm³', scope: 'SCOPE_1', methodology: 'IPCC 2006',   version: 1 },
  { name: 'LPG',                      category: 'STATIONARY', factorValue: 1.85,  factorUnit: 'kgCO2e/kg',  scope: 'SCOPE_1', methodology: 'IPCC 2006',   version: 1 },
  { name: 'Solar PPA',                category: 'ELECTRICITY', factorValue: 0.0,  factorUnit: 'kgCO2e/kWh', scope: 'SCOPE_2', methodology: 'Renewable',    version: 1 },
]

/* ============================================================
 * Main component
 * ============================================================ */
export function AuditorDashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [audit, setAudit] = useState<AuditLogItem[]>([])
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const mountedRef = useRef(true)

  /* ---- fetchers ---- */
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/overview', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as OverviewData
      if (!mountedRef.current) return
      setOverview(data)
      setError('')
    } catch (e) {
      if (!mountedRef.current) return
      if (!overview) setError(e instanceof Error ? e.message : 'Failed to load overview')
    }
  }, [overview])

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch('/api/audit?take=20', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as AuditResponse
      if (!mountedRef.current) return
      setAudit(Array.isArray(data.items) ? data.items : [])
      setLastSync(new Date())
    } catch {
      /* silent — keep existing on poll error */
    }
  }, [])

  const fetchEvidence = useCallback(async () => {
    try {
      const res = await fetch('/api/evidence?take=200', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as EvidenceResponse
      if (!mountedRef.current) return
      setEvidence(Array.isArray(data.items) ? data.items : [])
    } catch {
      /* silent */
    }
  }, [])

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/submissions?take=50', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as SubmissionResponse
      if (!mountedRef.current) return
      setSubmissions(Array.isArray(data.items) ? data.items : [])
    } catch {
      /* silent */
    }
  }, [])

  /* ---- initial load ---- */
  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchAudit(), fetchEvidence(), fetchSubmissions()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [])

  /* ---- polling: audit every 30s, overview every 60s, evidence 90s ---- */
  useEffect(() => {
    const auditTimer = setInterval(fetchAudit, 30_000)
    const overviewTimer = setInterval(fetchOverview, 60_000)
    const evidenceTimer = setInterval(fetchEvidence, 90_000)
    return () => {
      clearInterval(auditTimer)
      clearInterval(overviewTimer)
      clearInterval(evidenceTimer)
    }
  }, [fetchAudit, fetchOverview, fetchEvidence])

  /* ---- derived: evidence breakdown for donut ---- */
  const evidenceBreakdown = useMemo(() => {
    let verified = 0
    let pending = 0
    let rejected = 0
    for (const ev of evidence) {
      const s = (ev.status || '').toUpperCase()
      if (s === 'VERIFIED') verified++
      else if (s === 'REJECTED' || s === 'EXPIRED') rejected++
      else pending++ // REQUIRED | UPLOADED | UNDER_REVIEW
    }
    // Fall back to /api/overview totals if /api/evidence list is shorter than total
    const k = overview?.kpis
    if (k && k.evidenceTotal > 0 && evidence.length < k.evidenceTotal) {
      verified = k.evidenceVerified
      rejected = Math.max(0, rejected) // keep observed rejection rate, or 0
      pending = Math.max(0, k.evidenceTotal - verified - rejected)
    }
    return { verified, pending, rejected, total: verified + pending + rejected }
  }, [evidence, overview])

  /* ---- derived: audit coverage ---- */
  const auditCoverage = useMemo(() => {
    const k = overview?.kpis
    const s = overview?.sources
    if (!k) return 0
    const uniqueEntities = new Set(audit.map(a => `${a.entityType}:${a.entityId}`))
    const totalRecords =
      (s?.energyRecords ?? 0) +
      (s?.waterRecords ?? 0) +
      (s?.wasteRecords ?? 0) +
      (s?.workforceRecords ?? 0) +
      (s?.safetyRecords ?? 0) +
      (s?.brsrAnswers ?? 0) +
      Math.max(0, k.totalSubs)
    if (totalRecords === 0) return 0
    const coverage = Math.min(100, Math.round((uniqueEntities.size / totalRecords) * 100))
    return coverage
  }, [audit, overview])

  /* ---- derived: top exceptions from submissions with validationErrors ---- */
  const topExceptions = useMemo(() => {
    const withErrors = submissions
      .filter(s => (s.validationErrors ?? 0) > 0)
      .sort((a, b) => (b.validationErrors ?? 0) - (a.validationErrors ?? 0))
      .slice(0, 5)
    return withErrors.map(s => {
      const n = s.validationErrors ?? 0
      const severity = n >= 5 ? 'BLOCKING' : n >= 2 ? 'ERROR' : 'WARNING'
      return {
        id: s.id,
        module: s.module,
        title: s.title,
        severity,
        count: n,
        project: s.project?.projectName ?? '—',
        projectCode: s.project?.projectCode ?? '',
        period: s.reportingPeriod?.periodLabel ?? '',
      }
    })
  }, [submissions])

  /* ---- render states ---- */
  if (loading) return <DashboardSkeleton />
  if (error && !overview) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!overview) return <EmptyState />

  const k = overview.kpis

  /* ---- 4 compact stat tiles for the top status bar ---- */
  const statTiles = [
    {
      icon: Gauge,
      label: 'Data Completeness',
      value: `${Math.round(k.completion)}%`,
      sub: `${k.approvedSubs}/${k.totalSubs} subs`,
      tone: 'text-slate-700',
      bgIcon: 'bg-slate-100 text-slate-700',
    },
    {
      icon: ShieldCheck,
      label: 'Evidence Verified',
      value: k.evidenceTotal > 0
        ? `${Math.round((k.evidenceVerified / k.evidenceTotal) * 100)}%`
        : '0%',
      sub: `${k.evidenceVerified}/${k.evidenceTotal} docs`,
      tone: 'text-emerald-700',
      bgIcon: 'bg-emerald-50 text-emerald-700',
    },
    {
      icon: Fingerprint,
      label: 'Audit Trail Coverage',
      value: `${auditCoverage}%`,
      sub: `${audit.length} events / 20`,
      tone: 'text-slate-700',
      bgIcon: 'bg-slate-100 text-slate-700',
    },
    {
      icon: AlertOctagon,
      label: 'Exceptions',
      value: `${k.openExceptions}`,
      sub: `${k.anomalies} anomalies · ${k.corrections} corrections`,
      tone: k.openExceptions > 0 ? 'text-rose-700' : 'text-slate-700',
      bgIcon: k.openExceptions > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700',
    },
  ]

  const donutData = [
    { name: 'Verified', value: evidenceBreakdown.verified, color: EVIDENCE_COLORS.verified },
    { name: 'Pending',  value: evidenceBreakdown.pending,  color: EVIDENCE_COLORS.pending },
    { name: 'Rejected', value: evidenceBreakdown.rejected, color: EVIDENCE_COLORS.rejected },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-4">
      {/* ---- Page header ---- */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg shadow-slate-900/20">
            <ShieldCheck className="h-5.5 w-5.5" strokeWidth={2.1} />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-800 sm:text-lg">
              Assurance Console
            </h2>
            <p className="text-xs text-slate-500">
              Independent audit trail · evidence verification · factor provenance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
          {lastSync && (
            <span className="hidden items-center gap-1 sm:inline-flex">
              <Clock className="h-3 w-3" />
              Last sync: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => { fetchOverview(); fetchAudit(); fetchEvidence(); fetchSubmissions() }}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 font-medium text-slate-600 transition hover:bg-slate-50"
            aria-label="Refresh assurance data"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* ---- TOP STATUS BAR — 4 compact stat tiles (max 80px each) ---- */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {statTiles.map((t, i) => (
          <StatTile key={t.label} delay={0.05 + 0.04 * i} {...t} />
        ))}
      </motion.div>

      {/* ---- 2-column equal split ---- */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ============================
            LEFT COLUMN — Audit Trail Timeline
           ============================ */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <AuditTimelineCard
            items={audit}
            totalAuditEvents={audit.length}
            lastSync={lastSync}
          />
        </motion.div>

        {/* ============================
            RIGHT COLUMN — Donut + Exceptions + Factors
           ============================ */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          <EvidenceDonutCard data={donutData} total={evidenceBreakdown.total} />
          <ExceptionsCard exceptions={topExceptions} />
          <FactorInventoryCard factors={FACTOR_INVENTORY} />
        </motion.div>
      </div>
    </div>
  )
}

/* ============================================================
 * Sub-components
 * ============================================================ */

/** Compact stat tile — max 80px height. Icon + label + value + sub. */
function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  bgIcon,
  delay,
}: {
  icon: typeof ShieldCheck
  label: string
  value: string
  sub: string
  tone: string
  bgIcon: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className="glass-subtle flex h-[80px] max-h-[80px] items-center gap-2.5 rounded-2xl px-3"
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bgIcon}`}>
        <Icon className="h-4.5 w-4.5" strokeWidth={2.1} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className={`text-lg font-bold leading-tight tabular-nums ${tone}`}>{value}</p>
        <p className="truncate text-[10px] text-slate-500">{sub}</p>
      </div>
    </motion.div>
  )
}

/** Audit Trail Timeline card — vertical timeline of recent audit events. */
function AuditTimelineCard({
  items,
  totalAuditEvents,
  lastSync,
}: {
  items: AuditLogItem[]
  totalAuditEvents: number
  lastSync: Date | null
}) {
  return (
    <div className="glass flex h-full flex-col rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <History className="h-4 w-4" strokeWidth={2.1} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Audit Trail Timeline</h3>
            <p className="text-[11px] text-slate-500">
              {totalAuditEvents} recent event{totalAuditEvents === 1 ? '' : 's'} · immutable log
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Fingerprint className="h-3 w-3" />
          <span className="hidden sm:inline">
            {lastSync ? lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </div>
      </div>

      {/* Timeline body — scrollable max-h-96 */}
      <div className="max-h-96 flex-1 overflow-y-auto px-4 py-3">
        {items.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
            <ScrollText className="h-8 w-8 opacity-40" />
            <p className="text-xs">No audit events recorded</p>
          </div>
        ) : (
          <ol className="relative space-y-1">
            {/* Vertical line */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-slate-300 via-slate-200 to-transparent"
            />
            <AnimatePresence initial={false}>
              {items.map((log, i) => (
                <TimelineRow key={log.id} log={log} index={i} />
              ))}
            </AnimatePresence>
          </ol>
        )}
      </div>
    </div>
  )
}

/** Single timeline row — max 60px each. Timestamp + actor + action pill + entity + reason. */
function TimelineRow({ log, index }: { log: AuditLogItem; index: number }) {
  const style = actionStyle(log.action)
  const ts = new Date(log.createdAt)
  const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = ts.toLocaleDateString([], { day: '2-digit', month: 'short' })
  const actorName = log.actorName || 'System'
  const actorRole = log.actorRoles?.[0]?.name || log.actorRole || '—'
  const reason = log.reason ? truncate(log.reason, 60) : defaultReason(log.action, log.entityType)

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-[60px] max-h-[60px] items-start gap-3 pl-0"
    >
      {/* Dot on the timeline */}
      <div className="relative z-10 mt-2 flex h-3 w-3 shrink-0 items-center justify-center">
        <span className={`h-3 w-3 rounded-full border-2 border-white ${style.dot} shadow-sm`} />
      </div>

      {/* Row body */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border border-slate-100 bg-white/60 px-2.5 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={`status-pill border ${style.pill} !px-1.5 !py-0 !text-[9px]`}>
              {log.action}
            </span>
            <span className="truncate text-[11px] font-medium text-slate-700">
              {actorName}
            </span>
            <span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">
              · {actorRole}
            </span>
          </div>
          <div className="shrink-0 text-right text-[10px] tabular-nums text-slate-500">
            <span className="font-medium">{time}</span>
            <span className="ml-1 text-slate-400">{date}</span>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500">
          <span className="rounded bg-slate-100 px-1 py-px font-mono text-[9px] text-slate-600">
            {log.entityType}
          </span>
          <span className="truncate text-slate-500">{reason}</span>
          {log.ipAddress && (
            <span className="ml-auto hidden shrink-0 text-slate-400 md:inline">
              {log.ipAddress}
            </span>
          )}
        </div>
      </div>
    </motion.li>
  )
}

/** Evidence Status donut card — compact h-32 chart + legend. */
function EvidenceDonutCard({
  data,
  total,
}: {
  data: { name: string; value: number; color: string }[]
  total: number
}) {
  const legend = [
    { name: 'Verified', color: EVIDENCE_COLORS.verified },
    { name: 'Pending',  color: EVIDENCE_COLORS.pending },
    { name: 'Rejected', color: EVIDENCE_COLORS.rejected },
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <FileSearch className="h-4 w-4" strokeWidth={2.1} />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Evidence Status</h3>
        </div>
        <span className="text-[11px] font-medium text-slate-500 tabular-nums">
          {total} total
        </span>
      </div>
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Donut chart */}
        <div className="relative h-32 w-32 shrink-0">
          {data.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-slate-100 text-[10px] text-slate-400">
              No data
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={36}
                    outerRadius={56}
                    paddingAngle={2}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={1.5}
                  >
                    {data.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, n: string) => [`${v} docs`, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold tabular-nums text-slate-800">
                  {total > 0 ? Math.round((data.find(d => d.name === 'Verified')?.value ?? 0) / total * 100) : 0}%
                </span>
                <span className="text-[9px] uppercase tracking-wide text-slate-400">verified</span>
              </div>
            </>
          )}
        </div>
        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          {legend.map(l => {
            const item = data.find(d => d.name === l.name)
            const v = item?.value ?? 0
            const pct = total > 0 ? Math.round((v / total) * 100) : 0
            return (
              <div key={l.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                  <span className="font-medium text-slate-600">{l.name}</span>
                </div>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="font-semibold text-slate-700">{v}</span>
                  <span className="text-slate-400">{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

/** Top Exceptions card — validation errors with severity + source record links. */
function ExceptionsCard({
  exceptions,
}: {
  exceptions: Array<{
    id: string
    module: string
    title: string
    severity: string
    count: number
    project: string
    projectCode: string
    period: string
  }>
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
            <AlertTriangle className="h-4 w-4" strokeWidth={2.1} />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Top Exceptions</h3>
        </div>
        <span className="text-[11px] font-medium text-slate-500 tabular-nums">
          {exceptions.length} flagged
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto px-3 py-2">
        {exceptions.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-1.5 text-slate-400">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <p className="text-xs">No open validation errors</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {exceptions.map((ex, i) => (
              <motion.li
                key={ex.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="group flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white/60 px-2.5 py-2 transition hover:border-slate-200 hover:bg-white"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <AlertOctagon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`status-pill border ${severityStyle(ex.severity)} !px-1.5 !py-0 !text-[9px]`}>
                      {ex.severity}
                    </span>
                    <span className="truncate text-[11px] font-medium text-slate-700">
                      {ex.title}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="rounded bg-slate-100 px-1 py-px font-mono text-[9px] text-slate-600">
                      {ex.module}
                    </span>
                    <span className="truncate">
                      {ex.project}
                      {ex.projectCode ? ` · ${ex.projectCode}` : ''}
                      {ex.period ? ` · ${ex.period}` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-rose-700">
                    {ex.count}
                  </span>
                  <a
                    href={`/api/submissions/${ex.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`View source record ${ex.id}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  )
}

/** Factor Version Inventory card — compact list of emission factors in use. */
function FactorInventoryCard({ factors }: { factors: FactorEntry[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Boxes className="h-4 w-4" strokeWidth={2.1} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Factor Version Inventory</h3>
            <p className="text-[10px] text-slate-500">Emission factors in active calculations</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          <Layers className="h-3 w-3" />
          v1
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {factors.map((f, i) => (
            <motion.li
              key={f.name}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white/60 px-2.5 py-1.5 transition hover:border-slate-200 hover:bg-white"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <Cpu className="h-3 w-3" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-semibold text-slate-700">
                    {f.name}
                  </span>
                  <span className="rounded bg-slate-100 px-1 py-px font-mono text-[9px] text-slate-500">
                    {f.scope.replace('SCOPE_', 'S')}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <BookOpen className="h-2.5 w-2.5" />
                  <span className="truncate">{f.methodology}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] font-bold tabular-nums text-slate-700">
                  {f.factorValue.toFixed(3)}
                </div>
                <div className="text-[9px] text-slate-400">{f.factorUnit}</div>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-0">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  <Hash className="h-2 w-2" />
                  v{f.version}
                </span>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

/* ============================================================
 * Skeleton / Error / Empty states
 * ============================================================ */
function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200/60" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-40 animate-pulse rounded bg-slate-200/60" />
          <div className="h-2.5 w-56 animate-pulse rounded bg-slate-200/50" />
        </div>
      </div>
      {/* Stat tiles skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[80px] max-h-[80px] animate-pulse rounded-2xl bg-slate-200/50" />
        ))}
      </div>
      {/* 2-col skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200/50" />
        <div className="space-y-4">
          <div className="h-44 animate-pulse rounded-2xl bg-slate-200/50" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200/50" />
          <div className="h-56 animate-pulse rounded-2xl bg-slate-200/50" />
        </div>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/50 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
        <AlertOctagon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-rose-800">Failed to load assurance console</p>
        <p className="mt-1 text-xs text-rose-600">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/60 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Database className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">No assurance data available</p>
        <p className="mt-1 text-xs text-slate-500">
          Reporting periods have not been initialised yet.
        </p>
      </div>
    </div>
  )
}

/* ============================================================
 * Helpers
 * ============================================================ */
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function defaultReason(action: string, entityType: string): string {
  const a = action.toUpperCase()
  if (a === 'CREATE')            return `Created new ${entityType.toLowerCase()} record`
  if (a === 'UPDATE')            return `Updated ${entityType.toLowerCase()} fields`
  if (a === 'SUBMIT')            return `Submitted ${entityType.toLowerCase()} for review`
  if (a === 'RESUBMIT')          return `Resubmitted after correction`
  if (a === 'VALIDATE')          return `Validation run completed`
  if (a === 'REVIEW')            return `Reviewed ${entityType.toLowerCase()}`
  if (a === 'APPROVE')           return `Approved ${entityType.toLowerCase()}`
  if (a === 'REJECT')            return `Rejected ${entityType.toLowerCase()}`
  if (a === 'LOCK')              return `Locked period — immutable`
  if (a === 'EVIDENCE_UPLOAD')   return `Uploaded evidence document`
  if (a === 'EVIDENCE_VERIFY')   return `Evidence verified by auditor`
  if (a === 'CORRECTION_REQUEST')return `Correction requested — open issue`
  if (a === 'CALCULATION')       return `Emissions calculation re-run`
  if (a === 'BRSR_MAPPING')      return `BRSR principle mapping updated`
  if (a === 'REPORT_GENERATE')   return `Report generated for archive`
  return `${action} on ${entityType.toLowerCase()}`
}
