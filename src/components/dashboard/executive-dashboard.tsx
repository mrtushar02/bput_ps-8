'use client'
/**
 * Executive Dashboard — premium C-suite briefing view for EXECUTIVE and SUPER_ADMIN roles.
 *
 * Design language: AMBER / GOLD premium — warm, authoritative, minimal.
 *   - Hero: large radial ESG gauge (120px) with amber→gold gradient stroke + letter grade
 *   - 2x4 compact KPI grid (max 120px height each): icon tile + label + value + trend pill only
 *   - Bottom split 50/50: ESG score dimension breakdown (RadialBarChart, 8 bars) | Top 3 AI Insights
 *
 * Data sources (real, no hardcode):
 *   - GET /api/overview  → kpis (8 ESG dimensions + workforce/safety/etc.)
 *   - GET /api/insights  → AI-generated narrative insights (severity-tagged)
 */
import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Award, Crown, Flame, Zap, Droplet, Recycle, Users, ShieldCheck, FileCheck2, Gauge,
  TrendingUp, TrendingDown, Sparkles, AlertTriangle, AlertOctagon, RefreshCw, Activity, ChevronRight,
} from 'lucide-react'
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts'

/* ------------------------------------------------------------------ types */

interface OverviewData {
  kpis: any
  trends: Record<string, { emissions: number; energy: number; water: number; waste: number }>
}

interface Insight {
  title: string
  severity: 'positive' | 'warning' | 'critical'
  category: string
  insight: string
  action: string
}

/* -------------------------------------------------------------- palette */

const AMBER       = '#f59e0b'   // primary accent
const GOLD        = '#d4a017'   // warm gold
const AMBER_DEEP  = '#b45309'   // deep amber for contrast
const AMBER_LITE  = '#fbbf24'   // light amber
const CREAM       = '#fffbeb'   // warm cream surface
const WARM_INK    = '#451a03'   // deep brown ink for high contrast on warm surfaces

// 8 amber/gold shades — one per ESG dimension in the radial bar chart
const DIM_PALETTE = [
  '#f59e0b', '#d97706', '#fbbf24', '#f97316',
  '#eab308', '#ca8a04', '#fcd34d', '#b45309',
]

/* -------------------------------------------------------- grade + score */

function gradeFromScore(score: number): { grade: string; label: string } {
  if (score >= 90) return { grade: 'A+', label: 'Exemplary' }
  if (score >= 80) return { grade: 'A',  label: 'Strong' }
  if (score >= 70) return { grade: 'B+', label: 'On Track' }
  if (score >= 60) return { grade: 'B',  label: 'Improving' }
  if (score >= 50) return { grade: 'C',  label: 'Watch' }
  return { grade: 'D', label: 'At Risk' }
}

/* ------------------------------------------------------- trend helpers */

function trendDelta(
  trends: { emissions: number; energy: number; water: number; waste: number }[] | undefined,
  key: 'emissions' | 'energy' | 'water' | 'waste'
): number | null {
  if (!trends || trends.length < 2) return null
  const arr = Object.values(trends)
  const last = arr[arr.length - 1][key]
  const prev = arr[arr.length - 2][key]
  if (prev === 0) return null
  return Math.round(((last - prev) / prev) * 1000) / 10
}

type TrendPill =
  | { kind: 'delta'; value: number; goodWhen: 'up' | 'down' }
  | { kind: 'status'; text: string; tone: 'good' | 'watch' | 'risk' | 'neutral' }

/* ------------------------------------------------------------- main */

