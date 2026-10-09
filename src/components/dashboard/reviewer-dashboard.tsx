'use client'
/**
 * ReviewerDashboard — BU / SUBSIDIARY / GROUP reviewer command surface.
 *
 * DISTINCTLY DIFFERENT from the site-user (sky-blue) and admin (slate)
 * dashboards: this surface uses an **indigo / violet premium** palette and
 * a **2-column + top-pipeline-banner** layout purpose-built for reviewers.
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  Top banner: Review Pipeline horizontal stepper (7 stages, counts)  │
 *  ├──────────────────────────────────────────┬──────────────────────────┤
 *  │  LEFT (~60%)                             │  RIGHT (~40%)            │
 *  │  • Review Queue table (dense, 40px rows) │  • Pending Approvals     │
 *  │  • 3 compact KPI cards + sparklines      │  • Exception Summary     │
 *  │                                          │  • Recent Review Actions │
 *  └──────────────────────────────────────────┴──────────────────────────┘
 *
 * Data is sourced entirely from real APIs — no hardcoded values:
 *   - GET /api/overview   → kpis, trends, emissionsBySource, periods, activities
 *   - GET /api/submissions → submissions list (status / completion / reviewer)
 *
 * The component is self-contained; it does not modify any other file.
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, FileCheck, AlertTriangle, ClipboardCheck, GitBranch,
  Flame, Zap, Droplet, TrendingUp, TrendingDown, ArrowRight, ArrowUpRight,
  Send, CheckCircle2, Lock, Eye, RefreshCw, AlertOctagon, AlertCircle,
  Activity as ActivityIcon, FileText, ChevronRight, Layers, Sparkles,
  XCircle, Clock, PenLine, BadgeCheck, Building2, Network, FlaskConical,
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
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

/* ============================================================
 * Constants — Indigo / Violet premium palette
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(196,181,253,0.55)',
  borderRadius: 12,
  fontSize: 11,
  boxShadow: '0 8px 24px -8px rgba(91,33,182,0.22)',
  backdropFilter: 'blur(12px)',
  padding: '6px 10px',
}

/** Sparkline stroke / fill — indigo → violet */
const SPARK_STROKE = '#6366f1'
const SPARK_FILL = 'rgba(99,102,241,0.18)'
const SPARK_STROKE_ALT = '#8b5cf6'
const SPARK_FILL_ALT = 'rgba(139,92,246,0.18)'
const SPARK_STROKE_ALT2 = '#a855f7'
const SPARK_FILL_ALT2 = 'rgba(168,85,247,0.18)'

/** Pipeline stage definitions — 7 stages matching the Submission.status enum */
interface PipelineStage {
  key: string
  label: string
  short: string
  statuses: string[]   // statuses that "belong" to this stage
  icon: typeof FileText
}
const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'DRAFT',              label: 'Draft',              short: 'D',  statuses: ['DRAFT'], icon: FileText },
  { key: 'SUBMITTED',          label: 'Submitted',          short: 'S',  statuses: ['SUBMITTED'], icon: Send },
  { key: 'UNDER_REVIEW',       label: 'Under Review',       short: 'R',  statuses: ['UNDER_REVIEW'], icon: Eye },
  { key: 'BU_APPROVED',        label: 'BU Approved',        short: 'B',  statuses: ['BU_APPROVED'], icon: ClipboardCheck },
  { key: 'SUBSIDIARY_APPROVED',label: 'Subsidiary Approved',short: 'SA', statuses: ['SUBSIDIARY_APPROVED'], icon: Building2 },
  { key: 'HQ_REVIEW',          label: 'HQ Review',          short: 'HQ', statuses: ['HQ_REVIEW'], icon: Network },
  { key: 'LOCKED',             label: 'Locked',             short: 'L',  statuses: ['LOCKED', 'APPROVED'], icon: Lock },
]

