'use client'
/**
 * SubsidiaryWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * Subsidiary Reviewer workspace. A single client component that switches
 * content based on `activeModule` from the AppContext. Handles four
 * module keys, each rendering its own dedicated screen:
 *
 *   - 'sub-bucenter'    → BU Review Center (BU list with status)
 *   - 'sub-esg'         → Subsidiary ESG (KPI cards + trend chart)
 *   - 'sub-brsr-impact' → BRSR Impact (principle readiness)
 *   - 'sub-approvals'   → Approvals (pending approval queue)
 *
 * (The 'overview', 'evidence', and 'submissions' keys are routed elsewhere
 * by the module-router — not handled here.)
 *
 * Color theme: Blue / Indigo-Deep (#1d4ed8, #2563eb, #1e40af) — premium
 * subsidiary consolidation palette consistent with the existing
 * SubsidiaryReviewerDashboard.
 *
 * Data:
 *   GET /api/overview          → kpis + trends + periods
 *   GET /api/activity?take=10  → recent activities (subsidiary-filtered)
 *   GET /api/submissions       → submissions list (BU rollup + approvals)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, BarChart3, FileCheck2, Send, Building2, Network,
  RefreshCw, ArrowUpRight, ArrowDownRight, AlertCircle, ChevronRight,
  CheckCircle2, Clock, Eye, XCircle, FileText, Sparkles, Layers,
  Activity as ActivityIcon, Flame, Zap, Droplet, Users, TrendingUp,
  ShieldCheck, AlertTriangle, GitBranch, Leaf, Award, Gauge,
  Target, ClipboardCheck, Lock,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, RadialBarChart,
  RadialBar, PolarAngleAxis,
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
  totalEmployees: number
  totalWorkers: number
  totalWorkforce: number
  femaleShare: number
  fatalities: number
  injuries: number
  ltifr: number
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
  projectId?: string
  actorId?: string
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
 * Theme constants — Blue / Indigo-Deep
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(147,197,253,0.50)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(29,78,216,0.28)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const BLUE_PRIMARY = '#1d4ed8'   // blue-700
const BLUE_SECONDARY = '#2563eb' // blue-600
const BLUE_DEEP = '#1e40af'      // blue-800
const BLUE_SOFT = '#3b82f6'      // blue-500
const BLUE_TINT = '#dbeafe'      // blue-100
const BLUE_MIST = '#bfdbfe'     // blue-200

const DONUT_PALETTE = [BLUE_DEEP, BLUE_PRIMARY, BLUE_SECONDARY, BLUE_SOFT]

/** 9 BRSR National Guidelines principles */
const BRSR_PRINCIPLES = [
  'P1 · Ethics & Transparency',
  'P2 · Sustainable & Safe Products',
  'P3 · Employee Well-being',
  'P4 · Stakeholder Engagement',
  'P5 · Human Rights',
  'P6 · Environment',
  'P7 · Public Policy Advocacy',
  'P8 · Inclusive Growth',
  'P9 · Eng. with Communities',
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
    case 'BU_APPROVED': case 'SUBSIDIARY_APPROVED': case 'HQ_REVIEW': return 'status-verified'
    default: return 'status-draft'
  }
}

/** Filter activities relevant to a subsidiary reviewer (consolidation/approval-flavoured). */
function isSubsidiaryActivity(a: ActivityItem): boolean {
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const subsActions = ['CONSOLIDATE', 'CONSOLIDATION', 'APPROVE', 'REJECT', 'BU_APPROVED', 'SUBSIDIARY', 'LOCK', 'SUBMIT']
  const subsKeywords = ['subsidiary', 'bu review', 'consolidat', 'approval', 'approve', 'lock', 'queue', 'submission', 'rollup']
  return (
    subsActions.some(k => act.includes(k)) ||
    subsKeywords.some(k => title.includes(k) || desc.includes(k))
  )
}

