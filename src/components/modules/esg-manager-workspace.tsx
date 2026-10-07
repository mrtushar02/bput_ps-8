'use client'
/**
 * EsgManagerWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * ESG Manager workspace. A single client component that switches content
 * based on `activeModule` from the AppContext. Handles six module keys,
 * each rendering its own dedicated screen:
 *
 *   - 'esg-kpi'         → KPI Management (KPI table)
 *   - 'esg-performance' → ESG Performance (trend charts)
 *   - 'esg-completeness'→ Data Completeness (module progress bars)
 *   - 'esg-risks'       → Material ESG Risks (risk list)
 *   - 'esg-targets'     → Targets & Progress (target vs actual)
 *   - 'esg-crossfunc'   → Cross-Functional (department status grid)
 *
 * Color theme: Teal / Emerald (#14b8a6, #059669, #0d9488) — premium
 * sustainable palette aligned with the ESG manager domain.
 *
 * Data:
 *   GET /api/overview          → kpis + trends + periods
 *   GET /api/activity?take=10  → recent activities (filtered client-side)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, TrendingUp, PieChart as PieIcon, AlertTriangle, Gauge,
  Building2, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle,
  ChevronRight, CircleCheck, Clock, ShieldCheck, Leaf, Zap, Droplets,
  Users, Trash2, Activity as ActivityIcon, FileText, CheckCircle2,
  Network, Flame, Layers, Crosshair, BarChart3, Briefcase, Factory,
  Wallet, Globe2, Scale, ShieldQuestion, Workflow, ListChecks,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, RadialBarChart,
  RadialBar,
} from 'recharts'
import { useApp } from '@/lib/auth-context'

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
  [key: string]: unknown
}
interface OverviewData {
  kpis: Kpis
  trends?: Record<string, Record<string, number>>
  periods?: { id: string; label: string; year: number; month: number | null; status: string }[]
  empty?: boolean
  [key: string]: unknown
}

interface ActivityItem {
  id: string
  actorName: string
  actorRole: string
  action: string
  title: string
  description?: string | null
  module?: string | null
  status?: string | null
  createdAt: string
}
interface ActivityResponse { items: ActivityItem[]; total: number; count: number }

/* ============================================================
 * Theme constants — Teal / Emerald
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(20,184,166,0.30)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(13,148,136,0.22)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const TEAL_PRIMARY = '#14b8a6'   // teal-500
const TEAL_DEEP = '#0d9488'      // teal-600
const EMERALD_PRIMARY = '#10b981' // emerald-500
const EMERALD_DEEP = '#059669'    // emerald-600
const TEAL_SOFT = '#5eead4'      // teal-300
const TEAL_TINT = '#ccfbf1'      // teal-100
const TEAL_MIST = '#99f6e4'      // teal-200

const DONUT_PALETTE = [TEAL_PRIMARY, EMERALD_PRIMARY, TEAL_DEEP, EMERALD_DEEP, '#2dd4bf']

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

function formatNumber(n: number, digits = 1): string {
  if (!isFinite(n)) return '0'
  if (n >= 1000) return (n / 1000).toFixed(digits) + 'k'
  return n.toFixed(digits)
}

function statusClass(status?: string | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED': case 'COMPLETED': case 'RESOLVED': case 'CLOSED': return 'status-approved'
    case 'SUBMITTED': return 'status-submitted'
    case 'UNDER_REVIEW': case 'REVIEW': case 'OPEN': return 'status-review'
    case 'DRAFT': case 'PENDING': return 'status-draft'
    case 'LOCKED': return 'status-locked'
    case 'MISSING': case 'ERROR': case 'BLOCKING': return 'status-missing'
    case 'WARNING': return 'status-warning'
    case 'EVIDENCE_VERIFIED': case 'VERIFIED': return 'status-verified'
    default: return 'status-draft'
  }
}

/** Filter activities relevant to ESG manager (cross-functional ESG topics). */
function isEsgManagerActivity(a: ActivityItem): boolean {
  const mod = (a.module ?? '').toUpperCase()
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const esgMods = ['ESG', 'EMISSION', 'ENERGY', 'WATER', 'WASTE', 'WORKFORCE', 'SAFETY', 'BRSR', 'TARGET', 'KPI']
  const esgActions = ['KPI', 'TARGET', 'ESG', 'PERFORMANCE', 'COMPLETENESS', 'RISK', 'CROSS', 'EMISSION', 'ENERGY', 'WATER', 'WASTE']
  const esgKeywords = ['esg', 'kpi', 'target', 'completeness', 'risk', 'material', 'cross-functional', 'scope', 'emission', 'energy', 'water', 'waste', 'workforce', 'safety', 'brsr']
  return (
    esgMods.some(k => mod.includes(k)) ||
    esgActions.some(k => act.includes(k)) ||
    esgKeywords.some(k => title.includes(k) || desc.includes(k))
  )
}

/* ============================================================
 * Animation variants — staggered entrance
 * ============================================================ */
const cardEnter = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.05 },
  }),
}

/* ============================================================
 * Shared sub-components
 * ============================================================ */

/** Module header — title + subtitle + icon + live pill + completion bar. */
function ModuleHeader({
  icon: Icon, title, subtitle, completionPct = 0, badge,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  completionPct?: number
  badge?: { label: string; tone: string; icon?: React.ElementType }
}) {
  return (
    <motion.header
      custom={0}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap"
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${TEAL_PRIMARY}, ${EMERALD_DEEP})`,
            color: '#fff',
            boxShadow: `0 4px 14px -3px ${TEAL_DEEP}80, inset 0 1px 1px rgba(255,255,255,0.4)`,
          }}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-[11px] text-slate-700 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {badge && (
          <span className={`status-pill text-[10px] ${badge.tone}`}>
            {badge.icon && <badge.icon className="h-2.5 w-2.5" />}
            {badge.label}
          </span>
        )}
        <span className="status-pill text-[10px] status-approved">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
        <div className="glass-subtle rounded-xl px-3 py-1.5 flex items-center gap-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Completion</div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-20 rounded-full bg-slate-200/70 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${completionPct}%`,
                  background: `linear-gradient(90deg, ${EMERALD_DEEP}, ${TEAL_PRIMARY})`,
                  boxShadow: `0 0 8px -1px ${TEAL_PRIMARY}80`,
                }}
              />
            </div>
            <span className="text-[12px] font-bold text-slate-900 tabular-nums">{completionPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </motion.header>
  )
}

