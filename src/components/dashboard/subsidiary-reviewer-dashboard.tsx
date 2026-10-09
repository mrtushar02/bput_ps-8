'use client'
/**
 * SubsidiaryReviewerDashboard — Subsidiary consolidation review console.
 *
 * DISTINCTLY DIFFERENT from the BU Reviewer (indigo/violet) — this surface
 * uses a DEEPER blue/indigo palette (#3b82f6 / #1d4ed8 / #1e40af) and a
 * top-banner + 2-column (55/45) consolidation-focused layout.
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  Top banner: Consolidation progress (BU submission/approval %)       │
 *  ├───────────────────────────────────┬─────────────────────────────────┤
 *  │  LEFT (55%)                       │  RIGHT (45%)                    │
 *  │  • 3 KPI cards (Emissions/Energy/ │  • Approval Pipeline (vertical  │
 *  │    Water) — deep-blue tiles       │    stepper Subsidiary→HQ→Lock)  │
 *  │  • BU Consolidation Table          │  • Exceptions 2×2 grid          │
 *  │    (BU/Proj/Status/%/LastAction)  │  • Recent Consolidation Actions│
 *  └───────────────────────────────────┴─────────────────────────────────┘
 *
 * Data sources:
 *   - GET /api/overview     → kpis, trends, activities
 *   - GET /api/submissions  → BU consolidation table rows
 *   - GET /api/activity?take=10 → consolidation action feed
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Network, Layers, Flame, Zap, Droplet, CheckCircle2,
  AlertTriangle, AlertOctagon, AlertCircle, ClipboardCheck, Lock,
  ArrowRight, ArrowUpRight, TrendingUp, TrendingDown, Send, Eye,
  RefreshCw, ChevronRight, Activity as ActivityIcon, FileText,
  GitBranch, Sparkles, Clock, ShieldCheck,
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid,
} from 'recharts'
import { useApp, type ModuleKey } from '@/lib/auth-context'

/* ============================================================
 * Types
 * ============================================================ */
interface Kpis {
  totalEmissions: number
  scope1: number
  scope2: number
  scope3: number
  energyGJ: number
  renewableShare: number
  waterWithdrawalKL: number
  waterRecycledShare: number
  wasteGeneratedT: number
  wasteRecycledShare: number
  brsrReadiness: number
  brsrMissing: number
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
  projects: number
  orgs: number
}
interface Trend { emissions: number; energy: number; water: number; waste: number }
type Trends = Record<string, Trend>
interface OverviewData {
  kpis: Kpis
  trends: Trends
  emissionsBySource?: Record<string, number>
  periods: { id: string; label: string; year: number; month: number | null; status: string }[]
  activities?: ActivityItem[]
}

interface ActivityItem {
  id: string
  projectId: string
  actorId: string
  actorName: string
  actorRole: string
  action: string
  title: string
  description?: string | null
  module?: string | null
  status?: string | null
  createdAt: string
  project?: { id: string; projectName: string; projectCode: string; location?: string | null } | null
}

interface SubmissionItem {
  id: string
  projectId: string
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
  currentReviewer?: { id: string; name: string; email: string } | null
}
interface SubmissionResponse { items: SubmissionItem[]; total: number; count: number }
interface ActivityResponse { items: ActivityItem[]; total: number; count: number }

/* ============================================================
 * Constants — Deep Blue / Indigo consolidation palette
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(59,130,246,0.35)',
  borderRadius: 12,
  fontSize: 11,
  boxShadow: '0 8px 24px -8px rgba(30,64,175,0.30)',
  backdropFilter: 'blur(12px)',
  padding: '6px 10px',
}

const DEEP_BLUE = '#1d4ed8'
const DEEP_BLUE_LIGHT = '#3b82f6'
const DEEP_BLUE_DARK = '#1e40af'

/** Vertical pipeline stages for subsidiary consolidation */
interface PipelineStage {
  key: string
  label: string
  sub: string
  statuses: string[]
  icon: typeof Building2
}
const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'SUBSIDIARY', label: 'Subsidiary', sub: 'BU submissions collected', statuses: ['SUBMITTED', 'UNDER_REVIEW', 'BU_APPROVED'], icon: Building2 },
  { key: 'HQ', label: 'HQ Review', sub: 'Subsidiary approved → HQ', statuses: ['SUBSIDIARY_APPROVED', 'HQ_REVIEW'], icon: Network },
  { key: 'LOCKED', label: 'Locked', sub: 'Final locked for reporting', statuses: ['LOCKED', 'APPROVED'], icon: Lock },
]

