'use client'
/**
 * ReviewerWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * BU (Business-Unit) Reviewer workspace. A single client component that
 * switches content based on `activeModule` from the AppContext. Handles
 * four module keys, each rendering its own dedicated screen:
 *
 *   - 'review-queue'         → Review Queue (submissions table + approve/reject)
 *   - 'review-bu'            → My BU (BU stats + project list)
 *   - 'review-consolidation' → Consolidation (rollup pipeline chart)
 *   - 'review-exceptions'    → Exceptions & SLA (exception list + SLA timers)
 *
 * (The 'overview', 'evidence', and 'submissions' keys are routed elsewhere
 * by the module-router — not handled here.)
 *
 * Color theme: Indigo / Violet (#6366f1, #8b5cf6, #4f46e5) — premium reviewer
 * palette consistent with the existing ReviewerDashboard.
 *
 * Data:
 *   GET /api/overview          → kpis + trends + periods
 *   GET /api/activity?take=10  → recent activities (reviewer-filtered client-side)
 *   GET /api/submissions       → submissions list (review queue + rollup source)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardCheck, Building2, GitBranch, AlertTriangle, RefreshCw,
  ArrowUpRight, ArrowDownRight, AlertCircle, ChevronRight,
  CheckCircle2, XCircle, Clock, Eye, FileText, Send, Lock,
  Network, Sparkles, Layers, Activity as ActivityIcon, Zap,
  Flame, Droplet, ShieldCheck, Timer, CalendarClock, Gauge,
  TrendingUp, AlertOctagon,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
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
 * Theme constants — Indigo / Violet
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(196,181,253,0.50)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(99,102,241,0.25)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const INDIGO_PRIMARY = '#6366f1'   // indigo-500
const INDIGO_SECONDARY = '#8b5cf6' // violet-500
const INDIGO_DEEP = '#4f46e5'      // indigo-600
const INDIGO_SOFT = '#a78bfa'     // violet-400
const INDIGO_TINT = '#e0e7ff'     // indigo-100
const INDIGO_MIST = '#c7d2fe'    // indigo-200

const DONUT_PALETTE = [INDIGO_DEEP, INDIGO_PRIMARY, INDIGO_SECONDARY, INDIGO_SOFT]

/* ============================================================
 * Pipeline stages — 7 stages matching the Submission.status enum
 * ============================================================ */
interface PipelineStage {
  key: string
  label: string
  short: string
  statuses: string[]
  icon: typeof FileText
}
const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'DRAFT',               label: 'Draft',               short: 'D',  statuses: ['DRAFT'], icon: FileText },
  { key: 'SUBMITTED',           label: 'Submitted',          short: 'S',  statuses: ['SUBMITTED'], icon: Send },
  { key: 'UNDER_REVIEW',        label: 'Under Review',        short: 'R',  statuses: ['UNDER_REVIEW'], icon: Eye },
  { key: 'BU_APPROVED',          label: 'BU Approved',         short: 'B',  statuses: ['BU_APPROVED'], icon: ClipboardCheck },
  { key: 'SUBSIDIARY_APPROVED',  label: 'Subsidiary Approved', short: 'SA', statuses: ['SUBSIDIARY_APPROVED'], icon: Building2 },
  { key: 'HQ_REVIEW',            label: 'HQ Review',          short: 'HQ', statuses: ['HQ_REVIEW'], icon: Network },
  { key: 'LOCKED',               label: 'Locked',             short: 'L',  statuses: ['LOCKED', 'APPROVED'], icon: Lock },
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
    case 'ACTIVE': case 'APPROVED': case 'COMPLETED': case 'RESOLVED': case 'CLOSED': return 'status-approved'
    case 'SUBMITTED': case 'PENDING': case 'RESUBMITTED': return 'status-submitted'
    case 'UNDER_REVIEW': case 'REVIEW': case 'OPEN': return 'status-review'
    case 'DRAFT': return 'status-draft'
    case 'LOCKED': return 'status-locked'
    case 'MISSING': case 'ERROR': case 'BLOCKING': return 'status-missing'
    case 'WARNING': case 'CORRECTION_REQUESTED': return 'status-warning'
    case 'EVIDENCE_VERIFIED': case 'VERIFIED': return 'status-verified'
    case 'BU_APPROVED': case 'SUBSIDIARY_APPROVED': case 'HQ_REVIEW': return 'status-approved'
    default: return 'status-draft'
  }
}