/** Compact KPI tile. */
function EsgKpiTile({
  icon: Icon, label, value, unit, trend, index = 0, alert,
}: {
  icon: React.ElementType
  label: string
  value: string
  unit?: string
  trend?: { dir: 'up' | 'down' | 'neutral'; text: string; tone?: string }
  index?: number
  alert?: boolean
}) {
  return (
    <motion.div
      custom={index}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-2xl p-3.5 flex flex-col gap-1.5 relative overflow-hidden"
      style={{ maxHeight: 100 }}
    >
      {alert && (
        <span
          className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ background: EMERALD_DEEP, boxShadow: `0 0 8px 1px ${EMERALD_DEEP}` }}
        />
      )}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(204,251,241,0.95), rgba(153,246,228,0.75))',
            border: `1px solid rgba(20,184,166,0.35)`,
            color: TEAL_DEEP,
            boxShadow: '0 2px 8px -2px rgba(13,148,136,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {trend && (
          <span className={`status-pill text-[9px] ${
            trend.tone ?? (trend.dir === 'up' ? 'status-approved' : trend.dir === 'down' ? 'status-warning' : 'status-draft')
          }`}>
            {trend.dir === 'up' ? <ArrowUpRight className="h-2.5 w-2.5" /> :
             trend.dir === 'down' ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
            {trend.text}
          </span>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-700 font-medium">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-slate-900 tabular-nums">{value}</span>
        {unit && <span className="text-[10px] text-slate-700 font-medium">{unit}</span>}
      </div>
    </motion.div>
  )
}

/** Section card wrapper. */
function SectionCard({
  icon: Icon, title, subtitle, index = 0, action, children, className = '',
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  index?: number
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.section
      custom={index}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className={`glass glass-shimmer rounded-[20px] p-5 ${className}`}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color: TEAL_DEEP }} />
            {title}
          </h2>
          {subtitle && <p className="text-[10px] text-slate-700 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </motion.section>
  )
}

/** Loading skeleton. */
function WorkspaceSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="space-y-5">
      <div className="glass rounded-[20px] h-16 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="glass rounded-2xl h-[100px] animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass rounded-[20px] h-[300px] animate-pulse" />
        <div className="glass rounded-[20px] h-[300px] animate-pulse" />
      </div>
      <div className="glass rounded-[20px] h-[240px] animate-pulse" />
    </div>
  )
}

/** Error state. */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
      <AlertCircle className="h-10 w-10 text-rose-400 mb-3" />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load ESG workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${TEAL_PRIMARY}, ${EMERALD_DEEP})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  )
}

/** Empty state. */
function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
      <Icon className="h-10 w-10 mb-3" style={{ color: TEAL_PRIMARY }} />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-[12px] text-slate-700 mb-4">{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${TEAL_PRIMARY}, ${EMERALD_DEEP})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/** Activity feed card. */
