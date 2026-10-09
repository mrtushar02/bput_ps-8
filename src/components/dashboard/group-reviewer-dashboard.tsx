'use client'
/**
 * GroupReviewerDashboard — Group / HQ ESG reviewer command surface.
 *
 * DISTINCTLY DIFFERENT — authoritative NAVY/GOLD palette (#1e3a8a navy +
 * #d4a017 gold + #1e40af deep) and a FULL-WIDTH hero radial gauge above a
 * 3-column grid layout (premium / executive tone).
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  HERO: large radial gauge (group ESG readiness %) + Final Review badge│
 *  ├──────────────────┬─────────────────────┬───────────────────────────┤
 *  │  LEFT            │  CENTER             │  RIGHT                    │
 *  │  Subsidiary list │  Final Review Queue │  Group KPIs + readiness   │
 *  │  (name/BU/%/pill)│  table w/ approve  │  + lock count             │
 *  │                  │  & lock actions     │                           │
 *  └──────────────────┴─────────────────────┴───────────────────────────┘
 *
 * Data sources:
 *   - GET /api/overview     → kpis, trends, activities
 *   - GET /api/submissions  → final review queue
 *   - GET /api/activity?take=10 → recent group-level actions
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown, ShieldCheck, Lock, Network, Building2, FlaskConical,
  Flame, Zap, Droplet, Users, CheckCircle2, AlertTriangle,
  ArrowRight, ChevronRight, Send, Eye, ClipboardCheck, Award,
  RefreshCw, AlertOctagon, Activity as ActivityIcon, FileText,
  Sparkles, TrendingUp, TrendingDown, BadgeCheck, Layers, Gauge,
} from 'lucide-react'
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
  AreaChart, Area, Tooltip,
} from 'recharts'
import { useApp, type ModuleKey } from '@/lib/auth-context'

/* ============================================================
 * Types
 * ============================================================ */
interface Kpis {
  totalEmissions: number; scope1: number; scope2: number; scope3: number
  energyGJ: number; renewableShare: number
  waterWithdrawalKL: number; waterRecycledShare: number
  wasteGeneratedT: number; wasteRecycledShare: number
  brsrReadiness: number; brsrMissing: number
  completion: number; totalSubs: number; approvedSubs: number
  draftSubs: number; reviewSubs: number
  openExceptions: number; anomalies: number; corrections: number
  evidenceTotal: number; evidenceVerified: number
  projects: number; orgs: number
  totalEmployees: number; totalWorkers: number; totalWorkforce: number
  femaleShare: number; fatalities: number; injuries: number; ltifr: number
}
interface Trend { emissions: number; energy: number; water: number; waste: number }
type Trends = Record<string, Trend>
interface OverviewData {
  kpis: Kpis; trends: Trends; emissionsBySource?: Record<string, number>
  periods: { id: string; label: string; year: number; month: number | null; status: string }[]
  activities?: ActivityItem[]
}
interface ActivityItem {
  id: string; projectId: string; actorId: string; actorName: string
  actorRole: string; action: string; title: string
  description?: string | null; module?: string | null; status?: string | null
  createdAt: string
  project?: { id: string; projectName: string; projectCode: string; location?: string | null } | null
}
interface SubmissionItem {
  id: string; projectId: string; module: string; title: string; status: string
  recordIds: string; completionPct: number; evidenceCount: number
  validationPassed: number; validationErrors: number
  createdAt: string; updatedAt: string
  project?: { id: string; projectCode: string; projectName: string; location?: string | null; status?: string } | null
  reportingPeriod?: { id: string; periodLabel: string; year: number; month: number | null } | null
  currentReviewer?: { id: string; name: string; email: string } | null
}
interface SubmissionResponse { items: SubmissionItem[]; total: number; count: number }
interface ActivityResponse { items: ActivityItem[]; total: number; count: number }

/* ============================================================
 * Constants — Navy / Gold premium palette
 * ============================================================ */
const NAVY = '#1e3a8a'
const NAVY_DEEP = '#1e40af'
const GOLD = '#d4a017'
const GOLD_LIGHT = '#f4c842'

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,253,245,0.97)',
  border: '1px solid rgba(212,160,23,0.45)',
  borderRadius: 12,
  fontSize: 11,
  boxShadow: '0 8px 24px -8px rgba(30,58,138,0.30)',
  backdropFilter: 'blur(12px)',
  padding: '6px 10px',
  color: '#0f172a',
}

/* ============================================================
 * Helpers
 * ============================================================ */
