'use client'
/**
 * AuditorWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * Auditor workspace. A single client component that switches content
 * based on `activeModule` from the AppContext. Handles ten module keys:
 *
 *   - 'aud-engagements'   → Engagements (list)
 *   - 'aud-scope'         → Scope & Materiality (scope card)
 *   - 'aud-evidence'      → Evidence Review (evidence list)
 *   - 'aud-testing'       → Data Testing (test results)
 *   - 'aud-brsr-testing'  → BRSR Testing (BRSR test status)
 *   - 'aud-findings'      → Findings (findings list)
 *   - 'aud-requests'      → Evidence Requests (request queue)
 *   - 'aud-responses'     → Mgmt Responses (response list)
 *   - 'aud-status'        → Assurance Status (status dashboard)
 *   - 'aud-reports'       → Assurance Reports (report list)
 *
 * Color theme: Slate / Steel (#475569, #334155, #64748b) — premium
 * audit palette aligned with the assurance domain.
 *
 * Data:
 *   GET /api/overview          → kpis + trends + periods
 *   GET /api/activity?take=10  → recent activities (filtered client-side)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList, Target, FileSearch, FlaskConical, FileCheck2,
  AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle,
  ChevronRight, CircleCheck, Clock, ShieldCheck, Inbox, MessageSquare,
  BarChart3, FileText, PieChart as PieIcon, Database, Stamp,
  Scale, Crosshair, Workflow, Send, ListChecks, TrendingUp, Gauge,
  CheckCircle2, XCircle, FileWarning, MailOpen, Reply, Flame,
  Activity as ActivityIcon, Building2, FileBarChart, ClipboardCheck,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
  RadialBarChart, RadialBar,
} from 'recharts'
import { useApp } from '@/lib/auth-context'

/* ============================================================
 * Types — strict API shapes
 * ============================================================ */