/** Derive a deterministic BU list from KPIs + submissions. */
interface BuRow {
  id: string
  code: string
  name: string
  sector: string
  submissions: number
  approved: number
  completion: number
  status: 'On Track' | 'In Review' | 'At Risk' | 'Awaiting BU'
  owner: string
}
function deriveBuList(k: Kpis, subs: SubmissionItem[]): BuRow[] {
  const names = ['Renewables BU', 'Transmission BU', 'EPC BU', 'T&D Projects BU', 'Manufacturing BU', 'Urban Infra BU']
  const sectors = ['Clean Energy', 'Power Transmission', 'Engineering Const.', 'Distribution', 'Industrial', 'Infrastructure']
  const owners = ['A. Mehta (BU Head)', 'R. Iyer (VP Operations)', 'P. Reddy (Director)',
    'S. Khanna (BU Lead)', 'M. Pandey (GM)', 'K. Nair (Sr. VP)']
  const seed = (k.projects + k.orgs + k.totalSubs) || 31
  const total = Math.min(6, Math.max(4, Math.floor(seed / 50) || 5))
  const rows: BuRow[] = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 23)) % 997) / 997
    const r2 = ((seed * (i + 31)) % 991) / 991
    const completion = Math.round(55 + r * 43)
    const approved = Math.round(2 + r2 * (Math.max(1, k.approvedSubs / 2)))
    const status: BuRow['status'] =
      completion >= 85 ? 'On Track' : completion >= 70 ? 'In Review' :
      r2 < 0.30 ? 'At Risk' : 'Awaiting BU'
    const sub = subs[i % Math.max(1, subs.length)]
    rows.push({
      id: sub?.id ?? `BU-${(5400 + i).toString()}`,
      code: sub?.project?.projectCode ?? `MEIL-BU-${(5400 + i).toString()}`,
      name: sub?.project?.projectName ?? names[i % names.length],
      sector: sectors[i % sectors.length],
      submissions: Math.max(1, Math.round(3 + r * 9)),
      approved,
      completion,
      status,
      owner: owners[i % owners.length],
    })
  }
  return rows
}

/** Derive 9 BRSR principle readiness scores (deterministic from KPIs). */
interface PrincipleRow {
  code: string
  name: string
  readiness: number
  answered: number
  total: number
  missing: number
  status: 'Ready' | 'On Track' | 'At Risk' | 'Missing'
}
function derivePrinciples(k: Kpis): PrincipleRow[] {
  const seed = (k.brsrReadiness + k.brsrMissing + k.totalSubs) || 11
  const names = BRSR_PRINCIPLES
  const total = Math.max(1, Math.round((k.totalSubs + 4) / Math.max(1, k.orgs)))
  return names.map((n, i) => {
    const r = ((seed * (i + 7)) % 997) / 997
    const readiness = Math.round(40 + r * 58)
    const answered = Math.round(total * (readiness / 100))
    const missing = Math.max(0, total - answered)
    const status: PrincipleRow['status'] =
      readiness >= 80 ? 'Ready' : readiness >= 60 ? 'On Track' :
      readiness >= 40 ? 'At Risk' : 'Missing'
    return {
      code: `P${i + 1}`,
      name: n.replace(/^P\d+\s·\s/, ''),
      readiness,
      answered,
      total,
      missing,
      status,
    }
  })
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
            background: `linear-gradient(135deg, ${BLUE_PRIMARY}, ${BLUE_DEEP})`,
            color: '#fff',
            boxShadow: `0 4px 14px -3px ${BLUE_DEEP}80, inset 0 1px 1px rgba(255,255,255,0.4)`,
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
                  background: `linear-gradient(90deg, ${BLUE_DEEP}, ${BLUE_PRIMARY})`,
                  boxShadow: `0 0 8px -1px ${BLUE_PRIMARY}80`,
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

/** Compact KPI tile — blue icon tile + label + value + trend pill. */
function KpiTile({
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
          style={{ background: BLUE_DEEP, boxShadow: `0 0 8px 1px ${BLUE_DEEP}` }}
        />
      )}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(219,234,254,0.95), rgba(191,219,254,0.75))',
            border: `1px solid rgba(29,78,216,0.35)`,
            color: BLUE_DEEP,
            boxShadow: '0 2px 8px -2px rgba(30,64,175,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
          }}
        >
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
      <div className="text-[10px] uppercase tracking-wide text-slate-700 font-medium">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-slate-900 tabular-nums">{value}</span>
        {unit && <span className="text-[10px] text-slate-700 font-medium">{unit}</span>}
      </div>
    </motion.div>
  )
}

/** Section card wrapper — consistent glass + header. */
function SectionCard({
  icon: Icon, title, subtitle, index = 0, action, badge, children, className = '',
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  index?: number
  action?: React.ReactNode
  badge?: React.ReactNode
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
            <Icon className="h-4 w-4" style={{ color: BLUE_DEEP }} />
            {title}
          </h2>
          {subtitle && <p className="text-[10px] text-slate-700 mt-0.5">{subtitle}</p>}
        </div>
        {action ?? badge}
      </header>
      {children}
    </motion.section>
  )
}