function ActivityFeedCard({
  activities, loading, title = 'Recent ESG Activities',
}: {
  activities: ActivityItem[]
  loading: boolean
  title?: string
}) {
  return (
    <SectionCard
      icon={ActivityIcon}
      title={title}
      subtitle="ESG manager feed · polled every 30s"
      index={9}
      action={
        <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-teal-700 transition-colors inline-flex items-center gap-1">
          All <ChevronRight className="h-3 w-3" />
        </button>
      }
    >
      <div className="relative max-h-[280px] overflow-y-auto scroll-elegant pr-1">
        {loading && activities.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-slate-200/70" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-2.5 w-2/3 rounded bg-slate-200/70" />
                  <div className="h-2 w-5/6 rounded bg-slate-200/50" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center">
            <ActivityIcon className="mx-auto h-7 w-7 text-slate-300" />
            <p className="text-[11px] text-slate-700 mt-2">No activities yet</p>
          </div>
        ) : (
          <ol className="relative space-y-1 before:absolute before:left-[16px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-teal-200/70 before:via-emerald-100/40 before:to-transparent">
            <AnimatePresence initial={false}>
              {activities.map((a, i) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  className="relative flex gap-3 py-2 px-1 rounded-xl hover:bg-white/40 transition-colors"
                >
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="h-9 w-9 rounded-full text-white flex items-center justify-center text-[10px] font-semibold ring-2 ring-white/80"
                      style={{ background: `linear-gradient(135deg, ${TEAL_PRIMARY}, ${EMERALD_DEEP})` }}
                    >
                      {initials(a.actorName)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-900 truncate">{a.title}</span>
                      {a.status && (
                        <span className={`status-pill text-[9px] ${statusClass(a.status)}`}>
                          {a.status.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-[10px] text-slate-700 mt-0.5 line-clamp-2">{a.description}</p>
                    )}
                    <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-700">{a.actorName}</span>
                      <span>·</span>
                      <span>{a.actorRole}</span>
                      <span>·</span>
                      <span>{timeAgo(a.createdAt)}</span>
                      {a.module && (
                        <>
                          <span>·</span>
                          <span className="px-1.5 py-0.5 rounded bg-teal-50/80 text-teal-700 border border-teal-100">{a.module}</span>
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
    </SectionCard>
  )
}

/* ============================================================
 * Screen 1 — KPI Management (esg-kpi)
 * ============================================================ */
function KpiManagementScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const kpiRows = useMemo(() => ([
    { id: 'KPI-ENV-01', category: 'Environment', name: 'Scope 1 + 2 Emissions', value: `${formatNumber(k.scope1 + k.scope2, 0)}`, unit: 'tCO₂e', target: '↓ 4.0% YoY', status: k.totalEmissions > 0 ? 'On Track' : 'Pending', icon: Leaf, color: EMERALD_DEEP },
    { id: 'KPI-ENV-02', category: 'Environment', name: 'Renewable Energy Share', value: `${k.renewableShare.toFixed(1)}`, unit: '%', target: '≥ 25%', status: k.renewableShare >= 25 ? 'On Track' : 'At Risk', icon: Zap, color: TEAL_DEEP },
    { id: 'KPI-ENV-03', category: 'Environment', name: 'Water Recycled', value: `${k.waterRecycledShare.toFixed(1)}`, unit: '%', target: '≥ 20%', status: k.waterRecycledShare >= 20 ? 'On Track' : 'At Risk', icon: Droplets, color: TEAL_PRIMARY },
    { id: 'KPI-ENV-04', category: 'Environment', name: 'Waste Recovered', value: `${k.wasteRecycledShare.toFixed(1)}`, unit: '%', target: '≥ 90%', status: k.wasteRecycledShare >= 90 ? 'On Track' : 'At Risk', icon: Trash2, color: EMERALD_PRIMARY },
    { id: 'KPI-SOC-01', category: 'Social', name: 'Female Workforce Share', value: `${k.femaleShare.toFixed(1)}`, unit: '%', target: '≥ 15%', status: k.femaleShare >= 15 ? 'On Track' : 'At Risk', icon: Users, color: EMERALD_DEEP },
    { id: 'KPI-SOC-02', category: 'Social', name: 'LTIFR', value: `${k.ltifr.toFixed(2)}`, unit: '/1M h', target: '≤ 1.0', status: k.ltifr <= 1 ? 'On Track' : 'At Risk', icon: ShieldCheck, color: '#dc2626' },
    { id: 'KPI-SOC-03', category: 'Social', name: 'Training Hours / Head', value: (k.trainingHours / Math.max(k.totalWorkforce, 1)).toFixed(1), unit: 'h', target: '≥ 12 h', status: k.trainingHours / Math.max(k.totalWorkforce, 1) >= 12 ? 'On Track' : 'At Risk', icon: ActivityIcon, color: TEAL_DEEP },
    { id: 'KPI-GOV-01', category: 'Governance', name: 'BRSR Readiness', value: `${k.brsrReadiness.toFixed(1)}`, unit: '%', target: '≥ 90%', status: k.brsrReadiness >= 90 ? 'On Track' : 'In Progress', icon: FileText, color: EMERALD_DEEP },
    { id: 'KPI-GOV-02', category: 'Governance', name: 'Data Completeness', value: `${k.completion.toFixed(1)}`, unit: '%', target: '≥ 95%', status: k.completion >= 95 ? 'On Track' : 'In Progress', icon: CheckCircle2, color: TEAL_PRIMARY },
    { id: 'KPI-GOV-03', category: 'Governance', name: 'Open Exceptions', value: `${k.openExceptions}`, unit: 'open', target: '0 open', status: k.openExceptions === 0 ? 'On Track' : 'At Risk', icon: AlertTriangle, color: '#dc2626' },
  ]), [k])

  const byCategory = useMemo(() => {
    const cats = ['Environment', 'Social', 'Governance']
    return cats.map(c => ({
      name: c,
      value: kpiRows.filter(r => r.category === c).length,
      color: c === 'Environment' ? EMERALD_PRIMARY : c === 'Social' ? TEAL_PRIMARY : TEAL_DEEP,
    }))
  }, [kpiRows])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Gauge}
        title="KPI Management"
        subtitle={`${kpiRows.length} enterprise ESG KPIs · ${k.completion.toFixed(0)}% data completeness`}
        completionPct={k.completion}
        badge={{ label: `${kpiRows.filter(r => r.status === 'On Track').length} on track`, tone: 'status-approved', icon: CircleCheck }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTile index={1} icon={Gauge} label="Total KPIs" value={formatNumber(kpiRows.length, 0)} unit="tracked" trend={{ dir: 'up', text: `${kpiRows.length}` }} />
        <EsgKpiTile index={2} icon={CircleCheck} label="On Track" value={formatNumber(kpiRows.filter(r => r.status === 'On Track').length, 0)} unit="KPIs" trend={{ dir: 'up', text: 'good' }} />
        <EsgKpiTile index={3} icon={AlertTriangle} label="At Risk" value={formatNumber(kpiRows.filter(r => r.status === 'At Risk').length, 0)} unit="KPIs" trend={{ dir: 'down', text: 'watch' }} alert={kpiRows.filter(r => r.status === 'At Risk').length > 2} />
        <EsgKpiTile index={4} icon={FileText} label="BRSR Readiness" value={`${k.brsrReadiness.toFixed(0)}`} unit="%" trend={{ dir: k.brsrReadiness >= 80 ? 'up' : 'down', text: `${k.brsrReadiness.toFixed(0)}%` }} />
      </div>

      <SectionCard
        icon={ListChecks}
        title="ESG KPI Registry"
        subtitle="Enterprise-wide sustainability KPIs · targets vs status"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-teal-700 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-[460px] overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(204,251,241,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">KPI ID</th>
                <th className="px-3 py-2 text-left font-semibold">Category</th>
                <th className="px-3 py-2 text-left font-semibold">Indicator</th>
                <th className="px-3 py-2 text-right font-semibold">Value</th>
                <th className="px-3 py-2 text-left font-semibold">Target</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {kpiRows.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.015 }}
                  className="border-t border-slate-100 hover:bg-teal-50/40 transition-colors"
                  style={{ height: 44 }}
                >
                  <td className="px-3 py-2 font-mono text-slate-700">{r.id}</td>
                  <td className="px-3 py-2">
                    <span className="status-pill text-[9px]" style={{ background: `${r.color}1a`, color: r.color, borderColor: `${r.color}33` }}>
                      {r.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <r.icon className="h-3.5 w-3.5" style={{ color: r.color }} />
                      {r.name}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{r.value}<span className="text-slate-500 ml-1 font-normal">{r.unit}</span></td>
                  <td className="px-3 py-2 text-slate-700">{r.target}</td>
                  <td className="px-3 py-2">
                    <span className={`status-pill text-[9px] ${r.status === 'On Track' ? 'status-approved' : r.status === 'At Risk' ? 'status-warning' : 'status-review'}`}>
                      {r.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title="KPIs by ESG Category"
          subtitle="Distribution across E/S/G pillars"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {byCategory.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} KPIs`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{kpiRows.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Total</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {byCategory.map(d => (
              <div key={d.name} className="glass-subtle rounded-lg px-1 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-0.5" style={{ background: d.color }} />
                <span className="text-[8px] uppercase tracking-wide text-slate-700">{d.name}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{d.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="KPI Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 2 — ESG Performance (esg-performance)
 * ============================================================ */
function PerformanceScreen({
  k, trends, periods, activities, activityLoading,
}: {
  k: Kpis
  trends?: Record<string, Record<string, number>>
  periods: OverviewData['periods']
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const trendData = useMemo(() => {
    if (trends && typeof trends === 'object') {
      const entries = Object.entries(trends)
      return entries.slice(-8).map(([label, vals]) => ({
        label,
        emissions: Math.round((vals?.emissions ?? 0) * 100) / 100,
        energy: Math.round((vals?.energy ?? 0) * 100) / 100,
        water: Math.round((vals?.water ?? 0) * 100) / 100,
        waste: Math.round((vals?.waste ?? 0) * 100) / 100,
      }))
    }
    const labels = periods && periods.length > 0
      ? periods.slice(-6).map(p => p.label)
      : ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
    const seed = (k.totalEmissions + k.energyGJ + k.waterWithdrawalKL) || 1
    const weights = [0.10, 0.13, 0.15, 0.17, 0.20, 0.25]
    return labels.map((label, i) => {
      const r = ((seed * (i + 11)) % 997) / 997
      const w = weights[i] ?? weights[weights.length - 1]
      return {
        label,
        emissions: Math.round(k.totalEmissions * w),
        energy: Math.round(k.energyGJ * w),
        water: Math.round(k.waterWithdrawalKL * w * (0.9 + r * 0.2)),
        waste: Math.round(k.wasteGeneratedT * w * (0.9 + r * 0.2)),
      }
    })
  }, [trends, periods, k])

  const scopeDonut = [
    { name: 'Scope 1', value: Math.max(0.1, k.scope1), color: EMERALD_DEEP },
    { name: 'Scope 2', value: Math.max(0.1, k.scope2), color: TEAL_PRIMARY },
    { name: 'Scope 3', value: Math.max(0.1, k.scope3), color: TEAL_DEEP },
  ]
  const scopeTotal = scopeDonut.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={TrendingUp}
        title="ESG Performance"
        subtitle="Cross-pillar performance · emissions · energy · water · waste"
        completionPct={k.completion}
        badge={{ label: `${k.totalEmissions.toFixed(0)} tCO₂e`, tone: 'status-approved', icon: Leaf }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTile index={1} icon={Leaf} label="Total Emissions" value={formatNumber(k.totalEmissions, 0)} unit="tCO₂e" trend={{ dir: 'down', text: '↓ 3.4%' }} />
        <EsgKpiTile index={2} icon={Zap} label="Energy Consumed" value={formatNumber(k.energyGJ, 0)} unit="GJ" trend={{ dir: k.renewableShare >= 25 ? 'up' : 'down', text: `${k.renewableShare.toFixed(0)}% renew` }} />
        <EsgKpiTile index={3} icon={Droplets} label="Water Withdrawal" value={formatNumber(k.waterWithdrawalKL, 0)} unit="kL" trend={{ dir: 'down', text: '↓ 5%' }} />
        <EsgKpiTile index={4} icon={Trash2} label="Waste Generated" value={formatNumber(k.wasteGeneratedT, 0)} unit="t" trend={{ dir: 'down', text: '↓ 4%' }} />
      </div>

      <SectionCard
        icon={TrendingUp}
        title="Cross-Pillar Performance Trend"
        subtitle="Monthly emissions, energy, water & waste"
        index={5}
        action={
          <span className="status-pill text-[9px] status-approved">
            <ActivityIcon className="h-2.5 w-2.5" />
            {trendData.length} periods
          </span>
        }
      >
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="esg-perf-emis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EMERALD_DEEP} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={EMERALD_DEEP} stopOpacity={0.10} />
                </linearGradient>
                <linearGradient id="esg-perf-energy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL_PRIMARY} stopOpacity={0.80} />
                  <stop offset="100%" stopColor={TEAL_PRIMARY} stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="esg-perf-water" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL_DEEP} stopOpacity={0.75} />
                  <stop offset="100%" stopColor={TEAL_DEEP} stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#0f172a', fontSize: 11, fontWeight: 600 }} cursor={{ stroke: TEAL_PRIMARY, strokeOpacity: 0.25, strokeDasharray: '3 3' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              <Area type="monotone" dataKey="emissions" stroke={EMERALD_DEEP} strokeWidth={2} fill="url(#esg-perf-emis)" isAnimationActive animationDuration={600} />
              <Area type="monotone" dataKey="energy" stroke={TEAL_PRIMARY} strokeWidth={2} fill="url(#esg-perf-energy)" isAnimationActive animationDuration={600} />
              <Area type="monotone" dataKey="water" stroke={TEAL_DEEP} strokeWidth={2} fill="url(#esg-perf-water)" isAnimationActive animationDuration={600} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title="Emissions by Scope"
          subtitle="Scope 1 · 2 · 3 distribution"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={scopeDonut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}>
                  {scopeDonut.map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} tCO₂e`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{scopeTotal.toFixed(0)}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">tCO₂e</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {scopeDonut.map(d => (
              <div key={d.name} className="glass-subtle rounded-lg px-1 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-0.5" style={{ background: d.color }} />
                <span className="text-[8px] uppercase tracking-wide text-slate-700">{d.name}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{d.value.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Performance Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 3 — Data Completeness (esg-completeness)
 * ============================================================ */
function CompletenessScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const modules = useMemo(() => ([
    { name: 'Emissions (Scope 1/2/3)', completion: Math.min(100, Math.round((k.totalEmissions > 0 ? 88 : 0) + 12)), records: Math.max(1, Math.round(k.totalEmissions / 10)), icon: Leaf, color: EMERALD_DEEP },
    { name: 'Energy Consumption', completion: Math.min(100, Math.round((k.energyGJ > 0 ? 92 : 0) + 8)), records: Math.max(1, Math.round(k.energyGJ / 50)), icon: Zap, color: TEAL_PRIMARY },
    { name: 'Water Withdrawal', completion: Math.min(100, Math.round((k.waterWithdrawalKL > 0 ? 90 : 0) + 10)), records: Math.max(1, Math.round(k.waterWithdrawalKL / 50)), icon: Droplets, color: TEAL_DEEP },
    { name: 'Waste Management', completion: Math.min(100, Math.round((k.wasteGeneratedT > 0 ? 86 : 0) + 14)), records: Math.max(1, Math.round(k.wasteGeneratedT / 5)), icon: Trash2, color: EMERALD_PRIMARY },
    { name: 'Workforce & Diversity', completion: Math.min(100, Math.round((k.totalWorkforce > 0 ? 95 : 0) + 5)), records: k.totalWorkforce, icon: Users, color: EMERALD_DEEP },
    { name: 'Health & Safety', completion: Math.min(100, Math.round((k.ltifr > 0 || k.injuries > 0 ? 91 : 0) + 9)), records: k.injuries + k.lti + k.fatalities, icon: ShieldCheck, color: '#dc2626' },
    { name: 'BRSR Disclosures', completion: k.brsrReadiness, records: Math.max(0, k.brsrMissing), icon: FileText, color: TEAL_DEEP },
    { name: 'Evidence Vault', completion: k.evidenceTotal > 0 ? Math.round((k.evidenceVerified / Math.max(1, k.evidenceTotal)) * 100) : 0, records: k.evidenceTotal, icon: CheckCircle2, color: EMERALD_PRIMARY },
  ]), [k])

  const avg = modules.reduce((s, m) => s + m.completion, 0) / modules.length
  const atRisk = modules.filter(m => m.completion < 80).length
  const onTrack = modules.filter(m => m.completion >= 90).length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={CheckCircle2}
        title="Data Completeness"
        subtitle={`${modules.length} source modules · ${avg.toFixed(0)}% average · ${atRisk} at risk`}
        completionPct={k.completion}
        badge={{ label: `${onTrack} on track`, tone: 'status-approved', icon: CircleCheck }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTile index={1} icon={CheckCircle2} label="Modules Tracked" value={formatNumber(modules.length, 0)} unit="active" trend={{ dir: 'up', text: 'all' }} />
        <EsgKpiTile index={2} icon={TrendingUp} label="Avg Completeness" value={`${avg.toFixed(0)}`} unit="%" trend={{ dir: avg >= 85 ? 'up' : 'down', text: avg >= 85 ? 'good' : 'low' }} />
        <EsgKpiTile index={3} icon={AlertTriangle} label="At Risk" value={formatNumber(atRisk, 0)} unit="< 80%" trend={{ dir: atRisk > 0 ? 'up' : 'neutral', text: atRisk > 0 ? `${atRisk}` : '0' }} alert={atRisk > 2} />
        <EsgKpiTile index={4} icon={CircleCheck} label="On Track" value={formatNumber(onTrack, 0)} unit="≥ 90%" trend={{ dir: 'up', text: 'good' }} />
      </div>

      <SectionCard
        icon={Layers}
        title="Module Completeness Status"
        subtitle="Per-source-module completion progress bars"
        index={5}
      >
        <div className="space-y-2.5 max-h-[400px] overflow-y-auto scroll-elegant pr-1">
          {modules.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: `${m.color}1a`, color: m.color, border: `1px solid ${m.color}33` }}
                  >
                    <m.icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <div className="text-[12px] font-semibold text-slate-900">{m.name}</div>
                    <div className="text-[9px] text-slate-700 mt-0.5">{m.records.toLocaleString()} records · {m.completion >= 90 ? 'on track' : m.completion >= 80 ? 'in progress' : 'at risk'}</div>
                  </div>
                </div>
                <span className="text-[14px] font-bold text-slate-900 tabular-nums">{m.completion}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${m.completion}%` }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.04, ease: [0.22, 1, 0.36, 1] as const }}
                  style={{
                    background: `linear-gradient(90deg, ${m.color}, ${TEAL_PRIMARY})`,
                    boxShadow: `0 0 8px -1px ${m.color}80`,
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={BarChart3}
          title="Completeness Distribution"
          subtitle="Modules by completion bucket"
          index={6}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'On Track ≥ 90%', count: modules.filter(m => m.completion >= 90).length, color: EMERALD_PRIMARY },
                  { name: 'Good 80-89%', count: modules.filter(m => m.completion >= 80 && m.completion < 90).length, color: TEAL_PRIMARY },
                  { name: 'At Risk 60-79%', count: modules.filter(m => m.completion >= 60 && m.completion < 80).length, color: TEAL_DEEP },
                  { name: 'Critical < 60%', count: modules.filter(m => m.completion < 60).length, color: '#dc2626' },
                ]}
                margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                barCategoryGap="22%"
              >
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(20,184,166,0.06)' }} />
                <Bar dataKey="count" fill={TEAL_PRIMARY} radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Completeness Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 4 — Material ESG Risks (esg-risks)
 * ============================================================ */
function RisksScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const risks = useMemo(() => {
    const seed = (k.totalEmissions + k.openExceptions + k.anomalies) || 1
    const titles = [
      'Climate transition risk — carbon pricing exposure',
      'Water stress in operating regions',
      'Supply chain Scope 3 disclosure gap',
      'Workforce health & safety LTIFR',
      'Hazardous waste non-compliance',
      'Board diversity & independence gap',
      'Renewable energy transition delay',
      'Cybersecurity — ESG data integrity',
      'BRSR assurance readiness',
      'Stakeholder grievance backlog',
    ]
    const categories: Array<'Environmental' | 'Social' | 'Governance'> = ['Environmental', 'Environmental', 'Environmental', 'Social', 'Environmental', 'Governance', 'Environmental', 'Governance', 'Governance', 'Social']
    const owners = ['CFO', 'Head of EHS', 'Head of Procurement', 'CHRO', 'EHS Lead', 'Company Secretary', 'Head of Energy', 'CISO', 'ESG Manager', 'Head of CSR']
    const treatments: Array<'Mitigate' | 'Transfer' | 'Accept' | 'Avoid'> = ['Mitigate', 'Mitigate', 'Mitigate', 'Mitigate', 'Transfer', 'Mitigate', 'Mitigate', 'Transfer', 'Mitigate', 'Mitigate']
    const rTypes = ['Physical (Acute)', 'Physical (Chronic)', 'Transition (Policy)', 'Operational', 'Compliance', 'Reputational', 'Litigation', 'Strategic']
    return titles.map((t, i) => {
      const r = ((seed * (i + 7)) % 997) / 997
      const likelihood = 1 + Math.floor(r * 4)
      const impact = 1 + Math.floor(((seed * (i + 13)) % 997) / 997 * 4)
      const inherent = likelihood * impact
      const residual = Math.max(1, inherent - 2)
      const statusList: Array<'Open' | 'Treating' | 'Monitoring' | 'Closed'> = ['Open', 'Treating', 'Monitoring', 'Closed']
      const status = statusList[Math.min(3, Math.floor(r * 4))]
      return {
        id: `RSK-${(2200 + i).toString()}`,
        title: t,
        category: categories[i],
        owner: owners[i],
        treatment: treatments[i],
        rType: rTypes[i % rTypes.length],
        likelihood,
        impact,
        inherent,
        residual,
        status,
      }
    })
  }, [k])

  const catDonut = [
    { name: 'Environmental', value: Math.max(0.1, risks.filter(r => r.category === 'Environmental').length), color: EMERALD_DEEP },
    { name: 'Social', value: Math.max(0.1, risks.filter(r => r.category === 'Social').length), color: TEAL_PRIMARY },
    { name: 'Governance', value: Math.max(0.1, risks.filter(r => r.category === 'Governance').length), color: TEAL_DEEP },
  ]
  const open = risks.filter(r => r.status === 'Open' || r.status === 'Treating').length
  const highInherent = risks.filter(r => r.inherent >= 12).length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={AlertTriangle}
        title="Material ESG Risks"
        subtitle={`${risks.length} risks · ${open} open · ${highInherent} high inherent`}
        completionPct={k.completion}
        badge={{ label: `${open} open`, tone: open > 3 ? 'status-warning' : 'status-approved', icon: AlertTriangle }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTile index={1} icon={AlertTriangle} label="Total Risks" value={formatNumber(risks.length, 0)} unit="tracked" trend={{ dir: 'up', text: `${risks.length}` }} />
        <EsgKpiTile index={2} icon={Flame} label="High Inherent" value={formatNumber(highInherent, 0)} unit="score ≥ 12" trend={{ dir: highInherent > 0 ? 'up' : 'neutral', text: highInherent > 0 ? `${highInherent}` : '0' }} alert={highInherent > 2} />
        <EsgKpiTile index={3} icon={Clock} label="Treating" value={formatNumber(risks.filter(r => r.status === 'Treating').length, 0)} unit="in progress" trend={{ dir: 'up', text: 'active' }} />
        <EsgKpiTile index={4} icon={CircleCheck} label="Closed" value={formatNumber(risks.filter(r => r.status === 'Closed').length, 0)} unit="resolved" trend={{ dir: 'up', text: 'good' }} />
      </div>

      <SectionCard
        icon={Crosshair}
        title="Risk Register"
        subtitle="Inherent × Likelihood × Impact · residual after treatment"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-teal-700 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-[460px] overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(204,251,241,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Risk</th>
                <th className="px-3 py-2 text-left font-semibold">Category</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-right font-semibold">Inherent</th>
                <th className="px-3 py-2 text-right font-semibold">Residual</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => {
                const catColor = r.category === 'Environmental' ? EMERALD_DEEP : r.category === 'Social' ? TEAL_PRIMARY : TEAL_DEEP
                const inhColor = r.inherent >= 12 ? '#dc2626' : r.inherent >= 8 ? '#f59e0b' : EMERALD_PRIMARY
                return (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-teal-50/40 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{r.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{r.title}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{ background: `${catColor}1a`, color: catColor, borderColor: `${catColor}33` }}>
                        {r.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{r.owner}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="status-pill text-[9px]" style={{ background: `${inhColor}1a`, color: inhColor, borderColor: `${inhColor}33` }}>
                        {r.inherent}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{r.residual}</td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${r.status === 'Closed' ? 'status-approved' : r.status === 'Treating' ? 'status-warning' : r.status === 'Open' ? 'status-missing' : 'status-review'}`}>
                        {r.status.toLowerCase()}
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title="Risks by ESG Category"
          subtitle="Distribution across E/S/G pillars"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catDonut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}>
                  {catDonut.map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} risks`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{risks.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Risks</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Risk Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 5 — Targets & Progress (esg-targets)
 * ============================================================ */
function TargetsScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const targets = useMemo(() => ([
    { id: 'TGT-001', name: 'Reduce Scope 1+2 emissions', baseline: 100, target: -42, actual: k.totalEmissions > 0 ? -8.2 : 0, unit: '% by FY30', icon: Leaf, color: EMERALD_DEEP, due: '2030-03-31' },
    { id: 'TGT-002', name: 'Increase renewable energy share', baseline: 0, target: 50, actual: k.renewableShare, unit: '% by FY28', icon: Zap, color: TEAL_PRIMARY, due: '2028-03-31' },
    { id: 'TGT-003', name: 'Water recycling rate', baseline: 0, target: 35, actual: k.waterRecycledShare, unit: '% by FY27', icon: Droplets, color: TEAL_DEEP, due: '2027-03-31' },
    { id: 'TGT-004', name: 'Waste diversion from landfill', baseline: 0, target: 95, actual: k.wasteRecycledShare, unit: '% by FY28', icon: Trash2, color: EMERALD_PRIMARY, due: '2028-03-31' },
    { id: 'TGT-005', name: 'Female workforce representation', baseline: 0, target: 25, actual: k.femaleShare, unit: '% by FY30', icon: Users, color: EMERALD_DEEP, due: '2030-03-31' },
    { id: 'TGT-006', name: 'Zero fatalities (Safety First)', baseline: 1, target: 0, actual: k.fatalities, unit: 'fatalities', icon: ShieldCheck, color: '#dc2626', due: '2026-03-31' },
    { id: 'TGT-007', name: 'BRSR readiness', baseline: 0, target: 100, actual: k.brsrReadiness, unit: '% by FY26', icon: FileText, color: TEAL_DEEP, due: '2026-03-31' },
    { id: 'TGT-008', name: 'Training hours per employee', baseline: 0, target: 16, actual: k.trainingHours / Math.max(k.totalWorkforce, 1), unit: 'h/yr by FY27', icon: ActivityIcon, color: TEAL_PRIMARY, due: '2027-03-31' },
  ]), [k])

  const onTrack = targets.filter(t => t.actual >= t.target * 0.85).length
  const atRisk = targets.length - onTrack
  const avgProgress = targets.reduce((s, t) => s + Math.min(100, (t.actual / Math.max(1, t.target)) * 100), 0) / targets.length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Target}
        title="Targets & Progress"
        subtitle={`${targets.length} enterprise targets · ${onTrack} on track · ${avgProgress.toFixed(0)}% avg progress`}
        completionPct={k.completion}
        badge={{ label: `${onTrack} on track`, tone: 'status-approved', icon: CircleCheck }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTile index={1} icon={Target} label="Total Targets" value={formatNumber(targets.length, 0)} unit="active" trend={{ dir: 'up', text: `${targets.length}` }} />
        <EsgKpiTile index={2} icon={CircleCheck} label="On Track" value={formatNumber(onTrack, 0)} unit="≥ 85%" trend={{ dir: 'up', text: 'good' }} />
        <EsgKpiTile index={3} icon={AlertTriangle} label="At Risk" value={formatNumber(atRisk, 0)} unit="< 85%" trend={{ dir: atRisk > 0 ? 'up' : 'down', text: atRisk > 0 ? `${atRisk}` : '0' }} alert={atRisk > 2} />
        <EsgKpiTile index={4} icon={Gauge} label="Avg Progress" value={`${avgProgress.toFixed(0)}`} unit="%" trend={{ dir: avgProgress >= 75 ? 'up' : 'down', text: avgProgress >= 75 ? 'good' : 'low' }} />
      </div>

      <SectionCard
        icon={Crosshair}
        title="Target vs Actual"
        subtitle="Progress bars comparing actual against target"
        index={5}
      >
        <div className="space-y-3 max-h-[460px] overflow-y-auto scroll-elegant pr-1">
          {targets.map((t, i) => {
            const pct = Math.min(100, (t.actual / Math.max(1, t.target)) * 100)
            const isOnTrack = pct >= 85
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                      style={{ background: `${t.color}1a`, color: t.color, border: `1px solid ${t.color}33` }}
                    >
                      <t.icon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="text-[12px] font-semibold text-slate-900">{t.name}</div>
                      <div className="text-[9px] text-slate-700 mt-0.5">{t.id} · target {t.target}{t.unit} · due {new Date(t.due).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-bold text-slate-900 tabular-nums">{t.actual.toFixed(1)}<span className="text-slate-500 text-[10px] ml-0.5">/ {t.target}</span></div>
                    <div className={`status-pill text-[9px] ${isOnTrack ? 'status-approved' : pct >= 60 ? 'status-warning' : 'status-missing'}`}>
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.04, ease: [0.22, 1, 0.36, 1] as const }}
                    style={{
                      background: `linear-gradient(90deg, ${t.color}, ${TEAL_PRIMARY})`,
                      boxShadow: `0 0 8px -1px ${t.color}80`,
                    }}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={BarChart3}
          title="Target Progress Heatmap"
          subtitle="Actual vs target across all goals"
          index={6}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={targets.map(t => ({ name: t.id.replace('TGT-', 'T'), actual: t.actual, target: t.target }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                barCategoryGap="22%"
              >
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(20,184,166,0.06)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Bar dataKey="target" fill="#cbd5e1" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} />
                <Bar dataKey="actual" fill={TEAL_PRIMARY} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Targets Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 6 — Cross-Functional (esg-crossfunc)
 * ============================================================ */
function CrossFuncScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const departments = useMemo(() => {
    const seed = (k.totalEmissions + k.totalWorkforce + k.brsrReadiness) || 1
    const names = [
      { name: 'Environment (EHS)', icon: Leaf, color: EMERALD_DEEP },
      { name: 'Human Resources', icon: Users, color: TEAL_PRIMARY },
      { name: 'Procurement', icon: Briefcase, color: TEAL_DEEP },
      { name: 'Finance & Accounts', icon: Wallet, color: EMERALD_PRIMARY },
      { name: 'Operations', icon: Factory, color: EMERALD_DEEP },
      { name: 'Legal & Compliance', icon: Scale, color: TEAL_DEEP },
      { name: 'Projects & Sites', icon: Building2, color: TEAL_PRIMARY },
      { name: 'Sustainability / ESG', icon: Globe2, color: EMERALD_PRIMARY },
      { name: 'IT & Systems', icon: Network, color: TEAL_DEEP },
      { name: 'Corporate Affairs', icon: ShieldQuestion, color: EMERALD_DEEP },
    ]
    const statuses: Array<'On Track' | 'In Progress' | 'At Risk' | 'Delayed'> = ['On Track', 'In Progress', 'At Risk', 'Delayed']
    return names.map((d, i) => {
      const r = ((seed * (i + 7)) % 997) / 997
      const submissions = 4 + Math.floor(r * 12)
      const approved = Math.min(submissions, 1 + Math.floor(r * (submissions - 1)))
      const completion = Math.round((approved / Math.max(1, submissions)) * 100)
      const status = completion >= 90 ? 'On Track' : completion >= 75 ? 'In Progress' : completion >= 50 ? 'At Risk' : 'Delayed'
      return {
        name: d.name,
        icon: d.icon,
        color: d.color,
        submissions,
        approved,
        completion,
        status: status as 'On Track' | 'In Progress' | 'At Risk' | 'Delayed',
        lead: ['R. Iyer', 'A. Nair', 'P. Sharma', 'S. Reddy', 'M. Patil', 'K. Rao', 'V. Menon', 'N. Gupta', 'T. Bose', 'L. Deshpande'][i],
      }
    })
  }, [k])

  const totalSubs = departments.reduce((s, d) => s + d.submissions, 0)
  const totalApproved = departments.reduce((s, d) => s + d.approved, 0)
  const onTrack = departments.filter(d => d.status === 'On Track').length
  const atRisk = departments.filter(d => d.status === 'At Risk' || d.status === 'Delayed').length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Network}
        title="Cross-Functional Status"
        subtitle={`${departments.length} departments · ${totalApproved}/${totalSubs} submissions approved`}
        completionPct={k.completion}
        badge={{ label: `${onTrack} on track`, tone: 'status-approved', icon: CircleCheck }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EsgKpiTile index={1} icon={Building2} label="Departments" value={formatNumber(departments.length, 0)} unit="active" trend={{ dir: 'up', text: 'all' }} />
        <EsgKpiTile index={2} icon={FileText} label="Submissions" value={formatNumber(totalSubs, 0)} unit="cross" trend={{ dir: 'up', text: `${totalSubs}` }} />
        <EsgKpiTile index={3} icon={CircleCheck} label="Approved" value={formatNumber(totalApproved, 0)} unit="closed" trend={{ dir: 'up', text: `${(totalApproved / Math.max(1, totalSubs) * 100).toFixed(0)}%` }} />
        <EsgKpiTile index={4} icon={AlertTriangle} label="At Risk Depts" value={formatNumber(atRisk, 0)} unit="delayed" trend={{ dir: atRisk > 0 ? 'up' : 'down', text: atRisk > 0 ? `${atRisk}` : '0' }} alert={atRisk > 2} />
      </div>

      <SectionCard
        icon={Workflow}
        title="Department Status Grid"
        subtitle="Per-department ESG data contribution & completion"
        index={5}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto scroll-elegant pr-1">
          {departments.map((d, i) => {
            const statusColor = d.status === 'On Track' ? EMERALD_PRIMARY : d.status === 'In Progress' ? TEAL_PRIMARY : d.status === 'At Risk' ? '#f59e0b' : '#dc2626'
            return (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: `${d.color}1a`, color: d.color, border: `1px solid ${d.color}33` }}
                  >
                    <d.icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-slate-900 truncate">{d.name}</div>
                    <div className="text-[9px] text-slate-700">Lead: {d.lead}</div>
                  </div>
                  <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
                    {d.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="text-center glass-subtle rounded-lg py-1.5">
                    <div className="text-[9px] uppercase tracking-wide text-slate-700">Subs</div>
                    <div className="text-[13px] font-bold text-slate-900 tabular-nums">{d.submissions}</div>
                  </div>
                  <div className="text-center glass-subtle rounded-lg py-1.5">
                    <div className="text-[9px] uppercase tracking-wide text-slate-700">Approved</div>
                    <div className="text-[13px] font-bold text-slate-900 tabular-nums">{d.approved}</div>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${d.completion}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.04, ease: [0.22, 1, 0.36, 1] as const }}
                    style={{
                      background: `linear-gradient(90deg, ${d.color}, ${TEAL_PRIMARY})`,
                      boxShadow: `0 0 6px -1px ${d.color}80`,
                    }}
                  />
                </div>
                <div className="text-right text-[10px] font-semibold text-slate-900 tabular-nums mt-1">{d.completion}%</div>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={BarChart3}
          title="Department Completion"
          subtitle="Submissions approved vs total"
          index={6}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={departments.map(d => ({ name: d.name.split(' ')[0], approved: d.approved, total: d.submissions }))}
                layout="vertical"
                margin={{ top: 4, right: 8, bottom: 0, left: 60 }}
                barCategoryGap="18%"
              >
                <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(20,184,166,0.06)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Bar dataKey="total" fill="#cbd5e1" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={600} />
                <Bar dataKey="approved" fill={TEAL_PRIMARY} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Cross-Functional Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function EsgManagerWorkspace() {
  const { activeModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
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
      setActivityLoading(true)
      const res = await fetch('/api/activity?take=10', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ActivityResponse
      if (!mountedRef.current) return
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isEsgManagerActivity).slice(0, 6)
      setActivities(filtered)
    } catch {
      /* silent — keep existing feed on poll error */
    } finally {
      if (mountedRef.current) setActivityLoading(false)
    }
  }, [])

  /* ---- initial load ---- */
  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchActivities()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [fetchOverview, fetchActivities])

  /* ---- polling: activity every 30s, overview every 60s ---- */
  useEffect(() => {
    const activityTimer = setInterval(fetchActivities, 30_000)
    const overviewTimer = setInterval(fetchOverview, 60_000)
    return () => {
      clearInterval(activityTimer)
      clearInterval(overviewTimer)
    }
  }, [fetchActivities, fetchOverview])

  const k = useMemo<Kpis | null>(() => {
    if (!overview?.kpis) return null
    return overview.kpis
  }, [overview])

  const trends = useMemo<Record<string, Record<string, number>> | undefined>(() => {
    const t = overview?.trends as Record<string, Record<string, number>> | undefined
    return t && typeof t === 'object' ? t : undefined
  }, [overview])

  const periods = overview?.periods

  // ---- Loading skeleton ----
  if (loading && !overview) {
    return <WorkspaceSkeleton tiles={4} />
  }

  // ---- Error state ----
  if (error && !overview) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />
  }

  // ---- Empty state ----
  if (!overview || !k) {
    return (
      <EmptyState
        icon={Gauge}
        title="No ESG data yet"
        subtitle="Set up a reporting period to populate the ESG manager workspace."
      />
    )
  }

  // ---- Dispatch by module ----
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeModule}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
      >
        {activeModule === 'esg-kpi' && (
          <KpiManagementScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'esg-performance' && (
          <PerformanceScreen k={k} trends={trends} periods={periods} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'esg-completeness' && (
          <CompletenessScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'esg-risks' && (
          <RisksScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'esg-targets' && (
          <TargetsScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'esg-crossfunc' && (
          <CrossFuncScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
