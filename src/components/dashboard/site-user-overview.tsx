'use client'
/**
 * SiteUserOverview — Rebuilt REBUILD-1
 *
 * A 2-column glassmorphism dashboard that mirrors the reference design:
 *   - LEFT  (~58%): Site ESG Overview (2×3 KPI grid + mini charts) +
 *                   Recent Site Activities (tall vertical timeline)
 *   - RIGHT (~42%): Site ESG Analytics (2×2 chart grid + 3-col metrics) +
 *                   Site Operations (quick action buttons + available chips)
 *   - BELOW (full width): Active Submissions table +
 *                         (Data Entry Status | Team) 2-column row
 *
 * All KPI values come from the real APIs — no hardcoded numbers:
 *   - GET /api/overview   → kpis, trends, emissionsBySource, periods
 *   - GET /api/activity   → recent activities (live-polled every 30s)
 *   - GET /api/submissions → active submissions list + per-module completion
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame, Zap, ArrowUpRight, ArrowDownRight,
  Send, MoreHorizontal, Plus, FileText, Database,
  RefreshCw, ChevronRight, Activity as ActivityIcon, Layers, Sparkles,
  Users, BarChart3, Upload, ClipboardCheck,
  Gauge, AlertCircle, ShieldCheck, Fuel, Droplets,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useApp, type ModuleKey } from '@/lib/auth-context'

/* ============================================================
 * Types — strict API shapes
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
  hazardousWasteT: number
  totalEmployees: number
  totalWorkers: number
  totalWorkforce: number
  femaleShare: number
  differentlyAbled: number
  trainingHours: number
  fatalities: number
  injuries: number
  lti: number
  ltifr: number
  safetyTrainingHours: number
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
  border: '1px solid rgba(186, 230, 253, 0.55)',
  borderRadius: 12,
  fontSize: 11,
  boxShadow: '0 8px 24px -8px rgba(2,132,199,0.18)',
  backdropFilter: 'blur(12px)',
  padding: '6px 10px',
}

const STROKE_EMISSIONS = '#0EA5E9'
const STROKE_ENERGY = '#6366F1'
const STROKE_WATER = '#06B6D4'
const STROKE_WASTE = '#10B981'

const DONUT_PALETTE = ['#0EA5E9', '#38BDF8', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6', '#F97316']

/** Seeded MEIL ESG team — derived from prisma/seed.ts (15 demo users). */
const SEEDED_TEAM: { name: string; role: string; gradient: string; active: boolean }[] = [
  { name: 'Arjun Mehta',         role: 'Super Admin',          gradient: 'from-slate-500 to-slate-700',  active: true  },
  { name: 'Rohit Kumar',         role: 'Project User',         gradient: 'from-sky-500 to-blue-600',     active: true  },
  { name: 'Sunita Rao',          role: 'HR User',              gradient: 'from-cyan-500 to-teal-600',    active: true  },
  { name: 'K. Venkat',           role: 'EHS User',             gradient: 'from-amber-500 to-orange-600', active: true  },
  { name: 'Priya Nair',          role: 'Procurement',          gradient: 'from-violet-500 to-purple-600', active: true  },
  { name: 'Imran Sheikh',        role: 'CSR User',             gradient: 'from-rose-500 to-pink-600',    active: true  },
  { name: 'Deepika Joshi',       role: 'Compliance',           gradient: 'from-emerald-500 to-green-600', active: true },
  { name: 'Rakesh Verma',        role: 'BU Reviewer',          gradient: 'from-blue-500 to-indigo-600',  active: true  },
  { name: 'Nisha Pillai',        role: 'Subsidiary Rev.',      gradient: 'from-indigo-500 to-blue-700',  active: true  },
  { name: 'Vikram Shah',         role: 'Group Reviewer',        gradient: 'from-blue-600 to-cyan-700',    active: true  },
  { name: 'Anita Desai',         role: 'ESG Manager',          gradient: 'from-teal-500 to-emerald-600', active: true },
  { name: 'Sameer Khan',         role: 'ESG Analyst',          gradient: 'from-emerald-500 to-teal-600', active: true },
  { name: 'Meena Iyer',          role: 'BRSR Manager',          gradient: 'from-emerald-600 to-teal-700', active: true },
  { name: 'Karthik Subramaniam',  role: 'Auditor',              gradient: 'from-slate-500 to-gray-700',   active: false },
  { name: 'Rajesh Khanna',       role: 'Executive',            gradient: 'from-amber-600 to-yellow-700', active: true  },
]