interface Kpis {
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
  totalEmissions: number
  energyGJ: number
  waterWithdrawalKL: number
  wasteGeneratedT: number
  totalWorkforce: number
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
 * Theme constants — Slate / Steel
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(71,85,105,0.30)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(51,65,85,0.22)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const SLATE_PRIMARY = '#475569'  // slate-600
const SLATE_DEEP = '#334155'      // slate-700
const SLATE_DARK = '#1e293b'      // slate-800
const STEEL = '#64748b'           // slate-500
const SLATE_SOFT = '#94a3b8'      // slate-400
const SLATE_TINT = '#e2e8f0'      // slate-200
const SLATE_MIST = '#cbd5e1'      // slate-300

const DONUT_PALETTE = [SLATE_DEEP, SLATE_PRIMARY, STEEL, SLATE_SOFT, SLATE_MIST]

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

/** Filter activities relevant to auditor (audit / assurance / testing / findings). */
function isAuditorActivity(a: ActivityItem): boolean {
  const mod = (a.module ?? '').toUpperCase()
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const audMods = ['AUDIT', 'ASSURANCE', 'TEST', 'FINDING', 'EVIDENCE', 'ENGAGEMENT']
  const audActions = ['AUDIT', 'ASSURE', 'TEST', 'FINDING', 'EVIDENCE', 'REVIEW', 'APPROVE', 'LOCK', 'VERIFY']
  const audKeywords = ['audit', 'assurance', 'engagement', 'finding', 'testing', 'evidence request', 'mgmt response', 'scope', 'materiality', 'sampling', 'limited', 'reasonable']
  return (
    audMods.some(k => mod.includes(k)) ||
    audActions.some(k => act.includes(k)) ||
    audKeywords.some(k => title.includes(k) || desc.includes(k))
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

/** Module header. */
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
            background: `linear-gradient(135deg, ${SLATE_PRIMARY}, ${SLATE_DARK})`,
            color: '#fff',
            boxShadow: `0 4px 14px -3px ${SLATE_DEEP}80, inset 0 1px 1px rgba(255,255,255,0.4)`,
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
          <div className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Progress</div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-20 rounded-full bg-slate-200/70 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${completionPct}%`,
                  background: `linear-gradient(90deg, ${SLATE_DEEP}, ${SLATE_PRIMARY})`,
                  boxShadow: `0 0 8px -1px ${SLATE_PRIMARY}80`,
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
function AuditorKpiTile({
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
          style={{ background: '#dc2626', boxShadow: `0 0 8px 1px #dc2626` }}
        />
      )}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(226,232,240,0.95), rgba(203,213,225,0.75))',
            border: `1px solid rgba(71,85,105,0.35)`,
            color: SLATE_DARK,
            boxShadow: '0 2px 8px -2px rgba(30,41,59,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
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
            <Icon className="h-4 w-4" style={{ color: SLATE_DARK }} />
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
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load auditor workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${SLATE_PRIMARY}, ${SLATE_DARK})` }}
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
      <Icon className="h-10 w-10 mb-3" style={{ color: SLATE_PRIMARY }} />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-[12px] text-slate-700 mb-4">{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${SLATE_PRIMARY}, ${SLATE_DARK})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/** Activity feed card. */
function ActivityFeedCard({
  activities, loading, title = 'Recent Auditor Activities',
}: {
  activities: ActivityItem[]
  loading: boolean
  title?: string
}) {
  return (
    <SectionCard
      icon={ActivityIcon}
      title={title}
      subtitle="Auditor feed · polled every 30s"
      index={9}
      action={
        <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1">
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
          <ol className="relative space-y-1 before:absolute before:left-[16px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-slate-300/70 before:via-slate-200/40 before:to-transparent">
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
                      style={{ background: `linear-gradient(135deg, ${SLATE_PRIMARY}, ${SLATE_DARK})` }}
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
                          <span className="px-1.5 py-0.5 rounded bg-slate-100/80 text-slate-700 border border-slate-200">{a.module}</span>
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
 * Screen 1 — Engagements (aud-engagements)
 * ============================================================ */
function EngagementsScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const engagements = useMemo(() => {
    const seed = (k.brsrReadiness + k.evidenceTotal + k.totalSubs) || 1
    const rows = [
      { id: 'ENG-001', name: 'BRSR Limited Assurance FY26', type: 'Limited', auditor: 'KPMG India', start: '2026-01-15', end: '2026-03-31', status: 'Active' as const, scope: 'BRSR Core' },
      { id: 'ENG-002', name: 'GHG Emissions Reasonable FY26', type: 'Reasonable', auditor: 'DNV India', start: '2026-01-15', end: '2026-04-30', status: 'Active' as const, scope: 'Scope 1/2/3' },
      { id: 'ENG-003', name: 'Internal Audit — ESG Controls', type: 'Internal', auditor: 'In-house IA', start: '2025-12-01', end: '2026-02-15', status: 'Closed' as const, scope: 'ESG Controls' },
      { id: 'ENG-004', name: 'Stakeholder Engagement Review', type: 'Limited', auditor: 'EY India', start: '2026-02-01', end: '2026-03-15', status: 'Planning' as const, scope: 'Section B' },
      { id: 'ENG-005', name: 'Supply Chain Audit FY26', type: 'Limited', auditor: 'TUV SUD', start: '2026-01-20', end: '2026-04-15', status: 'Active' as const, scope: 'Value Chain' },
      { id: 'ENG-006', name: 'BRSR Core FY25 (carryover)', type: 'Limited', auditor: 'KPMG India', start: '2025-04-01', end: '2025-05-30', status: 'Closed' as const, scope: 'BRSR Core' },
    ]
    return rows.map((r, i) => {
      const r2 = ((seed * (i + 11)) % 997) / 997
      const procedures = 18 + Math.floor(r2 * 18)
      const completed = Math.round(procedures * (r.status === 'Closed' ? 1 : r.status === 'Active' ? 0.6 : 0.2))
      return { ...r, procedures, completed, progress: Math.round((completed / Math.max(1, procedures)) * 100) }
    })
  }, [k])

  const active = engagements.filter(e => e.status === 'Active').length
  const closed = engagements.filter(e => e.status === 'Closed').length
  const planning = engagements.filter(e => e.status === 'Planning').length
  const totalProcedures = engagements.reduce((s, e) => s + e.procedures, 0)
  const completedProcedures = engagements.reduce((s, e) => s + e.completed, 0)

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={ClipboardList}
        title="Assurance Engagements"
        subtitle={`${engagements.length} engagements · ${active} active · ${completedProcedures}/${totalProcedures} procedures`}
        completionPct={(completedProcedures / Math.max(1, totalProcedures)) * 100}
        badge={{ label: `${active} active`, tone: active > 0 ? 'status-warning' : 'status-draft', icon: ClipboardList }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AuditorKpiTile index={1} icon={ClipboardList} label="Engagements" value={formatNumber(engagements.length, 0)} unit="total" trend={{ dir: 'up', text: `${active} active` }} />
        <AuditorKpiTile index={2} icon={ActivityIcon} label="Active" value={formatNumber(active, 0)} unit="underway" trend={{ dir: active > 0 ? 'up' : 'neutral', text: `${active}` }} alert={active > 2} />
        <AuditorKpiTile index={3} icon={Clock} label="Planning" value={formatNumber(planning, 0)} unit="upcoming" trend={{ dir: planning > 0 ? 'up' : 'neutral', text: `${planning}` }} />
        <AuditorKpiTile index={4} icon={CircleCheck} label="Closed" value={formatNumber(closed, 0)} unit="complete" trend={{ dir: 'up', text: 'good' }} />
      </div>

      <SectionCard
        icon={ClipboardList}
        title="Engagement Registry"
        subtitle="Active & past engagements with scope and procedure progress"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5">
            New <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-[460px] overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(226,232,240,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Engagement</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Auditor</th>
                <th className="px-3 py-2 text-left font-semibold">Scope</th>
                <th className="px-3 py-2 text-right font-semibold">Procedures</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {engagements.map((e, i) => {
                const typeColor = e.type === 'Reasonable' ? '#dc2626' : e.type === 'Limited' ? SLATE_DEEP : STEEL
                const statusColor = e.status === 'Closed' ? '#10b981' : e.status === 'Active' ? '#f59e0b' : '#64748b'
                return (
                  <motion.tr
                    key={e.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-slate-50/40 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{e.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{e.name}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{ background: `${typeColor}1a`, color: typeColor, borderColor: `${typeColor}33` }}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{e.auditor}</td>
                    <td className="px-3 py-2 text-slate-700">{e.scope}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="tabular-nums font-semibold text-slate-900">{e.completed}</span>
                      <span className="text-slate-500">/{e.procedures}</span>
                      <span className="text-[9px] text-slate-500 ml-1">({e.progress}%)</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={BarChart3}
          title="Procedure Progress"
          subtitle="Completed vs total procedures per engagement"
          index={6}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={engagements.map(e => ({ name: e.id, completed: e.completed, total: e.procedures }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                barCategoryGap="22%"
              >
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(71,85,105,0.06)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Bar dataKey="total" fill="#cbd5e1" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} />
                <Bar dataKey="completed" fill={SLATE_DEEP} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Engagement Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 2 — Scope & Materiality (aud-scope)
 * ============================================================ */
function ScopeScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const scopeItems = useMemo(() => ([
    { id: 'SC-001', area: 'GHG Emissions (Scope 1+2)', inScope: true, material: 'High', population: 240, sample: 32, methodology: 'Substantive', risk: 'High', icon: FlaskConical, color: SLATE_DARK },
    { id: 'SC-002', area: 'Energy Consumption (GJ)', inScope: true, material: 'High', population: 180, sample: 24, methodology: 'Substantive', risk: 'High', icon: FlaskConical, color: SLATE_DEEP },
    { id: 'SC-003', area: 'Water Withdrawal', inScope: true, material: 'Medium', population: 120, sample: 16, methodology: 'Analytical', risk: 'Medium', icon: FlaskConical, color: SLATE_PRIMARY },
    { id: 'SC-004', area: 'Waste Management', inScope: true, material: 'Medium', population: 96, sample: 12, methodology: 'Analytical', risk: 'Medium', icon: FlaskConical, color: STEEL },
    { id: 'SC-005', area: 'Workforce Metrics', inScope: true, material: 'High', population: 60, sample: 14, methodology: 'Substantive', risk: 'High', icon: FlaskConical, color: SLATE_DARK },
    { id: 'SC-006', area: 'Safety (LTIFR / Injuries)', inScope: true, material: 'High', population: 48, sample: 10, methodology: 'Substantive', risk: 'High', icon: FlaskConical, color: SLATE_DEEP },
    { id: 'SC-007', area: 'BRSR Section A', inScope: true, material: 'High', population: 6, sample: 6, methodology: 'Substantive', risk: 'High', icon: FileText, color: SLATE_PRIMARY },
    { id: 'SC-008', area: 'BRSR Section B', inScope: true, material: 'Medium', population: 8, sample: 6, methodology: 'Substantive', risk: 'Medium', icon: FileText, color: STEEL },
    { id: 'SC-009', area: 'BRSR Section C', inScope: true, material: 'High', population: 9, sample: 9, methodology: 'Substantive', risk: 'High', icon: FileText, color: SLATE_DARK },
    { id: 'SC-010', area: 'CSR Spend & Impact', inScope: false, material: 'Low', population: 30, sample: 0, methodology: 'Analytical', risk: 'Low', icon: FileText, color: '#94a3b8' },
  ]), [k])

  const inScope = scopeItems.filter(s => s.inScope).length
  const totalPop = scopeItems.reduce((s, x) => s + x.population, 0)
  const totalSample = scopeItems.reduce((s, x) => s + x.sample, 0)
  const samplingRate = totalPop > 0 ? (totalSample / totalPop) * 100 : 0

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Target}
        title="Scope & Materiality"
        subtitle={`${inScope}/${scopeItems.length} areas in scope · ${totalSample}/${totalPop} sample (${samplingRate.toFixed(1)}%)`}
        completionPct={(inScope / Math.max(1, scopeItems.length)) * 100}
        badge={{ label: `${samplingRate.toFixed(0)}% sampling`, tone: 'status-approved', icon: Target }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AuditorKpiTile index={1} icon={Target} label="Scope Areas" value={formatNumber(scopeItems.length, 0)} unit="identified" trend={{ dir: 'up', text: `${inScope}` }} />
        <AuditorKpiTile index={2} icon={CheckCircle2} label="In Scope" value={formatNumber(inScope, 0)} unit="auditing" trend={{ dir: 'up', text: `${inScope}` }} />
        <AuditorKpiTile index={3} icon={Database} label="Population" value={formatNumber(totalPop, 0)} unit="items" trend={{ dir: 'up', text: `${totalPop}` }} />
        <AuditorKpiTile index={4} icon={Crosshair} label="Sample" value={formatNumber(totalSample, 0)} unit="tested" trend={{ dir: 'up', text: `${samplingRate.toFixed(0)}%` }} />
      </div>

      <SectionCard
        icon={Target}
        title="Scope Card"
        subtitle="Materiality assessment · sampling methodology · risk tier"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-[460px] overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(226,232,240,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Area</th>
                <th className="px-3 py-2 text-center font-semibold">In Scope</th>
                <th className="px-3 py-2 text-left font-semibold">Materiality</th>
                <th className="px-3 py-2 text-right font-semibold">Population</th>
                <th className="px-3 py-2 text-right font-semibold">Sample</th>
                <th className="px-3 py-2 text-left font-semibold">Method</th>
                <th className="px-3 py-2 text-left font-semibold">Risk</th>
              </tr>
            </thead>
            <tbody>
              {scopeItems.map((s, i) => {
                const matColor = s.material === 'High' ? '#dc2626' : s.material === 'Medium' ? '#f59e0b' : '#64748b'
                return (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className={`border-t border-slate-100 hover:bg-slate-50/40 transition-colors ${!s.inScope ? 'opacity-60' : ''}`}
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{s.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                        {s.area}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s.inScope ? (
                        <CheckCircle2 className="h-4 w-4 inline" style={{ color: '#10b981' }} />
                      ) : (
                        <XCircle className="h-4 w-4 inline text-slate-300" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{ background: `${matColor}1a`, color: matColor, borderColor: `${matColor}33` }}>
                        {s.material}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{s.population}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{s.sample}</td>
                    <td className="px-3 py-2 text-slate-700">{s.methodology}</td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${s.risk === 'High' ? 'status-missing' : s.risk === 'Medium' ? 'status-warning' : 'status-draft'}`}>
                        {s.risk}
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
          title="Materiality Distribution"
          subtitle="Scope areas by materiality tier"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'High', value: Math.max(0.1, scopeItems.filter(s => s.material === 'High').length), color: '#dc2626' },
                    { name: 'Medium', value: Math.max(0.1, scopeItems.filter(s => s.material === 'Medium').length), color: '#f59e0b' },
                    { name: 'Low', value: Math.max(0.1, scopeItems.filter(s => s.material === 'Low').length), color: STEEL },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}
                >
                  {['#dc2626', '#f59e0b', STEEL].map((c, i) => (<Cell key={i} fill={c} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} areas`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{scopeItems.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Areas</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Scope Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 3 — Evidence Review (aud-evidence)
 * ============================================================ */
function EvidenceScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const evidence = useMemo(() => {
    const seed = (k.evidenceTotal + k.evidenceVerified + k.openExceptions) || 1
    const titles = [
      'Energy meter readings — Plant A (Apr-Sep)',
      'Water withdrawal log — Pump house',
      'Workforce master register — HR',
      'Safety incident register Q1/Q2',
      'BRSR Section A — entity disclosure',
      'Supplier code of conduct — signed',
      'Whistleblower complaints register',
      'Waste manifests — Hazmat disposal',
      'Board composition — annual disclosure',
      'Cybersecurity policy v3.2',
      'GHG calculation workbook — Scope 1+2',
      'CSR project — Village water supply',
    ]
    const modules = ['Energy', 'Water', 'HR', 'Safety', 'BRSR', 'Procurement', 'Governance', 'Waste', 'Board', 'IT', 'Emissions', 'CSR']
    const types = ['PDF', 'XLSX', 'CSV', 'Image', 'DOCX']
    const statuses: Array<'Sufficient' | 'Partial' | 'Insufficient' | 'Pending'> = ['Sufficient', 'Partial', 'Insufficient', 'Pending']
    const reviewers = ['Audit Lead — A. Iyer', 'Sr. Auditor — R. Nair', 'Manager — P. Sharma', 'Partner — S. Reddy']
    return titles.map((t, i) => {
      const r = ((seed * (i + 11)) % 997) / 997
      const status = statuses[Math.min(3, Math.floor(r * 4))]
      const sufficient = status === 'Sufficient'
      return {
        id: `EV-${(5500 + i).toString()}`,
        title: t,
        module: modules[i % modules.length],
        type: types[i % types.length],
        status,
        reviewer: reviewers[i % reviewers.length],
        reviewedAt: new Date(Date.now() - i * 86400_000).toISOString(),
        sufficient,
      }
    })
  }, [k])

  const sufficient = evidence.filter(e => e.status === 'Sufficient').length
  const partial = evidence.filter(e => e.status === 'Partial').length
  const insufficient = evidence.filter(e => e.status === 'Insufficient').length
  const pending = evidence.filter(e => e.status === 'Pending').length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={FileSearch}
        title="Evidence Review"
        subtitle={`${evidence.length} items · ${sufficient} sufficient · ${insufficient} insufficient`}
        completionPct={(sufficient / Math.max(1, evidence.length)) * 100}
        badge={{ label: `${sufficient} sufficient`, tone: sufficient > 0 ? 'status-approved' : 'status-warning', icon: FileSearch }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AuditorKpiTile index={1} icon={FileSearch} label="Evidence Items" value={formatNumber(evidence.length, 0)} unit="reviewed" trend={{ dir: 'up', text: `${evidence.length}` }} />
        <AuditorKpiTile index={2} icon={CheckCircle2} label="Sufficient" value={formatNumber(sufficient, 0)} unit="complete" trend={{ dir: 'up', text: 'good' }} />
        <AuditorKpiTile index={3} icon={AlertTriangle} label="Partial" value={formatNumber(partial, 0)} unit="needs more" trend={{ dir: partial > 0 ? 'up' : 'neutral', text: partial > 0 ? `${partial}` : '0' }} alert={partial > 2} />
        <AuditorKpiTile index={4} icon={XCircle} label="Insufficient" value={formatNumber(insufficient, 0)} unit="blocked" trend={{ dir: insufficient > 0 ? 'up' : 'neutral', text: insufficient > 0 ? `${insufficient}` : '0' }} alert={insufficient > 0} />
      </div>

      <SectionCard
        icon={FileSearch}
        title="Evidence Review List"
        subtitle="Sufficiency assessment per evidence item"
        index={5}
      >
        <div className="space-y-2 max-h-[460px] overflow-y-auto scroll-elegant pr-1">
          {evidence.map((e, i) => {
            const statusColor = e.status === 'Sufficient' ? '#10b981' : e.status === 'Partial' ? '#f59e0b' : e.status === 'Insufficient' ? '#dc2626' : STEEL
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                    style={{ background: `${statusColor}1a`, color: statusColor, border: `1px solid ${statusColor}33` }}
                  >
                    {e.status === 'Sufficient' ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                     e.status === 'Insufficient' ? <XCircle className="h-3.5 w-3.5" /> :
                     <FileSearch className="h-3.5 w-3.5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-900 truncate">{e.title}</span>
                      <span className="status-pill text-[9px] status-draft">{e.type}</span>
                      <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
                        {e.status}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono">{e.id}</span>
                      <span>·</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100/80 text-slate-700 border border-slate-200">{e.module}</span>
                      <span>·</span>
                      <span>{e.reviewer}</span>
                      <span>·</span>
                      <span>reviewed {timeAgo(e.reviewedAt)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title="Sufficiency Distribution"
          subtitle="Sufficient · partial · insufficient · pending"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Sufficient', value: Math.max(0.1, sufficient), color: '#10b981' },
                    { name: 'Partial', value: Math.max(0.1, partial), color: '#f59e0b' },
                    { name: 'Insufficient', value: Math.max(0.1, insufficient), color: '#dc2626' },
                    { name: 'Pending', value: Math.max(0.1, pending), color: STEEL },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}
                >
                  {['#10b981', '#f59e0b', '#dc2626', STEEL].map((c, i) => (<Cell key={i} fill={c} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} items`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{evidence.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Items</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Evidence Review Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 4 — Data Testing (aud-testing)
 * ============================================================ */
function TestingScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const tests = useMemo(() => {
    const seed = (k.evidenceTotal + k.openExceptions + k.anomalies) || 1
    const rows = [
      { id: 'TST-001', area: 'Emissions — Scope 1', procedure: 'Recalculation', population: 240, sample: 32, exceptions: 0, status: 'Pass' as const, deviation: 0 },
      { id: 'TST-002', area: 'Emissions — Scope 2', procedure: 'Recalculation', population: 180, sample: 24, exceptions: 0, status: 'Pass' as const, deviation: 0 },
      { id: 'TST-003', area: 'Energy — GJ', procedure: 'Substantive', population: 180, sample: 24, exceptions: 2, status: 'Pass with exceptions' as const, deviation: 8.3 },
      { id: 'TST-004', area: 'Water Withdrawal', procedure: 'Analytical', population: 120, sample: 16, exceptions: 1, status: 'Pass with exceptions' as const, deviation: 6.2 },
      { id: 'TST-005', area: 'Waste Records', procedure: 'Analytical', population: 96, sample: 12, exceptions: 0, status: 'Pass' as const, deviation: 0 },
      { id: 'TST-006', area: 'Workforce Metrics', procedure: 'Substantive', population: 60, sample: 14, exceptions: 0, status: 'Pass' as const, deviation: 0 },
      { id: 'TST-007', area: 'Safety LTIFR', procedure: 'Substantive', population: 48, sample: 10, exceptions: 1, status: 'Pass with exceptions' as const, deviation: 4.5 },
      { id: 'TST-008', area: 'BRSR Section A', procedure: 'Walkthrough', population: 6, sample: 6, exceptions: 0, status: 'Pass' as const, deviation: 0 },
      { id: 'TST-009', area: 'BRSR Section C', procedure: 'Walkthrough', population: 9, sample: 9, exceptions: 0, status: 'Pass' as const, deviation: 0 },
      { id: 'TST-010', area: 'Renewable Share', procedure: 'Recalculation', population: 24, sample: 6, exceptions: 1, status: 'Pass with exceptions' as const, deviation: 3.1 },
      { id: 'TST-011', area: 'Hazardous Waste', procedure: 'Substantive', population: 30, sample: 8, exceptions: 2, status: 'Fail' as const, deviation: 12.5 },
      { id: 'TST-012', area: 'Training Hours', procedure: 'Analytical', population: 48, sample: 10, exceptions: 0, status: 'Pass' as const, deviation: 0 },
    ]
    return rows
  }, [k])

  const passed = tests.filter(t => t.status === 'Pass').length
  const passWithEx = tests.filter(t => t.status === 'Pass with exceptions').length
  const failed = tests.filter(t => t.status === 'Fail').length
  const totalExceptions = tests.reduce((s, t) => s + t.exceptions, 0)
  const totalSample = tests.reduce((s, t) => s + t.sample, 0)
  const exceptionRate = totalSample > 0 ? (totalExceptions / totalSample) * 100 : 0

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={FlaskConical}
        title="Data Testing"
        subtitle={`${tests.length} test procedures · ${passed} pass · ${failed} fail · ${exceptionRate.toFixed(1)}% exception rate`}
        completionPct={(passed / Math.max(1, tests.length)) * 100}
        badge={{ label: `${exceptionRate.toFixed(1)}% except`, tone: exceptionRate > 5 ? 'status-warning' : 'status-approved', icon: FlaskConical }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AuditorKpiTile index={1} icon={FlaskConical} label="Test Procedures" value={formatNumber(tests.length, 0)} unit="executed" trend={{ dir: 'up', text: `${tests.length}` }} />
        <AuditorKpiTile index={2} icon={CheckCircle2} label="Pass" value={formatNumber(passed, 0)} unit="clean" trend={{ dir: 'up', text: 'good' }} />
        <AuditorKpiTile index={3} icon={AlertTriangle} label="Exceptions" value={formatNumber(passWithEx, 0)} unit="w/ excep." trend={{ dir: passWithEx > 0 ? 'up' : 'neutral', text: passWithEx > 0 ? `${passWithEx}` : '0' }} alert={passWithEx > 2} />
        <AuditorKpiTile index={4} icon={XCircle} label="Fail" value={formatNumber(failed, 0)} unit="critical" trend={{ dir: failed > 0 ? 'up' : 'neutral', text: failed > 0 ? `${failed}` : '0' }} alert={failed > 0} />
      </div>

      <SectionCard
        icon={FlaskConical}
        title="Test Results"
        subtitle="Procedure · sample · exceptions · deviation"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-[460px] overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(226,232,240,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Area</th>
                <th className="px-3 py-2 text-left font-semibold">Procedure</th>
                <th className="px-3 py-2 text-right font-semibold">Sample</th>
                <th className="px-3 py-2 text-right font-semibold">Exceptions</th>
                <th className="px-3 py-2 text-right font-semibold">Deviation</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t, i) => {
                const statusColor = t.status === 'Pass' ? '#10b981' : t.status === 'Pass with exceptions' ? '#f59e0b' : '#dc2626'
                const exColor = t.exceptions > 0 ? '#f59e0b' : STEEL
                return (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-slate-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{t.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{t.area}</td>
                    <td className="px-3 py-2 text-slate-700">{t.procedure}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{t.sample}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: exColor }}>{t.exceptions}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{t.deviation.toFixed(1)}%</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
                        {t.status}
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
          title="Test Outcome Distribution"
          subtitle="Pass · pass w/ exceptions · fail"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Pass', value: Math.max(0.1, passed), color: '#10b981' },
                    { name: 'Pass w/ Ex', value: Math.max(0.1, passWithEx), color: '#f59e0b' },
                    { name: 'Fail', value: Math.max(0.1, failed), color: '#dc2626' },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}
                >
                  {['#10b981', '#f59e0b', '#dc2626'].map((c, i) => (<Cell key={i} fill={c} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} tests`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{tests.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Tests</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Testing Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 5 — BRSR Testing (aud-brsr-testing)
 * ============================================================ */
function BrsrTestingScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const brsrTests = useMemo(() => {
    const seed = (k.brsrReadiness + k.evidenceTotal + k.brsrMissing) || 1
    const principles = ['P1 Ethics', 'P2 Products', 'P3 Employees', 'P4 Stakeholders', 'P5 Human Rights', 'P6 Environment', 'P7 Policy', 'P8 Inclusive', 'P9 Customers']
    const statuses: Array<'Tested — Pass' | 'Tested — Pass w/ Ex' | 'In Progress' | 'Not Started' | 'Failed'> =
      ['Tested — Pass', 'Tested — Pass w/ Ex', 'In Progress', 'Not Started', 'Failed']
    return principles.map((p, i) => {
      const r = ((seed * (i + 11)) % 997) / 997
      const statusIdx = i < 6 ? Math.min(2, Math.floor(r * 3)) : Math.min(4, Math.floor(r * 5))
      const status = statuses[statusIdx]
      const indicators = 5 + Math.floor(r * 3)
      const tested = status.startsWith('Tested') ? indicators : status === 'In Progress' ? Math.floor(indicators / 2) : 0
      return {
        id: `BR-${(i + 1).toString().padStart(2, '0')}`,
        principle: p,
        indicators,
        tested,
        exceptions: status === 'Tested — Pass w/ Ex' ? 1 + Math.floor(r * 2) : status === 'Failed' ? 2 + Math.floor(r * 2) : 0,
        status,
        evidence: status === 'Not Started' ? 0 : 1 + Math.floor(r * 3),
      }
    })
  }, [k])

  const tested = brsrTests.filter(t => t.status.startsWith('Tested')).length
  const inProgress = brsrTests.filter(t => t.status === 'In Progress').length
  const notStarted = brsrTests.filter(t => t.status === 'Not Started').length
  const failed = brsrTests.filter(t => t.status === 'Failed').length
  const coverage = (tested / Math.max(1, brsrTests.length)) * 100

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={FileCheck2}
        title="BRSR Testing"
        subtitle={`${brsrTests.length} principles · ${tested} tested · ${coverage.toFixed(0)}% coverage`}
        completionPct={coverage}
        badge={{ label: `${coverage.toFixed(0)}% coverage`, tone: coverage >= 80 ? 'status-approved' : 'status-warning', icon: FileCheck2 }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AuditorKpiTile index={1} icon={FileCheck2} label="Principles" value={formatNumber(brsrTests.length, 0)} unit="tested" trend={{ dir: 'up', text: 'all' }} />
        <AuditorKpiTile index={2} icon={CheckCircle2} label="Tested" value={formatNumber(tested, 0)} unit="complete" trend={{ dir: 'up', text: `${tested}` }} />
        <AuditorKpiTile index={3} icon={Clock} label="In Progress" value={formatNumber(inProgress, 0)} unit="underway" trend={{ dir: inProgress > 0 ? 'up' : 'neutral', text: inProgress > 0 ? `${inProgress}` : '0' }} alert={inProgress > 2} />
        <AuditorKpiTile index={4} icon={XCircle} label="Not Started" value={formatNumber(notStarted, 0)} unit="pending" trend={{ dir: notStarted > 0 ? 'up' : 'neutral', text: notStarted > 0 ? `${notStarted}` : '0' }} alert={notStarted > 0} />
      </div>

      <SectionCard
        icon={FileCheck2}
        title="BRSR Test Status"
        subtitle="Per-principle testing coverage & exceptions"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-[460px] overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(226,232,240,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Principle</th>
                <th className="px-3 py-2 text-right font-semibold">Indicators</th>
                <th className="px-3 py-2 text-right font-semibold">Tested</th>
                <th className="px-3 py-2 text-right font-semibold">Exceptions</th>
                <th className="px-3 py-2 text-right font-semibold">Evidence</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {brsrTests.map((t, i) => {
                const statusColor = t.status === 'Tested — Pass' ? '#10b981' :
                  t.status === 'Tested — Pass w/ Ex' ? '#f59e0b' :
                  t.status === 'Failed' ? '#dc2626' :
                  t.status === 'In Progress' ? SLATE_DEEP : STEEL
                return (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-slate-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{t.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{t.principle}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{t.indicators}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{t.tested}<span className="text-slate-500 font-normal">/{t.indicators}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: t.exceptions > 0 ? '#dc2626' : STEEL }}>{t.exceptions}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{t.evidence}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
                        {t.status}
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
          icon={BarChart3}
          title="Indicator Coverage by Principle"
          subtitle="Tested vs total indicators"
          index={6}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={brsrTests.map(t => ({ name: t.id, tested: t.tested, total: t.indicators }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                barCategoryGap="22%"
              >
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(71,85,105,0.06)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Bar dataKey="total" fill="#cbd5e1" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} />
                <Bar dataKey="tested" fill={SLATE_DEEP} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="BRSR Testing Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 6 — Findings (aud-findings)
 * ============================================================ */
function FindingsScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const findings = useMemo(() => {
    const seed = (k.openExceptions + k.anomalies + k.corrections + k.evidenceTotal) || 1
    const titles = [
      'Scope 1 emissions recalculation differs by 4.2%',
      'Hazardous waste manifest mismatch — 2 records',
      'Energy meter reading gap of 3 days',
      'Training hours per head below target',
      'BRSR Section C P6 evidence incomplete',
      'Water withdrawal log signed but undated',
      'Workforce count variance between HR & site',
      'LTIFR calculation used incorrect hours',
      'Renewable share misclassified — pump house',
      'Supplier code of conduct expired',
      'Board composition disclosure outdated',
      'Whistleblower register not timestamped',
    ]
    const types: Array<'Factual Error' | 'Exception' | 'Observation' | 'Control Gap'> = ['Factual Error', 'Exception', 'Observation', 'Control Gap']
    const severities: Array<'Critical' | 'Significant' | 'Minor'> = ['Critical', 'Significant', 'Minor']
    const statuses: Array<'Open' | 'Mgmt Response' | 'Resolved' | 'Closed'> = ['Open', 'Mgmt Response', 'Resolved', 'Closed']
    return titles.map((t, i) => {
      const r = ((seed * (i + 7)) % 997) / 997
      const severity = severities[Math.min(2, Math.floor(r * 3))]
      const status = statuses[Math.min(3, Math.floor(r * 4))]
      return {
        id: `FND-${(6600 + i).toString()}`,
        title: t,
        type: types[i % types.length],
        severity,
        status,
        raisedAt: new Date(Date.now() - i * 86400_000 * 2).toISOString(),
        area: ['Emissions', 'Waste', 'Energy', 'HR', 'BRSR', 'Water', 'Workforce', 'Safety', 'Energy', 'Procurement', 'Board', 'Governance'][i % 12],
      }
    })
  }, [k])

  const open = findings.filter(f => f.status === 'Open').length
  const critical = findings.filter(f => f.severity === 'Critical').length
  const significant = findings.filter(f => f.severity === 'Significant').length
  const resolved = findings.filter(f => f.status === 'Resolved' || f.status === 'Closed').length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={AlertTriangle}
        title="Audit Findings"
        subtitle={`${findings.length} findings · ${open} open · ${critical} critical · ${resolved} resolved`}
        completionPct={(resolved / Math.max(1, findings.length)) * 100}
        badge={{ label: `${open} open`, tone: open > 3 ? 'status-warning' : 'status-approved', icon: AlertTriangle }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AuditorKpiTile index={1} icon={AlertTriangle} label="Findings" value={formatNumber(findings.length, 0)} unit="raised" trend={{ dir: 'up', text: `${findings.length}` }} />
        <AuditorKpiTile index={2} icon={Flame} label="Critical" value={formatNumber(critical, 0)} unit="urgent" trend={{ dir: critical > 0 ? 'up' : 'neutral', text: critical > 0 ? `${critical}` : '0' }} alert={critical > 0} />
        <AuditorKpiTile index={3} icon={Clock} label="Significant" value={formatNumber(significant, 0)} unit="material" trend={{ dir: significant > 0 ? 'up' : 'neutral', text: significant > 0 ? `${significant}` : '0' }} alert={significant > 2} />
        <AuditorKpiTile index={4} icon={CheckCircle2} label="Resolved" value={formatNumber(resolved, 0)} unit="closed" trend={{ dir: 'up', text: 'good' }} />
      </div>

      <SectionCard
        icon={AlertTriangle}
        title="Findings List"
        subtitle="Type · severity · status · area"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="space-y-2 max-h-[460px] overflow-y-auto scroll-elegant pr-1">
          {findings.map((f, i) => {
            const sevColor = f.severity === 'Critical' ? '#dc2626' : f.severity === 'Significant' ? '#f59e0b' : STEEL
            const statusColor = f.status === 'Closed' ? '#10b981' : f.status === 'Resolved' ? '#10b981' : f.status === 'Mgmt Response' ? '#a855f7' : '#dc2626'
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                    style={{ background: `${sevColor}1a`, color: sevColor, border: `1px solid ${sevColor}33` }}
                  >
                    {f.severity === 'Critical' ? <Flame className="h-3.5 w-3.5" /> :
                     f.severity === 'Significant' ? <AlertTriangle className="h-3.5 w-3.5" /> :
                     <FileWarning className="h-3.5 w-3.5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-900 truncate">{f.title}</span>
                      <span className="status-pill text-[9px]" style={{ background: `${sevColor}1a`, color: sevColor, borderColor: `${sevColor}33` }}>
                        {f.severity}
                      </span>
                      <span className="status-pill text-[9px] status-draft">{f.type}</span>
                      <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
                        {f.status}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono">{f.id}</span>
                      <span>·</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100/80 text-slate-700 border border-slate-200">{f.area}</span>
                      <span>·</span>
                      <span>raised {timeAgo(f.raisedAt)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title="Severity Distribution"
          subtitle="Critical · significant · minor findings"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Critical', value: Math.max(0.1, critical), color: '#dc2626' },
                    { name: 'Significant', value: Math.max(0.1, significant), color: '#f59e0b' },
                    { name: 'Minor', value: Math.max(0.1, findings.length - critical - significant), color: STEEL },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}
                >
                  {['#dc2626', '#f59e0b', STEEL].map((c, i) => (<Cell key={i} fill={c} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} findings`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{findings.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Findings</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Findings Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 7 — Evidence Requests (aud-requests)
 * ============================================================ */
function RequestsScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const requests = useMemo(() => {
    const seed = (k.evidenceTotal + k.openExceptions + k.totalSubs) || 1
    const titles = [
      'Request — Energy meter readings Apr-Jun',
      'Request — Water withdrawal daily logs',
      'Request — Workforce HR master export',
      'Request — Safety incident register Q1',
      'Request — BRSR Section A draft answers',
      'Request — Supplier code of conduct copy',
      'Request — Whistleblower complaints list',
      'Request — Waste manifests for FY26',
      'Request — Board composition disclosure',
      'Request — Cybersecurity policy document',
    ]
    const recipients = ['CFO — R. Iyer', 'EHS Lead — A. Nair', 'CHRO — P. Sharma', 'ESG Manager — S. Reddy', 'Company Sec — M. Patel', 'Procurement — K. Rao', 'Audit Lead — V. Menon', 'IT Head — N. Gupta']
    const priorities: Array<'High' | 'Medium' | 'Low'> = ['High', 'Medium', 'Low']
    const statuses: Array<'Open' | 'Partially Fulfilled' | 'Fulfilled' | 'Overdue'> = ['Open', 'Partially Fulfilled', 'Fulfilled', 'Overdue']
    return titles.map((t, i) => {
      const r = ((seed * (i + 11)) % 997) / 997
      const status = statuses[Math.min(3, Math.floor(r * 4))]
      const priority = priorities[Math.min(2, Math.floor(r * 3))]
      return {
        id: `REQ-${(7700 + i).toString()}`,
        title: t,
        recipient: recipients[i % recipients.length],
        priority,
        status,
        requestedAt: new Date(Date.now() - i * 86400_000 * 2).toISOString(),
        dueAt: new Date(Date.now() + (i + 1) * 86400_000).toISOString(),
      }
    })
  }, [k])

  const open = requests.filter(r => r.status === 'Open').length
  const partial = requests.filter(r => r.status === 'Partially Fulfilled').length
  const fulfilled = requests.filter(r => r.status === 'Fulfilled').length
  const overdue = requests.filter(r => r.status === 'Overdue' || (new Date(r.dueAt).getTime() < Date.now() && r.status === 'Open')).length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Inbox}
        title="Evidence Requests"
        subtitle={`${requests.length} requests · ${fulfilled} fulfilled · ${overdue} overdue`}
        completionPct={(fulfilled / Math.max(1, requests.length)) * 100}
        badge={{ label: `${overdue} overdue`, tone: overdue > 0 ? 'status-warning' : 'status-approved', icon: Inbox }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AuditorKpiTile index={1} icon={Inbox} label="Requests" value={formatNumber(requests.length, 0)} unit="raised" trend={{ dir: 'up', text: `${requests.length}` }} />
        <AuditorKpiTile index={2} icon={CheckCircle2} label="Fulfilled" value={formatNumber(fulfilled, 0)} unit="closed" trend={{ dir: 'up', text: 'good' }} />
        <AuditorKpiTile index={3} icon={Clock} label="Partial" value={formatNumber(partial, 0)} unit="incomplete" trend={{ dir: partial > 0 ? 'up' : 'neutral', text: partial > 0 ? `${partial}` : '0' }} alert={partial > 2} />
        <AuditorKpiTile index={4} icon={AlertTriangle} label="Overdue" value={formatNumber(overdue, 0)} unit="late" trend={{ dir: overdue > 0 ? 'up' : 'neutral', text: overdue > 0 ? `${overdue}` : '0' }} alert={overdue > 0} />
      </div>

      <SectionCard
        icon={Inbox}
        title="Request Queue"
        subtitle="Open evidence requests with recipient & due date"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5">
            New <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="space-y-2 max-h-[460px] overflow-y-auto scroll-elegant pr-1">
          {requests.map((r, i) => {
            const priColor = r.priority === 'High' ? '#dc2626' : r.priority === 'Medium' ? '#f59e0b' : STEEL
            const statusColor = r.status === 'Fulfilled' ? '#10b981' : r.status === 'Partially Fulfilled' ? '#a855f7' : r.status === 'Overdue' ? '#dc2626' : '#f59e0b'
            const isOverdue = new Date(r.dueAt).getTime() < Date.now() && r.status !== 'Fulfilled'
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                    style={{ background: `${priColor}1a`, color: priColor, border: `1px solid ${priColor}33` }}
                  >
                    <MailOpen className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-900 truncate">{r.title}</span>
                      <span className="status-pill text-[9px]" style={{ background: `${priColor}1a`, color: priColor, borderColor: `${priColor}33` }}>
                        {r.priority}
                      </span>
                      <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
                        {r.status}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono">{r.id}</span>
                      <span>·</span>
                      <span>{r.recipient}</span>
                      <span>·</span>
                      <span>requested {timeAgo(r.requestedAt)}</span>
                      <span>·</span>
                      <span className={isOverdue ? 'text-rose-600 font-semibold' : ''}>due {new Date(r.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{isOverdue ? ' (overdue)' : ''}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title="Request Status Distribution"
          subtitle="Fulfilled · partial · open · overdue"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Fulfilled', value: Math.max(0.1, fulfilled), color: '#10b981' },
                    { name: 'Partial', value: Math.max(0.1, partial), color: '#a855f7' },
                    { name: 'Open', value: Math.max(0.1, open), color: '#f59e0b' },
                    { name: 'Overdue', value: Math.max(0.1, overdue), color: '#dc2626' },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}
                >
                  {['#10b981', '#a855f7', '#f59e0b', '#dc2626'].map((c, i) => (<Cell key={i} fill={c} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} requests`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{requests.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Requests</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Requests Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 8 — Mgmt Responses (aud-responses)
 * ============================================================ */
function ResponsesScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const responses = useMemo(() => {
    const seed = (k.evidenceTotal + k.openExceptions + k.corrections) || 1
    const titles = [
      'Mgmt response — Scope 1 recalc variance',
      'Mgmt response — Hazmat manifest mismatch',
      'Mgmt response — Energy meter gap',
      'Mgmt response — Training deficit',
      'Mgmt response — BRSR P6 evidence gap',
      'Mgmt response — Water log undated',
      'Mgmt response — Workforce count variance',
      'Mgmt response — LTIFR hours miscount',
      'Mgmt response — Renewable misclassification',
      'Mgmt response — Supplier code expired',
    ]
    const responders = ['CFO — R. Iyer', 'EHS Lead — A. Nair', 'CHRO — P. Sharma', 'ESG Manager — S. Reddy', 'Company Sec — M. Patel', 'Procurement — K. Rao']
    const dispositions: Array<'Agreed' | 'Partially Agreed' | 'Disagreed' | 'Under Review'> = ['Agreed', 'Partially Agreed', 'Disagreed', 'Under Review']
    return titles.map((t, i) => {
      const r = ((seed * (i + 11)) % 997) / 997
      const dispo = dispositions[Math.min(3, Math.floor(r * 4))]
      return {
        id: `MGR-${(8800 + i).toString()}`,
        title: t,
        responder: responders[i % responders.length],
        disposition: dispo,
        respondedAt: new Date(Date.now() - i * 86400_000).toISOString(),
        actionPlan: dispo === 'Disagreed' ? null : ['Recalculate & re-submit by Sep 30', 'Update manifest within 7 days', 'Bridge data gap with backup meter', 'Schedule refresher training', 'Collect missing BRSR evidence', 'Sign & date water log retrospectively', 'Reconcile HR vs site records', 'Recalculate LTIFR with correct hours', 'Reclassify renewable source', 'Renew supplier code of conduct'][i],
      }
    })
  }, [k])

  const agreed = responses.filter(r => r.disposition === 'Agreed').length
  const partial = responses.filter(r => r.disposition === 'Partially Agreed').length
  const disagreed = responses.filter(r => r.disposition === 'Disagreed').length
  const underReview = responses.filter(r => r.disposition === 'Under Review').length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={MessageSquare}
        title="Management Responses"
        subtitle={`${responses.length} responses · ${agreed} agreed · ${disagreed} disagreed`}
        completionPct={(agreed / Math.max(1, responses.length)) * 100}
        badge={{ label: `${agreed} agreed`, tone: 'status-approved', icon: MessageSquare }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AuditorKpiTile index={1} icon={MessageSquare} label="Responses" value={formatNumber(responses.length, 0)} unit="received" trend={{ dir: 'up', text: `${responses.length}` }} />
        <AuditorKpiTile index={2} icon={CheckCircle2} label="Agreed" value={formatNumber(agreed, 0)} unit="accepted" trend={{ dir: 'up', text: 'good' }} />
        <AuditorKpiTile index={3} icon={Clock} label="Under Review" value={formatNumber(underReview, 0)} unit="pending" trend={{ dir: underReview > 0 ? 'up' : 'neutral', text: underReview > 0 ? `${underReview}` : '0' }} alert={underReview > 2} />
        <AuditorKpiTile index={4} icon={XCircle} label="Disagreed" value={formatNumber(disagreed, 0)} unit="contested" trend={{ dir: disagreed > 0 ? 'up' : 'neutral', text: disagreed > 0 ? `${disagreed}` : '0' }} alert={disagreed > 0} />
      </div>

      <SectionCard
        icon={MessageSquare}
        title="Response List"
        subtitle="Disposition · responder · action plan"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="space-y-2 max-h-[460px] overflow-y-auto scroll-elegant pr-1">
          {responses.map((r, i) => {
            const dispoColor = r.disposition === 'Agreed' ? '#10b981' : r.disposition === 'Partially Agreed' ? '#a855f7' : r.disposition === 'Disagreed' ? '#dc2626' : '#f59e0b'
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                    style={{ background: `${dispoColor}1a`, color: dispoColor, border: `1px solid ${dispoColor}33` }}
                  >
                    <Reply className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-900 truncate">{r.title}</span>
                      <span className="status-pill text-[9px]" style={{ background: `${dispoColor}1a`, color: dispoColor, borderColor: `${dispoColor}33` }}>
                        {r.disposition}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono">{r.id}</span>
                      <span>·</span>
                      <span>{r.responder}</span>
                      <span>·</span>
                      <span>responded {timeAgo(r.respondedAt)}</span>
                    </div>
                    {r.actionPlan ? (
                      <div className="text-[10px] text-slate-700 mt-1">
                        <span className="font-semibold text-slate-900">Action:</span> {r.actionPlan}
                      </div>
                    ) : (
                      <div className="text-[10px] mt-1" style={{ color: '#dc2626' }}>
                        <span className="font-semibold">Mgmt disagrees with finding — escalates to AC.</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title="Disposition Distribution"
          subtitle="Agreed · partially · disagreed · under review"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Agreed', value: Math.max(0.1, agreed), color: '#10b981' },
                    { name: 'Partial', value: Math.max(0.1, partial), color: '#a855f7' },
                    { name: 'Disagreed', value: Math.max(0.1, disagreed), color: '#dc2626' },
                    { name: 'Under Review', value: Math.max(0.1, underReview), color: '#f59e0b' },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}
                >
                  {['#10b981', '#a855f7', '#dc2626', '#f59e0b'].map((c, i) => (<Cell key={i} fill={c} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} responses`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{responses.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Responses</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Mgmt Response Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 9 — Assurance Status (aud-status)
 * ============================================================ */
function StatusScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const stages = useMemo(() => ([
    { name: 'Engagement Planning', pct: 100, status: 'Complete', color: '#10b981' },
    { name: 'Scope & Materiality', pct: 100, status: 'Complete', color: '#10b981' },
    { name: 'Evidence Gathering', pct: Math.min(100, Math.round((k.evidenceVerified / Math.max(1, k.evidenceTotal)) * 100)), status: 'In Progress', color: '#f59e0b' },
    { name: 'Data Testing', pct: 75, status: 'In Progress', color: '#f59e0b' },
    { name: 'BRSR Testing', pct: k.brsrReadiness, status: 'In Progress', color: '#f59e0b' },
    { name: 'Findings & Mgmt Response', pct: 50, status: 'In Progress', color: '#a855f7' },
    { name: 'Draft Assurance Report', pct: 20, status: 'Not Started', color: '#64748b' },
    { name: 'Final Report & Sign-off', pct: 0, status: 'Pending', color: '#64748b' },
  ]), [k])

  const overall = stages.reduce((s, x) => s + x.pct, 0) / stages.length
  const complete = stages.filter(s => s.status === 'Complete').length
  const inProgress = stages.filter(s => s.status === 'In Progress').length
  const pending = stages.length - complete - inProgress

  const openFindings = 4 + (k.openExceptions > 2 ? 2 : 0)
  const criticalFindings = k.openExceptions > 4 ? 2 : 1
  const passRate = Math.max(0, 100 - (criticalFindings * 10 + openFindings * 2))

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Gauge}
        title="Assurance Status"
        subtitle={`${overall.toFixed(0)}% overall · ${complete} complete · ${inProgress} in progress`}
        completionPct={overall}
        badge={{ label: `${passRate.toFixed(0)}% pass rate`, tone: passRate >= 85 ? 'status-approved' : 'status-warning', icon: Gauge }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AuditorKpiTile index={1} icon={Workflow} label="Stages" value={formatNumber(stages.length, 0)} unit="tracked" trend={{ dir: 'up', text: 'all' }} />
        <AuditorKpiTile index={2} icon={CheckCircle2} label="Complete" value={formatNumber(complete, 0)} unit="done" trend={{ dir: 'up', text: `${complete}` }} />
        <AuditorKpiTile index={3} icon={Clock} label="In Progress" value={formatNumber(inProgress, 0)} unit="underway" trend={{ dir: inProgress > 0 ? 'up' : 'neutral', text: inProgress > 0 ? `${inProgress}` : '0' }} alert={inProgress > 2} />
        <AuditorKpiTile index={4} icon={Gauge} label="Pass Rate" value={`${passRate.toFixed(0)}`} unit="%" trend={{ dir: passRate >= 85 ? 'up' : 'down', text: passRate >= 85 ? 'good' : 'low' }} />
      </div>

      <SectionCard
        icon={Gauge}
        title="Assurance Overall Gauge"
        subtitle="Composite progress across all engagement stages"
        index={5}
      >
        <div className="relative" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="40%" outerRadius="100%" data={[{ name: 'Progress', value: overall, fill: SLATE_DEEP }]} startAngle={90} endAngle={-270}>
              <RadialBar background dataKey="value" cornerRadius={10} isAnimationActive animationDuration={900} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Progress']} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="tabular-nums text-4xl font-bold text-slate-900">{overall.toFixed(0)}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold">out of 100</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={Workflow}
        title="Stage-wise Progress"
        subtitle="Per-stage completion with status"
        index={6}
      >
        <div className="space-y-2.5">
          {stages.map((s, i) => {
            const isComplete = s.status === 'Complete'
            return (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <div className="text-[12px] font-semibold text-slate-900">{s.name}</div>
                    <div className="text-[9px] text-slate-700 mt-0.5">stage {i + 1} of {stages.length}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-slate-900 tabular-nums">{s.pct}%</span>
                    <span className="status-pill text-[9px]" style={{ background: `${s.color}1a`, color: s.color, borderColor: `${s.color}33` }}>
                      {s.status}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${s.pct}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.04, ease: [0.22, 1, 0.36, 1] as const }}
                    style={{ background: `linear-gradient(90deg, ${s.color}, ${SLATE_DEEP})`, boxShadow: `0 0 8px -1px ${s.color}80` }}
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
          title="Findings & Pass Rate"
          subtitle="Open findings vs critical findings"
          index={7}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-subtle rounded-xl p-4 text-center">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Open Findings</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{openFindings}</div>
              <div className="status-pill text-[9px] status-warning mt-2 inline-flex">Open</div>
            </div>
            <div className="glass-subtle rounded-xl p-4 text-center">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Critical</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums" style={{ color: '#dc2626' }}>{criticalFindings}</div>
              <div className="status-pill text-[9px] status-missing mt-2 inline-flex">Critical</div>
            </div>
            <div className="glass-subtle rounded-xl p-4 text-center">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Pass Rate</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{passRate.toFixed(0)}%</div>
              <div className={`status-pill text-[9px] ${passRate >= 85 ? 'status-approved' : 'status-warning'} mt-2 inline-flex`}>
                {passRate >= 85 ? 'Healthy' : 'At Risk'}
              </div>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Assurance Status Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 10 — Assurance Reports (aud-reports)
 * ============================================================ */
function ReportsScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const reports = useMemo(() => {
    const seed = (k.brsrReadiness + k.evidenceTotal + k.totalSubs) || 1
    const rows = [
      { id: 'RPT-001', name: 'BRSR Limited Assurance FY26', type: 'Limited Assurance', engagement: 'ENG-001', auditor: 'KPMG India', status: 'Drafting' as const, signedAt: null as string | null, pages: 24 },
      { id: 'RPT-002', name: 'GHG Emissions Reasonable Assurance FY26', type: 'Reasonable Assurance', engagement: 'ENG-002', auditor: 'DNV India', status: 'Drafting' as const, signedAt: null as string | null, pages: 32 },
      { id: 'RPT-003', name: 'Internal Audit Report — ESG Controls', type: 'Internal Audit', engagement: 'ENG-003', auditor: 'In-house IA', status: 'Issued' as const, signedAt: '2026-02-20T00:00:00.000Z', pages: 18 },
      { id: 'RPT-004', name: 'BRSR Limited Assurance FY25', type: 'Limited Assurance', engagement: 'ENG-006', auditor: 'KPMG India', status: 'Issued' as const, signedAt: '2025-05-30T00:00:00.000Z', pages: 22 },
      { id: 'RPT-005', name: 'Stakeholder Engagement Review', type: 'Review Report', engagement: 'ENG-004', auditor: 'EY India', status: 'Not Started' as const, signedAt: null as string | null, pages: 0 },
      { id: 'RPT-006', name: 'Supply Chain Audit FY26', type: 'Audit Report', engagement: 'ENG-005', auditor: 'TUV SUD', status: 'Drafting' as const, signedAt: null as string | null, pages: 16 },
      { id: 'RPT-007', name: 'Management Letter FY26', type: 'Management Letter', engagement: 'ENG-001', auditor: 'KPMG India', status: 'Drafting' as const, signedAt: null as string | null, pages: 8 },
      { id: 'RPT-008', name: 'Audit Committee Summary', type: 'AC Summary', engagement: 'ENG-003', auditor: 'In-house IA', status: 'Issued' as const, signedAt: '2026-02-25T00:00:00.000Z', pages: 6 },
    ]
    return rows.map((r, i) => {
      const r2 = ((seed * (i + 11)) % 997) / 997
      return { ...r, version: `v${1 + Math.floor(r2 * 3)}.${Math.floor(r2 * 9)}`, updatedAt: new Date(Date.now() - i * 86400_000 * 2).toISOString() }
    })
  }, [k])

  const issued = reports.filter(r => r.status === 'Issued').length
  const drafting = reports.filter(r => r.status === 'Drafting').length
  const notStarted = reports.filter(r => r.status === 'Not Started').length
  const total = reports.length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={FileBarChart}
        title="Assurance Reports"
        subtitle={`${total} reports · ${issued} issued · ${drafting} drafting`}
        completionPct={(issued / Math.max(1, total)) * 100}
        badge={{ label: `${issued} issued`, tone: 'status-approved', icon: FileBarChart }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AuditorKpiTile index={1} icon={FileBarChart} label="Reports" value={formatNumber(total, 0)} unit="total" trend={{ dir: 'up', text: `${total}` }} />
        <AuditorKpiTile index={2} icon={Stamp} label="Issued" value={formatNumber(issued, 0)} unit="signed" trend={{ dir: 'up', text: 'good' }} />
        <AuditorKpiTile index={3} icon={Clock} label="Drafting" value={formatNumber(drafting, 0)} unit="in progress" trend={{ dir: drafting > 0 ? 'up' : 'neutral', text: drafting > 0 ? `${drafting}` : '0' }} alert={drafting > 2} />
        <AuditorKpiTile index={4} icon={XCircle} label="Not Started" value={formatNumber(notStarted, 0)} unit="pending" trend={{ dir: notStarted > 0 ? 'up' : 'neutral', text: notStarted > 0 ? `${notStarted}` : '0' }} alert={notStarted > 0} />
      </div>

      <SectionCard
        icon={FileBarChart}
        title="Report List"
        subtitle="Assurance reports · type · engagement · sign-off status"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5">
            New <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-[460px] overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(226,232,240,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Report</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Auditor</th>
                <th className="px-3 py-2 text-left font-semibold">Version</th>
                <th className="px-3 py-2 text-right font-semibold">Pages</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Signed</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => {
                const statusColor = r.status === 'Issued' ? '#10b981' : r.status === 'Drafting' ? '#f59e0b' : '#64748b'
                return (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-slate-50/40 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{r.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{r.name}</td>
                    <td className="px-3 py-2 text-slate-700">{r.type}</td>
                    <td className="px-3 py-2 text-slate-700">{r.auditor}</td>
                    <td className="px-3 py-2 font-mono text-slate-700">{r.version}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.pages}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.signedAt ? (
                        <span className="inline-flex items-center gap-1">
                          <Stamp className="h-3 w-3" style={{ color: '#10b981' }} />
                          {new Date(r.signedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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
          title="Report Status Distribution"
          subtitle="Issued · drafting · not started"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Issued', value: Math.max(0.1, issued), color: '#10b981' },
                    { name: 'Drafting', value: Math.max(0.1, drafting), color: '#f59e0b' },
                    { name: 'Not Started', value: Math.max(0.1, notStarted), color: STEEL },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}
                >
                  {['#10b981', '#f59e0b', STEEL].map((c, i) => (<Cell key={i} fill={c} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} reports`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Reports</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Reports Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function AuditorWorkspace() {
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
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isAuditorActivity).slice(0, 6)
      setActivities(filtered)
    } catch {
      /* silent */
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

  /* ---- polling ---- */
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
        icon={ClipboardList}
        title="No audit data yet"
        subtitle="Set up a reporting period to populate the auditor workspace."
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
        {activeModule === 'aud-engagements' && (
          <EngagementsScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'aud-scope' && (
          <ScopeScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'aud-evidence' && (
          <EvidenceScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'aud-testing' && (
          <TestingScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'aud-brsr-testing' && (
          <BrsrTestingScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'aud-findings' && (
          <FindingsScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'aud-requests' && (
          <RequestsScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'aud-responses' && (
          <ResponsesScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'aud-status' && (
          <StatusScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'aud-reports' && (
          <ReportsScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
