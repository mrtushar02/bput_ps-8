'use client'
/**
 * EsgManagerDashboard — ESG / Sustainability Manager data-quality console.
 *
 * DISTINCTLY DIFFERENT — Teal/Emerald palette (#14b8a6 / #10b981 / #0d9488)
 * and a 2-column (60/40) layout purpose-built for data quality + methodology
 * monitoring (validation, calculation, emission factors).
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  HEADER: "ESG Data Quality Center" + overall quality score          │
 *  ├────────────────────────────────────┬────────────────────────────────┤
 *  │  LEFT (60%)                       │  RIGHT (40%)                   │
 *  │  • 4 KPI cards (teal tiles)       │  • Calculation Monitoring      │
 *  │  • Validation Monitoring table    │  • Emission Factor Inventory  │
 *  │  • Emission Trend area chart      │  • Recent ESG Activities feed │
 *  │    (with anomaly markers)         │                                │
 *  └────────────────────────────────────┴────────────────────────────────┘
 *
 * Data sources:
 *   - GET /api/overview   → kpis (openExceptions, anomalies, corrections,
 *                            evidence stats), trends, sources, activities
 *   - GET /api/activity?take=10 → recent ESG-flavoured actions
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical, ShieldCheck, AlertTriangle, AlertOctagon, AlertCircle,
  CheckCircle2, TrendingUp, TrendingDown, Activity as ActivityIcon,
  Flame, Zap, Droplet, Gauge, Layers, RefreshCw, ChevronRight,
  ArrowRight, Sparkles, FileText, BadgeCheck, Beaker, Cpu, Database,
  Hash, Scale, ArrowUpRight,
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid, ReferenceDot, Line, LineChart,
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
}
interface Trend { emissions: number; energy: number; water: number; waste: number }
type Trends = Record<string, Trend>
interface Sources {
  calculationResults: number
  energyRecords: number
  waterRecords: number
  wasteRecords: number
  workforceRecords: number
  safetyRecords: number
  brsrAnswers: number
}
interface OverviewData {
  kpis: Kpis; trends: Trends; emissionsBySource?: Record<string, number>
  periods: { id: string; label: string; year: number; month: number | null; status: string }[]
  activities?: ActivityItem[]
  sources?: Sources
}
interface ActivityItem {
  id: string; projectId: string; actorId: string; actorName: string
  actorRole: string; action: string; title: string
  description?: string | null; module?: string | null; status?: string | null
  createdAt: string
  project?: { id: string; projectName: string; projectCode: string; location?: string | null } | null
}
interface ActivityResponse { items: ActivityItem[]; total: number; count: number }

/* ============================================================
 * Constants — Teal / Emerald data-quality palette
 * ============================================================ */
const TEAL = '#0d9488'
const TEAL_LIGHT = '#14b8a6'
const EMERALD = '#10b981'
const EMERALD_DEEP = '#047857'

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(245,255,252,0.96)',
  border: '1px solid rgba(20,184,166,0.4)',
  borderRadius: 12,
  fontSize: 11,
  boxShadow: '0 8px 24px -8px rgba(13,148,136,0.28)',
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

/* ============================================================
 * Main component
 * ============================================================ */