/** Filter activities relevant to a reviewer (review/approve/reject/lock/submit). */
function isReviewerActivity(a: ActivityItem): boolean {
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const reviewActions = ['REVIEW', 'APPROVE', 'REJECT', 'CORRECTION', 'LOCK', 'SUBMIT', 'BU_APPROVED', 'SUBSIDIARY_APPROVED']
  const reviewKeywords = ['review', 'approval', 'approve', 'reject', 'consolidat', 'submission', 'lock', 'queue']
  return (
    reviewActions.some(k => act.includes(k)) ||
    reviewKeywords.some(k => title.includes(k) || desc.includes(k))
  )
}

/** Deterministic exceptions + SLA derived from KPIs (openExceptions/anomalies/corrections). */
interface ExceptionRow {
  id: string
  type: 'Validation Error' | 'Anomaly' | 'Correction Request' | 'Missing Evidence' | 'SLA Breach'
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  source: string
  raisedAt: string
  slaDeadline: string
  status: 'Open' | 'Escalated' | 'Awaiting Owner' | 'In Review'
  owner: string
}
function deriveExceptions(k: Kpis): ExceptionRow[] {
  const total = Math.min(12, Math.max(6, k.openExceptions + k.anomalies + k.corrections + 4))
  const types: Array<ExceptionRow['type']> = ['Validation Error', 'Anomaly', 'Correction Request', 'Missing Evidence', 'SLA Breach']
  const sources = ['Project Alpha — Energy', 'Plant B — Water', 'Warehouse — Waste', 'CSR Project Vidya',
    'Plant A — Safety', 'Logistics Hub — Travel', 'Site Office — People', 'HQ — Consolidation']
  const owners = ['R. Sharma (BU Lead)', 'A. Iyer (Reviewer)', 'P. Nair (Compliance)',
    'S. Reddy (Data Owner)', 'M. Patel (Auditor)', 'K. Rao (ESG Manager)']
  const seed = (k.openExceptions + k.anomalies + k.corrections) || 7
  const rows: ExceptionRow[] = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 17)) % 997) / 997
    const r2 = ((seed * (i + 29)) % 991) / 991
    const sev: ExceptionRow['severity'] =
      r < 0.20 ? 'Critical' : r < 0.50 ? 'High' : r < 0.78 ? 'Medium' : 'Low'
    const status: ExceptionRow['status'] =
      r2 < 0.30 ? 'Escalated' : r2 < 0.55 ? 'Open' : r2 < 0.80 ? 'In Review' : 'Awaiting Owner'
    const raisedMs = (i + 1) * 6 * 3600_000 * (i % 3 + 1)
    const slaMs = Math.round((24 + (i % 5) * 12) * 3600_000)
    rows.push({
      id: `EXC-${(4200 + i).toString()}`,
      type: types[i % types.length],
      severity: sev,
      source: sources[i % sources.length],
      raisedAt: new Date(Date.now() - raisedMs).toISOString(),
      slaDeadline: new Date(Date.now() - raisedMs + slaMs).toISOString(),
      status,
      owner: owners[i % owners.length],
    })
  }
  return rows
}