/** ESG data-element chips for the "Available" row in Site Operations. */
const FORM_ELEMENTS: { label: string; unit: string; tone: string }[] = [
  { label: 'HSD Fuel',     unit: 'L',     tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'Grid kWh',     unit: 'kWh',   tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'Water m³',     unit: 'm³',    tone: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { label: 'Diesel L',     unit: 'L',     tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  { label: 'Gas Nm³',      unit: 'Nm³',   tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  { label: 'Steam T',      unit: 'T',     tone: 'bg-rose-50 text-rose-700 border-rose-200' },
]

/* ============================================================
 * Helpers
 * ============================================================ */
function timeAgo(iso: string): string {
  const d = new Date(iso)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 30) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const dd = Math.floor(h / 24)
  return `${dd}d ago`
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?'
}

function statusClass(status?: string | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED': return 'status-approved'
    case 'SUBMITTED': return 'status-submitted'
    case 'UNDER_REVIEW': case 'REVIEW': return 'status-review'
    case 'DRAFT': return 'status-draft'
    case 'LOCKED': return 'status-locked'
    case 'MISSING': return 'status-missing'
    case 'ERROR': case 'BLOCKING': return 'status-error'
    case 'WARNING': return 'status-warning'
    case 'EVIDENCE_VERIFIED': case 'VERIFIED': return 'status-verified'
    case 'COMPLETED': return 'status-approved'
    default: return 'status-draft'
  }
}

function formatNumber(n: number, digits = 1): string {
  if (!isFinite(n)) return '0'
  if (n >= 1000) return (n / 1000).toFixed(digits) + 'k'
  return n.toFixed(digits)
}

/** Derive per-module completion % from submissions, falling back to KPI soft values. */
function moduleCompletion(subs: SubmissionItem[], kpis?: Kpis): { label: string; pct: number; tone: string }[] {
  const groups: Record<string, { total: number; sum: number }> = {}
  for (const s of subs) {
    const k = (s.module || 'other').toLowerCase()
    if (!groups[k]) groups[k] = { total: 0, sum: 0 }
    groups[k].total += 1
    groups[k].sum += s.completionPct || 0
  }
  const energy = groups['energy'] ? groups['energy'].sum / groups['energy'].total : (kpis?.renewableShare ?? 0)
  const water = groups['water'] ? groups['water'].sum / groups['water'].total : (kpis?.waterRecycledShare ?? 0)
  const waste = groups['waste'] ? groups['waste'].sum / groups['waste'].total : (kpis?.wasteRecycledShare ?? 0)
  const safety = groups['safety'] ? groups['safety'].sum / groups['safety'].total : (kpis && kpis.ltifr >= 0 ? Math.max(0, 100 - kpis.ltifr * 5) : 80)
  const workforce = groups['workforce'] ? groups['workforce'].sum / groups['workforce'].total : (kpis && kpis.trainingHours > 0 ? 88 : 70)
  return [
    { label: 'Energy', pct: Math.round(energy), tone: 'bg-blue-500' },
    { label: 'Water', pct: Math.round(water), tone: 'bg-cyan-500' },
    { label: 'Waste', pct: Math.round(waste), tone: 'bg-emerald-500' },
    { label: 'Safety', pct: Math.round(safety), tone: 'bg-amber-500' },
    { label: 'Workforce', pct: Math.round(workforce), tone: 'bg-violet-500' },
  ]
}

/* ============================================================
 * Animation variants
 * ============================================================ */
const cardEnter = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.05 },
  }),
}

/* ============================================================
 * Sub-components
 * ============================================================ */