export function ExecutiveDashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading]       = useState(true)
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [error, setError]           = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const [ov, inx] = await Promise.all([
        fetch('/api/overview').then(r => r.json()),
        fetch('/api/insights').then(r => r.json()),
      ])
      setOverview(ov)
      setInsights(inx.insights || [])
      setError('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setInsightsLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/overview').then(r => r.json()),
      fetch('/api/insights').then(r => r.json()),
    ])
      .then(([ov, inx]) => {
        if (cancelled) return
        setOverview(ov)
        setInsights(inx.insights || [])
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setInsightsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // ESG composite score (0–100) — SAME formula as OverviewDashboard
  const esgScore = useMemo(() => {
    if (!overview) return 0
    const kk = overview.kpis
    const dims = [
      kk.brsrReadiness,                            // BRSR readiness weight
      kk.completion,                               // reporting completion
      kk.waterRecycledShare,                       // water circularity
      kk.wasteRecycledShare,                       // waste recovery
      kk.renewableShare,                           // renewable energy
      Math.min(kk.femaleShare * 2, 100),           // gender diversity (boost)
      Math.max(0, 100 - kk.ltifr * 20),            // safety (lower LTIFR = better)
      Math.max(0, 100 - kk.openExceptions * 5),     // data quality
    ]
    return Math.round(dims.reduce((s, v) => s + v, 0) / dims.length)
  }, [overview])

  if (loading) return <ExecutiveSkeleton />
  if (error)  return <ExecutiveError message={error} onRetry={() => load()} />
  if (!overview) return null

  const k = overview.kpis
  const trendArr = Object.values(overview.trends || {})
  const { grade, label: gradeLabel } = gradeFromScore(esgScore)

  // 8 ESG dimensions for the radial breakdown
  const dims = [
    { name: 'BRSR',        value: k.brsrReadiness },
    { name: 'Completion', value: k.completion },
    { name: 'Water',      value: k.waterRecycledShare },
    { name: 'Waste',      value: k.wasteRecycledShare },
    { name: 'Renewables', value: k.renewableShare },
    { name: 'Diversity',  value: Math.min(k.femaleShare * 2, 100) },
    { name: 'Safety',     value: Math.max(0, 100 - k.ltifr * 20) },
    { name: 'Data Qual.', value: Math.max(0, 100 - k.openExceptions * 5) },
  ]

  // ---- 2x4 compact KPI cards ----
  const row1: { icon: any; label: string; value: string; unit?: string; pill: TrendPill }[] = [
    { icon: Flame,   label: 'Emissions', value: k.totalEmissions.toLocaleString(),    unit: 'tCO₂e', pill: (() => { const d = trendDelta(trendArr, 'emissions'); return d === null ? { kind: 'status', text: 'Stable', tone: 'neutral' as const } : { kind: 'delta' as const, value: d, goodWhen: 'down' as const } })() },
    { icon: Zap,     label: 'Energy',    value: k.energyGJ.toLocaleString(),           unit: 'GJ',    pill: (() => { const d = trendDelta(trendArr, 'energy');    return d === null ? { kind: 'status', text: 'Stable', tone: 'neutral' as const } : { kind: 'delta' as const, value: d, goodWhen: 'down' as const } })() },
    { icon: Droplet, label: 'Water',     value: k.waterWithdrawalKL.toLocaleString(),  unit: 'KL',    pill: (() => { const d = trendDelta(trendArr, 'water');    return d === null ? { kind: 'status', text: 'Stable', tone: 'neutral' as const } : { kind: 'delta' as const, value: d, goodWhen: 'down' as const } })() },
    { icon: Recycle, label: 'Waste Rec.', value: String(k.wasteRecycledShare),          unit: '%',     pill: { kind: 'status', text: k.wasteRecycledShare >= 80 ? 'Strong' : k.wasteRecycledShare >= 50 ? 'Fair' : 'Watch', tone: k.wasteRecycledShare >= 80 ? 'good' : k.wasteRecycledShare >= 50 ? 'neutral' : 'watch' } },
  ]
  const row2: { icon: any; label: string; value: string; unit?: string; pill: TrendPill }[] = [
    { icon: Users,        label: 'Workforce',  value: k.totalWorkforce.toLocaleString(), unit: 'people', pill: { kind: 'status', text: k.totalWorkforce > 0 ? 'Active' : '—', tone: 'good' } },
    { icon: ShieldCheck, label: 'Safety · LTIFR', value: k.ltifr.toFixed(1),              unit: '/M hrs', pill: { kind: 'status', text: k.ltifr <= 1 ? 'Best-in-class' : k.ltifr <= 3 ? 'Acceptable' : 'Watch', tone: k.ltifr <= 1 ? 'good' : k.ltifr <= 3 ? 'neutral' : 'watch' } },
    { icon: FileCheck2,  label: 'BRSR Ready', value: String(k.brsrReadiness),             unit: '%',      pill: { kind: 'status', text: k.brsrMissing === 0 ? 'Complete' : `${k.brsrMissing} gaps`, tone: k.brsrMissing === 0 ? 'good' : 'watch' } },
    { icon: Gauge,       label: 'Completion', value: String(k.completion),               unit: '%',      pill: { kind: 'status', text: k.openExceptions === 0 ? 'On Track' : `${k.openExceptions} ex.`, tone: k.openExceptions === 0 ? 'good' : 'risk' } },
  ]

  const heroSummary = `ESG performance is ${grade} with ${k.brsrReadiness.toFixed(1)}% BRSR readiness · ${k.completion}% reporting completion · ${k.openExceptions} open exceptions`

  return (
    <div className="min-h-screen space-y-5">
      {/* ===== Top header strip ===== */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/30">
            <Crown className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-amber-950">Executive Briefing</h1>
            <p className="text-[11px] text-amber-700/70">MEIL ESG · BRSR Reporting Platform · Group consolidated</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-pill status-approved">
            <Activity className="h-3 w-3" /> Live · auto-refresh
          </span>
          <button
            onClick={() => load()}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-4 py-2 text-[11px] font-semibold text-amber-800 backdrop-blur-md transition hover:bg-amber-100 disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </motion.div>

      {/* ===== HERO — radial gauge + grade + executive summary (≈180px) ===== */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-2xl border border-amber-200/60 p-5"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,251,235,0.95) 0%, rgba(254,243,199,0.85) 50%, rgba(251,191,36,0.18) 100%)',
          boxShadow: '0 12px 40px -10px rgba(180,83,9,0.22), inset 0 1px 1px rgba(255,255,255,0.7)',
        }}
      >
        {/* warm decorative orbs */}
        <div className="pointer-events-none absolute -right-12 -top-10 h-44 w-44 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-yellow-200/40 blur-3xl" />

        <div className="relative flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-7">
          {/* Radial gauge — 120px */}
          <EsgGauge score={esgScore} grade={grade} />

          {/* Grade + summary */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full border border-amber-300/70 bg-amber-50/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Composite ESG Score
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-100 to-yellow-50 px-2.5 py-1 text-[10px] font-semibold text-amber-900">
                <Award className="h-3 w-3 text-amber-600" />
                {gradeLabel}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-bold leading-snug text-amber-950 md:text-xl">
              {heroSummary}
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-amber-800/80">
              {k.orgs} group(s) · {k.projects} project(s) · {k.totalSubs} submissions ({k.approvedSubs} approved) · renewable share {k.renewableShare}% · water recycled {k.waterRecycledShare}%
            </p>
          </div>
        </div>
      </motion.section>

      {/* ===== KPI GRID 2x4 — compact cards (max 120px each) ===== */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[...row1, ...row2].map((c, i) => (
          <motion.div
            key={c.label}
            custom={i}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="group relative flex h-[118px] flex-col justify-between overflow-hidden rounded-xl border border-amber-200/60 p-3"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,251,235,0.92) 0%, rgba(254,243,199,0.65) 100%)',
              boxShadow: '0 6px 20px -8px rgba(180,83,9,0.18), inset 0 1px 1px rgba(255,255,255,0.6)',
            }}
          >
            {/* glow on hover */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-200/0 to-amber-200/0 opacity-0 transition-opacity duration-300 group-hover:from-amber-200/30 group-hover:opacity-100" />

            <div className="relative flex items-start justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30">
                <c.icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              </div>
              <TrendPillView pill={c.pill} />
            </div>

            <div className="relative">
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700/80">{c.label}</p>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-[20px] font-bold leading-none tracking-tight text-amber-950">{c.value}</span>
                {c.unit && <span className="text-[10px] font-medium text-amber-700/70">{c.unit}</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ===== BOTTOM SPLIT 50/50 ===== */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        {/* LEFT — ESG dimension breakdown */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="rounded-2xl border border-amber-200/60 p-5"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,251,235,0.95) 0%, rgba(254,243,199,0.7) 100%)',
            boxShadow: '0 8px 32px -8px rgba(180,83,9,0.18), inset 0 1px 1px rgba(255,255,255,0.6)',
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30">
                <Gauge className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950">ESG Score Breakdown</h3>
                <p className="text-[10px] text-amber-700/70">8 dimensions · weighted equally</p>
              </div>
            </div>
            <span className="rounded-full border border-amber-300/60 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
              Composite {esgScore}/100
            </span>
          </div>

          <div className="grid grid-cols-[180px,1fr] items-center gap-3">
            <div className="relative h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="22%"
                  outerRadius="100%"
                  data={dims.map((d, i) => ({ ...d, fill: DIM_PALETTE[i % DIM_PALETTE.length] }))}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background={{ fill: 'rgba(180,83,9,0.08)' }} dataKey="value" cornerRadius={6} />
                </RadialBarChart>
              </ResponsiveContainer>
              {/* center label */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black leading-none text-amber-950">{esgScore}</span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700/80">ESG</span>
              </div>
            </div>

            {/* dimension list */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {dims.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: DIM_PALETTE[i % DIM_PALETTE.length] }} />
                    <span className="truncate text-[11px] font-medium text-amber-900/90">{d.name}</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-950">{d.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* RIGHT — Top 3 AI Insights */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="rounded-2xl border border-amber-200/60 p-5"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,251,235,0.95) 0%, rgba(254,243,199,0.7) 100%)',
            boxShadow: '0 8px 32px -8px rgba(180,83,9,0.18), inset 0 1px 1px rgba(255,255,255,0.6)',
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950">Top AI Insights</h3>
                <p className="text-[10px] text-amber-700/70">LLM-generated · ranked by severity</p>
              </div>
            </div>
            {insightsLoading && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700/70">
                <RefreshCw className="h-3 w-3 animate-spin" /> Generating…
              </span>
            )}
          </div>

          {insightsLoading ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-[68px] animate-pulse rounded-xl bg-amber-100/60" />
              ))}
            </div>
          ) : insights.length === 0 ? (
            <div className="flex h-[220px] flex-col items-center justify-center text-center">
              <Sparkles className="h-8 w-8 text-amber-400/60" />
              <p className="mt-2 text-[12px] text-amber-800/70">No insights generated yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {insights.slice(0, 3).map((ins, i) => (
                <InsightRow key={i} index={i} insight={ins} />
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  )
}

/* ============================================================ ESG Gauge */

function EsgGauge({ score, grade }: { score: number; grade: string }) {
  const size = 120
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  const dash = c * pct
  const gid = 'esg-gauge-amber'

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={AMBER_LITE} />
            <stop offset="55%" stopColor={AMBER} />
            <stop offset="100%" stopColor={GOLD} />
          </linearGradient>
        </defs>
        {/* track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(180,83,9,0.14)"
          strokeWidth={stroke}
        />
        {/* progress */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${dash} ${c - dash}` }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          style={{ filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.45))' }}
        />
      </svg>
      {/* center overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-[28px] font-black leading-none text-amber-950"
        >
          {score}
        </motion.span>
        <motion.span
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.35 }}
          className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[10px] font-black text-white shadow-sm"
        >
          {grade}
        </motion.span>
        <span className="mt-1 text-[8px] font-semibold uppercase tracking-wider text-amber-700/70">/ 100</span>
      </div>
    </div>
  )
}

/* ====================================================== Trend Pill View */

function TrendPillView({ pill }: { pill: TrendPill }) {
  if (pill.kind === 'delta') {
    const up = pill.value > 0
    const down = pill.value < 0
    const isGood =
      (pill.goodWhen === 'up' && up) || (pill.goodWhen === 'down' && down)
    const isBad =
      (pill.goodWhen === 'up' && down) || (pill.goodWhen === 'down' && up)
    const toneClass = isGood
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200/60'
      : isBad
        ? 'bg-rose-100 text-rose-700 border-rose-200/60'
        : 'bg-amber-100 text-amber-800 border-amber-200/60'
    const Icon = up ? TrendingUp : down ? TrendingDown : Activity
    const text = pill.value === 0 ? '0%' : `${up ? '+' : ''}${pill.value}%`
    return (
      <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${toneClass}`}>
        <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
        {text}
      </span>
    )
  }
  // status pill
  const map: Record<string, string> = {
    good:    'bg-emerald-100 text-emerald-700 border-emerald-200/60',
    watch:   'bg-amber-100 text-amber-800 border-amber-200/60',
    risk:    'bg-rose-100 text-rose-700 border-rose-200/60',
    neutral: 'bg-amber-50 text-amber-700/80 border-amber-200/50',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${map[pill.tone]}`}>
      {pill.text}
    </span>
  )
}

/* ====================================================== Insight Row */

function InsightRow({ insight, index }: { insight: Insight; index: number }) {
  const sev = insight.severity || 'positive'
  const cfg =
    sev === 'positive'
      ? { Icon: TrendingUp,   tile: 'bg-emerald-100 text-emerald-700', ring: 'border-emerald-200/50' }
      : sev === 'warning'
        ? { Icon: AlertTriangle, tile: 'bg-amber-100 text-amber-700',    ring: 'border-amber-200/60' }
        : { Icon: AlertOctagon,  tile: 'bg-rose-100 text-rose-700',     ring: 'border-rose-200/60' }
  const num = index + 1

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 + index * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-start gap-2.5 rounded-xl border ${cfg.ring} bg-white/60 p-2.5 backdrop-blur-sm transition hover:bg-white/80`}
    >
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-[12px] font-black text-white shadow-sm shadow-amber-500/30">
        {num}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className={`flex h-4 w-4 items-center justify-center rounded ${cfg.tile}`}>
            <cfg.Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
          </div>
          <p className="truncate text-[12px] font-bold text-amber-950">
            {insight.title || insight.category || 'Insight'}
          </p>
          <span className={`ml-auto inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${cfg.tile}`}>
            {sev}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-amber-900/85">{insight.insight}</p>
        {insight.action && (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-700/80">
            <ChevronRight className="h-2.5 w-2.5" /> {insight.action}
          </p>
        )}
      </div>
    </motion.div>
  )
}