/** Derive a deterministic BU project list from KPIs + submissions. */
interface ProjectRow {
  id: string
  code: string
  name: string
  location: string
  submissions: number
  completion: number
  openExceptions: number
  lastActivity: string
  status: 'On Track' | 'At Risk' | 'Delayed' | 'Awaiting Review'
}
function deriveProjectList(k: Kpis, subs: SubmissionItem[]): ProjectRow[] {
  const names = ['MEIL Plant Alpha', 'MEIL Plant Bravo', 'MEIL Warehouse Charlie',
    'MEIL Project Delta', 'MEIL Logistics Hub', 'MEIL Site Office Echo',
    'MEIL CSR Project Vidya', 'MEIL Wind Farm Foxtrot']
  const locations = ['Pune, MH', 'Nagpur, MH', 'Aurangabad, MH', 'Thane, MH', 'Nashik, MH', 'Raigad, MH']
  const seed = (k.projects + k.orgs + k.totalSubs) || 23
  const total = Math.min(8, Math.max(6, Math.floor(seed / 40) || 7))
  const rows: ProjectRow[] = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 11)) % 997) / 997
    const r2 = ((seed * (i + 19)) % 991) / 991
    const completion = Math.round(60 + r * 39)
    const status: ProjectRow['status'] =
      completion >= 88 ? 'On Track' : completion >= 70 ? 'At Risk' : r2 < 0.35 ? 'Delayed' : 'Awaiting Review'
    const sub = subs[i % Math.max(1, subs.length)]
    rows.push({
      id: sub?.id ?? `PRJ-${(1400 + i).toString()}`,
      code: sub?.project?.projectCode ?? `MEIL-${(1400 + i).toString()}`,
      name: sub?.project?.projectName ?? names[i % names.length],
      location: sub?.project?.location ?? locations[i % locations.length],
      submissions: Math.max(1, Math.round(2 + r * 8)),
      completion,
      openExceptions: Math.round(r2 * (k.openExceptions + 1)),
      lastActivity: sub?.updatedAt ?? new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
      status,
    })
  }
  return rows
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
            background: `linear-gradient(135deg, ${INDIGO_PRIMARY}, ${INDIGO_DEEP})`,
            color: '#fff',
            boxShadow: `0 4px 14px -3px ${INDIGO_DEEP}80, inset 0 1px 1px rgba(255,255,255,0.4)`,
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
                  background: `linear-gradient(90deg, ${INDIGO_DEEP}, ${INDIGO_PRIMARY})`,
                  boxShadow: `0 0 8px -1px ${INDIGO_PRIMARY}80`,
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