function fmt(n: number, d = 0): string { return n.toLocaleString('en-IN', { maximumFractionDigits: d }) }
function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  const s = Math.floor((Date.now() - t) / 1000)
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
function stageLabel(s: string): string {
  const m: Record<string, string> = {
    DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review',
    BU_APPROVED: 'BU approved', SUBSIDIARY_APPROVED: 'Subsidiary approved',
    HQ_REVIEW: 'HQ review', LOCKED: 'Locked', APPROVED: 'Approved',
  }
  return m[s.toUpperCase()] || s
}

/* ============================================================
 * Main component
 * ============================================================ */
export function GroupReviewerDashboard() {
  const { setActiveModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [locking, setLocking] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/overview', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as OverviewData
      if (!mountedRef.current) return
      setOverview(data); setError('')
    } catch (e) {
      if (!mountedRef.current) return
      if (!overview) setError(e instanceof Error ? e.message : 'Failed to load group overview')
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
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [fetchOverview, fetchSubmissions])

  /* Final review queue = HQ_REVIEW + SUBSIDIARY_APPROVED (need HQ action) */
  const finalQueue = useMemo(() => {
    const actionable = ['HQ_REVIEW', 'SUBSIDIARY_APPROVED', 'BU_APPROVED']
    return submissions
      .filter(s => actionable.includes((s.status || '').toUpperCase()))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6)
  }, [submissions])

  /* Subsidiary overview (group by projectId) */
  const subsidiaryRows = useMemo(() => {
    const map = new Map<string, { name: string; code: string; buCount: number; completion: number; status: string; updatedAt: string }>()
    for (const s of submissions) {
      const key = s.projectId || s.id
      const existing = map.get(key)
      const name = s.project?.projectName || s.title || '—'
      const code = s.project?.projectCode || '—'
      if (existing) {
        existing.buCount += 1
        existing.completion = Math.round((existing.completion + s.completionPct) / 2)
        if (new Date(s.updatedAt) > new Date(existing.updatedAt)) {
          existing.status = s.status; existing.updatedAt = s.updatedAt
        }
      } else {
        map.set(key, { name, code, buCount: 1, completion: s.completionPct, status: s.status, updatedAt: s.updatedAt })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.completion - a.completion).slice(0, 8)
  }, [submissions])

  const recentGroupActions = useMemo<ActivityItem[]>(() => {
    const all = (overview?.activities as ActivityItem[] | undefined) ?? activities
    const filtered = all.filter(a => {
      const act = (a.action || '').toUpperCase()
      return act.includes('APPROVE') || act.includes('LOCK') || act.includes('REVIEW') || act.includes('SUBMIT')
    })
    return (filtered.length > 0 ? filtered : all).slice(0, 5)
  }, [overview, activities])

  /* Action: Approve / Lock simulation (front-end only — no API mutation). */
  const onAction = useCallback((id: string, kind: 'approve' | 'lock') => {
    setLocking(id)
    setTimeout(() => {
      setLocking(null)
      setActiveModule('submissions')
    }, 600)
    // intentionally no fetch — actual workflow runs through submissions module
    void kind
  }, [setActiveModule])

  /* ---- render states ---- */
  if (loading) return <GroupSkeleton />
  if (error && !overview) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!overview) return <EmptyState />
  const k = overview.kpis
  const readiness = Math.round(k.completion)
  const readinessData = [{ name: 'readiness', value: readiness, fill: GOLD }]

  const groupKpis = [
    { icon: Flame, label: 'Emissions', value: fmt(k.totalEmissions, 1), unit: 'tCO₂e', sub: `S1 ${fmt(k.scope1, 0)}` },
    { icon: Zap, label: 'Energy', value: fmt(k.energyGJ, 1), unit: 'GJ', sub: `Renewable ${k.renewableShare}%` },
    { icon: Droplet, label: 'Water', value: fmt(k.waterWithdrawalKL, 1), unit: 'KL', sub: `Recycled ${k.waterRecycledShare}%` },
    { icon: Users, label: 'Workforce', value: fmt(k.totalWorkforce), unit: 'people', sub: `Female ${k.femaleShare}%` },
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
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-navy-700 to-navy-900 text-white shadow-lg shadow-blue-900/40" style={{ background: 'linear-gradient(135deg, #1e3a8a, #1e40af)' }}>
              <Crown className="h-5 w-5" />
            </span>
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900">Group HQ Review Console</h1>
            <span className="status-pill status-approved">
              <Lock className="h-3 w-3" /> {k.approvedSubs} locked
            </span>
          </div>
          <p className="mt-1 text-[12px] text-slate-600">
            Final HQ authority · {k.orgs} group(s) · {k.projects} BU(s) · {k.totalSubs} submissions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-slate-700">
            <Award className="h-3.5 w-3.5" style={{ color: GOLD }} />
            Readiness {readiness}%
          </span>
          <button
            onClick={() => setActiveModule('submissions')}
            className="rounded-full px-4 py-1.5 text-[11px] font-semibold text-white shadow-md transition-transform hover:scale-[1.03]"
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #d4a017)' }}
          >
            Open review queue
          </button>
        </div>
      </motion.div>

      {/* ============================
          HERO — Radial readiness gauge
         ============================ */}
      <HeroGaugeCard
        readiness={readiness}
        gaugeData={readinessData}
        totalSubs={k.totalSubs}
        approvedSubs={k.approvedSubs}
        reviewSubs={k.reviewSubs}
        openExceptions={k.openExceptions + k.anomalies + k.corrections}
        onOpenQueue={() => setActiveModule('submissions')}
        onOpenExceptions={() => setActiveModule('audit')}
      />

      {/* ============================
          3-COLUMN GRID
         ============================ */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ---- LEFT: Subsidiary Overview ---- */}
        <SubsidiaryOverviewCard rows={subsidiaryRows} onOpen={() => setActiveModule('submissions')} />

        {/* ---- CENTER: Final Review Queue ---- */}
        <FinalReviewQueueCard
          items={finalQueue}
          onAction={onAction}
          locking={locking}
        />

        {/* ---- RIGHT: Group KPIs + readiness ---- */}
        <div className="space-y-5">
          <GroupKpiCard kpis={groupKpis} />
          <ReadinessCard brsrReadiness={k.brsrReadiness} brsrMissing={k.brsrMissing} lockCount={k.approvedSubs} />
          <GroupActivityCard actions={recentGroupActions} onOpenAll={() => setActiveModule('audit')} />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * Sub-components
 * ============================================================ */

/* ---------- Hero radial gauge ---------- */
function HeroGaugeCard({
  readiness, gaugeData, totalSubs, approvedSubs, reviewSubs, openExceptions, onOpenQueue, onOpenExceptions,
}: {
  readiness: number
  gaugeData: { name: string; value: number; fill: string }[]
  totalSubs: number; approvedSubs: number; reviewSubs: number; openExceptions: number
  onOpenQueue: () => void; onOpenExceptions: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="glass-strong relative overflow-hidden rounded-2xl p-6 shadow-xl shadow-blue-900/15"
    >
      <div className="orb -right-16 -top-20 h-56 w-56" style={{ background: 'rgba(212,160,23,0.35)' }} />
      <div className="orb -left-10 -bottom-16 h-40 w-40" style={{ background: 'rgba(30,58,138,0.18)' }} />
      <div className="relative flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* gauge */}
        <div className="flex items-center gap-5">
          <div className="relative h-[140px] w-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%" cy="50%" innerRadius="68%" outerRadius="100%"
                barSize={14} data={gaugeData} startAngle={220} endAngle={-40}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background={{ fill: 'rgba(30,58,138,0.10)' }} dataKey="value" cornerRadius={10} angleAxisId={0} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[36px] font-extrabold tabular-nums leading-none" style={{ color: NAVY }}>{readiness}%</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Group Readiness</span>
            </div>
          </div>
          <div>
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md" style={{ background: 'linear-gradient(135deg, #1e3a8a, #d4a017)' }}>
              <ShieldCheck className="h-3 w-3" /> Final Review
            </span>
            <h2 className="mt-2 text-[18px] font-bold tracking-tight text-slate-900">Group-wide ESG readiness</h2>
            <p className="mt-1 max-w-sm text-[12px] text-slate-600">
              {approvedSubs} of {totalSubs} submissions locked for reporting · {reviewSubs} awaiting HQ sign-off.
            </p>
          </div>
        </div>

        {/* side stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
          {[
            { label: 'Total', value: totalSubs, icon: FileText, tone: 'text-navy-700' },
            { label: 'Locked', value: approvedSubs, icon: Lock, tone: 'text-emerald-600' },
            { label: 'In review', value: reviewSubs, icon: Eye, tone: 'text-amber-600' },
            { label: 'Exceptions', value: openExceptions, icon: AlertTriangle, tone: 'text-rose-600' },
          ].map(s => (
            <button
              key={s.label}
              onClick={s.label === 'Exceptions' ? onOpenExceptions : onOpenQueue}
              className="rounded-xl border border-slate-200/70 bg-white/60 p-3 text-left transition-all hover:scale-[1.03]"
            >
              <div className="flex items-center justify-between">
                <s.icon className={`h-4 w-4 ${s.tone}`} style={s.label === 'Total' ? { color: NAVY } : undefined} />
                <span className="text-[10px] font-medium uppercase text-slate-500">{s.label}</span>
              </div>
              <div className="mt-1 text-[22px] font-bold tabular-nums text-slate-900">{s.value}</div>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/* ---------- LEFT: Subsidiary overview list ---------- */
function SubsidiaryOverviewCard({
  rows, onOpen,
}: {
  rows: { name: string; code: string; buCount: number; completion: number; status: string; updatedAt: string }[]
  onOpen: () => void
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
          <Building2 className="h-4 w-4" style={{ color: NAVY }} />
          <h2 className="text-[13px] font-semibold text-slate-900">Subsidiary Overview</h2>
        </div>
        <button onClick={onOpen} className="text-[11px] font-semibold hover:underline" style={{ color: NAVY }}>
          All →
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-[11px] text-slate-500">No subsidiaries reporting yet.</div>
      ) : (
        <ul className="scroll-elegant max-h-96 space-y-2 overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.04 }}
              className="rounded-xl border border-slate-200/60 bg-white/55 p-3 transition-colors hover:bg-amber-50/40"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-slate-900">{r.name}</div>
                  <div className="text-[10px] text-slate-500">{r.code} · {r.buCount} BU(s) · {timeAgo(r.updatedAt)}</div>
                </div>
                <span className={`status-pill ${subStatusPill(r.status)}`}>{stageLabel(r.status)}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/70">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.completion)}%`, background: 'linear-gradient(90deg, #1e3a8a, #d4a017)' }} />
                </div>
                <span className="tabular-nums text-[10px] font-semibold text-slate-700">{r.completion}%</span>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}

/* ---------- CENTER: Final Review Queue ---------- */
function FinalReviewQueueCard({
  items, onAction, locking,
}: {
  items: SubmissionItem[]
  onAction: (id: string, kind: 'approve' | 'lock') => void
  locking: string | null
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
          <ShieldCheck className="h-4 w-4" style={{ color: NAVY }} />
          <h2 className="text-[13px] font-semibold text-slate-900">Final Review Queue</h2>
          <span className="status-pill status-verified">{items.length}</span>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-[11px] text-slate-500">No items awaiting HQ sign-off.</div>
      ) : (
        <ul className="scroll-elegant max-h-96 space-y-2 overflow-y-auto pr-1">
          {items.map((s, i) => {
            const stage = stageLabel(s.status)
            const isHQ = (s.status || '').toUpperCase() === 'HQ_REVIEW' || (s.status || '').toUpperCase() === 'SUBSIDIARY_APPROVED'
            return (
              <motion.li
                key={s.id || i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.22 + i * 0.05 }}
                className="rounded-xl border border-slate-200/60 bg-white/55 p-3 transition-colors hover:bg-amber-50/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold text-slate-900">
                      {s.project?.projectName || s.title || 'Submission'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {s.project?.projectCode} · {s.module} · {timeAgo(s.updatedAt)}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className={`status-pill ${subStatusPill(s.status)}`}>{stage}</span>
                      <span className="text-[10px] tabular-nums text-slate-600">{s.completionPct}%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      disabled={locking === s.id || !isHQ}
                      onClick={() => onAction(s.id, 'approve')}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white shadow transition-transform hover:scale-105 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #1e3a8a, #1e40af)' }}
                    >
                      {locking === s.id ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <CheckCircle2 className="h-2.5 w-2.5" />} Approve
                    </button>
                    <button
                      disabled={locking === s.id || !isHQ}
                      onClick={() => onAction(s.id, 'lock')}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold shadow transition-transform hover:scale-105 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #d4a017, #b8860b)', color: '#1e3a8a' }}
                    >
                      <Lock className="h-2.5 w-2.5" /> Lock
                    </button>
                  </div>
                </div>
              </motion.li>
            )
          })}
        </ul>
      )}
    </motion.div>
  )
}

/* ---------- RIGHT: Group KPIs ---------- */
function GroupKpiCard({ kpis }: { kpis: { icon: typeof Flame; label: string; value: string; unit: string; sub: string }[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.21, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-blue-900/5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4" style={{ color: NAVY }} />
        <h2 className="text-[13px] font-semibold text-slate-900">Group KPIs</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 + i * 0.04 }}
            className="rounded-xl border border-slate-200/60 bg-white/55 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow" style={{ background: 'linear-gradient(135deg, #1e3a8a, #1e40af)' }}>
                <c.icon className="h-4 w-4" />
              </div>
              <Sparkles className="h-3 w-3" style={{ color: GOLD }} />
            </div>
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-bold tabular-nums text-slate-900">{c.value}</span>
              <span className="text-[10px] text-slate-500">{c.unit}</span>
            </div>
            <div className="text-[10px] text-slate-600">{c.sub}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

/* ---------- RIGHT: BRSR readiness + lock count ---------- */
function ReadinessCard({ brsrReadiness, brsrMissing, lockCount }: { brsrReadiness: number; brsrMissing: number; lockCount: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-blue-900/5"
    >
      <div className="mb-3 flex items-center gap-2">
        <BadgeCheck className="h-4 w-4" style={{ color: GOLD }} />
        <h2 className="text-[13px] font-semibold text-slate-900">BRSR Readiness</h2>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-slate-200/60 bg-white/55 p-2.5">
          <div className="text-[20px] font-bold tabular-nums" style={{ color: NAVY }}>{Math.round(brsrReadiness)}%</div>
          <div className="text-[9px] font-semibold uppercase text-slate-500">Ready</div>
        </div>
        <div className="rounded-xl border border-rose-200/60 bg-rose-50/40 p-2.5">
          <div className="text-[20px] font-bold tabular-nums text-rose-700">{brsrMissing}</div>
          <div className="text-[9px] font-semibold uppercase text-slate-500">Missing</div>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-2.5">
          <div className="text-[20px] font-bold tabular-nums text-emerald-700">{lockCount}</div>
          <div className="text-[9px] font-semibold uppercase text-slate-500">Locked</div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/70">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, brsrReadiness)}%`, background: 'linear-gradient(90deg, #1e3a8a, #d4a017)' }} />
      </div>
    </motion.div>
  )
}

/* ---------- RIGHT: Recent group-level actions ---------- */
function GroupActivityCard({
  actions, onOpenAll,
}: {
  actions: ActivityItem[]; onOpenAll: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.27, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-blue-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-4 w-4" style={{ color: NAVY }} />
          <h2 className="text-[13px] font-semibold text-slate-900">Group Actions</h2>
        </div>
        <button onClick={onOpenAll} className="text-[11px] font-semibold hover:underline" style={{ color: NAVY }}>All →</button>
      </div>
      {actions.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-slate-500">No recent actions.</div>
      ) : (
        <ul className="scroll-elegant max-h-60 space-y-2 overflow-y-auto pr-1">
          {actions.map((a, i) => (
            <motion.li
              key={a.id || i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.04 }}
              className="flex items-start gap-2 rounded-xl border border-slate-200/60 bg-white/55 p-2.5 hover:bg-amber-50/40"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow" style={{ background: 'linear-gradient(135deg, #1e3a8a, #d4a017)' }}>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-semibold text-slate-800">{a.actorName || 'System'}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="truncate text-[11px] text-slate-600">{a.title || a.action}</p>
                {a.project?.projectName && (
                  <p className="truncate text-[10px]" style={{ color: NAVY }}>{a.project.projectName}</p>
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
function GroupSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-12 animate-pulse rounded-2xl" style={{ background: 'rgba(30,58,138,0.15)' }} />
      <div className="h-40 animate-pulse rounded-2xl" style={{ background: 'rgba(212,160,23,0.12)' }} />
      <div className="grid grid-cols-1 md:grid-cols-1 gap-5 lg:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-72 animate-pulse rounded-2xl" style={{ background: 'rgba(30,58,138,0.10)', animationDelay: `${i * 0.08}s` }} />
        ))}
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
      <h3 className="text-sm font-semibold text-slate-900">Group console unavailable</h3>
      <p className="mt-1 text-[12px] text-slate-600">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-full px-4 py-2 text-[11px] font-semibold text-white shadow-md" style={{ background: 'linear-gradient(135deg, #1e3a8a, #d4a017)' }}>
        <RefreshCw className="mr-1 inline h-3 w-3" /> Retry
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl p-10 text-center shadow-lg">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(30,58,138,0.12)', color: NAVY }}>
        <Crown className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">No group data yet</h3>
      <p className="mt-1 text-[12px] text-slate-600">Once subsidiaries submit, the group HQ console will populate here.</p>
    </div>
  )
}
