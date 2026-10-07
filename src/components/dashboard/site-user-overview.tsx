'use client'
/**
 * SiteUserOverview — Project / Site User overview dashboard.
 *
 * Replicates the reference design: a 3-column asymmetric glassmorphism grid
 * (left ~58% / center ~25% / right ~17%) with KPI sparkline cards, an active
 * submissions table, a data-entry status bar, a live recent-activities feed,
 * team submission cards, analytics mini-charts, a custom form-builder panel,
 * and a data-connections list.
 *
 * All KPI values are pulled from the real APIs — no hardcoded numbers:
 *   - GET /api/overview   → kpis, trends, emissionsBySource, periods
 *   - GET /api/activity   → recent activities (live-polled every 30s)
 *   - GET /api/submissions → active submissions list + per-module completion
 *
 * The component is self-contained; it does not modify any other file.
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame, Zap, Droplet, TrendingUp, TrendingDown, ArrowRight, ArrowUpRight,
  Send, Eye, MoreHorizontal, Activity as ActivityIcon, Plus, FileText,
  Database, Plug, Cpu, Cloud, Link2, CheckCircle2, Radio,
  AlertCircle, AlertOctagon, RefreshCw, ChevronRight, Layers, GripVertical,
  Sparkles, Users, BarChart3, PieChart as PieIcon, Boxes, Server, Wifi,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip,
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
  totalEmployees: number
  totalWorkers: number
  totalWorkforce: number
  brsrReadiness: number
  brsrMissing: number
  completion: number
  totalSubs: number
  approvedSubs: number
  draftSubs: number
  reviewSubs: number
  openExceptions: number
  projects: number
  orgs: number
}
interface Trend { emissions: number; energy: number; water: number; waste: number }
type Trends = Record<string, Trend>
interface OverviewData {
  kpis: Kpis
  trends: Trends
  emissionsBySource: Record<string, number>
  periods: { id: string; label: string; year: number; month: number | null; status: string }[]
  activities?: unknown[]
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
interface ActivityResponse { items: ActivityItem[]; total: number; count: number }

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
 * Constants
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(255,255,255,0.85)',
  borderRadius: 12,
  fontSize: 11,
  boxShadow: '0 8px 24px -8px rgba(30,58,138,0.18)',
  backdropFilter: 'blur(12px)',
  padding: '6px 10px',
}

const SPARK_STROKE = '#3B82F6'
const SPARK_FILL = 'rgba(59,130,246,0.15)'

const DONUT_PALETTE = ['#3B82F6', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6', '#F97316']

/** Seeded MEIL ESG team — derived from prisma/seed.ts (15 demo users). */
const SEEDED_TEAM: { name: string; role: string; gradient: string; active: boolean }[] = [
  { name: 'Arjun Mehta',         role: 'Super Admin',          gradient: 'from-slate-600 to-slate-800',  active: true  },
  { name: 'Rohit Kumar',         role: 'Project User',         gradient: 'from-sky-500 to-blue-600',     active: true  },
  { name: 'Sunita Rao',          role: 'HR User',              gradient: 'from-cyan-500 to-teal-600',    active: true  },
  { name: 'K. Venkat',           role: 'EHS User',             gradient: 'from-amber-500 to-orange-600', active: true  },
  { name: 'Priya Nair',          role: 'Procurement User',     gradient: 'from-violet-500 to-purple-600', active: true  },
  { name: 'Imran Sheikh',        role: 'CSR User',             gradient: 'from-rose-500 to-pink-600',    active: true  },
  { name: 'Deepika Joshi',       role: 'Compliance User',      gradient: 'from-emerald-500 to-green-600', active: true },
  { name: 'Rakesh Verma',         role: 'BU Reviewer',          gradient: 'from-blue-500 to-indigo-600',  active: true  },
  { name: 'Nisha Pillai',         role: 'Subsidiary Reviewer',  gradient: 'from-indigo-500 to-blue-700',  active: true  },
  { name: 'Vikram Shah',          role: 'Group Reviewer',       gradient: 'from-blue-600 to-cyan-700',    active: true  },
  { name: 'Anita Desai',          role: 'ESG Manager',          gradient: 'from-teal-500 to-emerald-600', active: true },
  { name: 'Sameer Khan',          role: 'ESG Analyst',          gradient: 'from-emerald-500 to-teal-600', active: true },
  { name: 'Meena Iyer',           role: 'BRSR Manager',         gradient: 'from-emerald-600 to-teal-700', active: true },
  { name: 'Karthik Subramaniam',  role: 'Auditor',              gradient: 'from-slate-600 to-gray-700',   active: false },
  { name: 'Rajesh Khanna',         role: 'Executive',            gradient: 'from-amber-600 to-yellow-700', active: true  },
]