/* ====================================================== Skeleton + Error */

function ExecutiveSkeleton() {
  return (
    <div className="space-y-5">
      {/* header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-amber-200/60" />
          <div className="space-y-1.5">
            <div className="h-4 w-44 animate-pulse rounded bg-amber-200/60" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-amber-100" />
          </div>
        </div>
        <div className="h-8 w-32 animate-pulse rounded-full bg-amber-100" />
      </div>

      {/* hero skeleton */}
      <div className="h-[180px] animate-pulse rounded-2xl border border-amber-200/60 bg-amber-100/50" />

      {/* kpi grid skeleton */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[118px] animate-pulse rounded-xl border border-amber-200/60 bg-amber-100/50" />
        ))}
      </div>

      {/* bottom split skeleton */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        <div className="h-[280px] animate-pulse rounded-2xl border border-amber-200/60 bg-amber-100/50" />
        <div className="h-[280px] animate-pulse rounded-2xl border border-amber-200/60 bg-amber-100/50" />
      </div>
    </div>
  )
}

function ExecutiveError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/40">
        <AlertOctagon className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-amber-950">Executive briefing unavailable</h2>
      <p className="mt-1 max-w-md text-[12px] text-amber-800/70">{message || 'Could not load consolidated ESG data from the reporting chain.'}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-[12px] font-semibold text-white shadow-md shadow-amber-500/30 transition hover:from-amber-600 hover:to-amber-700"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  )
}

export default ExecutiveDashboard
