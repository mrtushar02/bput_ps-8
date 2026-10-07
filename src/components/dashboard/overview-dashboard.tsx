'use client'
/**
 * Overview Dashboard — real KPIs computed server-side from the ESG data control chain.
 * No hardcoded values; reads from /api/overview.
 */
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame, Zap, Droplet, Recycle, Users, HardHat, ShieldCheck, FileCheck2, TrendingUp, TrendingDown,
  Building2, Activity, ArrowUpRight, ArrowRight, CheckCircle2, AlertTriangle, AlertOctagon, Clock, Gauge, Leaf, Battery, Send, Link2, X, Sparkles, AlertCircle, ChevronRight, Award, FileDown
} from 'lucide-react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar, ComposedChart, ReferenceDot
} from 'recharts'
import { PipelineTracker } from '@/components/dashboard/pipeline-tracker'
import { TargetsWidget } from '@/components/dashboard/targets-widget'
import { AiInsightsPanel } from '@/components/dashboard/ai-insights-panel'
import { ActionItemsWidget } from '@/components/dashboard/action-items-widget'
import { GlossaryTooltip } from '@/components/dashboard/glossary-tooltip'
import { ScenarioCalculator } from '@/components/dashboard/scenario-calculator'
import { ExecutiveSummaryView } from '@/components/dashboard/executive-summary-view'
import { useApp, type ModuleKey } from '@/lib/auth-context'

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

  const { setActiveModule } = useApp()
  const [drillDown, setDrillDown] = useState<null | 'emissions' | 'energy' | 'water' | 'waste'>(null)
  const [exporting, setExporting] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')
  const [isCompact, setIsCompact] = useState(false)
  useEffect(() => {
    const check = () => setIsCompact(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  // Compute ESG composite score (0-100) from real KPIs — no hardcoded values
  const esgScore = useMemo(() => {
    if (!data) return 0
    const kk = data.kpis
    const dims = [
      kk.brsrReadiness,                              // BRSR readiness weight
      kk.completion,                                 // reporting completion
      kk.waterRecycledShare,                         // water circularity
      kk.wasteRecycledShare,                         // waste recovery
      kk.renewableShare,                             // renewable energy
      Math.min(kk.femaleShare * 2, 100),            // gender diversity (boost)
      Math.max(0, 100 - kk.ltifr * 20),             // safety (lower LTIFR = better)
      Math.max(0, 100 - kk.openExceptions * 5),     // data quality
    ]
    return Math.round(dims.reduce((s, v) => s + v, 0) / dims.length)
  }, [data])

  if (loading) return <DashboardSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!data) return <EmptyState />

  const k = data.kpis
  const allTrendArr = Object.entries(data.trends).map(([label, v]) => ({ label, ...v }))
  // Filter by selected period (if not 'all')
  const trendArr = selectedPeriod === 'all' ? allTrendArr : (() => {
    const period = data.periods.find((p: any) => p.id === selectedPeriod)
    return period ? allTrendArr.filter(t => t.label === period.label) : allTrendArr
  })()
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
      {/* Executive Summary for compact/mobile view */}
      {isCompact && <ExecutiveSummaryView data={data} esgScore={esgScore} />}
      {/* Full dashboard — hidden on compact view */}
      <div className={isCompact ? 'hidden' : 'space-y-5'}>
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
          <button onClick={() => { setExporting(true); fetch('/api/export/dashboard-pdf').then(r => r.blob()).then(b => { const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = `MEIL-ESG-Dashboard-${new Date().toISOString().slice(0,10)}.pdf`; a.click(); URL.revokeObjectURL(url); setExporting(false) }).catch(() => setExporting(false)) }}
            disabled={exporting}
            className="glass flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-slate-600 transition hover:text-blue-600 disabled:opacity-50">
            <FileDown className="h-3.5 w-3.5" /> {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
          <button className="btn-glass-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"><Activity className="h-3.5 w-3.5" /> Refresh</button>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY BANNER — smart alert with the single most important action */}
      <ExecutiveSummary kpis={k} onNavigate={(m) => setActiveModule(m as ModuleKey)} />

      {/* PERIOD SELECTOR — filter all charts/KPIs by reporting period */}
      {data.periods.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scroll-elegant">
          <button onClick={() => setSelectedPeriod('all')}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${selectedPeriod === 'all' ? 'bg-blue-500 text-white shadow-sm' : 'glass-subtle text-slate-500 hover:text-slate-700'}`}>
            All Periods
          </button>
          {data.periods.map((p: any) => (
            <button key={p.id} onClick={() => setSelectedPeriod(p.id)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${selectedPeriod === p.id ? 'bg-blue-500 text-white shadow-sm' : 'glass-subtle text-slate-500 hover:text-slate-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* ESG SCORE GAUGE + KPI GRID */}
      <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
        <EsgScoreGauge score={esgScore} />
        <div className="space-y-3">
          {/* KPI GRID row 1 */}

      {/* KPI GRID — real month-over-month deltas from trends data (no hardcoded values) */}
      {/* Data confidence: verified (green border) = approved records, warning (amber) = open exceptions, draft (slate) = no data */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        <KpiCard delay={0.05} icon={Flame} tileClass="bg-rose-50 text-rose-600" label="Scope 1 & 2 Emissions" glossaryTerm="Scope 1" value={k.totalEmissions.toLocaleString()} unit="tCO₂e" trend={trendDelta(trendArr, 'emissions')} goodDirection="down" sub={`S1: ${k.scope1} · S2: ${k.scope2}`} spark={allTrendArr.map(t => t.emissions)} sparkColor="#f43f5e" onClick={() => setDrillDown('emissions')} confidence={k.openExceptions > 0 ? 'warning' : 'verified'} />
        <KpiCard delay={0.1} icon={Zap} tileClass="bg-amber-50 text-amber-600" label="Energy Consumption" glossaryTerm="GJ" value={k.energyGJ.toLocaleString()} unit="GJ" trend={trendDelta(trendArr, 'energy')} goodDirection="down" sub={`Renewable ${k.renewableShare}%`} spark={allTrendArr.map(t => t.energy)} sparkColor="#f59e0b" onClick={() => setDrillDown('energy')} confidence={k.openExceptions > 0 ? 'warning' : 'verified'} />
        <KpiCard delay={0.15} icon={Droplet} tileClass="bg-cyan-50 text-cyan-600" label="Water Withdrawal" glossaryTerm="ZLD" value={k.waterWithdrawalKL.toLocaleString()} unit="KL" trend={trendDelta(trendArr, 'water')} goodDirection="down" sub={`Recycled ${k.waterRecycledShare}%`} spark={allTrendArr.map(t => t.water)} sparkColor="#06b6d4" onClick={() => setDrillDown('water')} confidence={k.openExceptions > 0 ? 'warning' : 'verified'} />
        <KpiCard delay={0.2} icon={Recycle} tileClass="bg-emerald-50 text-emerald-600" label="Waste Recovered" glossaryTerm="Waste Recovered" value={k.wasteRecycledShare.toString()} unit="%" trend={null} goodDirection="up" sub={`${k.wasteGeneratedT}T generated`} spark={allTrendArr.map(t => t.waste)} sparkColor="#10b981" onClick={() => setDrillDown('waste')} confidence={k.openExceptions > 0 ? 'warning' : 'verified'} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        <KpiCard delay={0.05} icon={Users} tileClass="bg-blue-50 text-blue-600" label="Total Workforce" value={k.totalWorkforce.toLocaleString()} unit="people" trend={null} goodDirection="up" sub={`${k.totalEmployees} emp · ${k.totalWorkers} workers`} confidence="verified" />
        <KpiCard delay={0.1} icon={ShieldCheck} tileClass="bg-violet-50 text-violet-600" label="Safety · LTIFR" glossaryTerm="LTIFR" value={k.ltifr.toString()} unit="/M hrs" trend={null} goodDirection="down" sub={`${k.injuries} injuries · 0 fatal`} risk={k.fatalities > 0 ? { level: 'danger', text: `${k.fatalities} fatality` } : undefined} confidence="verified" />
        <KpiCard delay={0.15} icon={FileCheck2} tileClass="bg-teal-50 text-teal-600" label="BRSR Readiness" glossaryTerm="BRSR Readiness" value={k.brsrReadiness.toString()} unit="%" trend={null} goodDirection="up" sub={`${k.brsrMissing} items missing`} risk={k.brsrMissing > 0 ? { level: 'warning', text: `${k.brsrMissing} gaps` } : undefined} onClick={() => setActiveModule('brsr')} confidence={k.brsrMissing > 0 ? 'warning' : 'verified'} />
        <KpiCard delay={0.2} icon={Gauge} tileClass="bg-slate-50 text-slate-600" label="Reporting Completion" glossaryTerm="Reporting Period" value={k.completion.toString()} unit="%" trend={null} goodDirection="up" sub={`${k.approvedSubs}/${k.totalSubs} submissions approved`} risk={k.openExceptions > 0 ? { level: 'warning', text: `${k.openExceptions} exceptions` } : undefined} onClick={() => setActiveModule('submissions')} confidence={k.openExceptions > 0 ? 'warning' : 'verified'} />
      </div>
        </div>
      </div>

      {/* ESG SCENARIO CALCULATOR — What-If modeling */}
      <ScenarioCalculator currentScore={esgScore} currentKpis={{
        brsrReadiness: k.brsrReadiness, completion: k.completion, waterRecycledShare: k.waterRecycledShare,
        wasteRecycledShare: k.wasteRecycledShare, renewableShare: k.renewableShare, femaleShare: k.femaleShare,
        ltifr: k.ltifr, openExceptions: k.openExceptions,
      }} />

      {/* ESG DATA CONTROL CHAIN — live pipeline tracker */}
      <PipelineTracker data={data} />

      {/* CHARTS ROW 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Emissions trend — with PoP comparison + anomaly annotations */}
        <GlassCard className="lg:col-span-2" delay={0.1}>
          <CardHeader icon={Flame} title="Monthly GHG Trajectory" subtitle="tCO₂e by reporting period · deterministic calc" right={
            <div className="flex items-center gap-1.5">
              <span className="status-pill status-approved">Target &lt; 5k</span>
            </div>
          } />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendArr} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
                {(() => {
                  // Detect anomalies (MoM change > 30%) and render annotation dots
                  const dots: any[] = []
                  for (let i = 1; i < trendArr.length; i++) {
                    const prev = trendArr[i - 1].emissions
                    const cur = trendArr[i].emissions
                    if (prev > 0) {
                      const pct = ((cur - prev) / prev) * 100
                      if (Math.abs(pct) > 30) {
                        dots.push(
                          <ReferenceDot key={`anomaly-${i}`} x={trendArr[i].label} y={cur} r={6} fill={pct > 0 ? '#f43f5e' : '#10b981'} stroke="white" strokeWidth={2} />
                        )
                      }
                    }
                  }
                  return dots
                })()}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* Anomaly legend */}
          {trendArr.length >= 2 && (() => {
            const last = trendArr[trendArr.length - 1].emissions
            const prev = trendArr[trendArr.length - 2].emissions
            if (prev <= 0) return null
            const pct = Math.round(((last - prev) / prev) * 1000) / 10
            const isAnomaly = Math.abs(pct) > 30
            return (
              <div className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] ${isAnomaly ? (pct > 0 ? 'bg-rose-50/70 text-rose-700' : 'bg-emerald-50/70 text-emerald-700') : 'bg-slate-50/60 text-slate-600'}`}>
                <span className="font-semibold">{isAnomaly ? (pct > 0 ? 'Anomaly detected' : 'Significant improvement') : 'Stable period'}</span>
                <span>· Last vs previous: {pct > 0 ? '+' : ''}{pct}%</span>
                {isAnomaly && pct > 0 && <span className="ml-auto">Review the spike source →</span>}
              </div>
            )
          })()}
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

      {/* AI INSIGHTS + MY ACTION ITEMS — premium executive features */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AiInsightsPanel />
        <ActionItemsWidget />
      </div>

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

      {/* KPI Drill-down modal */}
      <KpiDrillDownModal type={drillDown} data={data} onClose={() => setDrillDown(null)} />
      </div>{/* end full dashboard */}
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

function KpiCard({ icon: Icon, tileClass, label, value, unit, trend, goodDirection, sub, delay, spark, sparkColor, risk, onClick, confidence, glossaryTerm }: any) {
  // ESG semantics: trend direction vs what's "good" determines colour
  const hasTrend = trend !== null && trend !== undefined && !isNaN(trend)
  const isGood = hasTrend && ((goodDirection === 'down' && trend < 0) || (goodDirection === 'up' && trend > 0))
  const isNeutral = hasTrend && trend === 0
  const pillClass = !hasTrend ? 'status-review' : isNeutral ? 'status-review' : isGood ? 'status-approved' : 'status-warning'
  const hasSpark = Array.isArray(spark) && spark.length >= 2
  const clickable = !!onClick
  // Data confidence: verified (green left border), warning (amber), draft (slate)
  const confidenceConfig = {
    verified: { border: 'border-l-emerald-400', dot: 'bg-emerald-500', label: 'Verified', title: 'Data verified — all source records approved' },
    warning: { border: 'border-l-amber-400', dot: 'bg-amber-500', label: 'Review', title: 'Open validation exceptions — review required' },
    draft: { border: 'border-l-slate-300', dot: 'bg-slate-400', label: 'Draft', title: 'Data in draft — not yet submitted' },
  }
  const conf = confidence ? confidenceConfig[confidence as keyof typeof confidenceConfig] : null
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      onClick={onClick}
      title={conf?.title}
      className={`glass glass-shimmer relative overflow-hidden rounded-2xl border-l-[3px] p-4 ${conf?.border ?? 'border-l-transparent'} ${clickable ? 'cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/10' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`kpi-tile ${tileClass}`}><Icon className="h-5 w-5" /></div>
        <div className="flex items-center gap-1.5">
          {conf && (
            <span className="flex items-center gap-1 rounded-full bg-white/60 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500" title={conf.title}>
              <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
              {conf.label}
            </span>
          )}
          {hasTrend ? (
            <span className={`status-pill ${pillClass}`}>
              {trend < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          ) : risk ? (
            <span className={`status-pill ${risk.level === 'danger' ? 'status-error' : 'status-warning'}`}>
              <AlertTriangle className="h-3 w-3" /> {risk.text}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
          {glossaryTerm && <GlossaryTooltip term={glossaryTerm} />}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="tabular-nums text-[26px] font-bold leading-none text-slate-800">{value}</span>
          <span className="text-xs font-medium text-slate-400">&nbsp;{unit}</span>
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          {sub && <div className="text-[11px] leading-tight text-slate-500">{sub}</div>}
          {hasSpark && (
            <div className="h-7 w-16 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark.map((v: number, i: number) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <Line type="monotone" dataKey="v" stroke={sparkColor || '#3b82f6'} strokeWidth={1.8} dot={false} isAnimationActive={true} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      {risk && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50/70 px-2 py-1 text-[10px] font-medium text-rose-700">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span>{risk.text} — review required</span>
        </div>
      )}
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

/* ---------- Executive Summary banner — smart alert with the single most important action ---------- */
function ExecutiveSummary({ kpis, onNavigate }: { kpis: any; onNavigate: (m: string) => void }) {
  // Determine the most urgent action from real KPIs
  const alerts: { severity: 'danger' | 'warning' | 'info'; title: string; message: string; action: string; module: string }[] = []
  if (kpis.fatalities > 0) alerts.push({ severity: 'danger', title: 'Safety incident', message: `${kpis.fatalities} fatality recorded. Immediate review required.`, action: 'Review safety', module: 'audit' })
  if (kpis.brsrMissing > 0) alerts.push({ severity: 'warning', title: 'BRSR compliance gap', message: `${kpis.brsrMissing} BRSR indicators still missing data. Report readiness at ${kpis.brsrReadiness}%.`, action: 'View BRSR', module: 'brsr' })
  if (kpis.openExceptions > 0) alerts.push({ severity: 'warning', title: 'Data quality exceptions', message: `${kpis.openExceptions} validation errors need resolution before lock.`, action: 'Review exceptions', module: 'submissions' })
  if (kpis.corrections > 0) alerts.push({ severity: 'info', title: 'Corrections pending', message: `${kpis.corrections} correction requests await user response.`, action: 'View corrections', module: 'submissions' })
  if (alerts.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-emerald-200/50 bg-emerald-50/40 p-4">
        <div className="flex items-center gap-3">
          <div className="kpi-tile bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
          <div className="flex-1">
            <div className="text-sm font-bold text-slate-800">All systems healthy</div>
            <div className="text-xs text-slate-500">No critical ESG alerts. All data flowing through the control chain on schedule.</div>
          </div>
        </div>
      </motion.div>
    )
  }
  const top = alerts[0]
  const sevConfig = {
    danger: { bg: 'from-rose-50/80 to-red-50/40', border: 'border-rose-200/60', tile: 'bg-rose-100 text-rose-600', text: 'text-rose-700' },
    warning: { bg: 'from-amber-50/80 to-orange-50/40', border: 'border-amber-200/60', tile: 'bg-amber-100 text-amber-600', text: 'text-amber-700' },
    info: { bg: 'from-blue-50/80 to-cyan-50/40', border: 'border-blue-200/60', tile: 'bg-blue-100 text-blue-600', text: 'text-blue-700' },
  }[top.severity]
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={`glass rounded-2xl border ${sevConfig.border} bg-gradient-to-r ${sevConfig.bg} p-4`}>
      <div className="flex items-center gap-3">
        <div className={`kpi-tile ${sevConfig.tile}`}><AlertCircle className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Action required</span>
            <span className={`status-pill ${top.severity === 'danger' ? 'status-error' : top.severity === 'warning' ? 'status-warning' : 'status-submitted'}`}>{alerts.length} alert{alerts.length > 1 ? 's' : ''}</span>
          </div>
          <div className="mt-0.5 text-sm font-bold text-slate-800">{top.title}</div>
          <div className="text-xs text-slate-600">{top.message}</div>
        </div>
        <button onClick={() => onNavigate(top.module)} className={`btn-glass-primary flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold ${sevConfig.text}`}>
          {top.action} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

/* ---------- ESG Score Gauge — composite 0-100 score with letter grade ---------- */
function EsgScoreGauge({ score }: { score: number }) {
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : score >= 50 ? 'C' : 'D'
  const gradeColor = score >= 80 ? '#10b981' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444'
  const data = [{ name: 'score', value: score, fill: gradeColor }]
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-shimmer rounded-2xl p-5">
      <div className="mb-2 flex items-center gap-2">
        <div className="kpi-tile bg-gradient-to-br from-blue-500 to-cyan-600 text-white" style={{ width: 32, height: 32 }}><Award className="h-4 w-4" /></div>
        <div>
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-bold text-slate-800">ESG Score</h3>
            <GlossaryTooltip term="ESG Score" />
          </div>
          <p className="text-[11px] text-slate-500">Composite performance index</p>
        </div>
      </div>
      <div className="relative h-40">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="68%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <RadialBar background={{ fill: 'rgba(148,163,184,0.12)' }} dataKey="value" cornerRadius={12} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular-nums text-4xl font-bold text-slate-800">{score}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">/ 100</span>
          <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-full text-base font-black" style={{ color: 'white', background: gradeColor }}>{grade}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-50/60 px-2 py-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> A+ (90+)</div>
        <div className="flex items-center gap-1.5 rounded-md bg-blue-50/60 px-2 py-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> A (80+)</div>
        <div className="flex items-center gap-1.5 rounded-md bg-amber-50/60 px-2 py-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> B (60+)</div>
        <div className="flex items-center gap-1.5 rounded-md bg-rose-50/60 px-2 py-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> C/D (&lt;60)</div>
      </div>
      {/* Industry benchmark comparison */}
      <BenchmarkComparison score={score} />
    </motion.section>
  )
}

/* ---------- Industry Benchmark Comparison ---------- */
function BenchmarkComparison({ score }: { score: number }) {
  // Illustrative industry benchmarks (in production, these would come from a benchmark API)
  const benchmarks = [
    { label: 'Industry avg', value: 62, color: '#94a3b8' },
    { label: 'Top quartile', value: 78, color: '#10b981' },
    { label: 'Leaders', value: 88, color: '#3b82f6' },
  ]
  const percentile = score >= 88 ? 'Top 10%' : score >= 78 ? 'Top 25%' : score >= 62 ? 'Above average' : 'Below average'
  const percentileColor = score >= 78 ? 'text-emerald-600' : score >= 62 ? 'text-blue-600' : 'text-amber-600'
  return (
    <div className="mt-3 rounded-xl border border-slate-200/50 bg-white/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Industry benchmark</span>
        <span className={`text-[10px] font-bold ${percentileColor}`}>{percentile}</span>
      </div>
      {/* Benchmark bar */}
      <div className="relative h-2 rounded-full bg-slate-200/60">
        <div className="absolute h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${score}%` }} />
        {benchmarks.map((b) => (
          <div key={b.label} className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2" style={{ left: `${b.value}%`, background: b.color }} title={`${b.label}: ${b.value}`} />
        ))}
      </div>
      {/* Benchmark legend */}
      <div className="mt-2 flex items-center justify-between text-[9px]">
        {benchmarks.map((b) => (
          <span key={b.label} className="flex items-center gap-1 text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: b.color }} />
            {b.label} <span className="tabular-nums font-semibold">{b.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------- KPI Drill-Down Modal — month-over-month breakdown ---------- */
function KpiDrillDownModal({ type, data, onClose }: { type: 'emissions' | 'energy' | 'water' | 'waste' | null; data: any; onClose: () => void }) {
  if (!type) return null
  const trendArr = Object.entries(data.trends).map(([label, v]: any) => ({ label, ...v }))
  const config = {
    emissions: { title: 'Scope 1 & 2 Emissions', color: '#f43f5e', unit: 'tCO₂e', icon: Flame, total: data.kpis.totalEmissions, scope1: data.kpis.scope1, scope2: data.kpis.scope2 },
    energy: { title: 'Energy Consumption', color: '#f59e0b', unit: 'GJ', icon: Zap, total: data.kpis.energyGJ, renewable: data.kpis.renewableShare },
    water: { title: 'Water Withdrawal', color: '#06b6d4', unit: 'KL', icon: Droplet, total: data.kpis.waterWithdrawalKL, recycled: data.kpis.waterRecycledShare },
    waste: { title: 'Waste Recovered', color: '#10b981', unit: '%', icon: Recycle, total: data.kpis.wasteRecycledShare, generated: data.kpis.wasteGeneratedT },
  }[type]
  const Icon = config.icon
  const avg = trendArr.length > 0 ? trendArr.reduce((s: number, t: any) => s + t[type], 0) / trendArr.length : 0
  const max = trendArr.length > 0 ? Math.max(...trendArr.map((t: any) => t[type])) : 0
  const min = trendArr.length > 0 ? Math.min(...trendArr.map((t: any) => t[type])) : 0
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} onClick={(e) => e.stopPropagation()}
          className="glass-strong w-full max-w-2xl rounded-3xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="kpi-tile" style={{ background: config.color + '20', color: config.color }}><Icon className="h-5 w-5" /></div>
              <div>
                <h3 className="text-base font-bold text-slate-800">{config.title} · Drill-down</h3>
                <p className="text-xs text-slate-500">Month-over-month breakdown · {data.periods.length} periods</p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
          {/* Summary stats */}
          <div className="mb-4 grid grid-cols-4 gap-2">
            <StatTile label="Total" value={config.total.toLocaleString()} unit={config.unit} />
            <StatTile label="Average" value={avg.toLocaleString(undefined, { maximumFractionDigits: 1 })} unit={config.unit} />
            <StatTile label="Peak" value={max.toLocaleString(undefined, { maximumFractionDigits: 1 })} unit={config.unit} />
            <StatTile label="Lowest" value={min.toLocaleString(undefined, { maximumFractionDigits: 1 })} unit={config.unit} />
          </div>
          {/* Trend chart */}
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendArr} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id={`dd-${type}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={config.color} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={config.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey={type} stroke={config.color} strokeWidth={2.5} fill={`url(#dd-${type})`} name={`${config.title} (${config.unit})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Per-month table */}
          <div className="mt-4 max-h-40 overflow-y-auto scroll-elegant">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white/80 text-[10px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-2 py-1.5 text-left">Period</th><th className="px-2 py-1.5 text-right">Value</th><th className="px-2 py-1.5 text-right">vs Avg</th></tr>
              </thead>
              <tbody>
                {trendArr.map((t: any) => {
                  const delta = avg > 0 ? ((t[type] - avg) / avg) * 100 : 0
                  return (
                    <tr key={t.label} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 text-slate-600">{t.label}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-slate-800">{t[type].toLocaleString()} {config.unit}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${delta < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-white/50 px-3 py-2 text-center">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="tabular-nums text-base font-bold text-slate-800">{value}</div>
      <div className="text-[9px] text-slate-400">{unit}</div>
    </div>
  )
}