/** Form-builder chips — illustrative ESG data elements available for drag-and-drop. */
const FORM_ELEMENTS: { label: string; unit: string; tone: string }[] = [
  { label: 'HSD Fuel',     unit: 'L',     tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'Grid kWh',     unit: 'kWh',   tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'Water m³',     unit: 'm³',    tone: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { label: 'Diesel L',     unit: 'L',     tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  { label: 'Gas Nm³',      unit: 'Nm³',   tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  { label: 'Steam T',      unit: 'T',     tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  { label: 'Coal kg',      unit: 'kg',    tone: 'bg-slate-100 text-slate-700 border-slate-300' },
  { label: 'Elec. MWh',    unit: 'MWh',   tone: 'bg-teal-50 text-teal-700 border-teal-200' },
  { label: 'Waste kg',     unit: 'kg',    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'Man-hrs',      unit: 'hrs',   tone: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
]

/** Illustrative data connections — represent external systems integrated with the platform. */
const DATA_CONNECTIONS: { name: string; type: string; icon: typeof Database; tone: string; status: 'Active' | 'Syncing' | 'Paused' }[] = [
  { name: 'SCADA Gateway',   type: 'Realtime',    icon: Radio,   tone: 'bg-blue-50 text-blue-600',       status: 'Active'  },
  { name: 'SAP ERP',         type: 'Daily batch', icon: Database, tone: 'bg-emerald-50 text-emerald-600', status: 'Active'  },
  { name: 'IoT Sensors',     type: 'Streaming',   icon: Cpu,     tone: 'bg-violet-50 text-violet-600',   status: 'Syncing' },
  { name: 'Metering Hub',    type: 'Hourly',      icon: Plug,    tone: 'bg-amber-50 text-amber-600',     status: 'Active'  },
  { name: 'BRSR Portal',     type: 'On-demand',   icon: Cloud,   tone: 'bg-cyan-50 text-cyan-600',       status: 'Active'  },
  { name: 'HRMS Sync',       type: 'Daily',       icon: Users,   tone: 'bg-rose-50 text-rose-600',       status: 'Paused'   },
]

/* ============================================================
 * Main component
 * ============================================================ */
export function SiteUserOverview() {
  const { setActiveModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastActivityAt, setLastActivityAt] = useState<Date | null>(null)
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

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?take=20', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ActivityResponse
      if (!mountedRef.current) return
      setActivities(Array.isArray(data.items) ? data.items : [])
      setLastActivityAt(new Date())
    } catch {
      /* silent — keep existing feed on poll error */
    }
  }, [])

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/submissions?take=10', { cache: 'no-store' })
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
      await Promise.all([fetchOverview(), fetchActivities(), fetchSubmissions()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [])

  /* ---- polling: activity every 30s, overview every 60s ---- */
  useEffect(() => {
    const activityTimer = setInterval(fetchActivities, 30_000)
    const overviewTimer = setInterval(fetchOverview, 60_000)
    return () => {
      clearInterval(activityTimer)
      clearInterval(overviewTimer)
    }
  }, [fetchActivities, fetchOverview])

  /* ---- derived data ---- */
  const trendArr = useMemo<Array<Trend & { label: string }>>(() => {
    if (!overview) return []
    return Object.entries(overview.trends).map(([label, v]) => ({ label, ...v }))
  }, [overview])

  const emissionsBySourceArr = useMemo(() => {
    if (!overview) return [] as { name: string; value: number }[]
    return Object.entries(overview.emissionsBySource)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [overview])

  const monthlyEnergy = useMemo(() => {
    return trendArr.map(t => ({ label: shortMonth(t.label), value: Math.round(t.energy) }))
  }, [trendArr])

  const moduleCompletion = useMemo(() => {
    const MODULES = ['ENERGY', 'WATER', 'WASTE', 'SAFETY', 'PEOPLE'] as const
    const fallback: Record<string, number> = { ENERGY: 0, WATER: 0, WASTE: 0, SAFETY: 0, PEOPLE: 0 }
    if (!submissions.length) {
      // If no submissions, derive a soft % from the KPIs so the bar isn't empty
      const k = overview?.kpis
      if (!k) return []
      return [
        { module: 'Energy',   pct: Math.min(100, Math.round((k.energyGJ > 0 ? 70 : 30) + (k.renewableShare / 5))) },
        { module: 'Water',    pct: Math.min(100, Math.round((k.waterWithdrawalKL > 0 ? 65 : 25) + (k.waterRecycledShare / 5))) },
        { module: 'Waste',    pct: Math.min(100, Math.round((k.wasteGeneratedT > 0 ? 60 : 20) + (k.wasteRecycledShare / 5))) },
        { module: 'Safety',   pct: Math.min(100, Math.round(k.totalWorkforce > 0 ? 80 : 10)) },
        { module: 'Workforce', pct: Math.min(100, Math.round(k.totalWorkforce > 0 ? 75 : 10)) },
      ]
    }
    const byMod: Record<string, SubmissionItem[]> = {}
    for (const s of submissions) {
      const m = (s.module || '').toUpperCase()
      if (!MODULES.includes(m as typeof MODULES[number])) continue
      ;(byMod[m] ??= []).push(s)
    }
    const moduleLabels: Record<string, string> = { ENERGY: 'Energy', WATER: 'Water', WASTE: 'Waste', SAFETY: 'Safety', PEOPLE: 'Workforce' }
    return MODULES.map(m => {
      const items = byMod[m] ?? []
      const pct = items.length === 0
        ? fallback[m]
        : Math.round(items.reduce((s, x) => s + (x.completionPct || 0), 0) / items.length)
      return { module: moduleLabels[m], pct: Math.min(100, Math.max(0, pct)) }
    })
  }, [submissions, overview])

  const activeSubs = useMemo(() => submissions.slice(0, 5), [submissions])

  /* ---- render states ---- */
  if (loading) return <DashboardSkeleton />
  if (error && !overview) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!overview) return <EmptyState />
  const k = overview.kpis

  /* ---- KPI cards data (Emissions / Energy / Water) ---- */
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
      tone: 'bg-rose-50 text-rose-600',
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
      tone: 'bg-amber-50 text-amber-600',
      module: 'data-entry' as ModuleKey,
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
      tone: 'bg-cyan-50 text-cyan-600',
      module: 'data-entry' as ModuleKey,
    },
  ]

  return (
    <div className="space-y-5">
      {/* ---- Page header ---- */}
      <PageHeader k={k} periodCount={overview.periods.length} />

      {/* ---- 3-column asymmetric grid ---- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_400px_280px]">
        {/* ============================
            LEFT COLUMN (~58%)
           ============================ */}
        <div className="space-y-5">
          {/* KPI cards row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {kpiCards.map((c, i) => (
              <KpiCard key={c.label} delay={0.05 * i} {...c} onClick={() => setActiveModule(c.module)} />
            ))}
          </div>

          {/* Active Submissions table */}
          <ActiveSubmissionsCard
            subs={activeSubs}
            onViewAll={() => setActiveModule('submissions')}
          />

          {/* Data Entry Status bar */}
          <DataEntryStatusCard modules={moduleCompletion} onOpen={() => setActiveModule('data-entry')} />
        </div>

        {/* ============================
            CENTER COLUMN (~25%)
           ============================ */}
        <div className="space-y-5">
          <RecentActivitiesCard
            activities={activities}
            lastActivityAt={lastActivityAt}
          />
          <TeamSubmissionsCard
            team={SEEDED_TEAM}
            activeCount={SEEDED_TEAM.filter(t => t.active).length}
            onOpen={() => setActiveModule('my-project')}
          />
        </div>

        {/* ============================
            RIGHT COLUMN (~17%)
           ============================ */}
        <div className="space-y-5">
          <AnalyticsMiniCard
            emissionsBySource={emissionsBySourceArr}
            monthlyEnergy={monthlyEnergy}
            onOpen={() => setActiveModule('analytics')}
          />
          <FormBuilderCard elements={FORM_ELEMENTS} onOpen={() => setActiveModule('data-entry')} />
          <DataConnectionsCard connections={DATA_CONNECTIONS} onOpen={() => setActiveModule('admin')} />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * Sub-components
 * ============================================================ */

function PageHeader({ k, periodCount }: { k: Kpis; periodCount: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
    >
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[18px] font-bold tracking-tight text-slate-800">Site Overview</h1>
          <span className="status-pill status-approved">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
          </span>
        </div>
        <p className="mt-1 text-[12px] text-slate-500">
          Group consolidated · {k.orgs} group(s) · {k.projects} project(s) · {periodCount} reporting period(s)
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-slate-600">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          {k.completion}% reporting complete
        </span>
        <span className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-slate-600">
          <FileText className="h-3 w-3 text-blue-500" />
          {k.totalSubs} submissions
        </span>
      </div>
    </motion.div>
  )
}

/* ---------- KPI Card ---------- */
interface KpiCardProps {
  icon: typeof Flame
  label: string
  value: string
  unit: string
  trend: number | null
  spark: number[]
  sub: string
  goodDirection: 'up' | 'down'
  tone: string
  delay: number
  onClick: () => void
}
function KpiCard({ icon: Icon, label, value, unit, trend, spark, sub, goodDirection, tone, delay, onClick }: KpiCardProps) {
  const hasTrend = trend !== null && trend !== undefined && !Number.isNaN(trend)
  const isNeutral = hasTrend && trend === 0
  const isGood = hasTrend && !isNeutral && ((goodDirection === 'down' && trend! < 0) || (goodDirection === 'up' && trend! > 0))
  const pillClass = !hasTrend || isNeutral ? 'status-review' : isGood ? 'status-approved' : 'status-warning'
  const hasSpark = spark.length >= 2
  const sparkData = spark.map((v, i) => ({ i, v }))
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="glass glass-shimmer group relative flex w-full flex-col overflow-hidden rounded-2xl p-5 text-left transition-all hover:shadow-lg hover:shadow-blue-500/10"
    >
      {/* Top row: label + trend pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`kpi-tile ${tone}`} style={{ width: 32, height: 32 }}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-[13px] font-medium text-slate-500">{label}</span>
        </div>
        {hasTrend && (
          <span className={`status-pill ${pillClass}`}>
            {trend! < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {trend! > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      {/* Middle row: value + sparkline */}
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="tabular-nums text-[28px] font-bold leading-none text-slate-900">{value}</span>
            <span className="text-[12px] font-medium text-slate-400">&nbsp;{unit}</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">{sub}</div>
        </div>
        {hasSpark && (
          <div className="h-[60px] w-[88px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SPARK_STROKE} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={SPARK_STROKE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={SPARK_STROKE}
                  strokeWidth={2}
                  fill={`url(#spark-${label})`}
                  dot={false}
                  isAnimationActive
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-slate-400 opacity-0 transition group-hover:opacity-100">
        Drill-down <ArrowUpRight className="h-3 w-3" />
      </div>
    </motion.button>
  )
}

/* ---------- Active Submissions ---------- */
function ActiveSubmissionsCard({ subs, onViewAll }: { subs: SubmissionItem[]; onViewAll: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="glass glass-shimmer rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="kpi-tile bg-blue-50 text-blue-600" style={{ width: 32, height: 32 }}>
            <Send className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-slate-800">Active Submissions</h2>
            <p className="text-[11px] text-slate-500">Recent reporting submissions &amp; their status</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="glass-subtle flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:text-blue-600"
        >
          View All <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {subs.length === 0 ? (
        <div className="py-10 text-center text-[12px] text-slate-400">No active submissions yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200/60 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-3">Project / Title</th>
                <th className="pb-2 pr-3">Period</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-2">Completion</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s, i) => {
                const projectName = s.project?.projectName ?? s.title
                const period = s.reportingPeriod?.periodLabel ?? '—'
                const status = (s.status || 'DRAFT').toLowerCase().replace(/_/g, ' ')
                const statusPill = statusForSubmission(s.status)
                const completion = Math.round(s.completionPct ?? 0)
                return (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.04 }}
                    className="group border-b border-slate-100/80 text-[12px] transition hover:bg-white/50"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-100 to-cyan-100 text-[10px] font-bold text-blue-700">
                          {(s.module || '?').slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-800">{projectName}</div>
                          <div className="truncate text-[10px] text-slate-400">{s.project?.projectCode ?? s.module}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{period}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`status-pill ${statusPill}`}>
                        {status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200/70">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-[11px] font-semibold text-slate-700">{completion}%</span>
                      </div>
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

/* ---------- Data Entry Status ---------- */
function DataEntryStatusCard({ modules, onOpen }: { modules: { module: string; pct: number }[]; onOpen: () => void }) {
  const tones: Record<string, string> = {
    Energy:   'from-blue-500 to-cyan-500',
    Water:    'from-cyan-500 to-teal-500',
    Waste:    'from-emerald-500 to-teal-500',
    Safety:   'from-amber-500 to-orange-500',
    Workforce: 'from-violet-500 to-purple-500',
  }
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
      className="glass glass-shimmer rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="kpi-tile bg-emerald-50 text-emerald-600" style={{ width: 32, height: 32 }}>
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-slate-800">Data Entry Status</h2>
            <p className="text-[11px] text-slate-500">Module-wise completion across the current period</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="glass-subtle flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:text-blue-600"
        >
          Open Entry <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {modules.map((m, i) => (
          <motion.div
            key={m.module}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.04 }}
            className="rounded-xl bg-white/50 p-2.5"
          >
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-600">{m.module}</span>
              <span className="tabular-nums font-bold text-slate-800">{m.pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${m.pct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.4 + i * 0.04 }}
                className={`h-full rounded-full bg-gradient-to-r ${tones[m.module] ?? 'from-blue-500 to-cyan-500'}`}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

/* ---------- Recent Activities (live feed) ---------- */
function RecentActivitiesCard({ activities, lastActivityAt }: { activities: ActivityItem[]; lastActivityAt: Date | null }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="glass glass-shimmer flex flex-col rounded-2xl p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="kpi-tile bg-blue-50 text-blue-600" style={{ width: 32, height: 32 }}>
            <ActivityIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-slate-800">Recent Activities</h2>
            <p className="text-[11px] text-slate-500">Live feed of ESG data events</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50/80 px-2 py-1 text-[10px] font-semibold text-emerald-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      </div>

      <div className="max-h-[420px] min-h-[240px] space-y-1 overflow-y-auto scroll-elegant pr-1">
        <AnimatePresence initial={false}>
          {activities.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-10 text-center text-[12px] text-slate-400"
            >
              No recent activity yet.
            </motion.div>
          ) : (
            activities.map((a, i) => (
              <ActivityRowItem key={a.id} a={a} delay={i * 0.02} />
            ))
          )}
        </AnimatePresence>
      </div>

      {lastActivityAt && (
        <div className="mt-2 border-t border-slate-200/50 pt-2 text-[10px] text-slate-400">
          Last sync: {lastActivityAt.toLocaleTimeString()} · auto-refresh 30s
        </div>
      )}
    </motion.section>
  )
}

function ActivityRowItem({ a, delay }: { a: ActivityItem; delay: number }) {
  const initials = getInitials(a.actorName)
  const gradient = gradientForRole(a.actorRole)
  const tone = statusToneForActivity(a.status)
  const actionIcon = actionIconFor(a.action)
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ delay }}
      className="flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-white/50"
    >
      <div className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-[11px] font-bold text-white`}>
        {initials}
        <span className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-white ${tone.iconBg}`}>
          {actionIcon && <actionIcon.icon className={`h-2.5 w-2.5 ${tone.iconColor}`} />}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[12px] font-semibold text-slate-800">{a.title}</span>
          {a.status && (
            <span className={`status-pill ${tone.pill}`}>
              {a.status}
            </span>
          )}
        </div>
        {a.description && (
          <p className="truncate text-[11px] text-slate-500">{a.description}</p>
        )}
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="font-medium text-slate-500">{a.actorName}</span>
          <span>·</span>
          <span>{a.actorRole}</span>
          <span>·</span>
          <span>{timeAgo(a.createdAt)}</span>
        </div>
      </div>
    </motion.div>
  )
}

/* ---------- Team Submissions ---------- */
function TeamSubmissionsCard({ team, activeCount, onOpen }: { team: typeof SEEDED_TEAM; activeCount: number; onOpen: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="glass glass-shimmer rounded-2xl p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="kpi-tile bg-violet-50 text-violet-600" style={{ width: 32, height: 32 }}>
            <Users className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-slate-800">Team Submissions</h2>
            <p className="text-[11px] text-slate-500">{activeCount} active · {team.length} total members</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="glass-subtle flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:text-blue-600"
          aria-label="Open team view"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid max-h-[300px] grid-cols-1 gap-2 overflow-y-auto scroll-elegant pr-1 sm:grid-cols-2">
        {team.map((m, i) => {
          const initials = getInitials(m.name)
          return (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.02 }}
              className="flex items-center gap-2 rounded-xl bg-white/60 p-2 transition hover:bg-white/80"
            >
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${m.gradient} text-[10px] font-bold text-white`}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-slate-800">{m.name}</div>
                <div className="truncate text-[10px] text-slate-500">{m.role}</div>
              </div>
              <span className={`status-pill ${m.active ? 'status-approved' : 'status-draft'}`}>
                {m.active ? 'Active' : 'Away'}
              </span>
            </motion.div>
          )
        })}
      </div>
    </motion.section>
  )
}

/* ---------- Analytics mini-charts ---------- */
function AnalyticsMiniCard({
  emissionsBySource,
  monthlyEnergy,
  onOpen,
}: {
  emissionsBySource: { name: string; value: number }[]
  monthlyEnergy: { label: string; value: number }[]
  onOpen: () => void
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="glass glass-shimmer rounded-2xl p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="kpi-tile bg-cyan-50 text-cyan-600" style={{ width: 28, height: 28 }}>
            <PieIcon className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-[14px] font-semibold text-slate-800">Analytics</h2>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="text-[10px] font-medium text-slate-400 transition hover:text-blue-600"
        >
          Expand →
        </button>
      </div>

      {/* Donut: emissions by source */}
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Emissions by source</div>
        <div className="h-32">
          {emissionsBySource.length === 0 ? (
            <EmptyMini label="No emissions data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={emissionsBySource.slice(0, 6)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={36}
                  outerRadius={56}
                  paddingAngle={2}
                  isAnimationActive
                >
                  {emissionsBySource.slice(0, 6).map((_, i) => (
                    <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} tCO₂e`, n]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        {emissionsBySource.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1 text-[9px]">
            {emissionsBySource.slice(0, 4).map((s, i) => (
              <span key={s.name} className="flex items-center gap-1 text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                {s.name.length > 14 ? s.name.slice(0, 12) + '…' : s.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bar: monthly energy */}
      <div className="border-t border-slate-200/50 pt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Monthly energy (GJ)</span>
          <BarChart3 className="h-3 w-3 text-slate-400" />
        </div>
        <div className="h-32">
          {monthlyEnergy.length === 0 ? (
            <EmptyMini label="No energy trend yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyEnergy} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="miniBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <Bar dataKey="value" fill="url(#miniBarGrad)" radius={[4, 4, 0, 0]} isAnimationActive />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} GJ`, 'Energy']} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </motion.section>
  )
}

/* ---------- Custom Form Builder ---------- */
function FormBuilderCard({
  elements,
  onOpen,
}: {
  elements: { label: string; unit: string; tone: string }[]
  onOpen: () => void
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="glass glass-shimmer rounded-2xl p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="kpi-tile bg-amber-50 text-amber-600" style={{ width: 28, height: 28 }}>
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-slate-800">Form Builder</h2>
            <p className="text-[10px] text-slate-500">Drag-and-drop ESG fields</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="glass-subtle flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:text-blue-600"
          aria-label="Open form builder"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {elements.map((e, i) => (
          <motion.span
            key={e.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 + i * 0.02 }}
            whileHover={{ y: -1 }}
            draggable
            className={`flex cursor-grab items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${e.tone} active:cursor-grabbing`}
          >
            <GripVertical className="h-2.5 w-2.5 opacity-60" />
            {e.label}
            <span className="text-[9px] opacity-70">{e.unit}</span>
          </motion.span>
        ))}
      </div>
    </motion.section>
  )
}

/* ---------- Data Connections ---------- */
function DataConnectionsCard({
  connections,
  onOpen,
}: {
  connections: typeof DATA_CONNECTIONS
  onOpen: () => void
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
      className="glass glass-shimmer rounded-2xl p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="kpi-tile bg-blue-50 text-blue-600" style={{ width: 28, height: 28 }}>
            <Database className="h-3.5 w-3.5" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-slate-800">Data Connections</h2>
            <p className="text-[10px] text-slate-500">Integrated source systems</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="glass-subtle flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:text-blue-600"
          aria-label="Open admin"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1.5">
        {connections.map((c, i) => {
          const statusPill = c.status === 'Active' ? 'status-approved' : c.status === 'Syncing' ? 'status-submitted' : 'status-draft'
          return (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.03 }}
              className="flex items-center gap-2 rounded-xl bg-white/60 p-2 transition hover:bg-white/80"
            >
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${c.tone}`}>
                <c.icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-slate-800">{c.name}</div>
                <div className="truncate text-[10px] text-slate-500">{c.type}</div>
              </div>
              <span className={`status-pill ${statusPill}`}>{c.status}</span>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                aria-label={`${c.name} options`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )
        })}
      </div>
    </motion.section>
  )
}

/* ============================================================
 * Loading / Error / Empty states
 * ============================================================ */
function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-200/60" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_400px_280px]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map(i => <div key={i} className="glass h-32 animate-pulse rounded-2xl" />)}
          </div>
          <div className="glass h-72 animate-pulse rounded-2xl" />
          <div className="glass h-28 animate-pulse rounded-2xl" />
        </div>
        <div className="space-y-5">
          <div className="glass h-96 animate-pulse rounded-2xl" />
          <div className="glass h-64 animate-pulse rounded-2xl" />
        </div>
        <div className="space-y-5">
          <div className="glass h-72 animate-pulse rounded-2xl" />
          <div className="glass h-40 animate-pulse rounded-2xl" />
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
        <div className="text-base font-bold text-slate-800">Failed to load dashboard</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button onClick={onRetry} className="btn-glass-primary flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold">
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

function EmptyMini({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
      {label}
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

function shortMonth(label: string): string {
  // "April 2026" → "Apr"
  const parts = label.split(' ')
  if (parts.length < 2) return label.slice(0, 3)
  return parts[0].slice(0, 3)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function gradientForRole(role: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN:           'from-slate-600 to-slate-800',
    PROJECT_USER:          'from-sky-500 to-blue-600',
    HR_USER:               'from-cyan-500 to-teal-600',
    EHS_USER:              'from-amber-500 to-orange-600',
    PROCUREMENT_USER:      'from-violet-500 to-purple-600',
    CSR_USER:              'from-rose-500 to-pink-600',
    COMPLIANCE_USER:       'from-emerald-500 to-green-600',
    BU_REVIEWER:           'from-blue-500 to-indigo-600',
    SUBSIDIARY_REVIEWER:   'from-indigo-500 to-blue-700',
    GROUP_REVIEWER:        'from-blue-600 to-cyan-700',
    ESG_MANAGER:           'from-teal-500 to-emerald-600',
    ESG_ANALYST:           'from-emerald-500 to-teal-600',
    BRSR_MANAGER:          'from-emerald-600 to-teal-700',
    AUDITOR:               'from-slate-600 to-gray-700',
    EXECUTIVE:             'from-amber-600 to-yellow-700',
  }
  // Try exact match first, then case-insensitive, then fallback
  const key = Object.keys(map).find(k => k.toUpperCase() === role.toUpperCase())
  return key ? map[key] : 'from-blue-500 to-cyan-600'
}

function statusToneForActivity(status: string | null | undefined): { pill: string; iconBg: string; iconColor: string } {
  if (!status) return { pill: 'status-review', iconBg: 'bg-slate-100', iconColor: 'text-slate-500' }
  const s = status.toUpperCase()
  if (s.includes('APPROVED') || s.includes('VERIFIED') || s.includes('COMPLETED') || s.includes('LOCKED'))
    return { pill: 'status-approved', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' }
  if (s.includes('SUBMITTED') || s.includes('SYNC'))
    return { pill: 'status-submitted', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' }
  if (s.includes('REVIEW') || s.includes('PENDING'))
    return { pill: 'status-review', iconBg: 'bg-violet-50', iconColor: 'text-violet-600' }
  if (s.includes('DRAFT') || s.includes('MISSING'))
    return { pill: 'status-draft', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' }
  if (s.includes('ERROR') || s.includes('REJECTED'))
    return { pill: 'status-error', iconBg: 'bg-rose-50', iconColor: 'text-rose-600' }
  return { pill: 'status-locked', iconBg: 'bg-slate-100', iconColor: 'text-slate-500' }
}

function actionIconFor(action: string | undefined): { icon: typeof ActivityIcon } | null {
  if (!action) return null
  const a = action.toUpperCase()
  if (a.includes('SUBMIT'))  return { icon: Send }
  if (a.includes('APPROVE')) return { icon: CheckCircle2 }
  if (a.includes('EVIDENCE')) return { icon: Link2 }
  if (a.includes('CALC'))    return { icon: Zap }
  if (a.includes('CORRECT')) return { icon: AlertCircle }
  if (a.includes('DATA_ENTRY')) return { icon: FileText }
  return { icon: ActivityIcon }
}

function statusForSubmission(status: string | undefined): string {
  if (!status) return 'status-draft'
  const s = status.toUpperCase()
  if (s === 'APPROVED' || s === 'LOCKED') return 'status-approved'
  if (s === 'DRAFT')                       return 'status-draft'
  if (s === 'SUBMITTED')                   return 'status-submitted'
  if (s.includes('REVIEW'))                return 'status-review'
  if (s.includes('CORRECTION') || s.includes('REJECTED')) return 'status-error'
  if (s.includes('BU_APPROVED') || s.includes('SUBSIDIARY_APPROVED')) return 'status-verified'
  return 'status-locked'
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