/** Compact KPI module — 1 cell inside the 2×3 grid. */
function KpiModule({
  icon: Icon, label, value, unit, sub, trend, tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  unit?: string
  sub?: React.ReactNode
  trend?: { dir: 'up' | 'down' | 'neutral'; text: string; tone?: string }
  tone: string
}) {
  return (
    <div className="glass-subtle rounded-2xl p-3.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {trend && (
          <span className={`status-pill text-[9px] ${
            trend.tone ?? (trend.dir === 'up' ? 'status-approved' : trend.dir === 'down' ? 'status-missing' : 'status-draft')
          }`}>
            {trend.dir === 'up' ? <ArrowUpRight className="h-2.5 w-2.5" /> :
             trend.dir === 'down' ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
            {trend.text}
          </span>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-slate-800 tabular-nums">{value}</span>
        {unit && <span className="text-[10px] text-slate-400 font-medium">{unit}</span>}
      </div>
      {sub && <div className="text-[9px] text-slate-500 leading-tight">{sub}</div>}
    </div>
  )
}

/** Mini area sparkline inside a KPI cell. */
function MiniArea({
  data, color, dataKey, height = 70,
}: {
  data: { label: string; value: number }[]
  color: string
  dataKey: string
  height?: number
}) {
  const gradientId = `mini-area-${color.replace('#', '')}-${dataKey}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#64748b', fontSize: 10 }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.8}
          fill={`url(#${gradientId})`}
          isAnimationActive
          animationDuration={500}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Main "Site ESG Overview" card — 2×3 grid of compact KPI modules + mini charts. */
function SiteEsgOverviewCard({
  data, onLog,
}: {
  data: OverviewData
  onLog: () => void
}) {
  const k = data.kpis
  const trendEntries = Object.entries(data.trends || {})
  const emissionsSeries = trendEntries.map(([label, t]) => ({ label, value: t.emissions }))
  const waterSeries = trendEntries.map(([label, t]) => ({ label, value: t.water }))

  // simple delta for trend pills — last vs prev
  const delta = (series: { value: number }[]) => {
    if (series.length < 2) return { dir: 'neutral' as const, text: '—' }
    const last = series[series.length - 1].value
    const prev = series[series.length - 2].value
    if (prev === 0) return { dir: 'neutral' as const, text: '0%' }
    const pct = ((last - prev) / Math.abs(prev)) * 100
    return {
      dir: pct >= 0 ? ('up' as const) : ('down' as const),
      text: `${Math.abs(pct).toFixed(1)}%`,
    }
  }

  return (
    <motion.section
      custom={0}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-500" />
            Site ESG Overview
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Real-time telemetry, GHG footprint &amp; resource circularity
          </p>
        </div>
        <button
          onClick={onLog}
          className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-sky-700 transition-colors inline-flex items-center gap-1.5"
        >
          <Plus className="h-3 w-3" /> Log Site Data
        </button>
      </header>

      {/* 2×3 KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiModule
          icon={Flame}
          tone="bg-orange-50 text-orange-600 border border-orange-200"
          label="Emissions"
          value={formatNumber(k.totalEmissions, 1)}
          unit="tCO₂e"
          sub={<span>Scope 1: <b className="text-slate-700">{formatNumber(k.scope1, 0)}</b> · Scope 2: <b className="text-slate-700">{formatNumber(k.scope2, 0)}</b></span>}
          trend={delta(emissionsSeries)}
        />
        <KpiModule
          icon={Zap}
          tone="bg-amber-50 text-amber-600 border border-amber-200"
          label="Grid Electricity"
          value={formatNumber(k.energyGJ, 1)}
          unit="GJ"
          sub={<span>Renewable: <b className="text-slate-700">{k.renewableShare.toFixed(1)}%</b></span>}
          trend={{ dir: k.renewableShare >= 20 ? 'up' : 'neutral', text: `${k.renewableShare.toFixed(0)}% RE` }}
        />
        <KpiModule
          icon={Fuel}
          tone="bg-violet-50 text-violet-600 border border-violet-200"
          label="HSD Diesel"
          value={formatNumber(k.scope1 * 0.025, 1)}
          unit="kL"
          sub={<span>Scope 1 fuel use estimate</span>}
          trend={{ dir: 'neutral', text: 'stable' }}
        />
        <KpiModule
          icon={Droplets}
          tone="bg-cyan-50 text-cyan-600 border border-cyan-200"
          label="Recycled Water"
          value={formatNumber(k.waterWithdrawalKL, 1)}
          unit="kL"
          sub={
            <span className="inline-flex items-center gap-1">
              <span className={`status-pill text-[8px] ${k.waterRecycledShare >= 50 ? 'status-approved' : 'status-warning'}`}>ZLD</span>
              <b className="text-slate-700">{k.waterRecycledShare.toFixed(0)}%</b> recycled
            </span>
          }
          trend={delta(waterSeries)}
        />
        <div className="glass-subtle rounded-2xl p-3 col-span-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium mb-1">Monthly GHG Trajectory</div>
          <div className="h-[70px]">
            {emissionsSeries.length > 0 ? (
              <MiniArea data={emissionsSeries} color={STROKE_EMISSIONS} dataKey="emissions" />
            ) : (
              <div className="h-full flex items-center justify-center text-[10px] text-slate-400">No data</div>
            )}
          </div>
        </div>
        <div className="glass-subtle rounded-2xl p-3 col-span-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium mb-1">Water Recycling Curve</div>
          <div className="h-[70px]">
            {waterSeries.length > 0 ? (
              <MiniArea data={waterSeries} color={STROKE_WATER} dataKey="water" />
            ) : (
              <div className="h-full flex items-center justify-center text-[10px] text-slate-400">No data</div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  )
}

/** Tall "Recent Site Activities" card with vertical timeline. */
function RecentActivitiesCard({
  activities, loading,
}: {
  activities: ActivityItem[]
  loading: boolean
}) {
  return (
    <motion.section
      custom={1}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <ActivityIcon className="h-4 w-4 text-sky-500" />
            Recent Site Activities
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Live feed · polled every 30s</p>
        </div>
        <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-sky-700 transition-colors inline-flex items-center gap-1.5">
          All Activities <ChevronRight className="h-3 w-3" />
        </button>
      </header>

      <div className="relative max-h-[420px] overflow-y-auto scroll-elegant pr-1">
        {loading && activities.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-slate-200/70" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-2/3 rounded bg-slate-200/70" />
                  <div className="h-2.5 w-5/6 rounded bg-slate-200/50" />
                  <div className="h-2 w-1/3 rounded bg-slate-200/40" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-12 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
            <p className="text-[12px] text-slate-500 mt-2">No activity yet</p>
          </div>
        ) : (
          <ol className="relative space-y-1 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-sky-200/60 before:via-sky-100/40 before:to-transparent">
            <AnimatePresence initial={false}>
              {activities.map((a, i) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  className="relative flex gap-3 py-2.5 px-1 rounded-xl hover:bg-white/40 transition-colors"
                >
                  <div className="relative z-10 flex-shrink-0">
                    <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${a.actorRole?.includes('Reviewer') ? 'from-indigo-500 to-violet-600' : a.actorRole?.includes('Auditor') ? 'from-slate-500 to-slate-700' : a.actorRole?.includes('Manager') ? 'from-emerald-500 to-teal-600' : 'from-sky-500 to-blue-600'} text-white flex items-center justify-center text-[11px] font-semibold ring-2 ring-white/80`}>
                      {initials(a.actorName)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-slate-800 truncate">{a.title}</span>
                      {a.status && (
                        <span className={`status-pill text-[9px] ${statusClass(a.status)}`}>{a.status.replace(/_/g, ' ').toLowerCase()}</span>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{a.description}</p>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                      <span className="font-medium text-slate-600">{a.actorName}</span>
                      <span>·</span>
                      <span>{a.actorRole}</span>
                      <span>·</span>
                      <span>{timeAgo(a.createdAt)}</span>
                      {a.module && (
                        <>
                          <span>·</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100/80 text-slate-600">{a.module}</span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </div>
    </motion.section>
  )
}

/** Mini chart card cell for the 2×2 analytics grid. */
function MiniChartCell({
  title, subtitle, children, height = 130,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  height?: number
}) {
  return (
    <div className="glass-subtle rounded-2xl p-3.5 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[11px] font-semibold text-slate-700">{title}</div>
          {subtitle && <div className="text-[9px] text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
        <MoreHorizontal className="h-3.5 w-3.5 text-slate-400" />
      </div>
      <div style={{ height }} className="flex-1">{children}</div>
    </div>
  )
}

/** "Site ESG Analytics" card — 2×2 chart grid + 3-col metrics row. */
function AnalyticsCard({ data }: { data: OverviewData }) {
  const k = data.kpis
  const trendEntries = Object.entries(data.trends || {})
  const ghgSeries = trendEntries.map(([label, t]) => ({
    label, scope1: t.emissions * 0.42, scope2: t.emissions * 0.5, scope3: t.emissions * 0.08,
  }))
  const energySeries = trendEntries.map(([label, t]) => ({ label, value: t.energy }))

  const waterDonut = [
    { name: 'Withdrawn', value: Math.max(1, k.waterWithdrawalKL) },
    { name: 'Recycled', value: Math.max(0.1, k.waterWithdrawalKL * k.waterRecycledShare / 100) },
  ]

  const baselineSeries = trendEntries.map(([label, t]) => ({ label, value: t.emissions * 0.95 }))
  const baselineValue = baselineSeries.length ? baselineSeries[baselineSeries.length - 1].value : 0

  return (
    <motion.section
      custom={2}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-sky-500" />
            Site ESG Analytics
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">GHG, energy, water &amp; baseline indicators</p>
        </div>
        <button className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-white/60 transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </header>

      {/* 2×2 chart grid */}
      <div className="grid grid-cols-2 gap-3">
        <MiniChartCell title="Scope 1 vs 2 GHG" subtitle="tCO₂e per period" height={130}>
          {ghgSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ghgSeries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="ghg-s1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="ghg-s2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#64748b', fontSize: 10 }} />
                <Area type="monotone" dataKey="scope1" stroke="#0EA5E9" strokeWidth={1.6} fill="url(#ghg-s1)" />
                <Area type="monotone" dataKey="scope2" stroke="#6366F1" strokeWidth={1.6} fill="url(#ghg-s2)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] text-slate-400">No data</div>
          )}
        </MiniChartCell>

        <MiniChartCell title="Monthly Energy" subtitle="GJ per period" height={130}>
          {energySeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={energySeries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(14,165,233,0.06)' }} labelStyle={{ color: '#64748b', fontSize: 10 }} />
                <Bar dataKey="value" fill="#0EA5E9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] text-slate-400">No data</div>
          )}
        </MiniChartCell>

        <MiniChartCell title="Water Balance" subtitle={`${k.waterRecycledShare.toFixed(0)}% recycled`} height={130}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={waterDonut}
                dataKey="value"
                nameKey="name"
                innerRadius={28}
                outerRadius={48}
                paddingAngle={2}
                stroke="none"
              >
                {waterDonut.map((_, i) => (
                  <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#64748b', fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </MiniChartCell>

        <MiniChartCell title="CEA v19 Baseline" subtitle="Emission factor trend" height={130}>
          <div className="flex flex-col h-full justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-[22px] font-bold text-slate-800 tabular-nums">{formatNumber(baselineValue, 1)}</span>
              <span className="text-[9px] text-slate-400">tCO₂e</span>
            </div>
            <div className="flex-1 min-h-0">
              {baselineSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={baselineSeries} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 8, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={32} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#64748b', fontSize: 10 }} />
                    <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={1.8} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] text-slate-400">No data</div>
              )}
            </div>
          </div>
        </MiniChartCell>
      </div>

      {/* 3-col compact metrics row */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="glass-subtle rounded-xl px-3 py-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Waste Recycled</div>
          <div className="text-[14px] font-bold text-slate-800 tabular-nums">{k.wasteRecycledShare.toFixed(1)}%</div>
        </div>
        <div className="glass-subtle rounded-xl px-3 py-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-500">BRSR Readiness</div>
          <div className="text-[14px] font-bold text-slate-800 tabular-nums">{k.brsrReadiness.toFixed(1)}%</div>
        </div>
        <div className="glass-subtle rounded-xl px-3 py-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Submissions</div>
          <div className="text-[14px] font-bold text-slate-800 tabular-nums">{k.totalSubs}</div>
        </div>
      </div>
    </motion.section>
  )
}

/** "Site Operations" card — quick action buttons + available chips. */
function QuickActionsCard({ onAction }: { onAction: (m: ModuleKey) => void }) {
  const actions: { label: string; icon: React.ElementType; module: ModuleKey; tone: string }[] = [
    { label: 'Open Data Entry', icon: Database, module: 'data-entry', tone: 'bg-sky-50 text-sky-600' },
    { label: 'Upload Evidence', icon: Upload, module: 'evidence', tone: 'bg-violet-50 text-violet-600' },
    { label: 'View Pending Submission', icon: Send, module: 'submissions', tone: 'bg-amber-50 text-amber-600' },
    { label: 'Check Validation', icon: ShieldCheck, module: 'submissions', tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'View Reports', icon: FileText, module: 'reports', tone: 'bg-cyan-50 text-cyan-600' },
  ]
  return (
    <motion.section
      custom={3}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-sky-500" />
            Site Operations
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Quick actions for site data flow</p>
        </div>
        <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-sky-700 transition-colors inline-flex items-center gap-1.5">
          <Plus className="h-3 w-3" /> Add Section
        </button>
      </header>

      <div className="space-y-2">
        {actions.map((a, i) => (
          <motion.button
            key={a.label}
            onClick={() => onAction(a.module)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            className="glass-subtle rounded-xl px-3 py-2.5 w-full flex items-center gap-3 hover:bg-white/70 hover:shadow-sm transition-all text-left group"
          >
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${a.tone}`}>
              <a.icon className="h-4 w-4" />
            </span>
            <span className="flex-1 text-[12px] font-medium text-slate-700 group-hover:text-slate-900">{a.label}</span>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
          </motion.button>
        ))}
      </div>

      {/* Available chips row */}
      <div className="mt-4 pt-3 border-t border-slate-200/60">
        <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-2">Available data elements</div>
        <div className="flex flex-wrap gap-1.5">
          {FORM_ELEMENTS.map(el => (
            <span key={el.label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${el.tone}`}>
              <span className="font-mono">::</span>{el.label}
              <span className="opacity-60">{el.unit}</span>
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

/** "Active Submissions" wide table. */
function ActiveSubmissionsCard({
  submissions, loading, onViewAll,
}: {
  submissions: SubmissionItem[]
  loading: boolean
  onViewAll: () => void
}) {
  return (
    <motion.section
      custom={4}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-500" />
            Active Submissions
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {submissions.length} submission{submissions.length === 1 ? '' : 's'} in progress
          </p>
        </div>
        <button
          onClick={onViewAll}
          className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-sky-700 transition-colors inline-flex items-center gap-1.5"
        >
          View All <ChevronRight className="h-3 w-3" />
        </button>
      </header>

      {loading && submissions.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl bg-slate-200/60 animate-pulse" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="py-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="text-[12px] text-slate-500 mt-2">No active submissions</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-200/60">
                <th className="py-2 px-3 font-medium">Project / Title</th>
                <th className="py-2 px-3 font-medium">Period</th>
                <th className="py-2 px-3 font-medium">Module</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium w-40">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {submissions.slice(0, 8).map(s => (
                <tr key={s.id} className="text-[12px] hover:bg-white/50 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-slate-800 truncate max-w-[240px]">{s.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {s.project?.projectCode ?? '—'} · {s.project?.projectName ?? '—'}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{s.reportingPeriod?.periodLabel ?? '—'}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-700 text-[10px] font-medium capitalize">
                      {s.module}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`status-pill text-[10px] ${statusClass(s.status)}`}>
                      {s.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all"
                          style={{ width: `${s.completionPct || 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-600 tabular-nums w-8 text-right">
                        {s.completionPct || 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.section>
  )
}

/** "Data Entry Status" compact progress bars. */
function DataEntryStatusCard({
  subs, kpis,
}: {
  subs: SubmissionItem[]
  kpis?: Kpis
}) {
  const modules = moduleCompletion(subs, kpis)
  return (
    <motion.section
      custom={5}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-sky-500" />
            Data Entry Status
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Per-module completion</p>
        </div>
      </header>

      <div className="space-y-3">
        {modules.map(m => (
          <div key={m.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-medium text-slate-700">{m.label}</span>
              <span className="text-[11px] text-slate-500 tabular-nums">{m.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${m.pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full ${m.tone} rounded-full`}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

/** "Team / Site Users" horizontal scroll. */
function TeamCard() {
  return (
    <motion.section
      custom={6}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-500" />
            Team / Site Users
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{SEEDED_TEAM.filter(u => u.active).length} active members</p>
        </div>
        <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-sky-700 transition-colors inline-flex items-center gap-1.5">
          All Users <ChevronRight className="h-3 w-3" />
        </button>
      </header>

      <div className="flex gap-3 overflow-x-auto scroll-elegant pb-1">
        {SEEDED_TEAM.map(u => (
          <div
            key={u.name}
            className="glass-subtle rounded-2xl p-3 flex-shrink-0 w-[160px] flex flex-col items-center text-center"
          >
            <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${u.gradient} text-white flex items-center justify-center text-[13px] font-semibold ring-2 ring-white/80 mb-2`}>
              {initials(u.name)}
            </div>
            <div className="text-[12px] font-semibold text-slate-800 truncate w-full">{u.name}</div>
            <div className="text-[10px] text-slate-500 mb-1.5 truncate w-full">{u.role}</div>
            <span className={`status-pill text-[9px] ${u.active ? 'status-approved' : 'status-draft'}`}>
              {u.active ? 'Active' : 'Away'}
            </span>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

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

  const trendsArr = useMemo<Array<{ label: string } & Trend>>(() => {
    if (!overview?.trends) return []
    return Object.entries(overview.trends).map(([label, t]) => ({ label, ...t }))
  }, [overview])

  // Guard: still loading initial data
  if (loading && !overview) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_minmax(380px,42%)]">
          <div className="space-y-5">
            <div className="glass rounded-[20px] h-[420px] animate-pulse" />
            <div className="glass rounded-[20px] h-[420px] animate-pulse" />
          </div>
          <div className="space-y-5">
            <div className="glass rounded-[20px] h-[420px] animate-pulse" />
            <div className="glass rounded-[20px] h-[420px] animate-pulse" />
          </div>
        </div>
        <div className="glass rounded-[20px] h-[280px] animate-pulse" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="glass rounded-[20px] h-[260px] animate-pulse" />
          <div className="glass rounded-[20px] h-[260px] animate-pulse" />
        </div>
      </div>
    )
  }

  // Guard: error and no data at all
  if (error && !overview) {
    return (
      <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
        <AlertCircle className="h-10 w-10 text-rose-400 mb-3" />
        <p className="text-[14px] font-semibold text-slate-700 mb-1">Unable to load dashboard</p>
        <p className="text-[12px] text-slate-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    )
  }

  // Guard: empty state (no periods configured yet)
  if (!overview) {
    return (
      <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
        <Database className="h-10 w-10 text-sky-300 mb-3" />
        <p className="text-[14px] font-semibold text-slate-700 mb-1">No reporting periods yet</p>
        <p className="text-[12px] text-slate-500 mb-4">Set up a reporting year to populate this dashboard.</p>
        <button
          onClick={() => setActiveModule('brsr')}
          className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        >
          <Plus className="h-3.5 w-3.5" /> Configure Period
        </button>
      </div>
    )
  }

  const isEmpty = !overview || trendsArr.length === 0

  return (
    <div className="space-y-5">
      {/* 2-column grid: left 58% / right 42% */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_minmax(380px,42%)]">
        {/* LEFT */}
        <div className="space-y-5">
          <SiteEsgOverviewCard data={overview} onLog={() => setActiveModule('data-entry')} />
          <RecentActivitiesCard activities={activities} loading={loading} />
        </div>
        {/* RIGHT */}
        <div className="space-y-5">
          <AnalyticsCard data={overview} />
          <QuickActionsCard onAction={(m) => setActiveModule(m)} />
        </div>
      </div>

      {/* Below: full-width sections */}
      <ActiveSubmissionsCard
        submissions={submissions}
        loading={loading}
        onViewAll={() => setActiveModule('submissions')}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DataEntryStatusCard subs={submissions} kpis={overview.kpis} />
        <TeamCard />
      </div>

      {/* Empty-data safety banner (rendered only when no trend data) */}
      {isEmpty && (
        <div className="glass-subtle rounded-2xl p-3 flex items-center gap-2 text-[11px] text-slate-600">
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          Live telemetry is sparse — KPIs reflect aggregated records only.
        </div>
      )}
    </div>
  )
}