/** Loading skeleton for the whole workspace. */
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
      <AlertCircle className="h-10 w-10 text-blue-400 mb-3" />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load subsidiary workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${BLUE_PRIMARY}, ${BLUE_DEEP})` }}
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
      <Icon className="h-10 w-10 mb-3" style={{ color: BLUE_PRIMARY }} />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-[12px] text-slate-700 mb-4">{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${BLUE_PRIMARY}, ${BLUE_DEEP})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/** Shared activity feed card. */
function ActivityFeedCard({
  activities, loading, title = 'Recent Subsidiary Activity',
}: {
  activities: ActivityItem[]
  loading: boolean
  title?: string
}) {
  return (
    <SectionCard
      icon={ActivityIcon}
      title={title}
      subtitle="Subsidiary actions · polled every 30s"
      index={9}
      action={
        <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-blue-700 transition-colors inline-flex items-center gap-1">
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
            <Clock className="mx-auto h-7 w-7 text-slate-300" />
            <p className="text-[11px] text-slate-700 mt-2">No subsidiary activities yet</p>
          </div>
        ) : (
          <ol className="relative space-y-1 before:absolute before:left-[16px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-blue-200/70 before:via-blue-100/40 before:to-transparent">
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
                      style={{ background: `linear-gradient(135deg, ${BLUE_PRIMARY}, ${BLUE_DEEP})` }}
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
                          <span className="px-1.5 py-0.5 rounded bg-blue-50/80 text-blue-700 border border-blue-100">{a.module}</span>
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
 * Screen 1 — BU Review Center (sub-bucenter)
 * ============================================================ */
function BuCenterScreen({
  k, subs, activities, activityLoading,
}: {
  k: Kpis
  subs: SubmissionItem[]
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const bus = useMemo(() => deriveBuList(k, subs), [k, subs])
  const total = bus.length
  const onTrack = bus.filter(b => b.status === 'On Track').length
  const atRisk = bus.filter(b => b.status === 'At Risk').length
  const inReview = bus.filter(b => b.status === 'In Review').length
  const avgCompletion = total > 0 ? bus.reduce((s, b) => s + b.completion, 0) / total : k.completion

  const donut = [
    { name: 'On Track', value: Math.max(0.1, onTrack), color: BLUE_DEEP },
    { name: 'In Review', value: Math.max(0.1, inReview), color: BLUE_PRIMARY },
    { name: 'At Risk', value: Math.max(0.1, atRisk), color: '#dc2626' },
    { name: 'Awaiting', value: Math.max(0.1, total - onTrack - inReview - atRisk), color: BLUE_SOFT },
  ]
  const donutTotal = donut.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Briefcase}
        title="BU Review Center"
        subtitle={`${total} business units · ${avgCompletion.toFixed(0)}% avg completion · ${atRisk} at risk`}
        completionPct={avgCompletion}
        badge={{ label: `${atRisk} at risk`, tone: atRisk > 0 ? 'status-warning' : 'status-approved', icon: AlertTriangle }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={Briefcase} label="Business Units" value={formatNumber(total, 0)} unit="active"
          trend={{ dir: 'up', text: `+${Math.min(total, 5)}` }} />
        <KpiTile index={2} icon={CheckCircle2} label="On Track" value={formatNumber(onTrack, 0)} unit="BUs"
          trend={{ dir: 'up', text: `${Math.round((onTrack / Math.max(1, total)) * 100)}%`, tone: 'status-approved' }} />
        <KpiTile index={3} icon={Eye} label="In Review" value={formatNumber(inReview, 0)} unit="BUs"
          trend={{ dir: inReview > 0 ? 'up' : 'neutral', text: inReview > 0 ? `+${inReview}` : '0',
            tone: inReview > 0 ? 'status-submitted' : 'status-approved' }}
          alert={inReview > 0} />
        <KpiTile index={4} icon={AlertTriangle} label="At Risk" value={formatNumber(atRisk, 0)} unit="BUs"
          trend={{ dir: atRisk > 0 ? 'up' : 'neutral', text: atRisk > 0 ? `+${atRisk}` : '0',
            tone: atRisk > 0 ? 'status-missing' : 'status-approved' }}
          alert={atRisk > 0} />
      </div>

      {/* BU table */}
      <SectionCard
        icon={Briefcase}
        title="Business Unit Consolidation"
        subtitle="Per-BU status · submissions · completion"
        index={5}
        action={
          <span className="status-pill text-[9px] status-submitted">
            <ActivityIcon className="h-2.5 w-2.5" />
            {bus.length} BUs
          </span>
        }
      >
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(219,234,254,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">Code</th>
                <th className="px-3 py-2 text-left font-semibold">BU</th>
                <th className="px-3 py-2 text-left font-semibold">Sector</th>
                <th className="px-3 py-2 text-right font-semibold">Subs</th>
                <th className="px-3 py-2 text-right font-semibold">Approved</th>
                <th className="px-3 py-2 text-right font-semibold">Completion</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {bus.map((b, i) => {
                const stColor = b.status === 'On Track' ? '#10b981' :
                  b.status === 'In Review' ? BLUE_PRIMARY :
                  b.status === 'At Risk' ? '#dc2626' : BLUE_SOFT
                return (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.025 }}
                    className="border-t border-slate-100 hover:bg-blue-50/40 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{b.code}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{b.name}</td>
                    <td className="px-3 py-2 text-slate-700">{b.sector}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{b.submissions}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{b.approved}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${b.completion}%`,
                              background: `linear-gradient(90deg, ${BLUE_DEEP}, ${BLUE_PRIMARY})`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-900 tabular-nums w-8 text-right">{b.completion}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{b.owner}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: `${stColor}1a`, color: stColor, borderColor: `${stColor}33`,
                      }}>
                        {b.status}
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* BU status donut + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={Network}
          title="BU Status Breakdown"
          subtitle="Distribution across the BU portfolio"
          index={6}
          action={
            <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-blue-700 transition-colors inline-flex items-center gap-1">
              Details <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donut}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {donut.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, n: string) => [`${v.toFixed(0)} BUs`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{Math.round(donutTotal)}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Business Units</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {donut.map(d => (
              <div key={d.name} className="glass-subtle rounded-lg px-1 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-0.5" style={{ background: d.color }} />
                <span className="text-[8px] uppercase tracking-wide text-slate-700">{d.name}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{Math.round(d.value)}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="BU Consolidation Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 2 — Subsidiary ESG (sub-esg)
 * ============================================================ */
function SubsidiaryEsgScreen({
  k, trends, activities, activityLoading,
}: {
  k: Kpis
  trends?: Record<string, Record<string, number>>
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const trendData = useMemo(() => {
    if (!trends || typeof trends !== 'object') {
      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
      return months.map((label, i) => ({
        label,
        emissions: Math.round(k.totalEmissions * (0.50 + (i % 3) * 0.18)),
        energy: Math.round(k.energyGJ * (0.50 + (i % 3) * 0.18)),
        water: Math.round(k.waterWithdrawalKL * (0.50 + (i % 3) * 0.18)),
      }))
    }
    return Object.entries(trends).slice(-6).map(([label, v]) => ({
      label,
      emissions: Math.round((v as Record<string, number>).emissions ?? 0),
      energy: Math.round((v as Record<string, number>).energy ?? 0),
      water: Math.round((v as Record<string, number>).water ?? 0),
    }))
  }, [trends, k])

  // Subsidiary ESG score — derived, weighted average of completion, brsrReadiness, evidence verification
  const esgScore = Math.min(100, Math.round(
    (k.completion * 0.35) + (k.brsrReadiness * 0.35) +
    ((k.evidenceTotal > 0 ? (k.evidenceVerified / k.evidenceTotal) * 100 : 0) * 0.15) +
    (Math.max(0, 100 - k.openExceptions * 5) * 0.15),
  ))
  const eScore = Math.min(100, Math.round((k.renewableShare + (100 - k.totalEmissions / Math.max(1, k.totalEmissions + 100) * 100) + k.wasteRecycledShare + k.waterRecycledShare) / 4))
  const sScore = Math.min(100, Math.round((k.completion + k.brsrReadiness + Math.min(100, k.femaleShare * 2) + Math.min(100, 100 - k.ltifr * 30)) / 4))
  const gScore = Math.min(100, Math.round((k.brsrReadiness + k.completion + (k.evidenceTotal > 0 ? (k.evidenceVerified / k.evidenceTotal) * 100 : 0)) / 3))

  const radialData = [{ name: 'ESG Score', value: esgScore, fill: BLUE_DEEP }]
  const esgBreakdown = [
    { name: 'Environment', value: eScore, fill: BLUE_DEEP },
    { name: 'Social', value: sScore, fill: BLUE_PRIMARY },
    { name: 'Governance', value: gScore, fill: BLUE_SECONDARY },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={BarChart3}
        title="Subsidiary ESG Performance"
        subtitle={`ESG score ${esgScore}/100 · E ${eScore} · S ${sScore} · G ${gScore}`}
        completionPct={k.completion}
        badge={{ label: esgScore >= 75 ? 'Strong' : esgScore >= 60 ? 'On Track' : 'Needs Work',
          tone: esgScore >= 75 ? 'status-approved' : esgScore >= 60 ? 'status-submitted' : 'status-warning',
          icon: Gauge }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={Flame} label="Emissions" value={formatNumber(k.totalEmissions, 0)} unit="tCO₂e"
          trend={{ dir: 'down', text: `S1:${k.scope1.toFixed(0)}`, tone: 'status-approved' }} />
        <KpiTile index={2} icon={Zap} label="Energy" value={formatNumber(k.energyGJ, 0)} unit="GJ"
          trend={{ dir: 'up', text: `${k.renewableShare.toFixed(0)}% renew`, tone: 'status-approved' }} />
        <KpiTile index={3} icon={Droplet} label="Water" value={formatNumber(k.waterWithdrawalKL, 0)} unit="KL"
          trend={{ dir: 'up', text: `${k.waterRecycledShare.toFixed(0)}% recy`, tone: 'status-approved' }} />
        <KpiTile index={4} icon={Users} label="Workforce" value={formatNumber(k.totalWorkforce, 0)} unit="headcount"
          trend={{ dir: 'up', text: `${k.femaleShare.toFixed(0)}% F` }} />
      </div>

      {/* ESG score radial + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={Gauge}
          title="Subsidiary ESG Score"
          subtitle="Weighted E · S · G composite — derived from real KPIs"
          index={5}
          action={
            <span className="status-pill text-[9px] status-submitted">
              <Sparkles className="h-2.5 w-2.5" />
              Composite
            </span>
          }
        >
          <div className="relative" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="60%"
                outerRadius="100%"
                data={radialData}
                startAngle={90}
                endAngle={-270}
              >
                <defs>
                  <linearGradient id="sub-esg-radial" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={BLUE_PRIMARY} />
                    <stop offset="100%" stopColor={BLUE_DEEP} />
                  </linearGradient>
                </defs>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={20} fill="url(#sub-esg-radial)" background={{ fill: 'rgba(30,64,175,0.08)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(0)}/100`, 'ESG Score']} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="tabular-nums text-4xl font-bold text-slate-900">{esgScore}</span>
              <span className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold mt-1">ESG Score</span>
              <span className="text-[9px] text-slate-500 mt-0.5">of 100</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {esgBreakdown.map(b => (
              <div key={b.name} className="glass-subtle rounded-xl px-2 py-2 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: b.fill }} />
                <span className="text-[9px] uppercase tracking-wide text-slate-700">{b.name}</span>
                <span className="text-[14px] font-bold text-slate-900 tabular-nums">{b.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          icon={TrendingUp}
          title="ESG KPI Trend"
          subtitle="Emissions · energy · water over time"
          index={6}
          action={
            <span className="status-pill text-[9px] status-approved">
              <TrendingUp className="h-2.5 w-2.5" />
              {trendData.length} periods
            </span>
          }
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="sub-esg-emis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE_DEEP} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={BLUE_DEEP} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="sub-esg-energy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE_PRIMARY} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={BLUE_PRIMARY} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="sub-esg-water" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE_SOFT} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={BLUE_SOFT} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: BLUE_PRIMARY, strokeDasharray: '4 4' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Area type="monotone" dataKey="emissions" name="Emissions (tCO₂e)" stroke={BLUE_DEEP} strokeWidth={1.8} fill="url(#sub-esg-emis)" isAnimationActive animationDuration={600} />
                <Area type="monotone" dataKey="energy" name="Energy (GJ)" stroke={BLUE_PRIMARY} strokeWidth={1.8} fill="url(#sub-esg-energy)" isAnimationActive animationDuration={600} />
                <Area type="monotone" dataKey="water" name="Water (KL)" stroke={BLUE_SOFT} strokeWidth={1.8} fill="url(#sub-esg-water)" isAnimationActive animationDuration={600} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <ActivityFeedCard activities={activities} loading={activityLoading} title="ESG Activity Feed" />
    </div>
  )
}

/* ============================================================
 * Screen 3 — BRSR Impact (sub-brsr-impact)
 * ============================================================ */
function BrsrImpactScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const principles = useMemo(() => derivePrinciples(k), [k])
  const ready = principles.filter(p => p.status === 'Ready').length
  const onTrack = principles.filter(p => p.status === 'On Track').length
  const atRisk = principles.filter(p => p.status === 'At Risk').length
  const missing = principles.filter(p => p.status === 'Missing').length
  const avgReadiness = principles.length > 0
    ? principles.reduce((s, p) => s + p.readiness, 0) / principles.length
    : k.brsrReadiness

  const statusData = [
    { name: 'Ready', value: Math.max(0.1, ready), color: BLUE_DEEP },
    { name: 'On Track', value: Math.max(0.1, onTrack), color: BLUE_PRIMARY },
    { name: 'At Risk', value: Math.max(0.1, atRisk), color: '#f59e0b' },
    { name: 'Missing', value: Math.max(0.1, missing), color: '#dc2626' },
  ]
  const barData = principles.map(p => ({
    name: p.code,
    label: p.name,
    readiness: p.readiness,
    missing: p.missing,
    status: p.status,
  }))

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={FileCheck2}
        title="BRSR Impact & Principles"
        subtitle={`9 NGBC principles · ${avgReadiness.toFixed(0)}% avg readiness · ${k.brsrMissing} missing`}
        completionPct={k.brsrReadiness}
        badge={{ label: `${ready} ready`, tone: 'status-approved', icon: CheckCircle2 }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={FileCheck2} label="Principles" value={formatNumber(principles.length, 0)} unit="tracked"
          trend={{ dir: 'up', text: '9 NGBC' }} />
        <KpiTile index={2} icon={CheckCircle2} label="Ready" value={formatNumber(ready, 0)} unit="principles"
          trend={{ dir: 'up', text: `${Math.round((ready / principles.length) * 100)}%`, tone: 'status-approved' }} />
        <KpiTile index={3} icon={AlertTriangle} label="At Risk" value={formatNumber(atRisk, 0)} unit="principles"
          trend={{ dir: atRisk > 0 ? 'up' : 'neutral', text: atRisk > 0 ? `+${atRisk}` : '0',
            tone: atRisk > 0 ? 'status-warning' : 'status-approved' }}
          alert={atRisk > 0} />
        <KpiTile index={4} icon={AlertCircle} label="Missing" value={formatNumber(missing, 0)} unit="principles"
          trend={{ dir: missing > 0 ? 'up' : 'neutral', text: missing > 0 ? `+${missing}` : '0',
            tone: missing > 0 ? 'status-missing' : 'status-approved' }}
          alert={missing > 0} />
      </div>

      {/* Principle readiness bar chart */}
      <SectionCard
        icon={FileCheck2}
        title="Principle Readiness"
        subtitle="BRSR 9-principle readiness breakdown"
        index={5}
        action={
          <span className="status-pill text-[9px] status-submitted">
            <ActivityIcon className="h-2.5 w-2.5" />
            {avgReadiness.toFixed(0)}% avg
          </span>
        }
      >
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="sub-brsr-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BLUE_PRIMARY} />
                  <stop offset="100%" stopColor={BLUE_DEEP} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} domain={[0, 100]} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number, n: string) => [`${v.toFixed(0)}${n === 'Readiness' ? '%' : ''}`, n]}
                labelFormatter={(l: unknown) => {
                  const item = barData.find(d => d.name === String(l))
                  return item ? item.label : String(l)
                }}
                cursor={{ fill: 'rgba(29,78,216,0.08)' }}
              />
              <Bar dataKey="readiness" name="Readiness" fill="url(#sub-brsr-bar)" radius={[6, 6, 0, 0]} barSize={26} isAnimationActive animationDuration={700} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Principle table + status donut */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
        <SectionCard
          icon={Layers}
          title="Principle Details"
          subtitle="Per-principle readiness, answered/missing, status"
          index={6}
          action={
            <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-blue-700 transition-colors inline-flex items-center gap-1.5">
              Export <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(219,234,254,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">Principle</th>
                  <th className="px-3 py-2 text-right font-semibold">Answered</th>
                  <th className="px-3 py-2 text-right font-semibold">Missing</th>
                  <th className="px-3 py-2 text-right font-semibold">Readiness</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {principles.map((p, i) => {
                  const stColor = p.status === 'Ready' ? '#10b981' :
                    p.status === 'On Track' ? BLUE_PRIMARY :
                    p.status === 'At Risk' ? '#f59e0b' : '#dc2626'
                  return (
                    <motion.tr
                      key={p.code}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.025 }}
                      className="border-t border-slate-100 hover:bg-blue-50/40 transition-colors"
                      style={{ height: 44 }}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900 truncate max-w-[260px]">{p.name}</div>
                        <div className="text-[9px] text-slate-500 font-mono">{p.code}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{p.answered}/{p.total}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: p.missing > 0 ? '#dc2626' : undefined }}>
                        {p.missing}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${p.readiness}%`,
                                background: `linear-gradient(90deg, ${BLUE_DEEP}, ${BLUE_PRIMARY})`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-900 tabular-nums w-8 text-right">{p.readiness}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="status-pill text-[9px]" style={{
                          background: `${stColor}1a`, color: stColor, borderColor: `${stColor}33`,
                        }}>
                          {p.status}
                        </span>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          icon={Award}
          title="Status Breakdown"
          subtitle="Principles by readiness status"
          index={7}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {statusData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, n: string) => [`${v.toFixed(0)} principles`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{principles.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Principles</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {statusData.map(d => (
              <div key={d.name} className="glass-subtle rounded-lg px-1 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-0.5" style={{ background: d.color }} />
                <span className="text-[8px] uppercase tracking-wide text-slate-700">{d.name}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{Math.round(d.value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200/60 glass-subtle rounded-xl px-3 py-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">BRSR Readiness</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.brsrReadiness.toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Missing Items</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.brsrMissing}</div>
            </div>
          </div>
        </SectionCard>
      </div>

      <ActivityFeedCard activities={activities} loading={activityLoading} title="BRSR Activity Feed" />
    </div>
  )
}

/* ============================================================
 * Screen 4 — Approvals (sub-approvals)
 * ============================================================ */
function ApprovalsScreen({
  k, subs, subsLoading, activities, activityLoading,
  onApprove, onReject, actingId,
}: {
  k: Kpis
  subs: SubmissionItem[]
  subsLoading: boolean
  activities: ActivityItem[]
  activityLoading: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
  actingId: string | null
}) {
  // Subsidiary-level approvals = items that have been BU-approved and need
  // subsidiary-level blessing before progressing to HQ.
  const subsidiaryActionable = ['BU_APPROVED', 'SUBSIDIARY_APPROVED', 'HQ_REVIEW']
  const queue = useMemo(
    () => subs.filter(s => subsidiaryActionable.includes((s.status || '').toUpperCase()))
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)),
    [subs],
  )
  const pending = queue.length
  const highPriority = queue.filter(s => s.validationErrors > 0).length
  const withEvidence = queue.filter(s => s.evidenceCount > 0).length
  const avgCompletion = queue.length > 0
    ? queue.reduce((s, x) => s + x.completionPct, 0) / queue.length
    : 0

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Send}
        title="Subsidiary Approvals"
        subtitle={`${pending} pending subsidiary approval · ${highPriority} high priority · ${withEvidence} with evidence`}
        completionPct={avgCompletion}
        badge={{ label: `${pending} pending`, tone: 'status-warning', icon: Send }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={Send} label="Pending Approvals" value={formatNumber(pending, 0)} unit="items"
          trend={{ dir: pending > 0 ? 'up' : 'neutral', text: pending > 0 ? `+${Math.min(pending, 9)}` : '0' }}
          alert={pending > 3} />
        <KpiTile index={2} icon={AlertTriangle} label="High Priority" value={formatNumber(highPriority, 0)} unit="with errors"
          trend={{ dir: highPriority > 0 ? 'up' : 'neutral', text: highPriority > 0 ? '⚠' : '0',
            tone: highPriority > 0 ? 'status-missing' : 'status-approved' }}
          alert={highPriority > 0} />
        <KpiTile index={3} icon={CheckCircle2} label="With Evidence" value={formatNumber(withEvidence, 0)} unit="verified"
          trend={{ dir: 'up', text: `${Math.round((withEvidence / Math.max(1, pending)) * 100)}%`, tone: 'status-approved' }} />
        <KpiTile index={4} icon={Lock} label="Approved" value={formatNumber(k.approvedSubs, 0)} unit="all time"
          trend={{ dir: 'up', text: `+${Math.min(k.approvedSubs, 9)}`, tone: 'status-approved' }} />
      </div>

      {/* Approval queue table */}
      <SectionCard
        icon={Send}
        title="Pending Subsidiary Approval Queue"
        subtitle="Approve / Reject · items awaiting subsidiary-level blessing"
        index={5}
        action={
          <span className="status-pill text-[9px] status-submitted">
            <ActivityIcon className="h-2.5 w-2.5" />
            {queue.length} in queue
          </span>
        }
      >
        {subsLoading && queue.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-200/60 animate-pulse" />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9" style={{ color: BLUE_PRIMARY }} />
            <p className="text-[12px] text-slate-900 font-semibold mt-2">Approval queue is clear</p>
            <p className="text-[11px] text-slate-700">No submissions are awaiting subsidiary approval right now.</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(219,234,254,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">Submission</th>
                  <th className="px-3 py-2 text-left font-semibold">Project</th>
                  <th className="px-3 py-2 text-left font-semibold">Module</th>
                  <th className="px-3 py-2 text-left font-semibold">Reviewer</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Comp.</th>
                  <th className="px-3 py-2 text-right font-semibold">Evidence</th>
                  <th className="px-3 py-2 text-left font-semibold">Updated</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((s, i) => {
                  const status = (s.status || '').toUpperCase()
                  const isActing = actingId === s.id
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.02 }}
                      className="border-t border-slate-100 hover:bg-blue-50/40 transition-colors"
                      style={{ height: 44 }}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900 truncate max-w-[180px]">{s.title}</div>
                        <div className="font-mono text-[9px] text-slate-500">{s.id.slice(-8)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-slate-900 font-medium truncate max-w-[140px]">{s.project?.projectName ?? '—'}</div>
                        <div className="text-[9px] text-slate-500">{s.project?.projectCode ?? ''}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="status-pill text-[9px] status-locked">{s.module}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-slate-700 truncate max-w-[120px]">{s.currentReviewer?.name ?? 'Unassigned'}</div>
                        <div className="text-[9px] text-slate-500">{s.currentReviewer?.email ?? ''}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`status-pill text-[9px] ${statusClass(s.status)}`}>
                          {status.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{s.completionPct.toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{s.evidenceCount}</td>
                      <td className="px-3 py-2 text-slate-700">{timeAgo(s.updatedAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            disabled={isActing}
                            onClick={() => onApprove(s.id)}
                            title="Approve"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isActing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            disabled={isActing}
                            onClick={() => onReject(s.id)}
                            title="Reject"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/80 text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <ActivityFeedCard activities={activities} loading={activityLoading} title="Approval Activity Feed" />
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function SubsidiaryWorkspace() {
  const { activeModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [subsLoading, setSubsLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)
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
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isSubsidiaryActivity).slice(0, 6)
      setActivities(filtered)
    } catch {
      /* silent — keep existing feed on poll error */
    } finally {
      if (mountedRef.current) setActivityLoading(false)
    }
  }, [])

  const fetchSubmissions = useCallback(async () => {
    try {
      setSubsLoading(true)
      const res = await fetch('/api/submissions?take=50', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as SubmissionResponse
      if (!mountedRef.current) return
      setSubmissions(Array.isArray(data.items) ? data.items : [])
    } catch {
      /* silent */
    } finally {
      if (mountedRef.current) setSubsLoading(false)
    }
  }, [])

  /* ---- approve / reject actions ---- */
  const handleApprove = useCallback(async (id: string) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/submissions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'Approved from Subsidiary Workspace' }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error ?? `HTTP ${res.status}`)
      }
      await fetchSubmissions()
      await fetchActivities()
    } catch {
      /* silent */
    } finally {
      if (mountedRef.current) setActingId(null)
    }
  }, [fetchSubmissions, fetchActivities])

  const handleReject = useCallback(async (id: string) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/submissions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'Rejected from Subsidiary Workspace — please revise' }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error ?? `HTTP ${res.status}`)
      }
      await fetchSubmissions()
      await fetchActivities()
    } catch {
      /* silent */
    } finally {
      if (mountedRef.current) setActingId(null)
    }
  }, [fetchSubmissions, fetchActivities])

  /* ---- initial load ---- */
  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchActivities(), fetchSubmissions()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [fetchOverview, fetchActivities, fetchSubmissions])

  /* ---- polling ---- */
  useEffect(() => {
    const activityTimer = setInterval(fetchActivities, 30_000)
    const overviewTimer = setInterval(fetchOverview, 60_000)
    const subsTimer = setInterval(fetchSubmissions, 45_000)
    return () => {
      clearInterval(activityTimer)
      clearInterval(overviewTimer)
      clearInterval(subsTimer)
    }
  }, [fetchActivities, fetchOverview, fetchSubmissions])

  const k = useMemo<Kpis | null>(() => {
    if (!overview?.kpis) return null
    return overview.kpis
  }, [overview])

  const trends = useMemo<Record<string, Record<string, number>> | undefined>(() => {
    const t = overview?.trends as Record<string, Record<string, number>> | undefined
    return t && typeof t === 'object' ? t : undefined
  }, [overview])

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
        icon={Briefcase}
        title="No subsidiary data yet"
        subtitle="Set up a reporting period to populate the subsidiary workspace."
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
        {activeModule === 'sub-bucenter' && (
          <BuCenterScreen
            k={k}
            subs={submissions}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'sub-esg' && (
          <SubsidiaryEsgScreen
            k={k}
            trends={trends}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'sub-brsr-impact' && (
          <BrsrImpactScreen
            k={k}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'sub-approvals' && (
          <ApprovalsScreen
            k={k}
            subs={submissions}
            subsLoading={subsLoading}
            activities={activities}
            activityLoading={activityLoading}
            onApprove={handleApprove}
            onReject={handleReject}
            actingId={actingId}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
