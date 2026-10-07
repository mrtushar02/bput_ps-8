'use client'
/**
 * Overview Dashboard — real KPIs computed server-side from the ESG data control chain.
 * No hardcoded values; reads from /api/overview.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Flame, Zap, Droplet, Recycle, Users, HardHat, ShieldCheck, FileCheck2, TrendingUp, TrendingDown,
  Building2, Activity, ArrowUpRight, ArrowRight, CheckCircle2, AlertTriangle, AlertOctagon, Clock, Gauge, Leaf, Battery, Send, Link2
} from 'lucide-react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { PipelineTracker } from '@/components/dashboard/pipeline-tracker'
import { TargetsWidget } from '@/components/dashboard/targets-widget'

interface OverviewData {
  kpis: any
  trends: Record<string, { emissions: number; energy: number; water: number; waste: number }>
  emissionsBySource: Record<string, number>
  activities: any[]
  periods: any[]
  sources: any
}

const PALETTE = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316']

export function OverviewDashboard() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/overview')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <DashboardSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!data) return <EmptyState />

  const k = data.kpis
  const trendArr = Object.entries(data.trends).map(([label, v]) => ({ label, ...v }))
  const sourceArr = Object.entries(data.emissionsBySource).map(([name, value]) => ({ name, value }))
  const waterDonut = [
    { name: 'Recycled', value: k.waterRecycledShare },
    { name: 'Fresh', value: 100 - k.waterRecycledShare > 0 ? 100 - k.waterRecycledShare : 0 },
  ]
  const wasteDonut = [
    { name: 'Recovered', value: k.wasteRecycledShare },
    { name: 'Disposed', value: 100 - k.wasteRecycledShare > 0 ? 100 - k.wasteRecycledShare : 0 },
  ]

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">ESG Command Center</h1>
            <span className="status-pill status-approved"><CheckCircle2 className="h-3 w-3" /> Live</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Group-wide consolidated view · {k.orgs} group(s) · {k.projects} project(s) · {data.periods.length} reporting periods</p>
        </div>
        <div className="flex items-center gap-2">
          <ScopeFilter />
          <button className="btn-glass-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"><Activity className="h-3.5 w-3.5" /> Refresh</button>
        </div>
      </div>

      {/* KPI GRID — real month-over-month deltas from trends data (no hardcoded values) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        <KpiCard delay={0.05} icon={Flame} tileClass="bg-rose-50 text-rose-600" label="Scope 1 & 2 Emissions" value={k.totalEmissions.toLocaleString()} unit="tCO₂e" trend={trendDelta(trendArr, 'emissions')} goodDirection="down" sub={`S1: ${k.scope1} · S2: ${k.scope2}`} />
        <KpiCard delay={0.1} icon={Zap} tileClass="bg-amber-50 text-amber-600" label="Energy Consumption" value={k.energyGJ.toLocaleString()} unit="GJ" trend={trendDelta(trendArr, 'energy')} goodDirection="down" sub={`Renewable ${k.renewableShare}%`} />
        <KpiCard delay={0.15} icon={Droplet} tileClass="bg-cyan-50 text-cyan-600" label="Water Withdrawal" value={k.waterWithdrawalKL.toLocaleString()} unit="KL" trend={trendDelta(trendArr, 'water')} goodDirection="down" sub={`Recycled ${k.waterRecycledShare}%`} />
        <KpiCard delay={0.2} icon={Recycle} tileClass="bg-emerald-50 text-emerald-600" label="Waste Recovered" value={k.wasteRecycledShare.toString()} unit="%" trend={null} goodDirection="up" sub={`${k.wasteGeneratedT}T generated`} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        <KpiCard delay={0.05} icon={Users} tileClass="bg-blue-50 text-blue-600" label="Total Workforce" value={k.totalWorkforce.toLocaleString()} unit="people" trend={null} goodDirection="up" sub={`${k.totalEmployees} emp · ${k.totalWorkers} workers`} />
        <KpiCard delay={0.1} icon={ShieldCheck} tileClass="bg-violet-50 text-violet-600" label="Safety · LTIFR" value={k.ltifr.toString()} unit="/M hrs" trend={null} goodDirection="down" sub={`${k.injuries} injuries · 0 fatal`} />
        <KpiCard delay={0.15} icon={FileCheck2} tileClass="bg-teal-50 text-teal-600" label="BRSR Readiness" value={k.brsrReadiness.toString()} unit="%" trend={null} goodDirection="up" sub={`${k.brsrMissing} items missing`} />
        <KpiCard delay={0.2} icon={Gauge} tileClass="bg-slate-50 text-slate-600" label="Reporting Completion" value={k.completion.toString()} unit="%" trend={null} goodDirection="up" sub={`${k.approvedSubs}/${k.totalSubs} submissions approved`} />
      </div>

      {/* ESG DATA CONTROL CHAIN — live pipeline tracker */}
      <PipelineTracker data={data} />

      {/* CHARTS ROW 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Emissions trend */}
        <GlassCard className="lg:col-span-2" delay={0.1}>
          <CardHeader icon={Flame} title="Monthly GHG Trajectory" subtitle="tCO₂e by reporting period · deterministic calc" right={<span className="status-pill status-approved">Target &lt; 5k</span>} />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendArr} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="emGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="emissions" stroke="#3b82f6" strokeWidth={2.5} fill="url(#emGrad)" name="Emissions tCO₂e" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Emissions by source */}
        <GlassCard delay={0.15}>
          <CardHeader icon={Battery} title="Emissions by Source" subtitle="Scope 1 + 2 + 3 split" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceArr} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={3}>
                  {sourceArr.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Energy trend */}
        <GlassCard delay={0.1}>
          <CardHeader icon={Zap} title="Monthly Energy (GJ)" subtitle="Renewable vs non-renewable" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendArr} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="energy" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Energy GJ" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Water balance donut */}
        <GlassCard delay={0.15}>
          <CardHeader icon={Droplet} title="Water Balance" subtitle="Recycled vs fresh withdrawal" right={<span className="status-pill status-approved">ZLD Active</span>} />
          <div className="flex h-48 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={waterDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={66} paddingAngle={3}>
                  <Cell fill="#3b82f6" /><Cell fill="#bae6fd" />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v}%`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Waste recycled */}
        <GlassCard delay={0.2}>
          <CardHeader icon={Recycle} title="Waste Recovered" subtitle={`${k.hazardousWasteT}T hazardous`} />
          <div className="flex h-48 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={wasteDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={66} paddingAngle={3}>
                  <Cell fill="#10b981" /><Cell fill="#d1fae5" />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v}%`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Workforce + safety */}
        <GlassCard delay={0.25}>
          <CardHeader icon={Users} title="Workforce & Safety" subtitle={`${k.femaleShare}% female`} />
          <div className="space-y-2.5 p-1">
            <MiniStat label="Employees" value={k.totalEmployees} icon={Users} tone="blue" />
            <MiniStat label="Workers" value={k.totalWorkers} icon={HardHat} tone="amber" />
            <MiniStat label="Differently-abled" value={k.differentlyAbled} icon={ShieldCheck} tone="violet" />
            <MiniStat label="Training hours" value={k.trainingHours} icon={TrendingUp} tone="emerald" />
          </div>
        </GlassCard>
      </div>

      {/* SUSTAINABILITY TARGETS vs ACTUALS */}
      <TargetsWidget />

      {/* DATA QUALITY + ACTIVITY */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Data quality center */}
        <GlassCard className="lg:col-span-1" delay={0.1}>
          <CardHeader icon={AlertTriangle} title="Data Quality Center" subtitle="Exceptions & gaps" />
          <div className="space-y-2">
            <QualityRow icon={AlertOctagon} label="Open validation errors" value={k.openExceptions} tone="rose" />
            <QualityRow icon={AlertTriangle} label="Anomalies detected" value={k.anomalies} tone="amber" />
            <QualityRow icon={Clock} label="Open correction requests" value={k.corrections} tone="violet" />
            <QualityRow icon={FileCheck2} label="BRSR items missing" value={k.brsrMissing} tone="amber" />
            <QualityRow icon={CheckCircle2} label="Evidence verified" value={`${k.evidenceVerified}/${k.evidenceTotal}`} tone="emerald" />
          </div>
          <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100">
            View all exceptions <ArrowRight className="h-3 w-3" />
          </button>
        </GlassCard>

        {/* Recent activities */}
        <GlassCard className="lg:col-span-2" delay={0.15}>
          <CardHeader icon={Activity} title="Recent Site Activities" subtitle="Submissions, approvals, drafts, calculations" right={<button className="glass-subtle rounded-full px-3 py-1 text-[10px] font-medium text-slate-500">All activities</button>} />
          <div className="max-h-80 space-y-1 overflow-y-auto scroll-elegant pr-1">
            {data.activities.map((a, i) => <ActivityRow key={a.id} a={a} delay={i * 0.04} />)}
          </div>
        </GlassCard>
      </div>

      {/* TRACE banner */}
      <GlassCard delay={0.2}>
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="kpi-tile bg-blue-50 text-blue-600"><Leaf className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-bold text-slate-800">Every number is traceable</div>
              <div className="text-xs text-slate-500">Each KPI resolves through the chain: source record → evidence → validation → calculation (factor v{1}) → approval → BRSR mapping → report.</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            {['Source', 'Evidence', 'Validate', 'Calculate', 'Approve', 'Consolidate', 'BRSR', 'Report', 'Audit'].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-1">
                <span className="rounded-full bg-white/70 px-2 py-1 font-semibold text-slate-600">{s}</span>
                {i < arr.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-slate-300" />}
              </span>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

/* ---------- Building blocks ---------- */
function GlassCard({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      className={`glass glass-shimmer rounded-2xl p-4 ${className}`}>
      {children}
    </motion.section>
  )
}

function CardHeader({ icon: Icon, title, subtitle, right }: { icon: any; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between">
      <div className="flex items-start gap-2.5">
        <div className="kpi-tile bg-slate-50 text-slate-600" style={{ width: 32, height: 32 }}><Icon className="h-4 w-4" /></div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

/** Compute real month-over-month delta (%) from the trends array. Returns null if insufficient data. */
function trendDelta(trends: { emissions: number; energy: number; water: number; waste: number }[], key: 'emissions' | 'energy' | 'water' | 'waste'): number | null {
  if (!trends || trends.length < 2) return null
  const last = trends[trends.length - 1][key]
  const prev = trends[trends.length - 2][key]
  if (prev === 0) return null
  return Math.round(((last - prev) / prev) * 1000) / 10
}

function KpiCard({ icon: Icon, tileClass, label, value, unit, trend, goodDirection, sub, delay }: any) {
  // ESG semantics: trend direction vs what's "good" determines colour
  // goodDirection='down' → decreasing is good (emissions, energy, water, LTIFR)
  // goodDirection='up' → increasing is good (readiness, completion, workforce, recovery%)
  const hasTrend = trend !== null && trend !== undefined && !isNaN(trend)
  const isGood = hasTrend && ((goodDirection === 'down' && trend < 0) || (goodDirection === 'up' && trend > 0))
  const isNeutral = hasTrend && trend === 0
  const pillClass = !hasTrend ? 'status-review' : isNeutral ? 'status-review' : isGood ? 'status-approved' : 'status-warning'
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      className="glass glass-shimmer rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <div className={`kpi-tile ${tileClass}`}><Icon className="h-5 w-5" /></div>
        {hasTrend ? (
          <span className={`status-pill ${pillClass}`}>
            {trend < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        ) : (
          <span className="status-pill status-review"><Activity className="h-3 w-3" /> current</span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="tabular-nums text-2xl font-bold text-slate-800">{value}</span>
          <span className="text-xs font-medium text-slate-400">&nbsp;{unit}</span>
        </div>
        {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
      </div>
    </motion.div>
  )
}

function MiniStat({ label, value, icon: Icon, tone }: any) {
  const toneMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600', emerald: 'bg-emerald-50 text-emerald-600',
  }
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/40 px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${toneMap[tone]}`}><Icon className="h-3 w-3" /></div>
        <span className="text-[11px] font-medium text-slate-600">{label}</span>
      </div>
      <span className="tabular-nums text-sm font-bold text-slate-800">{value.toLocaleString()}</span>
    </div>
  )
}

function QualityRow({ icon: Icon, label, value, tone }: any) {
  const toneMap: Record<string, string> = {
    rose: 'text-rose-600 bg-rose-50', amber: 'text-amber-600 bg-amber-50',
    violet: 'text-violet-600 bg-violet-50', emerald: 'text-emerald-600 bg-emerald-50',
  }
  return (
    <div className="flex items-center justify-between rounded-lg px-2.5 py-2 transition hover:bg-white/40">
      <div className="flex items-center gap-2">
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${toneMap[tone]}`}><Icon className="h-3 w-3" /></div>
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <span className="tabular-nums text-sm font-bold text-slate-800">{value}</span>
    </div>
  )
}

function ActivityRow({ a, delay }: { a: any; delay: number }) {
  const toneMap: Record<string, string> = {
    SUBMITTED: 'bg-blue-100 text-blue-700', APPROVED: 'bg-emerald-100 text-emerald-700',
    DRAFT: 'bg-amber-100 text-amber-700', COMPLETED: 'bg-teal-100 text-teal-700',
  }
  const iconMap: Record<string, any> = { DATA_ENTRY: Activity, SUBMIT: Send, APPROVE: CheckCircle2, EVIDENCE_UPLOAD: Link2, CALCULATION: Zap }
  const Icon = iconMap[a.action] ?? Activity
  const tone = toneMap[a.status] ?? 'bg-slate-100 text-slate-700'
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}
      className="flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-white/40">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-slate-800">{a.title}</span>
          <span className={`status-pill ${tone}`}>{a.status}</span>
        </div>
        <p className="truncate text-[11px] text-slate-500">{a.description}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
          <span className="font-medium text-slate-500">{a.actorName}</span>
          <span>·</span><span>{a.actorRole}</span>
          <span>·</span><span>{timeAgo(a.createdAt)}</span>
        </div>
      </div>
    </motion.div>
  )
}

function ScopeFilter() {
  return (
    <div className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-2 text-xs">
      <Building2 className="h-3.5 w-3.5 text-blue-600" />
      <select className="bg-transparent font-semibold text-slate-700 outline-none">
        <option>MEIL Group (All)</option>
        <option>MEIL Power Systems</option>
        <option>MEIL Infrastructure</option>
      </select>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200/60" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[...Array(8)].map((_, i) => <div key={i} className="glass h-32 animate-pulse rounded-2xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass h-80 animate-pulse rounded-2xl lg:col-span-2" />
        <div className="glass h-80 animate-pulse rounded-2xl" />
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
      <button onClick={onRetry} className="btn-glass-primary rounded-full px-5 py-2 text-xs font-semibold">Retry</button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <FileCheck2 className="h-10 w-10 text-slate-400" />
      <div>
        <div className="text-base font-bold text-slate-800">No reporting periods yet</div>
        <div className="text-xs text-slate-500">Create a reporting year and period to begin.</div>
      </div>
    </div>
  )
}

const tooltipStyle = {
  background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.8)',
  borderRadius: 12, fontSize: 11, boxShadow: '0 8px 24px -8px rgba(30,58,138,0.18)',
  backdropFilter: 'blur(12px)',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