/** Status pill mapping for reviewer view (re-uses global .status-* classes) */
function reviewerStatusPill(status: string | undefined): string {
  if (!status) return 'status-draft'
  const s = status.toUpperCase()
  if (s === 'APPROVED' || s === 'LOCKED')                     return 'status-approved'
  if (s === 'DRAFT')                                            return 'status-draft'
  if (s === 'SUBMITTED')                                        return 'status-submitted'
  if (s === 'UNDER_REVIEW')                                    return 'status-review'
  if (s === 'BU_APPROVED' || s === 'SUBSIDIARY_APPROVED' || s === 'HQ_REVIEW') return 'status-verified'
  if (s.includes('CORRECTION') || s.includes('REJECTED'))       return 'status-error'
  return 'status-locked'
}

/* ============================================================
 * Main component
 * ============================================================ */
export function ReviewerDashboard() {
  const { setActiveModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
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
      if (!overview) setError(e instanceof Error ? e.message : 'Failed to load reviewer overview')
    }
  }, [overview])

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/submissions?take=50', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as SubmissionResponse
      if (!mountedRef.current) return
      setSubmissions(Array.isArray(data.items) ? data.items : [])
      setLastSyncAt(new Date())
    } catch {
      /* silent — keep existing list on poll error */
    }
  }, [])

  /* ---- initial load ---- */
  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchSubmissions()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [])

  /* ---- polling: overview 60s, submissions 45s ---- */
  useEffect(() => {
    const overviewTimer = setInterval(fetchOverview, 60_000)
    const subsTimer = setInterval(fetchSubmissions, 45_000)
    return () => {
      clearInterval(overviewTimer)
      clearInterval(subsTimer)
    }
  }, [fetchOverview, fetchSubmissions])

  /* ---- derived: trend array ---- */
  const trendArr = useMemo<Array<Trend & { label: string }>>(() => {
    if (!overview) return []
    return Object.entries(overview.trends).map(([label, v]) => ({ label, ...v }))
  }, [overview])

  /* ---- derived: pipeline counts ---- */
  const pipelineCounts = useMemo<{ stage: PipelineStage; count: number }[]>(() => {
    return PIPELINE_STAGES.map(stage => {
      const count = submissions.filter(s => stage.statuses.includes((s.status || '').toUpperCase())).length
      return { stage, count }
    })
  }, [submissions])

  /** Index of the "current" pipeline stage = the most-advanced stage that has items
   * OR the stage where the most review activity is concentrated. */
  const currentStageIdx = useMemo(() => {
    // pick the highest-indexed stage with count > 0; fallback to first stage
    let idx = 0
    for (let i = 0; i < pipelineCounts.length; i++) {
      if (pipelineCounts[i].count > 0) idx = i
    }
    return idx
  }, [pipelineCounts])

  /** Review queue = submissions that are at the reviewer's actionable stages
   * (Submitted, Under Review, BU Approved, Subsidiary Approved, HQ Review). */
  const reviewQueue = useMemo(() => {
    const actionable = ['SUBMITTED', 'UNDER_REVIEW', 'BU_APPROVED', 'SUBSIDIARY_APPROVED', 'HQ_REVIEW']
    return submissions
      .filter(s => actionable.includes((s.status || '').toUpperCase()))
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
      .slice(0, 8)
  }, [submissions])

  /** Pending approvals = items awaiting the reviewer's decision now. */
  const pendingApprovals = useMemo(() => {
    const actionable = ['SUBMITTED', 'UNDER_REVIEW', 'BU_APPROVED', 'SUBSIDIARY_APPROVED', 'HQ_REVIEW']
    return submissions.filter(s => actionable.includes((s.status || '').toUpperCase()))
  }, [submissions])

  const pendingByModule = useMemo(() => {
    const buckets: Record<string, number> = {}
    for (const s of pendingApprovals) {
      const m = (s.module || 'OTHER').toUpperCase()
      buckets[m] = (buckets[m] || 0) + 1
    }
    return Object.entries(buckets)
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count)
  }, [pendingApprovals])

  /** Recent review actions — from overview.activities, sliced to 5. */
  const recentActions = useMemo<ActivityItem[]>(() => {
    const acts = (overview?.activities as ActivityItem[] | undefined) ?? []
    // Prefer review-flavoured actions first; fall back to first 5
    const reviewActions = acts.filter(a => {
      const act = (a.action || '').toUpperCase()
      return act.includes('REVIEW') || act.includes('APPROVE') || act.includes('REJECT') ||
             act.includes('CORRECT') || act.includes('LOCK') || act.includes('SUBMIT')
    })
    return (reviewActions.length > 0 ? reviewActions : acts).slice(0, 5)
  }, [overview])

  /* ---- render states ---- */
  if (loading) return <ReviewerSkeleton />
  if (error && !overview) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!overview) return <EmptyState />
  const k = overview.kpis

  /* ---- KPI cards (Emissions / Energy / Water) — compact, indigo/violet ---- */
  const kpiCards = [
    {
      icon: Flame,
      label: 'Emissions',
      value: k.totalEmissions.toLocaleString(),
      unit: 'tCO₂e',
      trend: trendDelta(trendArr, 'emissions'),
      spark: trendArr.map(t => t.emissions),
      sub: `S1: ${k.scope1.toLocaleString()} · S2: ${k.scope2.toLocaleString()}`,
      goodDirection: 'down' as const,
      tone: 'bg-indigo-50 text-indigo-600',
      sparkStroke: SPARK_STROKE,
      sparkFill: SPARK_FILL,
      module: 'analytics' as ModuleKey,
    },
    {
      icon: Zap,
      label: 'Energy',
      value: k.energyGJ.toLocaleString(),
      unit: 'GJ',
      trend: trendDelta(trendArr, 'energy'),
      spark: trendArr.map(t => t.energy),
      sub: `Renewable ${k.renewableShare}%`,
      goodDirection: 'down' as const,
      tone: 'bg-violet-50 text-violet-600',
      sparkStroke: SPARK_STROKE_ALT,
      sparkFill: SPARK_FILL_ALT,
      module: 'analytics' as ModuleKey,
    },
    {
      icon: Droplet,
      label: 'Water',
      value: k.waterWithdrawalKL.toLocaleString(),
      unit: 'KL',
      trend: trendDelta(trendArr, 'water'),
      spark: trendArr.map(t => t.water),
      sub: `Recycled ${k.waterRecycledShare}%`,
      goodDirection: 'down' as const,
      tone: 'bg-purple-50 text-purple-600',
      sparkStroke: SPARK_STROKE_ALT2,
      sparkFill: SPARK_FILL_ALT2,
      module: 'analytics' as ModuleKey,
    },
  ]

  return (
    <div className="space-y-5">
      {/* ---- Page header ---- */}
      <ReviewerPageHeader
        k={k}
        periodCount={overview.periods.length}
        pendingCount={pendingApprovals.length}
        lastSyncAt={lastSyncAt}
      />

      {/* ---- Top banner: Review Pipeline stepper ---- */}
      <PipelineBanner
        stages={pipelineCounts}
        currentIdx={currentStageIdx}
        onJump={() => setActiveModule('submissions')}
      />

      {/* ---- 2-column grid ---- */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* ============================
            LEFT COLUMN (~60%)
           ============================ */}
        <div className="space-y-5">
          {/* Review Queue table */}
          <ReviewQueueCard
            subs={reviewQueue}
            onViewAll={() => setActiveModule('submissions')}
          />

          {/* 3 compact KPI cards with sparklines */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {kpiCards.map((c, i) => (
              <CompactKpiCard key={c.label} delay={0.05 * i} {...c} onClick={() => setActiveModule(c.module)} />
            ))}
          </div>
        </div>

        {/* ============================
            RIGHT COLUMN (~40%)
           ============================ */}
        <div className="space-y-5">
          {/* Pending Approvals */}
          <PendingApprovalsCard
            total={pendingApprovals.length}
            byModule={pendingByModule}
            onOpen={() => setActiveModule('submissions')}
          />

          {/* Exception Summary */}
          <ExceptionSummaryCard
            validationErrors={k.openExceptions}
            anomalies={k.anomalies}
            corrections={k.corrections}
            brsrMissing={k.brsrMissing}
            onOpen={() => setActiveModule('audit')}
          />

          {/* Recent Review Actions */}
          <RecentReviewActionsCard
            actions={recentActions}
            onOpenAll={() => setActiveModule('audit')}
          />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * Sub-components
 * ============================================================ */

/* ---------- Page header ---------- */
function ReviewerPageHeader({
  k,
  periodCount,
  pendingCount,
  lastSyncAt,
}: {
  k: Kpis
  periodCount: number
  pendingCount: number
  lastSyncAt: Date | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <h1 className="text-[18px] font-bold tracking-tight text-slate-800">Reviewer Console</h1>
          <span className="status-pill status-review">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" /> Live
          </span>
        </div>
        <p className="mt-1 text-[12px] text-slate-500">
          Scope: {k.orgs} group(s) · {k.projects} project(s) · {periodCount} reporting period(s)
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-slate-600">
          <ClipboardCheck className="h-3 w-3 text-indigo-500" />
          {pendingCount} pending review
        </span>
        <span className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-slate-600">
          <BadgeCheck className="h-3 w-3 text-violet-500" />
          {k.completion}% reporting complete
        </span>
        {lastSyncAt && (
          <span className="flex items-center gap-1.5 rounded-full bg-indigo-50/70 px-2.5 py-1.5 text-[10px] font-semibold text-indigo-700">
            <Clock className="h-3 w-3" />
            {lastSyncAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </motion.div>
  )
}

/* ---------- Review Pipeline horizontal stepper banner ---------- */
function PipelineBanner({
  stages,
  currentIdx,
  onJump,
}: {
  stages: { stage: PipelineStage; count: number }[]
  currentIdx: number
  onJump: () => void
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      className="glass glass-shimmer rounded-2xl p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="kpi-tile bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600" style={{ width: 32, height: 32 }}>
            <GitBranch className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800">Review Pipeline</h2>
            <p className="text-[11px] text-slate-500">
              Submission flow across {stages.length} stages · current focus:{' '}
              <span className="font-semibold text-indigo-600">{stages[currentIdx]?.stage.label}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onJump}
          className="glass-subtle flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:text-indigo-600"
        >
          Open queue <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Stepper — horizontal scroll on small screens */}
      <div className="overflow-x-auto scroll-elegant">
        <ol className="flex min-w-max items-stretch gap-0 sm:min-w-0">
          {stages.map((s, i) => {
            const isCurrent = i === currentIdx
            const isPast = i < currentIdx
            const isFuture = i > currentIdx
            const StageIcon = s.stage.icon
            return (
              <li key={s.stage.key} className="flex flex-1 items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  className={`group relative flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-center transition ${
                    isCurrent ? 'bg-gradient-to-br from-indigo-500/10 to-violet-500/10 ring-1 ring-inset ring-indigo-400/40'
                    : isPast ? 'bg-emerald-50/40'
                    : 'bg-white/40'
                  }`}
                >
                  {/* Circle */}
                  <div className="relative">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                        isCurrent
                          ? 'border-indigo-500 bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/40'
                          : isPast
                          ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                          : 'border-slate-300 bg-white/80 text-slate-400'
                      }`}
                    >
                      {isPast ? <CheckCircle2 className="h-4 w-4" /> : <StageIcon className="h-4 w-4" />}
                      {isCurrent && (
                        <span className="absolute -inset-1 -z-10 animate-pulse-ring rounded-full" />
                      )}
                    </div>
                    {/* Count badge */}
                    {s.count > 0 && (
                      <span
                        className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums ${
                          isCurrent ? 'bg-violet-600 text-white' : isPast ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'
                        }`}
                      >
                        {s.count}
                      </span>
                    )}
                  </div>
                  {/* Label */}
                  <div className="flex flex-col items-center">
                    <span className={`text-[10px] font-semibold leading-tight ${isCurrent ? 'text-indigo-700' : isPast ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {s.stage.label}
                    </span>
                    <span className="text-[9px] tabular-nums text-slate-400">{s.count}</span>
                  </div>
                </motion.div>

                {/* Connector line (except last) */}
                {i < stages.length - 1 && (
                  <div className="relative mx-0.5 h-0.5 flex-1 overflow-hidden rounded-full bg-slate-200/70 sm:mx-1">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: isPast ? 1 : 0 }}
                      transition={{ delay: 0.15 + i * 0.05, duration: 0.5, ease: 'easeOut' }}
                      style={{ transformOrigin: 'left' }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </motion.section>
  )
}

/* ---------- Review Queue table (dense 40px rows) ---------- */
function ReviewQueueCard({ subs, onViewAll }: { subs: SubmissionItem[]; onViewAll: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="glass glass-shimmer rounded-2xl p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="kpi-tile bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600" style={{ width: 32, height: 32 }}>
            <ClipboardCheck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800">Review Queue</h2>
            <p className="text-[11px] text-slate-500">Submissions awaiting your decision</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="glass-subtle flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:text-indigo-600"
        >
          View all <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {subs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          <p className="text-[12px] text-slate-500">Queue is clear — nothing pending your review.</p>
        </div>
      ) : (
        <div className="overflow-x-auto scroll-elegant">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200/60 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-3">Project / Module</th>
                <th className="pb-2 pr-3">Period</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-2">Completion</th>
                <th className="pb-2 pr-2">Reviewer</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s, i) => {
                const projectName = s.project?.projectName ?? s.title
                const projectCode = s.project?.projectCode ?? s.module
                const period = s.reportingPeriod?.periodLabel ?? '—'
                const status = (s.status || 'DRAFT').toLowerCase().replace(/_/g, ' ')
                const statusPill = reviewerStatusPill(s.status)
                const completion = Math.round(s.completionPct ?? 0)
                const reviewer = s.currentReviewer?.name ?? 'Unassigned'
                const reviewerInitials = getInitials(reviewer)
                const hasErrors = (s.validationErrors ?? 0) > 0
                return (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.04 }}
                    className="group h-10 border-b border-slate-100/70 text-[12px] transition hover:bg-white/60"
                  >
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-100 to-violet-100 text-[10px] font-bold text-indigo-700">
                          {(s.module || '?').slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-800">{projectName}</div>
                          <div className="truncate text-[10px] text-slate-400">{projectCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{period}</td>
                    <td className="py-2 pr-3">
                      <span className={`status-pill ${statusPill}`}>
                        {hasErrors && <AlertTriangle className="h-3 w-3" />}
                        {status}
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200/70">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-[11px] font-semibold text-slate-700">{completion}%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-[9px] font-bold text-white">
                          {reviewerInitials}
                        </span>
                        <span className="truncate text-[11px] text-slate-600">{reviewer.split(' ')[0]}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={onViewAll}
                        className="inline-flex h-7 items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-3 text-[11px] font-semibold text-white shadow-sm transition hover:shadow-md hover:shadow-indigo-500/30"
                      >
                        Review <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.section>
  )
}

/* ---------- Compact KPI card with sparkline ---------- */
interface CompactKpiCardProps {
  icon: typeof Flame
  label: string
  value: string
  unit: string
  trend: number | null
  spark: number[]
  sub: string
  goodDirection: 'up' | 'down'
  tone: string
  sparkStroke: string
  sparkFill: string
  delay: number
  onClick: () => void
}
function CompactKpiCard({
  icon: Icon, label, value, unit, trend, spark, sub, goodDirection, tone,
  sparkStroke, sparkFill, delay, onClick,
}: CompactKpiCardProps) {
  const hasTrend = trend !== null && trend !== undefined && !Number.isNaN(trend)
  const isNeutral = hasTrend && trend === 0
  const isGood = hasTrend && !isNeutral &&
    ((goodDirection === 'down' && trend! < 0) || (goodDirection === 'up' && trend! > 0))
  const pillClass = !hasTrend || isNeutral ? 'status-review' : isGood ? 'status-approved' : 'status-warning'
  const hasSpark = spark.length >= 2
  const sparkData = spark.map((v, i) => ({ i, v }))
  const sparkId = `spark-${label.toLowerCase()}`
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="glass glass-shimmer group relative flex w-full flex-col overflow-hidden rounded-2xl p-4 text-left transition-all hover:shadow-lg hover:shadow-indigo-500/15"
      style={{ maxHeight: 200 }}
    >
      {/* Top row: label + trend pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`kpi-tile ${tone}`} style={{ width: 30, height: 30 }}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[12px] font-medium text-slate-500">{label}</span>
        </div>
        {hasTrend && (
          <span className={`status-pill ${pillClass}`}>
            {trend! < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {trend! > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      {/* Middle row: value + sparkline */}
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="tabular-nums text-[24px] font-bold leading-none text-slate-900">{value}</span>
            <span className="text-[11px] font-medium text-slate-400">&nbsp;{unit}</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500">{sub}</div>
        </div>
        {hasSpark && (
          <div className="h-[44px] w-[80px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={sparkStroke} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={sparkStroke} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={sparkStroke}
                  strokeWidth={2}
                  fill={`url(#${sparkId})`}
                  dot={false}
                  isAnimationActive
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-slate-400 opacity-0 transition group-hover:opacity-100">
        Drill-down <ArrowUpRight className="h-3 w-3" />
      </div>
    </motion.button>
  )
}

/* ---------- Pending Approvals card ---------- */
function PendingApprovalsCard({
  total,
  byModule,
  onOpen,
}: {
  total: number
  byModule: { module: string; count: number }[]
  onOpen: () => void
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="glass glass-shimmer relative overflow-hidden rounded-2xl p-4 sm:p-5"
    >
      {/* decorative gradient orb */}
      <div className="orb pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-400/30 to-violet-500/30" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="kpi-tile bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600" style={{ width: 32, height: 32 }}>
              <FileCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-slate-800">Pending Approvals</h2>
              <p className="text-[10px] text-slate-500">Awaiting reviewer decision</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="glass-subtle flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:text-indigo-600"
            aria-label="Open submissions"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Big number */}
        <div className="flex items-baseline gap-2">
          <motion.span
            key={total}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="bg-gradient-to-br from-indigo-600 to-violet-600 bg-clip-text text-[44px] font-bold leading-none text-transparent tabular-nums"
          >
            {total}
          </motion.span>
          <span className="text-[11px] font-medium text-slate-500">in queue</span>
        </div>

        {/* Breakdown by module */}
        <div className="mt-3 space-y-1.5">
          {byModule.length === 0 ? (
            <div className="rounded-lg bg-emerald-50/60 px-3 py-2 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="mr-1 inline h-3 w-3" />
              No pending approvals
            </div>
          ) : (
            byModule.slice(0, 5).map((m, i) => {
              const pct = total > 0 ? (m.count / total) * 100 : 0
              return (
                <motion.div
                  key={m.module}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.04 }}
                  className="flex items-center gap-2"
                >
                  <span className="w-16 truncate text-[10px] font-medium uppercase text-slate-500">{m.module}</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/70">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.25 + i * 0.04, duration: 0.55, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    />
                  </div>
                  <span className="w-5 text-right text-[11px] font-bold tabular-nums text-slate-700">{m.count}</span>
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </motion.section>
  )
}

/* ---------- Exception Summary card ---------- */
function ExceptionSummaryCard({
  validationErrors,
  anomalies,
  corrections,
  brsrMissing,
  onOpen,
}: {
  validationErrors: number
  anomalies: number
  corrections: number
  brsrMissing: number
  onOpen: () => void
}) {
  const total = validationErrors + anomalies + corrections + brsrMissing
  const items = [
    { label: 'Validation errors', value: validationErrors, icon: AlertTriangle, tone: 'bg-rose-50 text-rose-600', pill: 'status-error' },
    { label: 'Anomalies',         value: anomalies,       icon: AlertOctagon,  tone: 'bg-amber-50 text-amber-600', pill: 'status-warning' },
    { label: 'Corrections',       value: corrections,     icon: PenLine,        tone: 'bg-violet-50 text-violet-600', pill: 'status-review' },
    { label: 'BRSR missing',      value: brsrMissing,      icon: FlaskConical,   tone: 'bg-indigo-50 text-indigo-600', pill: 'status-submitted' },
  ]
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
      className="glass glass-shimmer rounded-2xl p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="kpi-tile bg-gradient-to-br from-rose-50 to-amber-50 text-rose-600" style={{ width: 32, height: 32 }}>
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-slate-800">Exception Summary</h2>
            <p className="text-[10px] text-slate-500">
              {total > 0
                ? `${total} open items need attention`
                : 'All clear — no open exceptions'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="glass-subtle flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:text-indigo-600"
          aria-label="Open audit log"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {items.map((it, i) => {
          const Icon = it.icon
          return (
            <motion.div
              key={it.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.04 }}
              className="flex items-center gap-2 rounded-xl bg-white/55 p-2 transition hover:bg-white/80"
            >
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${it.tone}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-medium text-slate-500">{it.label}</div>
                <div className="flex items-baseline gap-1">
                  <span className="tabular-nums text-[18px] font-bold leading-none text-slate-800">{it.value}</span>
                  {it.value > 0 && (
                    <span className={`status-pill ${it.pill} px-1.5 py-0 text-[9px]`}>open</span>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.section>
  )
}

/* ---------- Recent Review Actions feed ---------- */
function RecentReviewActionsCard({
  actions,
  onOpenAll,
}: {
  actions: ActivityItem[]
  onOpenAll: () => void
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
      className="glass glass-shimmer flex flex-col rounded-2xl p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="kpi-tile bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600" style={{ width: 32, height: 32 }}>
            <ActivityIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-slate-800">Recent Review Actions</h2>
            <p className="text-[10px] text-slate-500">Last 5 reviewer decisions</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenAll}
          className="glass-subtle flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-slate-500 transition hover:text-indigo-600"
        >
          All <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {actions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center text-[12px] text-slate-400"
            >
              No recent review activity yet.
            </motion.div>
          ) : (
            actions.map((a, i) => (
              <ReviewActionRow key={a.id} a={a} delay={i * 0.04} />
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  )
}

function ReviewActionRow({ a, delay }: { a: ActivityItem; delay: number }) {
  const initials = getInitials(a.actorName)
  const gradient = gradientForReviewerRole(a.actorRole)
  const tone = statusToneForReview(a.status)
  const actionIcon = reviewActionIcon(a.action)
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ delay }}
      className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/55"
    >
      <div className={`relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-[10px] font-bold text-white`}>
        {initials}
        <span className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white ${tone.iconBg}`}>
          {actionIcon && <actionIcon.icon className={`h-2.5 w-2.5 ${tone.iconColor}`} />}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold text-slate-800">{a.title}</span>
          {a.status && (
            <span className={`status-pill ${tone.pill} px-1.5 py-0 text-[9px]`}>{a.status}</span>
          )}
        </div>
        {a.description && (
          <p className="truncate text-[10px] text-slate-500">{a.description}</p>
        )}
        <div className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-400">
          <span className="font-medium text-slate-500">{a.actorName}</span>
          <span>·</span>
          <span>{a.actorRole.replace(/_/g, ' ').toLowerCase()}</span>
          <span>·</span>
          <span>{timeAgo(a.createdAt)}</span>
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================
 * Loading / Error / Empty states
 * ============================================================ */
function ReviewerSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-9 w-72 animate-pulse rounded-lg bg-slate-200/60" />
      {/* pipeline banner skeleton */}
      <div className="glass h-28 animate-pulse rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* left */}
        <div className="space-y-5">
          <div className="glass h-72 animate-pulse rounded-2xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map(i => <div key={i} className="glass h-40 animate-pulse rounded-2xl" />)}
          </div>
        </div>
        {/* right */}
        <div className="space-y-5">
          <div className="glass h-44 animate-pulse rounded-2xl" />
          <div className="glass h-44 animate-pulse rounded-2xl" />
          <div className="glass h-56 animate-pulse rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-500" />
      <div>
        <div className="text-base font-bold text-slate-800">Failed to load reviewer console</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:shadow-lg"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <CheckCircle2 className="h-10 w-10 text-slate-400" />
      <div>
        <div className="text-base font-bold text-slate-800">No data yet</div>
        <div className="text-xs text-slate-500">Reporting periods or source records need to be created first.</div>
      </div>
    </div>
  )
}

/* ============================================================
 * Helpers
 * ============================================================ */
function trendDelta(trends: Trend[], key: keyof Trend): number | null {
  if (!trends || trends.length < 2) return null
  const last = trends[trends.length - 1][key]
  const prev = trends[trends.length - 2][key]
  if (prev === 0) return null
  return Math.round(((last - prev) / prev) * 1000) / 10
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function gradientForReviewerRole(role: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN:           'from-slate-600 to-slate-800',
    BU_REVIEWER:           'from-indigo-500 to-violet-600',
    SUBSIDIARY_REVIEWER:   'from-violet-500 to-purple-600',
    GROUP_REVIEWER:        'from-indigo-600 to-blue-700',
    ESG_MANAGER:           'from-violet-500 to-fuchsia-600',
    ESG_ANALYST:           'from-purple-500 to-violet-700',
    BRSR_MANAGER:          'from-indigo-500 to-purple-600',
    AUDITOR:               'from-slate-500 to-slate-700',
    PROJECT_USER:          'from-indigo-400 to-violet-500',
    HR_USER:               'from-violet-400 to-purple-500',
    EHS_USER:              'from-indigo-400 to-blue-500',
    PROCUREMENT_USER:      'from-violet-400 to-fuchsia-500',
    CSR_USER:              'from-purple-400 to-violet-600',
    COMPLIANCE_USER:       'from-indigo-500 to-blue-600',
    EXECUTIVE:             'from-amber-600 to-yellow-700',
  }
  const key = Object.keys(map).find(k => k.toUpperCase() === (role || '').toUpperCase())
  return key ? map[key] : 'from-indigo-500 to-violet-600'
}

function statusToneForReview(status: string | null | undefined): { pill: string; iconBg: string; iconColor: string } {
  if (!status) return { pill: 'status-review', iconBg: 'bg-slate-100', iconColor: 'text-slate-500' }
  const s = status.toUpperCase()
  if (s.includes('APPROVED') || s.includes('VERIFIED') || s.includes('COMPLETED') || s.includes('LOCKED'))
    return { pill: 'status-approved', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' }
  if (s.includes('SUBMITTED') || s.includes('SYNC'))
    return { pill: 'status-submitted', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' }
  if (s.includes('REVIEW') || s.includes('PENDING'))
    return { pill: 'status-review', iconBg: 'bg-violet-50', iconColor: 'text-violet-600' }
  if (s.includes('DRAFT') || s.includes('MISSING'))
    return { pill: 'status-draft', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' }
  if (s.includes('ERROR') || s.includes('REJECTED'))
    return { pill: 'status-error', iconBg: 'bg-rose-50', iconColor: 'text-rose-600' }
  return { pill: 'status-locked', iconBg: 'bg-slate-100', iconColor: 'text-slate-500' }
}

function reviewActionIcon(action: string | undefined): { icon: typeof ActivityIcon } | null {
  if (!action) return null
  const a = action.toUpperCase()
  if (a.includes('APPROVE')) return { icon: CheckCircle2 }
  if (a.includes('REJECT'))  return { icon: XCircle }
  if (a.includes('CORRECT')) return { icon: PenLine }
  if (a.includes('LOCK'))    return { icon: Lock }
  if (a.includes('SUBMIT'))  return { icon: Send }
  if (a.includes('REVIEW'))  return { icon: Eye }
  if (a.includes('EVIDENCE')) return { icon: BadgeCheck }
  return { icon: ActivityIcon }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