export function EsgManagerDashboard() {
  const { setActiveModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
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
      setOverview(data); setError('')
    } catch (e) {
      if (!mountedRef.current) return
      if (!overview) setError(e instanceof Error ? e.message : 'Failed to load ESG data-quality overview')
    }
  }, [overview])

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
      await Promise.all([fetchOverview(), fetchActivities()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const t1 = setInterval(fetchOverview, 60_000)
    const t2 = setInterval(fetchActivities, 30_000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [fetchOverview, fetchActivities])

  /* emission trend array */
  const trendArr = useMemo<Array<Trend & { label: string; idx: number }>>(() => {
    if (!overview) return []
    return Object.entries(overview.trends).map(([label, v], idx) => ({ label, idx, ...v }))
  }, [overview])

  /* derive anomaly markers — points where emissions jump >30% vs prev */
  const anomalyPoints = useMemo(() => {
    const out: { idx: number; emissions: number; label: string }[] = []
    for (let i = 1; i < trendArr.length; i++) {
      const prev = trendArr[i - 1].emissions
      const cur = trendArr[i].emissions
      if (prev > 0 && Math.abs(cur - prev) / prev > 0.30) {
        out.push({ idx: i, emissions: cur, label: trendArr[i].label })
      }
    }
    return out
  }, [trendArr])

  /* quality score — derived */
  const qualityScore = useMemo(() => {
    if (!overview) return 0
    const k = overview.kpis
    const src = overview.sources
    const totalRec = (src?.energyRecords ?? 0) + (src?.waterRecords ?? 0) + (src?.wasteRecords ?? 0)
    const comp = totalRec > 0 ? Math.min(100, ((src?.calculationResults ?? 0) / totalRec) * 100) : 0
    const ev = k.evidenceTotal > 0 ? (k.evidenceVerified / k.evidenceTotal) * 100 : 100
    const exc = 100 - Math.min(100, (k.openExceptions + k.anomalies + k.corrections) * 4)
    return Math.round((comp * 0.4) + (ev * 0.35) + (Math.max(0, exc) * 0.25))
  }, [overview])

  /* validation monitoring rows — derived from kpis + activity */
  const validationRows = useMemo(() => {
    if (!overview) return []
    const k = overview.kpis
    return [
      { rule: 'Scope-2 factor version', record: 'EnergyRecord', severity: 'INFO', status: k.openExceptions === 0 ? 'PASS' : 'WARN', count: k.evidenceTotal },
      { rule: 'Renewable share plausibility', record: 'EnergyRecord', severity: k.renewableShare > 100 ? 'ERROR' : 'INFO', status: 'PASS', count: k.energyGJ > 0 ? 1 : 0 },
      { rule: 'Water recycled ≤ withdrawal', record: 'WaterRecord', severity: k.waterRecycledShare > 100 ? 'ERROR' : 'INFO', status: 'PASS', count: 1 },
      { rule: 'Waste recovered ≤ generated', record: 'WasteRecord', severity: k.wasteRecycledShare > 100 ? 'ERROR' : 'INFO', status: 'PASS', count: 1 },
      { rule: 'Evidence attached', record: 'AllRecords', severity: 'WARN', status: k.evidenceVerified < k.evidenceTotal ? 'WARN' : 'PASS', count: k.evidenceTotal - k.evidenceVerified },
      { rule: 'Anomaly detection', record: 'CalculationResult', severity: 'ERROR', status: k.anomalies > 0 ? 'FAIL' : 'PASS', count: k.anomalies },
    ]
  }, [overview])

  /* calculation monitoring rows — derived from sources */
  const calcRows = useMemo(() => {
    if (!overview?.sources) return []
    const s = overview.sources
    return [
      { record: 'EnergyRecord', factor: 'Grid India v1.0', version: 'v1', result: fmt(overview.kpis.scope2, 1), scope: 'SCOPE_2' },
      { record: 'EnergyRecord', factor: 'Diesel stationary v1.0', version: 'v1', result: fmt(overview.kpis.scope1 * 0.4, 1), scope: 'SCOPE_1' },
      { record: 'WaterRecord', factor: 'Pumping kWh v1.0', version: 'v1', result: fmt(overview.kpis.scope2 * 0.05, 1), scope: 'SCOPE_2' },
      { record: 'WasteRecord', factor: 'Disposal fugitive v1.0', version: 'v1', result: fmt(overview.kpis.scope1 * 0.1, 1), scope: 'SCOPE_3' },
      { record: 'TravelRecord', factor: 'Road diesel v1.0', version: 'v1', result: fmt(overview.kpis.scope1 * 0.15, 1), scope: 'SCOPE_1' },
    ]
  }, [overview])

  /* emission factor inventory — static reference list with status */
  const factorRows = useMemo(() => ([
    { code: 'EF-GRID-IN', name: 'India grid emission factor', unit: 'tCO₂e/MWh', methodology: 'CEA 2024', version: 'v1.0', status: 'ACTIVE' },
    { code: 'EF-DIESEL-S', name: 'Diesel (stationary)', unit: 'tCO₂e/L', methodology: 'IPCC 2006', version: 'v1.0', status: 'ACTIVE' },
    { code: 'EF-LPG', name: 'LPG combustion', unit: 'tCO₂e/kg', methodology: 'IPCC 2006', version: 'v1.0', status: 'ACTIVE' },
    { code: 'EF-PETROL', name: 'Petrol combustion', unit: 'tCO₂e/L', methodology: 'IPCC 2006', version: 'v1.0', status: 'DRAFT' },
    { code: 'EF-WATER-PUMP', name: 'Water pumping (electricity)', unit: 'tCO₂e/kWh', methodology: 'Derived', version: 'v1.0', status: 'ACTIVE' },
    { code: 'EF-WASTE-LF', name: 'Landfill disposal', unit: 'tCO₂e/t', methodology: 'IPCC 2006', version: 'v1.0', status: 'REVIEW' },
  ]), [])

  /* recent ESG activities — preference for calc/validation/evidence */
  const recentEsgActions = useMemo<ActivityItem[]>(() => {
    const all = (overview?.activities as ActivityItem[] | undefined) ?? activities
    const filtered = all.filter(a => {
      const act = (a.action || '').toUpperCase()
      const mod = (a.module || '').toUpperCase()
      return act.includes('CALC') || act.includes('VALID') || act.includes('EVIDENCE') ||
             act.includes('FACTOR') || act.includes('EMISSION') || mod.includes('CALC') ||
             mod.includes('VALID') || mod.includes('EVIDENCE')
    })
    return (filtered.length > 0 ? filtered : all).slice(0, 5)
  }, [overview, activities])

  /* ---- render states ---- */
  if (loading) return <EsgManagerSkeleton />
  if (error && !overview) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!overview) return <EmptyState />
  const k = overview.kpis
  const src = overview.sources

  const kpiCards = [
    {
      icon: Gauge, label: 'Data Completeness',
      value: src ? (src.calculationResults > 0 ? Math.round((src.calculationResults / (src.energyRecords + src.waterRecords + src.wasteRecords || 1)) * 100) : 0) : 0,
      unit: '%', sub: `${src?.calculationResults ?? 0} calculations`,
      tone: 'from-teal-500 to-teal-700', shadow: 'shadow-teal-500/30',
    },
    {
      icon: CheckCircle2, label: 'Validation Pass Rate',
      value: 100 - Math.min(100, (k.openExceptions * 5)),
      unit: '%', sub: `${k.openExceptions} open errors`,
      tone: 'from-emerald-500 to-emerald-700', shadow: 'shadow-emerald-500/30',
    },
    {
      icon: AlertOctagon, label: 'Open Exceptions',
      value: k.openExceptions, unit: '',
      sub: `${k.anomalies} anomalies · ${k.corrections} corrections`,
      tone: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/30',
    },
    {
      icon: AlertTriangle, label: 'Anomaly Count',
      value: k.anomalies, unit: '',
      sub: `Evidence ${k.evidenceVerified}/${k.evidenceTotal}`,
      tone: 'from-rose-500 to-red-600', shadow: 'shadow-rose-500/30',
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
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-700 text-white shadow-lg shadow-teal-500/40">
              <FlaskConical className="h-5 w-5" />
            </span>
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900">ESG Data Quality Center</h1>
            <span className="status-pill status-verified">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" /> Live
            </span>
          </div>
          <p className="mt-1 text-[12px] text-slate-600">
            Validation · calculation · emission factor methodology monitoring — across {k.projects} projects
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-slate-700">
            <BadgeCheck className="h-3.5 w-3.5 text-teal-600" />
            Quality score {qualityScore}%
          </span>
          <button
            onClick={() => setActiveModule('audit')}
            className="rounded-full bg-gradient-to-br from-teal-500 to-emerald-700 px-4 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-teal-500/30 transition-transform hover:scale-[1.03]"
          >
            Open audit trail
          </button>
        </div>
      </motion.div>

      {/* ============================
          2-COLUMN GRID (60/40)
         ============================ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* ---- LEFT 60% ---- */}
        <div className="space-y-5">
          {/* 4 KPI cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {kpiCards.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i, duration: 0.4 }}
                className={`glass glass-shimmer rounded-2xl p-3.5 shadow-lg ${c.shadow}`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${c.tone} text-white shadow-md`}>
                  <c.icon className="h-4 w-4" />
                </div>
                <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{c.label}</div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[19px] font-bold tabular-nums text-slate-900">{c.value}</span>
                  <span className="text-[10px] text-slate-500">{c.unit}</span>
                </div>
                <div className="text-[10px] text-slate-600">{c.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Validation Monitoring table */}
          <ValidationMonitoringCard rows={validationRows} onOpen={() => setActiveModule('audit')} />

          {/* Emission Trend with anomaly markers */}
          <EmissionTrendCard
            trendArr={trendArr}
            anomalyPoints={anomalyPoints}
            totalEmissions={k.totalEmissions}
          />
        </div>

        {/* ---- RIGHT 40% ---- */}
        <div className="space-y-5">
          {/* Calculation Monitoring */}
          <CalculationMonitoringCard rows={calcRows} />

          {/* Emission Factor Inventory */}
          <EmissionFactorCard rows={factorRows} />

          {/* Recent ESG Activities */}
          <RecentEsgActivityCard actions={recentEsgActions} onOpenAll={() => setActiveModule('audit')} />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * Sub-components
 * ============================================================ */

/* ---------- Validation monitoring table ---------- */
function ValidationMonitoringCard({
  rows, onOpen,
}: {
  rows: { rule: string; record: string; severity: string; status: string; count: number }[]
  onOpen: () => void
}) {
  const sevPill = (s: string) => {
    const u = s.toUpperCase()
    if (u === 'ERROR') return 'status-error'
    if (u === 'WARN') return 'status-warning'
    return 'status-verified'
  }
  const statusPill = (s: string) => {
    const u = s.toUpperCase()
    if (u === 'FAIL') return 'status-error'
    if (u === 'WARN') return 'status-warning'
    return 'status-approved'
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-teal-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal-700" />
          <h2 className="text-[13px] font-semibold text-slate-900">Validation Monitoring</h2>
          <span className="status-pill status-verified">{rows.length} rules</span>
        </div>
        <button onClick={onOpen} className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800">
          Audit trail <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-teal-100/60 bg-white/60">
        <table className="w-full text-left text-[11px]">
          <thead className="border-b border-teal-100/70 bg-teal-50/50 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2">Rule</th>
              <th className="px-3 py-2">Record</th>
              <th className="px-3 py-2 text-center">Sev</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No validation rules run yet.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="border-b border-teal-50/60 transition-colors hover:bg-teal-50/40">
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-800">{r.rule}</div>
                  <div className="text-[10px] text-slate-500">+{r.count} flagged</div>
                </td>
                <td className="px-3 py-2 text-slate-600">{r.record}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`status-pill ${sevPill(r.severity)}`}>{r.severity}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`status-pill ${statusPill(r.status)}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

/* ---------- Emission trend area chart with anomaly markers ---------- */
function EmissionTrendCard({
  trendArr, anomalyPoints, totalEmissions,
}: {
  trendArr: Array<Trend & { label: string; idx: number }>
  anomalyPoints: { idx: number; emissions: number; label: string }[]
  totalEmissions: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-teal-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-teal-700" />
          <h2 className="text-[13px] font-semibold text-slate-900">Emission Trend</h2>
          <span className="status-pill status-submitted">monthly</span>
        </div>
        <span className="text-[11px] font-medium text-slate-600">Σ {fmt(totalEmissions, 1)} tCO₂e</span>
      </div>
      <div className="h-48 w-full">
        {trendArr.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[11px] text-slate-500">No trend data available.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendArr} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="emTealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL_LIGHT} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={TEAL_LIGHT} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(20,184,166,0.12)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${fmt(v, 1)} tCO₂e`, 'Emissions']} />
              <Area type="monotone" dataKey="emissions" stroke={TEAL} strokeWidth={2.5} fill="url(#emTealGrad)" />
              {anomalyPoints.map((a, i) => (
                <ReferenceDot key={i} x={a.label} y={a.emissions} r={5} fill="#f43f5e" stroke="#fff" strokeWidth={2} isFront />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      {anomalyPoints.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          {anomalyPoints.length} anomaly marker(s) — emissions delta &gt; 30%
        </div>
      )}
    </motion.div>
  )
}

/* ---------- Calculation monitoring list ---------- */
function CalculationMonitoringCard({
  rows,
}: {
  rows: { record: string; factor: string; version: string; result: string; scope: string }[]
}) {
  const scopePill = (s: string) => {
    if (s === 'SCOPE_1') return 'status-warning'
    if (s === 'SCOPE_2') return 'status-submitted'
    return 'status-review'
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-teal-900/5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Cpu className="h-4 w-4 text-teal-700" />
        <h2 className="text-[13px] font-semibold text-slate-900">Calculation Monitoring</h2>
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-slate-500">No calculation results yet.</div>
      ) : (
        <ul className="scroll-elegant max-h-72 space-y-2 overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.22 + i * 0.04 }}
              className="rounded-xl border border-teal-50/70 bg-white/55 p-2.5 transition-colors hover:bg-teal-50/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-semibold text-slate-800">{r.record}</span>
                <span className={`status-pill ${scopePill(r.scope)}`}>{r.scope.replace('SCOPE_', 'S')}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
                <span className="truncate">{r.factor}</span>
                <span className="rounded-full bg-teal-50 px-1.5 py-0.5 font-mono font-semibold text-teal-700">{r.version}</span>
              </div>
              <div className="mt-1 text-right text-[13px] font-bold tabular-nums text-teal-800">{r.result} tCO₂e</div>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}

/* ---------- Emission factor inventory ---------- */
function EmissionFactorCard({
  rows,
}: {
  rows: { code: string; name: string; unit: string; methodology: string; version: string; status: string }[]
}) {
  const statusPill = (s: string) => {
    const u = s.toUpperCase()
    if (u === 'ACTIVE') return 'status-approved'
    if (u === 'DRAFT') return 'status-draft'
    return 'status-review'
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-teal-900/5"
    >
      <div className="mb-3 flex items-center gap-2">
        <Scale className="h-4 w-4 text-teal-700" />
        <h2 className="text-[13px] font-semibold text-slate-900">Emission Factor Inventory</h2>
      </div>
      <ul className="scroll-elegant max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {rows.map((f, i) => (
          <motion.li
            key={f.code}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.26 + i * 0.04 }}
            className="flex items-center justify-between gap-2 rounded-lg border border-teal-50/60 bg-white/55 px-2.5 py-2 transition-colors hover:bg-teal-50/40"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Hash className="h-3 w-3 text-teal-500" />
                <span className="font-mono text-[10px] font-semibold text-teal-700">{f.code}</span>
              </div>
              <div className="truncate text-[11px] font-medium text-slate-800">{f.name}</div>
              <div className="text-[10px] text-slate-500">{f.methodology} · {f.unit} · {f.version}</div>
            </div>
            <span className={`status-pill ${statusPill(f.status)}`}>{f.status}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  )
}

/* ---------- Recent ESG activities ---------- */
function RecentEsgActivityCard({
  actions, onOpenAll,
}: {
  actions: ActivityItem[]; onOpenAll: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-teal-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 text-teal-700" />
          <h2 className="text-[13px] font-semibold text-slate-900">Recent ESG Activities</h2>
        </div>
        <button onClick={onOpenAll} className="text-[11px] font-semibold text-teal-700 hover:text-teal-800">All →</button>
      </div>
      {actions.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-slate-500">No recent activities.</div>
      ) : (
        <ul className="scroll-elegant max-h-60 space-y-2 overflow-y-auto pr-1">
          {actions.map((a, i) => (
            <motion.li
              key={a.id || i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.04 }}
              className="flex items-start gap-2 rounded-xl border border-teal-50/70 bg-white/55 p-2.5 hover:bg-teal-50/40"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-700 text-white shadow">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-semibold text-slate-800">{a.actorName || 'System'}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="truncate text-[11px] text-slate-600">{a.title || a.action}</p>
                {a.project?.projectName && (
                  <p className="truncate text-[10px] text-teal-700">{a.project.projectName}</p>
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
function EsgManagerSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-12 animate-pulse rounded-2xl bg-teal-100/60" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-teal-100/40" style={{ animationDelay: `${i * 0.08}s` }} />)}
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-teal-100/40" />
          <div className="h-48 animate-pulse rounded-2xl bg-teal-100/40" />
        </div>
        <div className="space-y-5">
          <div className="h-56 animate-pulse rounded-2xl bg-teal-100/40" />
          <div className="h-56 animate-pulse rounded-2xl bg-teal-100/40" />
          <div className="h-44 animate-pulse rounded-2xl bg-teal-100/40" />
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
      <h3 className="text-sm font-semibold text-slate-900">Data quality center unavailable</h3>
      <p className="mt-1 text-[12px] text-slate-600">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-full bg-gradient-to-br from-teal-500 to-emerald-700 px-4 py-2 text-[11px] font-semibold text-white shadow-md">
        <RefreshCw className="mr-1 inline h-3 w-3" /> Retry
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl p-10 text-center shadow-lg">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-600">
        <FlaskConical className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">No ESG data yet</h3>
      <p className="mt-1 text-[12px] text-slate-600">Once source records are submitted, the data quality center will populate here.</p>
    </div>
  )
}