/* ============================================================
 * Helpers
 * ============================================================ */
function fmt(n: number, digits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: digits })
}
function timeAgo(iso: string): string {
  const d = new Date(iso).getTime()
  const s = Math.floor((Date.now() - d) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
function subStatusPill(status: string | undefined): string {
  if (!status) return 'status-draft'
  const s = status.toUpperCase()
  if (s === 'APPROVED' || s === 'LOCKED') return 'status-approved'
  if (s === 'DRAFT') return 'status-draft'
  if (s === 'SUBMITTED') return 'status-submitted'
  if (s === 'UNDER_REVIEW') return 'status-review'
  if (s === 'BU_APPROVED' || s === 'SUBSIDIARY_APPROVED' || s === 'HQ_REVIEW') return 'status-verified'
  if (s.includes('CORRECTION') || s.includes('REJECTED')) return 'status-error'
  return 'status-locked'
}
function actionLabel(s: string): string {
  const m: Record<string, string> = {
    SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review', BU_APPROVED: 'BU approved',
    SUBSIDIARY_APPROVED: 'Subsidiary approved', HQ_REVIEW: 'HQ review',
    LOCKED: 'Locked', APPROVED: 'Approved', DRAFT: 'Drafted',
    CORRECTION_REQUESTED: 'Returned',
  }
  return m[s.toUpperCase()] || s
}

/* ============================================================
 * Main component
 * ============================================================ */
export function SubsidiaryReviewerDashboard() {
  const { setActiveModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

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
      if (!overview) setError(e instanceof Error ? e.message : 'Failed to load subsidiary overview')
    }
  }, [overview])

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/submissions?take=50', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as SubmissionResponse
      if (!mountedRef.current) return
      setSubmissions(Array.isArray(data.items) ? data.items : [])
    } catch { /* silent */ }
  }, [])

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?take=10', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ActivityResponse
      if (!mountedRef.current) return
      setActivities(Array.isArray(data.items) ? data.items : [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchSubmissions(), fetchActivities()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const t1 = setInterval(fetchOverview, 60_000)
    const t2 = setInterval(fetchSubmissions, 45_000)
    const t3 = setInterval(fetchActivities, 30_000)
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3) }
  }, [fetchOverview, fetchSubmissions, fetchActivities])

  /* trend array */
  const trendArr = useMemo<Array<Trend & { label: string }>>(() => {
    if (!overview) return []
    return Object.entries(overview.trends).map(([label, v]) => ({ label, ...v }))
  }, [overview])

  /* consolidation % = approved / total */
  const consolidationPct = useMemo(() => {
    if (!overview) return 0
    return overview.kpis.completion || 0
  }, [overview])

  /* BU consolidation table — group submissions by project (BU) */
  const buRows = useMemo(() => {
    const map = new Map<string, { buName: string; projectCode: string; projectCount: number; status: string; completion: number; updatedAt: string; action: string }>()
    for (const s of submissions) {
      const buName = s.project?.projectName || s.title || '—'
      const projectCode = s.project?.projectCode || '—'
      const key = s.projectId || s.id
      const existing = map.get(key)
      if (existing) {
        existing.projectCount += 1
        // pick the most-recent status
        if (new Date(s.updatedAt) > new Date(existing.updatedAt)) {
          existing.status = s.status
          existing.updatedAt = s.updatedAt
          existing.action = s.status
        }
        existing.completion = Math.round((existing.completion + s.completionPct) / 2)
      } else {
        map.set(key, {
          buName, projectCode, projectCount: 1,
          status: s.status, completion: s.completionPct,
          updatedAt: s.updatedAt, action: s.status,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 8)
  }, [submissions])

  /* pipeline counts (right rail) */
  const pipelineCounts = useMemo(() => {
    return PIPELINE_STAGES.map(stage => ({
      ...stage,
      count: submissions.filter(s => stage.statuses.includes((s.status || '').toUpperCase())).length,
    }))
  }, [submissions])

  /* consolidation actions feed */
  const consolidationActions = useMemo<ActivityItem[]>(() => {
    const all = (overview?.activities as ActivityItem[] | undefined) ?? activities
    const filtered = all.filter(a => {
      const act = (a.action || '').toUpperCase()
      return act.includes('SUBMIT') || act.includes('APPROVE') || act.includes('CONSOLID') ||
             act.includes('REVIEW') || act.includes('LOCK') || act.includes('CORRECT')
    })
    return (filtered.length > 0 ? filtered : all).slice(0, 5)
  }, [overview, activities])

  /* ---- render states ---- */
  if (loading) return <SubsidiarySkeleton />
  if (error && !overview) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!overview) return <EmptyState />
  const k = overview.kpis

  const kpiCards = [
    {
      icon: Flame, label: 'Total Emissions',
      value: fmt(k.totalEmissions, 1), unit: 'tCO₂e',
      sub: `S1 ${fmt(k.scope1, 0)} · S2 ${fmt(k.scope2, 0)}`,
      tone: 'from-blue-500 to-blue-700', shadow: 'shadow-blue-500/30',
    },
    {
      icon: Zap, label: 'Energy',
      value: fmt(k.energyGJ, 1), unit: 'GJ',
      sub: `Renewable ${k.renewableShare}%`,
      tone: 'from-indigo-500 to-indigo-700', shadow: 'shadow-indigo-500/30',
    },
    {
      icon: Droplet, label: 'Water',
      value: fmt(k.waterWithdrawalKL, 1), unit: 'KL',
      sub: `Recycled ${k.waterRecycledShare}%`,
      tone: 'from-sky-500 to-blue-700', shadow: 'shadow-sky-500/30',
    },
  ]

  return (
    <div className="space-y-5">
      {/* ============================
          HEADER
         ============================ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 text-white shadow-lg shadow-blue-600/40">
              <Building2 className="h-5 w-5" />
            </span>
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900">Subsidiary Consolidation Console</h1>
            <span className="status-pill status-submitted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" /> Live
            </span>
          </div>
          <p className="mt-1 text-[12px] text-slate-600">
            {k.projects} business units · subsidiary-wide consolidation view · {k.orgs} group(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-slate-700">
            <ClipboardCheck className="h-3.5 w-3.5 text-blue-600" />
            {k.totalSubs} submissions tracked
          </span>
          <span className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-slate-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-700" />
            {k.approvedSubs} locked
          </span>
          <button
            onClick={() => setActiveModule('submissions')}
            className="btn-glass-primary rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-md transition-transform hover:scale-[1.03]"
          >
            Open submissions
          </button>
        </div>
      </motion.div>

      {/* ============================
          TOP BANNER — Consolidation progress
         ============================ */}
      <ConsolidationBanner
        pct={consolidationPct}
        total={k.totalSubs}
        approved={k.approvedSubs}
        draft={k.draftSubs}
        review={k.reviewSubs}
        onOpen={() => setActiveModule('submissions')}
      />

      {/* ============================
          2-COLUMN GRID (55/45)
         ============================ */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-5 xl:grid-cols-[1.22fr_1fr]">
        {/* ---- LEFT 55% ---- */}
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {kpiCards.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i, duration: 0.4 }}
                className={`glass glass-shimmer rounded-2xl p-4 shadow-lg ${c.shadow}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.tone} text-white shadow-md`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                  <Sparkles className="h-3.5 w-3.5 text-blue-300" />
                </div>
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</div>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-[22px] font-bold tabular-nums text-slate-900">{c.value}</span>
                    <span className="text-[11px] font-medium text-slate-500">{c.unit}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">{c.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* BU Consolidation Table */}
          <BuConsolidationCard rows={buRows} onViewAll={() => setActiveModule('submissions')} />
        </div>

        {/* ---- RIGHT 45% ---- */}
        <div className="space-y-5">
          {/* Approval Pipeline (vertical stepper) */}
          <ApprovalPipelineCard stages={pipelineCounts} onOpen={() => setActiveModule('submissions')} />

          {/* Exceptions 2×2 grid */}
          <ExceptionsSummaryCard
            validationErrors={k.openExceptions}
            anomalies={k.anomalies}
            corrections={k.corrections}
            brsrGaps={k.brsrMissing}
            onOpen={() => setActiveModule('audit')}
          />

          {/* Recent Consolidation Actions */}
          <ConsolidationActionsCard actions={consolidationActions} onOpenAll={() => setActiveModule('audit')} />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * Sub-components
 * ============================================================ */

/* ---------- Consolidation progress banner ---------- */
function ConsolidationBanner({
  pct, total, approved, draft, review, onOpen,
}: {
  pct: number; total: number; approved: number; draft: number; review: number; onOpen: () => void
}) {
  const pctRound = Math.round(pct)
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.45 }}
      className="glass-strong relative overflow-hidden rounded-2xl p-5 shadow-xl shadow-blue-900/10"
    >
      {/* decorative orb */}
      <div className="orb -right-10 -top-12 h-40 w-40 bg-blue-400/30" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-800 text-white shadow-lg shadow-blue-600/40">
            <GitBranch className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Consolidation Progress</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-[26px] font-bold tabular-nums text-slate-900">{pctRound}%</span>
              <span className="text-[12px] text-slate-600">of {total} submissions locked</span>
            </div>
          </div>
        </div>

        {/* progress bar */}
        <div className="flex-1 lg:px-6">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-blue-100 via-indigo-100 to-blue-200">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pctRound}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-600">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600" /> {approved} locked</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" /> {review} in review</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> {draft} drafts</span>
          </div>
        </div>

        <button
          onClick={onOpen}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 px-4 py-2 text-[11px] font-semibold text-white shadow-md shadow-blue-600/30 transition-transform hover:scale-[1.03]"
        >
          Track pipeline <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

/* ---------- BU Consolidation table ---------- */
function BuConsolidationCard({
  rows, onViewAll,
}: {
  rows: { buName: string; projectCode: string; projectCount: number; status: string; completion: number; updatedAt: string; action: string }[]
  onViewAll: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-blue-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-700" />
          <h2 className="text-[13px] font-semibold text-slate-900">BU Consolidation</h2>
          <span className="status-pill status-submitted">{rows.length} BUs</span>
        </div>
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-800"
        >
          View all <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-blue-100/60 bg-white/60">
        <table className="w-full text-left text-[11px]">
          <thead className="border-b border-blue-100/70 bg-blue-50/50 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2">BU Name</th>
              <th className="px-3 py-2 text-center">Projects</th>
              <th className="px-3 py-2">Submission</th>
              <th className="px-3 py-2 text-center">Completion</th>
              <th className="px-3 py-2 text-right">Last Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No submissions tracked yet.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="border-b border-blue-50/60 transition-colors hover:bg-blue-50/40">
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-800">{r.buName}</div>
                  <div className="text-[10px] text-slate-500">{r.projectCode}</div>
                </td>
                <td className="px-3 py-2 text-center tabular-nums text-slate-700">{r.projectCount}</td>
                <td className="px-3 py-2">
                  <span className={`status-pill ${subStatusPill(r.status)}`}>{actionLabel(r.action)}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-blue-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-700" style={{ width: `${Math.min(100, r.completion)}%` }} />
                    </div>
                    <span className="tabular-nums text-slate-700">{r.completion}%</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-[10px] text-slate-500">{timeAgo(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

/* ---------- Approval pipeline vertical stepper ---------- */
function ApprovalPipelineCard({
  stages, onOpen,
}: {
  stages: { key: string; label: string; sub: string; count: number; icon: typeof Building2 }[]
  onOpen: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-blue-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-blue-700" />
          <h2 className="text-[13px] font-semibold text-slate-900">Approval Pipeline</h2>
        </div>
        <button onClick={onOpen} className="text-[11px] font-semibold text-blue-700 hover:text-blue-800">Open →</button>
      </div>

      <div className="relative">
        {/* vertical line */}
        <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-300 via-indigo-300 to-blue-200" />
        <ul className="space-y-3">
          {stages.map((s, i) => {
            const active = s.count > 0
            const isFinal = s.key === 'LOCKED'
            return (
              <motion.li
                key={s.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.22 + i * 0.08 }}
                className="relative flex items-center gap-3"
              >
                <span className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-md ${
                  active
                    ? isFinal
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-800 text-white border-blue-700'
                      : 'bg-gradient-to-br from-blue-500 to-blue-700 text-white border-blue-600'
                    : 'bg-white text-blue-400 border-blue-200'
                }`}>
                  <s.icon className="h-4 w-4" />
                  {active && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-slate-800">{s.label}</span>
                    <span className={`status-pill ${active ? 'status-submitted' : 'status-draft'}`}>{s.count}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">{s.sub}</p>
                </div>
              </motion.li>
            )
          })}
        </ul>
      </div>
    </motion.div>
  )
}

/* ---------- Exceptions 2×2 grid ---------- */
function ExceptionsSummaryCard({
  validationErrors, anomalies, corrections, brsrGaps, onOpen,
}: {
  validationErrors: number; anomalies: number; corrections: number; brsrGaps: number; onOpen: () => void
}) {
  const cells = [
    { label: 'Validation Errors', value: validationErrors, icon: AlertOctagon, tone: 'bg-rose-50 text-rose-600 border-rose-200', stat: 'status-error' },
    { label: 'Anomalies', value: anomalies, icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600 border-amber-200', stat: 'status-warning' },
    { label: 'Corrections', value: corrections, icon: AlertCircle, tone: 'bg-orange-50 text-orange-600 border-orange-200', stat: 'status-review' },
    { label: 'BRSR Gaps', value: brsrGaps, icon: FileText, tone: 'bg-blue-50 text-blue-600 border-blue-200', stat: 'status-submitted' },
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-blue-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-700" />
          <h2 className="text-[13px] font-semibold text-slate-900">Subsidiary-wide Exceptions</h2>
        </div>
        <button onClick={onOpen} className="text-[11px] font-semibold text-blue-700 hover:text-blue-800">Resolve →</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cells.map((c, i) => (
          <motion.button
            key={c.label}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.26 + i * 0.05 }}
            onClick={onOpen}
            className={`rounded-xl border p-3 text-left transition-all hover:scale-[1.02] ${c.tone}`}
          >
            <div className="flex items-center justify-between">
              <c.icon className="h-4 w-4" />
              <span className={`status-pill ${c.stat}`}>{c.value}</span>
            </div>
            <div className="mt-2 text-[11px] font-semibold">{c.label}</div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

/* ---------- Recent consolidation actions feed ---------- */
function ConsolidationActionsCard({
  actions, onOpenAll,
}: {
  actions: ActivityItem[]; onOpenAll: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-blue-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 text-blue-700" />
          <h2 className="text-[13px] font-semibold text-slate-900">Recent Consolidation Actions</h2>
        </div>
        <button onClick={onOpenAll} className="text-[11px] font-semibold text-blue-700 hover:text-blue-800">All →</button>
      </div>
      {actions.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-slate-500">No recent actions.</div>
      ) : (
        <ul className="scroll-elegant max-h-72 space-y-2 overflow-y-auto pr-1">
          {actions.map((a, i) => (
            <motion.li
              key={a.id || i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.04 }}
              className="flex items-start gap-2.5 rounded-xl border border-blue-50/70 bg-white/55 p-2.5 transition-colors hover:bg-blue-50/40"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 text-white shadow">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-semibold text-slate-800">{a.actorName || 'System'}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="truncate text-[11px] text-slate-600">{a.title || a.action}</p>
                {a.project?.projectName && (
                  <p className="mt-0.5 truncate text-[10px] text-blue-700">{a.project.projectName}</p>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}

/* ============================================================
 * Loading / Error / Empty states
 * ============================================================ */
function SubsidiarySkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-12 animate-pulse rounded-2xl bg-blue-100/60" />
      <div className="h-24 animate-pulse rounded-2xl bg-blue-100/40" />
      <div className="grid grid-cols-1 md:grid-cols-1 gap-5 xl:grid-cols-[1.22fr_1fr]">
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-blue-100/40" style={{ animationDelay: `${i * 0.08}s` }} />)}
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-blue-100/40" />
        </div>
        <div className="space-y-5">
          <div className="h-56 animate-pulse rounded-2xl bg-blue-100/40" />
          <div className="h-40 animate-pulse rounded-2xl bg-blue-100/40" />
          <div className="h-44 animate-pulse rounded-2xl bg-blue-100/40" />
        </div>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center shadow-lg">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <AlertOctagon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">Subsidiary console unavailable</h3>
      <p className="mt-1 text-[12px] text-slate-600">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 px-4 py-2 text-[11px] font-semibold text-white shadow-md">
        <RefreshCw className="mr-1 inline h-3 w-3" /> Retry
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl p-10 text-center shadow-lg">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <Building2 className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">No subsidiary data yet</h3>
      <p className="mt-1 text-[12px] text-slate-600">Once BU submissions begin, the consolidation console will populate here.</p>
    </div>
  )
}