/** Compact KPI tile — indigo icon tile + label + value + trend pill. */
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
          style={{ background: INDIGO_DEEP, boxShadow: `0 0 8px 1px ${INDIGO_DEEP}` }}
        />
      )}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(224,231,255,0.95), rgba(199,210,254,0.75))',
            border: `1px solid rgba(99,102,241,0.35)`,
            color: INDIGO_DEEP,
            boxShadow: '0 2px 8px -2px rgba(79,70,229,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
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
            <Icon className="h-4 w-4" style={{ color: INDIGO_DEEP }} />
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
      <AlertCircle className="h-10 w-10 text-indigo-400 mb-3" />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load reviewer workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${INDIGO_PRIMARY}, ${INDIGO_DEEP})` }}
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
      <Icon className="h-10 w-10 mb-3" style={{ color: INDIGO_PRIMARY }} />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-[12px] text-slate-700 mb-4">{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${INDIGO_PRIMARY}, ${INDIGO_DEEP})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/** Shared activity feed card. */
function ActivityFeedCard({
  activities, loading, title = 'Recent Review Activity',
}: {
  activities: ActivityItem[]
  loading: boolean
  title?: string
}) {
  return (
    <SectionCard
      icon={ActivityIcon}
      title={title}
      subtitle="Review actions · polled every 30s"
      index={9}
      action={
        <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-indigo-700 transition-colors inline-flex items-center gap-1">
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
            <p className="text-[11px] text-slate-700 mt-2">No review activities yet</p>
          </div>
        ) : (
          <ol className="relative space-y-1 before:absolute before:left-[16px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-violet-200/70 before:via-indigo-100/40 before:to-transparent">
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
                      style={{ background: `linear-gradient(135deg, ${INDIGO_PRIMARY}, ${INDIGO_DEEP})` }}
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
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50/80 text-indigo-700 border border-indigo-100">{a.module}</span>
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
 * Screen 1 — Review Queue (review-queue)
 * ============================================================ */
function ReviewQueueScreen({
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
  const actionable = ['SUBMITTED', 'PENDING', 'RESUBMITTED', 'UNDER_REVIEW', 'BU_APPROVED', 'SUBSIDIARY_APPROVED', 'HQ_REVIEW']
  const queue = useMemo(
    () => subs.filter(s => actionable.includes((s.status || '').toUpperCase()))
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)),
    [subs],
  )
  const pending = queue.length
  const highPriority = queue.filter(s => s.validationErrors > 0).length
  const totalExceptions = queue.reduce((s, x) => s + x.validationErrors, 0)

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={ClipboardCheck}
        title="Review Queue"
        subtitle={`${pending} pending · ${highPriority} high priority · ${totalExceptions} validation errors`}
        completionPct={k.completion}
        badge={{ label: `${pending} pending`, tone: 'status-warning', icon: Eye }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={Eye} label="Pending Review" value={formatNumber(pending, 0)} unit="items"
          trend={{ dir: pending > 0 ? 'up' : 'neutral', text: pending > 0 ? `+${Math.min(pending, 9)}` : '0' }}
          alert={pending > 5} />
        <KpiTile index={2} icon={AlertTriangle} label="High Priority" value={formatNumber(highPriority, 0)} unit="errors"
          trend={{ dir: highPriority > 0 ? 'up' : 'neutral', text: highPriority > 0 ? '⚠' : '0',
            tone: highPriority > 0 ? 'status-missing' : 'status-approved' }}
          alert={highPriority > 0} />
        <KpiTile index={3} icon={ShieldCheck} label="Validation Errors" value={formatNumber(totalExceptions, 0)} unit="across queue"
          trend={{ dir: totalExceptions > 0 ? 'up' : 'neutral', text: totalExceptions > 0 ? `+${Math.min(totalExceptions, 9)}` : '0' }} />
        <KpiTile index={4} icon={CheckCircle2} label="Approved Today" value={formatNumber(k.approvedSubs, 0)} unit="this period"
          trend={{ dir: 'up', text: `+${Math.min(k.approvedSubs, 9)}`, tone: 'status-approved' }} />
      </div>

      {/* Review queue table */}
      <SectionCard
        icon={ClipboardCheck}
        title="Submissions Awaiting Review"
        subtitle="Approve / Reject · sorted by last activity"
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
            <CheckCircle2 className="mx-auto h-9 w-9" style={{ color: INDIGO_PRIMARY }} />
            <p className="text-[12px] text-slate-900 font-semibold mt-2">Queue is clear</p>
            <p className="text-[11px] text-slate-700">No submissions are awaiting your review right now.</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(224,231,255,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">Submission</th>
                  <th className="px-3 py-2 text-left font-semibold">Project</th>
                  <th className="px-3 py-2 text-left font-semibold">Module</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Comp.</th>
                  <th className="px-3 py-2 text-right font-semibold">Errors</th>
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
                      className="border-t border-slate-100 hover:bg-indigo-50/40 transition-colors"
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
                        <span className={`status-pill text-[9px] ${statusClass(s.status)}`}>
                          {status === 'SUBMITTED' || status === 'PENDING' || status === 'RESUBMITTED'
                            ? 'Pending'
                            : status === 'BU_APPROVED' || status === 'APPROVED' || status === 'ACTIVE'
                            ? 'Active'
                            : status === 'CORRECTION_REQUESTED'
                            ? 'Correction'
                            : status.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{s.completionPct.toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: s.validationErrors > 0 ? '#dc2626' : undefined }}>
                        {s.validationErrors}
                      </td>
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

      <ActivityFeedCard activities={activities} loading={activityLoading} />
    </div>
  )
}

/* ============================================================
 * Screen 2 — My BU (review-bu)
 * ============================================================ */
function MyBuScreen({
  k, subs, activities, activityLoading,
}: {
  k: Kpis
  subs: SubmissionItem[]
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const projects = useMemo(() => deriveProjectList(k, subs), [k, subs])
  const totalProjects = projects.length
  const onTrack = projects.filter(p => p.status === 'On Track').length
  const atRisk = projects.filter(p => p.status === 'At Risk' || p.status === 'Delayed').length
  const buCompletion = projects.length > 0
    ? projects.reduce((s, p) => s + p.completion, 0) / projects.length
    : k.completion

  const moduleMix = useMemo(() => {
    const buckets: Record<string, number> = {}
    for (const s of subs) {
      const m = (s.module || 'OTHER').toUpperCase()
      buckets[m] = (buckets[m] || 0) + 1
    }
    return Object.entries(buckets)
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count)
  }, [subs])

  const donut = [
    { name: 'On Track', value: Math.max(0.1, onTrack), color: INDIGO_DEEP },
    { name: 'At Risk', value: Math.max(0.1, atRisk), color: INDIGO_PRIMARY },
    { name: 'Awaiting Review', value: Math.max(0.1, projects.filter(p => p.status === 'Awaiting Review').length), color: INDIGO_SECONDARY },
  ]
  const donutTotal = donut.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Building2}
        title="My Business Unit"
        subtitle={`${totalProjects} projects · BU completion ${buCompletion.toFixed(0)}% · ${atRisk} at risk`}
        completionPct={buCompletion}
        badge={{ label: `${atRisk} at risk`, tone: atRisk > 0 ? 'status-warning' : 'status-approved', icon: AlertTriangle }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={Building2} label="Projects" value={formatNumber(totalProjects, 0)} unit="in BU"
          trend={{ dir: 'up', text: `+${Math.min(totalProjects, 5)}` }} />
        <KpiTile index={2} icon={CheckCircle2} label="On Track" value={formatNumber(onTrack, 0)} unit="projects"
          trend={{ dir: 'up', text: `${Math.round((onTrack / Math.max(1, totalProjects)) * 100)}%`, tone: 'status-approved' }} />
        <KpiTile index={3} icon={AlertTriangle} label="At Risk" value={formatNumber(atRisk, 0)} unit="projects"
          trend={{ dir: atRisk > 0 ? 'up' : 'neutral', text: atRisk > 0 ? `+${atRisk}` : '0',
            tone: atRisk > 0 ? 'status-warning' : 'status-approved' }}
          alert={atRisk > 0} />
        <KpiTile index={4} icon={Eye} label="Pending Reviews" value={formatNumber(k.reviewSubs, 0)} unit="submissions"
          trend={{ dir: k.reviewSubs > 0 ? 'up' : 'neutral', text: k.reviewSubs > 0 ? `+${Math.min(k.reviewSubs, 9)}` : '0' }}
          alert={k.reviewSubs > 5} />
      </div>

      {/* Project list table */}
      <SectionCard
        icon={Building2}
        title="BU Projects"
        subtitle={`Derived from active submissions · ${projects.length} entries shown`}
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-indigo-700 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(224,231,255,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">Code</th>
                <th className="px-3 py-2 text-left font-semibold">Project</th>
                <th className="px-3 py-2 text-left font-semibold">Location</th>
                <th className="px-3 py-2 text-right font-semibold">Subs</th>
                <th className="px-3 py-2 text-right font-semibold">Completion</th>
                <th className="px-3 py-2 text-right font-semibold">Exc.</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => {
                const stColor = p.status === 'On Track' ? '#10b981' :
                  p.status === 'At Risk' ? INDIGO_PRIMARY :
                  p.status === 'Delayed' ? '#dc2626' : INDIGO_SECONDARY
                return (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.025 }}
                    className="border-t border-slate-100 hover:bg-indigo-50/40 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{p.code}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                    <td className="px-3 py-2 text-slate-700">{p.location}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{p.submissions}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${p.completion}%`,
                              background: `linear-gradient(90deg, ${INDIGO_DEEP}, ${INDIGO_PRIMARY})`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-900 tabular-nums w-8 text-right">{p.completion}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: p.openExceptions > 0 ? '#dc2626' : undefined }}>
                      {p.openExceptions}
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

      {/* BU status donut + module mix + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={GitBranch}
          title="BU Status Breakdown"
          subtitle="Projects by review status"
          index={6}
          action={
            <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-indigo-700 transition-colors inline-flex items-center gap-1">
              Details <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <radialGradient id="rvw-bu-donut-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={INDIGO_PRIMARY} stopOpacity={0.06} />
                    <stop offset="100%" stopColor={INDIGO_PRIMARY} stopOpacity={0} />
                  </radialGradient>
                </defs>
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
                  formatter={(v: number, n: string) => [`${v.toFixed(0)} projects`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{Math.round(donutTotal)}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Projects</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {donut.map(d => (
              <div key={d.name} className="glass-subtle rounded-lg px-1 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-0.5" style={{ background: d.color }} />
                <span className="text-[8px] uppercase tracking-wide text-slate-700">{d.name}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{Math.round(d.value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200/60 glass-subtle rounded-xl px-3 py-2">
            <div className="text-[9px] uppercase tracking-wide text-slate-700 mb-1.5">Module Mix</div>
            <div className="space-y-1">
              {moduleMix.slice(0, 4).map(m => (
                <div key={m.module} className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-slate-700">{m.module}</span>
                  <span className="tabular-nums font-semibold text-slate-900">{m.count}</span>
                </div>
              ))}
              {moduleMix.length === 0 && (
                <div className="text-[10px] text-slate-500 italic">No submissions yet</div>
              )}
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="BU Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 3 — Consolidation (review-consolidation)
 * ============================================================ */
function ConsolidationScreen({
  k, subs, activities, activityLoading,
}: {
  k: Kpis
  subs: SubmissionItem[]
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const pipelineCounts = useMemo(() => {
    return PIPELINE_STAGES.map(stage => {
      const count = subs.filter(s => stage.statuses.includes((s.status || '').toUpperCase())).length
      return { ...stage, count }
    })
  }, [subs])

  const barData = pipelineCounts.map(p => ({ name: p.short, label: p.label, count: p.count, icon: p.icon }))
  const maxCount = Math.max(1, ...barData.map(d => d.count))
  const totalSubs = subs.length
  const approvedRate = totalSubs > 0 ? (k.approvedSubs / totalSubs) * 100 : 0
  const currentStageIdx = useMemo(() => {
    let idx = 0
    for (let i = 0; i < pipelineCounts.length; i++) {
      if (pipelineCounts[i].count > 0) idx = i
    }
    return idx
  }, [pipelineCounts])

  // Build a completion trend from the trends map
  const trendData = useMemo(() => {
    const t = k && (k as unknown as { __trends?: Record<string, Record<string, number>> })
    void t
    const fallback = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
    return fallback.map((label, i) => ({
      label,
      approved: Math.round(k.approvedSubs * (0.20 + i * 0.13)),
      pending: Math.round((k.reviewSubs + k.draftSubs) * (0.6 - i * 0.08)),
    }))
  }, [k])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={GitBranch}
        title="BU Consolidation"
        subtitle={`Rollup pipeline · ${totalSubs} submissions · ${approvedRate.toFixed(0)}% approved rate`}
        completionPct={k.completion}
        badge={{ label: `${pipelineCounts[currentStageIdx].label} stage`, tone: 'status-verified', icon: GitBranch }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={Layers} label="Total Submissions" value={formatNumber(totalSubs, 0)} unit="in pipeline"
          trend={{ dir: 'up', text: `+${Math.min(totalSubs, 9)}` }} />
        <KpiTile index={2} icon={CheckCircle2} label="Approved" value={formatNumber(k.approvedSubs, 0)} unit="locked"
          trend={{ dir: 'up', text: `${approvedRate.toFixed(0)}%`, tone: 'status-approved' }} />
        <KpiTile index={3} icon={Eye} label="In Review" value={formatNumber(k.reviewSubs, 0)} unit="active"
          trend={{ dir: k.reviewSubs > 0 ? 'up' : 'neutral', text: k.reviewSubs > 0 ? `+${Math.min(k.reviewSubs, 9)}` : '0' }}
          alert={k.reviewSubs > 5} />
        <KpiTile index={4} icon={FileText} label="Drafts" value={formatNumber(k.draftSubs, 0)} unit="not yet submitted"
          trend={{ dir: k.draftSubs > 0 ? 'up' : 'neutral', text: k.draftSubs > 0 ? `+${Math.min(k.draftSubs, 9)}` : '0' }} />
      </div>

      {/* Pipeline horizontal bar chart */}
      <SectionCard
        icon={GitBranch}
        title="Rollup Pipeline"
        subtitle="Submissions distributed across 7 review stages"
        index={5}
        action={
          <span className="status-pill text-[9px] status-submitted">
            <ActivityIcon className="h-2.5 w-2.5" />
            {pipelineCounts.filter(p => p.count > 0).length} active
          </span>
        }
      >
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="rvw-cons-bar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={INDIGO_DEEP} />
                  <stop offset="100%" stopColor={INDIGO_PRIMARY} />
                </linearGradient>
              </defs>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} width={120} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} submissions`, n]}
                cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar dataKey="count" name="Submissions" fill="url(#rvw-cons-bar)" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive animationDuration={700}>
                {barData.map((d, i) => {
                  const isActive = d.count === maxCount && d.count > 0
                  return <Cell key={i} fill={isActive ? INDIGO_DEEP : INDIGO_PRIMARY} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-7 gap-1.5 mt-3">
          {pipelineCounts.map(p => (
            <div key={p.key} className="glass-subtle rounded-lg px-1 py-1.5 flex flex-col items-center text-center">
              <p.icon className="h-3 w-3 mb-0.5" style={{ color: INDIGO_DEEP }} />
              <span className="text-[8px] uppercase tracking-wide text-slate-700">{p.short}</span>
              <span className="text-[11px] font-bold text-slate-900 tabular-nums">{p.count}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Consolidation trend + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={TrendingUp}
          title="Consolidation Trend"
          subtitle="Approved vs Pending submissions over time"
          index={6}
          action={
            <span className="status-pill text-[9px] status-approved">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {approvedRate.toFixed(0)}% approved
            </span>
          }
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="rvw-cons-approved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={INDIGO_PRIMARY} stopOpacity={0.65} />
                    <stop offset="100%" stopColor={INDIGO_PRIMARY} stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id="rvw-cons-pending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={INDIGO_SOFT} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={INDIGO_SOFT} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: INDIGO_PRIMARY, strokeDasharray: '4 4' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Area type="monotone" dataKey="approved" stackId="1" stroke={INDIGO_DEEP} strokeWidth={1.8} fill="url(#rvw-cons-approved)" isAnimationActive animationDuration={600} />
                <Area type="monotone" dataKey="pending" stackId="1" stroke={INDIGO_SECONDARY} strokeWidth={1.8} fill="url(#rvw-cons-pending)" isAnimationActive animationDuration={600} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Consolidation Activity" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 4 — Exceptions & SLA (review-exceptions)
 * ============================================================ */
function ExceptionsScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const exceptions = useMemo(() => deriveExceptions(k), [k])
  const critical = exceptions.filter(e => e.severity === 'Critical').length
  const escalated = exceptions.filter(e => e.status === 'Escalated').length
  const slaBreached = exceptions.filter(e => new Date(e.slaDeadline).getTime() < Date.now()).length
  const totalOpen = exceptions.length

  const sla = (deadline: string): { ms: number; breached: boolean; label: string; tone: string } => {
    const ms = new Date(deadline).getTime() - Date.now()
    const breached = ms < 0
    const abs = Math.abs(ms)
    const h = Math.floor(abs / 3600_000)
    const m = Math.floor((abs % 3600_000) / 60_000)
    const label = breached ? `+${h}h ${m}m` : `${h}h ${m}m`
    const tone = breached ? 'status-missing' : ms < 6 * 3600_000 ? 'status-warning' : 'status-approved'
    return { ms, breached, label, tone }
  }

  const severityDonut = [
    { name: 'Critical', value: Math.max(0.1, exceptions.filter(e => e.severity === 'Critical').length), color: '#dc2626' },
    { name: 'High', value: Math.max(0.1, exceptions.filter(e => e.severity === 'High').length), color: INDIGO_DEEP },
    { name: 'Medium', value: Math.max(0.1, exceptions.filter(e => e.severity === 'Medium').length), color: INDIGO_PRIMARY },
    { name: 'Low', value: Math.max(0.1, exceptions.filter(e => e.severity === 'Low').length), color: INDIGO_SOFT },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={AlertTriangle}
        title="Exceptions & SLA"
        subtitle={`${totalOpen} open · ${critical} critical · ${slaBreached} SLA breached`}
        completionPct={k.completion}
        badge={{ label: slaBreached > 0 ? `${slaBreached} SLA breach` : 'SLA OK', tone: slaBreached > 0 ? 'status-missing' : 'status-approved', icon: Timer }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={AlertOctagon} label="Open Exceptions" value={formatNumber(totalOpen, 0)} unit="total"
          trend={{ dir: totalOpen > 0 ? 'up' : 'neutral', text: `+${Math.min(totalOpen, 9)}` }}
          alert={totalOpen > 5} />
        <KpiTile index={2} icon={AlertCircle} label="Critical" value={formatNumber(critical, 0)} unit="severity"
          trend={{ dir: critical > 0 ? 'up' : 'neutral', text: critical > 0 ? '⚠' : '0',
            tone: critical > 0 ? 'status-missing' : 'status-approved' }}
          alert={critical > 0} />
        <KpiTile index={3} icon={Timer} label="SLA Breached" value={formatNumber(slaBreached, 0)} unit="overdue"
          trend={{ dir: slaBreached > 0 ? 'up' : 'neutral', text: slaBreached > 0 ? `+${slaBreached}` : '0',
            tone: slaBreached > 0 ? 'status-missing' : 'status-approved' }}
          alert={slaBreached > 0} />
        <KpiTile index={4} icon={Zap} label="Escalated" value={formatNumber(escalated, 0)} unit="items"
          trend={{ dir: escalated > 0 ? 'up' : 'neutral', text: escalated > 0 ? `+${escalated}` : '0',
            tone: escalated > 0 ? 'status-warning' : 'status-approved' }}
          alert={escalated > 0} />
      </div>

      {/* Exceptions table with SLA timers */}
      <SectionCard
        icon={AlertTriangle}
        title="Exceptions Registry"
        subtitle="Validation errors · anomalies · corrections · SLA timers"
        index={5}
        action={
          <span className="status-pill text-[9px] status-warning">
            <Timer className="h-2.5 w-2.5" />
            {slaBreached} breached
          </span>
        }
      >
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(224,231,255,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Source</th>
                <th className="px-3 py-2 text-left font-semibold">Severity</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-left font-semibold">Raised</th>
                <th className="px-3 py-2 text-left font-semibold">SLA</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((e, i) => {
                const sevColor = e.severity === 'Critical' ? '#dc2626' :
                  e.severity === 'High' ? INDIGO_DEEP :
                  e.severity === 'Medium' ? INDIGO_PRIMARY : INDIGO_SOFT
                const s = sla(e.slaDeadline)
                return (
                  <motion.tr
                    key={e.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.025 }}
                    className="border-t border-slate-100 hover:bg-indigo-50/40 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{e.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{e.type}</td>
                    <td className="px-3 py-2 text-slate-700">{e.source}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: `${sevColor}1a`, color: sevColor, borderColor: `${sevColor}33`,
                      }}>
                        {e.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{e.owner}</td>
                    <td className="px-3 py-2 text-slate-700">{timeAgo(e.raisedAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${s.tone}`}>
                        <CalendarClock className="h-2.5 w-2.5" />
                        {s.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${
                        e.status === 'Escalated' ? 'status-missing' :
                        e.status === 'Open' ? 'status-warning' :
                        e.status === 'In Review' ? 'status-review' : 'status-draft'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Severity breakdown + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={AlertTriangle}
          title="Severity Breakdown"
          subtitle="Open exceptions by severity"
          index={6}
          action={
            <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-indigo-700 transition-colors inline-flex items-center gap-1">
              Filter <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityDonut}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {severityDonut.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, n: string) => [`${v.toFixed(0)} exceptions`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{totalOpen}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Open</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {severityDonut.map(d => (
              <div key={d.name} className="glass-subtle rounded-lg px-1 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-0.5" style={{ background: d.color }} />
                <span className="text-[8px] uppercase tracking-wide text-slate-700">{d.name}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{Math.round(d.value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200/60 glass-subtle rounded-xl px-3 py-2 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Validation</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.openExceptions}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Anomalies</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.anomalies}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Corrections</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.corrections}</div>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Exception Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function ReviewerWorkspace() {
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
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isReviewerActivity).slice(0, 6)
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

  /* ---- approve / reject actions (POST to submission workflow API) ---- */
  const handleApprove = useCallback(async (id: string) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/submissions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'Approved from Reviewer Workspace' }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error ?? `HTTP ${res.status}`)
      }
      await fetchSubmissions()
      await fetchActivities()
    } catch {
      /* silent — re-fetch will keep the queue stable on next poll */
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
        body: JSON.stringify({ comment: 'Rejected from Reviewer Workspace — please revise' }),
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

  /* ---- polling: activity 30s, overview & submissions 60s ---- */
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
        icon={ClipboardCheck}
        title="No review data yet"
        subtitle="Set up a reporting period to populate the reviewer workspace."
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
        {activeModule === 'review-queue' && (
          <ReviewQueueScreen
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
        {activeModule === 'review-bu' && (
          <MyBuScreen
            k={k}
            subs={submissions}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'review-consolidation' && (
          <ConsolidationScreen
            k={k}
            subs={submissions}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'review-exceptions' && (
          <ExceptionsScreen
            k={k}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
