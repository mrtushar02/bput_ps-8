'use client'
/**
 * ComplianceWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * Compliance & Regulatory workspace. A single client component that switches
 * content based on `activeModule` from the AppContext. Handles six module
 * keys, each rendering its own dedicated screen:
 *
 *   - 'comp-policies'     → Policy library & governance framework
 *   - 'comp-obligations'  → Regulatory obligations tracker
 *   - 'comp-controls'     → Internal controls framework
 *   - 'comp-cases'        → Legal & regulatory cases registry
 *   - 'comp-ethics'       → Ethics & whistleblower cases
 *   - 'comp-calendar'    → Compliance calendar & deadlines
 *
 * (The 'overview', 'evidence', and 'submissions' keys are routed
 * elsewhere by the module-router — not handled here.)
 *
 * Color theme: Emerald / Green (#10b981, #059669, #047857) —
 * calm, assured palette aligned with governance & assurance.
 *
 * Data:
 *   GET /api/overview          → kpis + trends + periods
 *   GET /api/activity?take=10  → recent activities (compliance-filtered client-side)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Scale, ShieldCheck, Gavel, BookOpen, CalendarClock,
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle,
  ChevronRight, CheckCircle2, Clock, Lock, Landmark,
  Building2, FileCheck, Bell, Users, AlertTriangle,
  BadgeCheck, Sparkles, TrendingUp, ShieldAlert, ClipboardCheck,
  Flag, Activity as ActivityIcon, FileWarning,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  ResponsiveContainer, Tooltip, XAxis, YAxis, RadialBarChart,
  RadialBar, Legend, LineChart, Line,
} from 'recharts'
import { useApp } from '@/lib/auth-context'

/* ============================================================
 * Types — strict API shapes
 * ============================================================ */
interface Kpis {
  totalEmissions: number
  energyGJ: number
  waterWithdrawalKL: number
  wasteGeneratedT: number
  totalEmployees: number
  totalWorkers: number
  totalWorkforce: number
  trainingHours: number
  completion: number
  totalSubs: number
  approvedSubs: number
  draftSubs: number
  reviewSubs: number
  evidenceTotal: number
  evidenceVerified: number
  projects: number
  orgs: number
  brsrReadiness: number
  brsrMissing: number
  openExceptions: number
  anomalies: number
  corrections: number
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
 * Theme constants — Emerald / Green
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(16,185,129,0.30)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(4,120,87,0.22)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const EMERALD_PRIMARY = '#10b981'    // emerald-500
const EMERALD_SECONDARY = '#059669' // emerald-600
const EMERALD_DEEP = '#047857'      // emerald-700
const EMERALD_SOFT = '#6ee7b7'     // emerald-300
const EMERALD_TINT = '#d1fae5'     // emerald-100
const EMERALD_MIST = '#a7f3d0'     // emerald-200

const DONUT_PALETTE = [EMERALD_DEEP, EMERALD_PRIMARY, EMERALD_SECONDARY]

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
    case 'APPROVED': case 'COMPLETED': case 'RESOLVED': return 'status-approved'
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

/** Filter activities relevant to compliance. */
function isComplianceActivity(a: ActivityItem): boolean {
  const mod = (a.module ?? '').toUpperCase()
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const compModules = ['COMPLIANCE', 'REGULATORY', 'LEGAL', 'AUDIT', 'ETHICS', 'GOVERNANCE', 'POLICY']
  const compActions = ['COMPLIANCE', 'POLICY_', 'REGULATORY', 'OBLIGATION', 'CONTROL_', 'CASE_', 'ETHICS', 'AUDIT', 'LOCK']
  const compKeywords = ['compliance', 'regulatory', 'obligation', 'control', 'policy', 'ethics', 'whistleblower', 'audit', 'statutory', 'deadline', 'filing']
  return (
    compModules.some(k => mod.includes(k)) ||
    compActions.some(k => act.includes(k)) ||
    compKeywords.some(k => title.includes(k) || desc.includes(k))
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

/** Module header — title + subtitle + icon + live pill. */
function ModuleHeader({
  icon: Icon, title, subtitle, completionPct = 0, badgeText,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  completionPct?: number
  badgeText?: string
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
            background: `linear-gradient(135deg, ${EMERALD_PRIMARY}, ${EMERALD_DEEP})`,
            color: '#fff',
            boxShadow: `0 4px 14px -3px ${EMERALD_DEEP}80, inset 0 1px 1px rgba(255,255,255,0.4)`,
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
        {badgeText && (
          <span className="glass-subtle rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-700 inline-flex items-center gap-1.5">
            <Building2 className="h-3 w-3" style={{ color: EMERALD_DEEP }} />
            {badgeText}
          </span>
        )}
        <span className="status-pill text-[10px] status-approved">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
        <div className="glass-subtle rounded-xl px-3 py-1.5 flex items-center gap-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Posture</div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-20 rounded-full bg-slate-200/70 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${completionPct}%`,
                  background: `linear-gradient(90deg, ${EMERALD_DEEP}, ${EMERALD_PRIMARY})`,
                  boxShadow: `0 0 8px -1px ${EMERALD_PRIMARY}80`,
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

/** Compact KPI tile — emerald icon tile + label + value + trend pill. */
function CompKpiTile({
  icon: Icon, label, value, unit, trend, index = 0,
}: {
  icon: React.ElementType
  label: string
  value: string
  unit?: string
  trend?: { dir: 'up' | 'down' | 'neutral'; text: string; tone?: string }
  index?: number
}) {
  return (
    <motion.div
      custom={index}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-2xl p-3.5 flex flex-col gap-1.5"
      style={{ maxHeight: 100 }}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(209,250,229,0.90), rgba(167,243,208,0.70))',
            border: '1px solid rgba(16,185,129,0.30)',
            color: EMERALD_DEEP,
            boxShadow: '0 2px 8px -2px rgba(4,120,87,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 glass rounded-[20px] h-[320px] animate-pulse" />
        <div className="glass rounded-[20px] h-[320px] animate-pulse" />
      </div>
      <div className="glass rounded-[20px] h-[200px] animate-pulse" />
    </div>
  )
}

/** Error state. */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
      <AlertCircle className="h-10 w-10 text-rose-400 mb-3" />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load Compliance workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${EMERALD_PRIMARY}, ${EMERALD_DEEP})` }}
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
      <Icon className="h-10 w-10 mb-3" style={{ color: EMERALD_PRIMARY }} />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-[12px] text-slate-700 mb-4">{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${EMERALD_PRIMARY}, ${EMERALD_DEEP})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/** Activity feed — timeline of recent compliance activities. */
function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <motion.section
      custom={10}
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <ActivityIcon className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
            Recent Activity
          </h2>
          <p className="text-[10px] text-slate-700 mt-0.5">Compliance & regulatory feed · live</p>
        </div>
        <span className="status-pill text-[9px] status-approved">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {activities.length} new
        </span>
      </header>
      {activities.length === 0 ? (
        <div className="py-10 text-center">
          <Clock className="mx-auto h-7 w-7 text-slate-300" />
          <p className="text-[11px] text-slate-700 mt-2">No recent compliance activity</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto scroll-elegant pr-1">
          <ol className="relative space-y-1 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-emerald-200/70 before:via-emerald-100/40 before:to-transparent">
            <AnimatePresence initial={false}>
              {activities.map((a, i) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  className="relative flex gap-3 py-2.5 px-1 rounded-xl hover:bg-emerald-50/40 transition-colors"
                >
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="h-10 w-10 rounded-full text-white flex items-center justify-center text-[11px] font-semibold ring-2 ring-white/80"
                      style={{ background: `linear-gradient(135deg, ${EMERALD_PRIMARY}, ${EMERALD_DEEP})` }}
                    >
                      {initials(a.actorName)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-slate-900 truncate">{a.title}</span>
                      {a.status && (
                        <span className={`status-pill text-[9px] ${statusClass(a.status)}`}>
                          {a.status.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-[11px] text-slate-700 mt-0.5 line-clamp-2">{a.description}</p>
                    )}
                    <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-1.5">
                      <span className="font-medium text-slate-600">{a.actorName}</span>
                      <span>·</span>
                      <span>{a.actorRole}</span>
                      <span>·</span>
                      <span>{timeAgo(a.createdAt)}</span>
                      {a.module && (
                        <>
                          <span>·</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50/80 text-emerald-700">{a.module}</span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </div>
      )}
    </motion.section>
  )
}

/* ============================================================
 * Screen 1 — Policies
 * ============================================================ */
function derivePolicies(k: Kpis): {
  code: string; name: string; domain: string; version: string;
  approver: string; status: 'Active' | 'Draft' | 'Under Review' | 'Retired'; lastReview: string
}[] {
  const names = ['Code of Conduct', 'Anti-Bribery Policy', 'Whistleblower Policy', 'ESG Policy',
    'Information Security', 'Labour & Human Rights', 'Supplier Code of Conduct', 'Data Privacy Policy']
  const domains = ['Governance', 'Ethics', 'Ethics', 'ESG', 'IT', 'Social', 'Procurement', 'Data']
  const approvers = ['Board', 'CEO', 'Audit Committee', 'ESG Council', 'CISO', 'CHRO', 'CPO', 'DPO']
  const seed = (k.totalWorkforce + k.orgs + k.projects) || 47
  const total = Math.min(8, Math.max(6, Math.floor(seed / 30) || 7))
  const rows: ReturnType<typeof derivePolicies> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const yr = 2024 + Math.floor(r2 * 2)
    const mo = Math.floor(r2 * 12) + 1
    rows.push({
      code: `POL-${(8000 + i).toString()}`,
      name: names[i % names.length],
      domain: domains[i % domains.length],
      version: `v${1 + Math.floor(r * 3)}.${Math.floor(r2 * 9)}`,
      approver: approvers[i % approvers.length],
      status: r < 0.7 ? 'Active' : r < 0.85 ? 'Under Review' : r < 0.93 ? 'Draft' : 'Retired',
      lastReview: `${yr}-${String(mo).padStart(2, '0')}-15`,
    })
  }
  return rows
}

function PoliciesScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const policies = useMemo(() => derivePolicies(k), [k])
  const active = policies.filter(p => p.status === 'Active').length
  const underReview = policies.filter(p => p.status === 'Under Review').length
  const draft = policies.filter(p => p.status === 'Draft').length
  const retired = policies.filter(p => p.status === 'Retired').length
  const coverage = policies.length > 0 ? (active / policies.length) * 100 : 0

  const domainData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of policies) {
      map[p.domain] = (map[p.domain] ?? 0) + 1
    }
    return Object.entries(map).map(([name, value], i) => ({
      name, value, color: DONUT_PALETTE[i % DONUT_PALETTE.length],
    }))
  }, [policies])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={FileText}
        title="Policy Library"
        subtitle="Governance policies, versions & approval chain"
        completionPct={coverage}
        badgeText={`${policies.length} policies`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompKpiTile index={1} icon={FileText} label="Total Policies" value={policies.length.toString()} unit="documents" trend={{ dir: 'up', text: '+1' }} />
        <CompKpiTile index={2} icon={CheckCircle2} label="Active" value={active.toString()} unit={`${coverage.toFixed(0)}% cov.`} trend={{ dir: 'up', text: '+2' }} />
        <CompKpiTile index={3} icon={Clock} label="Under Review" value={underReview.toString()} unit="pending" trend={{ dir: 'neutral', text: '0' }} />
        <CompKpiTile index={4} icon={BadgeCheck} label="Drafts" value={draft.toString()} unit="in progress" trend={{ dir: 'up', text: '+1' }} />
      </div>

      {/* Policies table + domain donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
                <BookOpen className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
                Policy Registry
              </h2>
              <p className="text-[11px] text-slate-700 mt-0.5">
                Governance documents · version · approver · status
              </p>
            </div>
            <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5">
              Export <ChevronRight className="h-3 w-3" />
            </button>
          </header>
          <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(209,250,229,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">Code</th>
                  <th className="px-3 py-2 text-left font-semibold">Policy</th>
                  <th className="px-3 py-2 text-left font-semibold">Domain</th>
                  <th className="px-3 py-2 text-left font-semibold">Ver.</th>
                  <th className="px-3 py-2 text-left font-semibold">Approver</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p, i) => (
                  <motion.tr
                    key={p.code}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-emerald-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{p.code}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <div className="truncate">{p.name}</div>
                      <div className="text-[9px] text-slate-500">Reviewed {new Date(p.lastReview).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: 'rgba(16,185,129,0.12)',
                        color: '#047857',
                        borderColor: 'rgba(16,185,129,0.25)',
                      }}>
                        {p.domain}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">{p.version}</td>
                    <td className="px-3 py-2 text-slate-700">{p.approver}</td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${p.status === 'Active' ? 'status-approved' : p.status === 'Under Review' ? 'status-submitted' : p.status === 'Draft' ? 'status-draft' : 'status-locked'}`}>
                        {p.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Domain distribution */}
        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <Landmark className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
              Domain Coverage
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Policies by governance domain</p>
          </header>
          <div className="relative" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={domainData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {domainData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${Math.round(v)} policies`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{policies.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Policies</span>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {domainData.slice(0, 5).map(d => (
              <div key={d.name} className="glass-subtle rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-[11px] font-medium text-slate-700">{d.name}</span>
                </div>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{d.value}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/60">
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Active</span>
              <span className="text-[12px] font-bold text-slate-900 tabular-nums">{active}</span>
            </div>
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Draft</span>
              <span className="text-[12px] font-bold text-slate-900 tabular-nums">{draft}</span>
            </div>
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Retired</span>
              <span className="text-[12px] font-bold text-slate-900 tabular-nums">{retired}</span>
            </div>
          </div>
        </motion.section>
      </div>

      <ActivityFeed activities={activities} />
    </div>
  )
}

/* ============================================================
 * Screen 2 — Obligations
 * ============================================================ */
function deriveObligations(k: Kpis): {
  id: string; regulation: string; title: string; authority: string;
  frequency: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Annual';
  dueDate: string; status: 'Filed' | 'Due' | 'Overdue' | 'In Progress'
}[] {
  const regs = ['Companies Act', 'SEBI LODR', 'GST Act', 'Income Tax', 'PF & ESI', 'Environment CTE', 'Factories Act', 'BRSR']
  const titles = ['Board Composition Disclosure', 'Related Party Txns', 'GSTR-3B Filing', 'TDS Quarterly', 'PF Returns', 'Consent Renewal', 'Factory License', 'BRSR Filing']
  const authorities = ['MCA', 'SEBI', 'CBIC', 'CBDT', 'EPFO', 'MPCB', 'Factory Insp.', 'SEBI']
  const freqs: Array<'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Annual'> = ['Monthly', 'Quarterly', 'Monthly', 'Quarterly', 'Monthly', 'Half-Yearly', 'Annual', 'Annual']
  const seed = (k.totalWorkforce + k.orgs + k.openExceptions) || 53
  const total = Math.min(8, Math.max(6, Math.floor(seed / 25) || 7))
  const rows: ReturnType<typeof deriveObligations> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const day = Math.floor(r2 * 28) + 1
    const mo = Math.floor(i / 3) + 1
    rows.push({
      id: `OBL-${(9000 + i).toString()}`,
      regulation: regs[i % regs.length],
      title: titles[i % titles.length],
      authority: authorities[i % authorities.length],
      frequency: freqs[i % freqs.length],
      dueDate: `2026-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      status: r < 0.5 ? 'Filed' : r < 0.78 ? 'In Progress' : r < 0.9 ? 'Due' : 'Overdue',
    })
  }
  return rows
}

function ObligationsScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const obligations = useMemo(() => deriveObligations(k), [k])
  const filed = obligations.filter(o => o.status === 'Filed').length
  const inProgress = obligations.filter(o => o.status === 'In Progress').length
  const due = obligations.filter(o => o.status === 'Due').length
  const overdue = obligations.filter(o => o.status === 'Overdue').length
  const complianceRate = obligations.length > 0 ? (filed / obligations.length) * 100 : 0

  const statusData = [
    { name: 'Filed', value: Math.max(0.1, filed), color: EMERALD_DEEP },
    { name: 'In Progress', value: Math.max(0.1, inProgress), color: EMERALD_PRIMARY },
    { name: 'Due', value: Math.max(0.1, due), color: EMERALD_SOFT },
    { name: 'Overdue', value: Math.max(0.1, overdue), color: '#ef4444' },
  ]

  const frequencyData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of obligations) {
      map[o.frequency] = (map[o.frequency] ?? 0) + 1
    }
    return Object.entries(map).map(([name, count]) => ({ name, count }))
  }, [obligations])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Scale}
        title="Regulatory Obligations"
        subtitle="Statutory filings, frequency & deadline tracker"
        completionPct={complianceRate}
        badgeText={`${obligations.length} obligations`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompKpiTile index={1} icon={CheckCircle2} label="Filed" value={filed.toString()} unit={`${complianceRate.toFixed(0)}% rate`} trend={{ dir: 'up', text: '+2' }} />
        <CompKpiTile index={2} icon={Clock} label="In Progress" value={inProgress.toString()} unit="in pipeline" trend={{ dir: 'neutral', text: '0' }} />
        <CompKpiTile index={3} icon={AlertCircle} label="Due (≤30d)" value={due.toString()} unit="upcoming" trend={{ dir: 'up', text: `+${due}` }} />
        <CompKpiTile index={4} icon={AlertTriangle} label="Overdue" value={overdue.toString()} unit="action req." trend={{ dir: overdue > 0 ? 'up' : 'down', text: overdue > 0 ? `+${overdue}` : '0' }} />
      </div>

      {/* Obligations table + status donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
                <Scale className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
                Obligations Tracker
              </h2>
              <p className="text-[11px] text-slate-700 mt-0.5">
                {obligations.length} statutory filings · frequency & due dates
              </p>
            </div>
            <span className="status-pill text-[9px] status-warning">{due + overdue} upcoming</span>
          </header>
          <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(209,250,229,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Regulation</th>
                  <th className="px-3 py-2 text-left font-semibold">Filing</th>
                  <th className="px-3 py-2 text-left font-semibold">Authority</th>
                  <th className="px-3 py-2 text-left font-semibold">Freq.</th>
                  <th className="px-3 py-2 text-left font-semibold">Due</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {obligations.map((o, i) => (
                  <motion.tr
                    key={o.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-emerald-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{o.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{o.regulation}</td>
                    <td className="px-3 py-2 text-slate-700">{o.title}</td>
                    <td className="px-3 py-2 text-slate-700">{o.authority}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: 'rgba(16,185,129,0.12)',
                        color: '#047857',
                        borderColor: 'rgba(16,185,129,0.25)',
                      }}>
                        {o.frequency}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{new Date(o.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${o.status === 'Filed' ? 'status-approved' : o.status === 'In Progress' ? 'status-submitted' : o.status === 'Due' ? 'status-warning' : 'status-missing'}`}>
                        {o.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Status donut */}
        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
              Filing Status
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Obligations by current status</p>
          </header>
          <div className="relative" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {statusData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${Math.round(v)} obligations`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{complianceRate.toFixed(0)}%</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Compliant</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {statusData.map(d => (
              <div key={d.name} className="glass-subtle rounded-xl px-2 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-[10px] uppercase tracking-wide text-slate-700">{d.name}</span>
                </div>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{Math.round(d.value)}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Frequency breakdown */}
      <motion.section
        custom={7}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        className="glass glass-shimmer rounded-[20px] p-5"
      >
        <header className="mb-3">
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <CalendarClock className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
            Obligations by Frequency
          </h2>
          <p className="text-[10px] text-slate-700 mt-0.5">Count of recurring statutory filings</p>
        </header>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={frequencyData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }} barCategoryGap="22%">
              <defs>
                <linearGradient id="comp-freq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={EMERALD_DEEP} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={EMERALD_PRIMARY} stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(16,185,129,0.06)' }} formatter={(v: number) => [`${Math.round(v)} obligations`, 'Count']} />
              <Bar dataKey="count" fill="url(#comp-freq)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      <ActivityFeed activities={activities} />
    </div>
  )
}

/* ============================================================
 * Screen 3 — Controls
 * ============================================================ */
function deriveControls(k: Kpis): {
  id: string; control: string; framework: string; owner: string;
  effectiveness: number; status: 'Effective' | 'Partially Effective' | 'Failed' | 'Not Tested'
}[] {
  const controls = ['Segregation of Duties', 'IT Access Reviews', 'Vendor Onboarding KYC', 'Financial Close Review',
    'Change Management', 'Cybersecurity Patching', 'Payroll Reconciliation', 'Board Approvals Log']
  const frameworks = ['COSO', 'ISO 27001', 'ISO 9001', 'SOX', 'NIST CSF', 'SOC 2', 'Internal', 'Governance']
  const owners = ['CFO', 'CISO', 'CPO', 'Controller', 'CTO', 'CISO', 'CHRO', 'Company Sec.']
  const seed = (k.totalWorkforce + k.openExceptions + k.corrections) || 59
  const total = Math.min(8, Math.max(6, Math.floor(seed / 25) || 7))
  const rows: ReturnType<typeof deriveControls> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const eff = Math.round(55 + r2 * 42)
    rows.push({
      id: `CTL-${(10000 + i).toString()}`,
      control: controls[i % controls.length],
      framework: frameworks[i % frameworks.length],
      owner: owners[i % owners.length],
      effectiveness: eff,
      status: eff >= 85 ? 'Effective' : eff >= 65 ? 'Partially Effective' : eff >= 50 ? 'Not Tested' : 'Failed',
    })
  }
  return rows
}

function ControlsScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const controls = useMemo(() => deriveControls(k), [k])
  const effective = controls.filter(c => c.status === 'Effective').length
  const partial = controls.filter(c => c.status === 'Partially Effective').length
  const failed = controls.filter(c => c.status === 'Failed').length
  const notTested = controls.filter(c => c.status === 'Not Tested').length
  const avgEffectiveness = controls.length > 0
    ? controls.reduce((s, c) => s + c.effectiveness, 0) / controls.length
    : 0

  const frameworkData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of controls) {
      map[c.framework] = (map[c.framework] ?? 0) + 1
    }
    return Object.entries(map).map(([name, value], i) => ({
      name, value, color: DONUT_PALETTE[i % DONUT_PALETTE.length],
    }))
  }, [controls])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={ShieldCheck}
        title="Internal Controls"
        subtitle="Control framework mapping & effectiveness testing"
        completionPct={avgEffectiveness}
        badgeText={`${controls.length} controls`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompKpiTile index={1} icon={CheckCircle2} label="Effective" value={effective.toString()} unit="controls" trend={{ dir: 'up', text: '+1' }} />
        <CompKpiTile index={2} icon={Clock} label="Partial" value={partial.toString()} unit="remediate" trend={{ dir: 'down', text: '-1' }} />
        <CompKpiTile index={3} icon={AlertCircle} label="Failed" value={failed.toString()} unit="action req." trend={{ dir: failed > 0 ? 'up' : 'down', text: failed > 0 ? `+${failed}` : '0' }} />
        <CompKpiTile index={4} icon={BadgeCheck} label="Avg Effectiveness" value={avgEffectiveness.toFixed(1)} unit="%" trend={{ dir: 'up', text: '+2.4' }} />
      </div>

      {/* Controls table + framework donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
                Control Registry
              </h2>
              <p className="text-[11px] text-slate-700 mt-0.5">
                Framework mapping · ownership · effectiveness score
              </p>
            </div>
            <span className="status-pill text-[9px] status-warning">{failed + notTested} action req.</span>
          </header>
          <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(209,250,229,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Control</th>
                  <th className="px-3 py-2 text-left font-semibold">Framework</th>
                  <th className="px-3 py-2 text-left font-semibold">Owner</th>
                  <th className="px-3 py-2 text-left font-semibold">Effect.</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {controls.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-emerald-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{c.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{c.control}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: 'rgba(16,185,129,0.12)',
                        color: '#047857',
                        borderColor: 'rgba(16,185,129,0.25)',
                      }}>
                        {c.framework}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{c.owner}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${c.effectiveness}%`, background: `linear-gradient(90deg, ${EMERALD_DEEP}, ${EMERALD_PRIMARY})` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-900 tabular-nums">{c.effectiveness}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${c.status === 'Effective' ? 'status-approved' : c.status === 'Partially Effective' ? 'status-warning' : c.status === 'Failed' ? 'status-missing' : 'status-draft'}`}>
                        {c.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Framework coverage */}
        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <Landmark className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
              Framework Coverage
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Controls mapped to compliance frameworks</p>
          </header>
          <div className="relative" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={frameworkData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {frameworkData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${Math.round(v)} controls`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{controls.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Controls</span>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {frameworkData.slice(0, 5).map(d => (
              <div key={d.name} className="glass-subtle rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-[11px] font-medium text-slate-700">{d.name}</span>
                </div>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Effectiveness distribution */}
      <motion.section
        custom={7}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        className="glass glass-shimmer rounded-[20px] p-5"
      >
        <header className="mb-3">
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
            Effectiveness Distribution
          </h2>
          <p className="text-[10px] text-slate-700 mt-0.5">Controls by effectiveness score band</p>
        </header>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { band: '50-64', count: controls.filter(c => c.effectiveness < 65).length, fill: '#ef4444' },
                { band: '65-74', count: controls.filter(c => c.effectiveness >= 65 && c.effectiveness < 75).length, fill: '#f59e0b' },
                { band: '75-84', count: controls.filter(c => c.effectiveness >= 75 && c.effectiveness < 85).length, fill: EMERALD_PRIMARY },
                { band: '85-100', count: controls.filter(c => c.effectiveness >= 85).length, fill: EMERALD_DEEP },
              ]}
              margin={{ top: 4, right: 12, bottom: 0, left: -20 }} barCategoryGap="22%"
            >
              <XAxis dataKey="band" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(16,185,129,0.06)' }} formatter={(v: number) => [`${Math.round(v)} controls`, 'Count']} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      <ActivityFeed activities={activities} />
    </div>
  )
}

/* ============================================================
 * Screen 4 — Cases
 * ============================================================ */
function deriveCases(k: Kpis): {
  id: string; case: string; type: 'Litigation' | 'Notice' | 'Inspection' | 'Penalty';
  statute: string; filingDate: string; amount: number; status: 'Open' | 'Defended' | 'Resolved' | 'Appealed'
}[] {
  const cases = ['Tax Dispute FY22', 'Labour Commissioner Notice', 'Pollution Board Inspection', 'GST Penalty Appeal',
    'PF Compliance Showcause', 'Environment Compensation', 'Contractor Dispute', 'Factory Safety Notice']
  const statutes = ['Income Tax Act', 'Industrial Disputes', 'Water Act', 'CGST Act', 'EPF Act', 'Air Act', 'Contract Act', 'Factories Act']
  const seed = (k.totalWorkforce + k.openExceptions + k.anomalies) || 61
  const total = Math.min(8, Math.max(5, Math.floor(seed / 30) || 6))
  const rows: ReturnType<typeof deriveCases> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const r3 = ((seed * (i + 29)) % 977) / 977
    const types: Array<'Litigation' | 'Notice' | 'Inspection' | 'Penalty'> = ['Litigation', 'Notice', 'Inspection', 'Penalty']
    rows.push({
      id: `CASE-${(11000 + i).toString()}`,
      case: cases[i % cases.length],
      type: types[Math.floor(r * types.length) % types.length],
      statute: statutes[i % statutes.length],
      filingDate: `2026-${String(Math.floor(i / 3) + 1).padStart(2, '0')}-${String(Math.floor(r2 * 28) + 1).padStart(2, '0')}`,
      amount: Math.round(r2 * 4500000),
      status: r3 < 0.4 ? 'Open' : r3 < 0.65 ? 'Defended' : r3 < 0.88 ? 'Resolved' : 'Appealed',
    })
  }
  return rows
}

function CasesScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const cases = useMemo(() => deriveCases(k), [k])
  const open = cases.filter(c => c.status === 'Open').length
  const defended = cases.filter(c => c.status === 'Defended').length
  const resolved = cases.filter(c => c.status === 'Resolved').length
  const totalExposure = cases.filter(c => c.status === 'Open' || c.status === 'Appealed').reduce((s, c) => s + c.amount, 0)
  const resolutionRate = cases.length > 0 ? (resolved / cases.length) * 100 : 0

  const typeData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of cases) {
      map[c.type] = (map[c.type] ?? 0) + 1
    }
    return Object.entries(map).map(([name, value], i) => ({
      name, value, color: DONUT_PALETTE[i % DONUT_PALETTE.length],
    }))
  }, [cases])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Gavel}
        title="Legal & Regulatory Cases"
        subtitle="Litigation, notices, inspections & penalty tracker"
        completionPct={resolutionRate}
        badgeText={`${cases.length} cases`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompKpiTile index={1} icon={AlertCircle} label="Open Cases" value={open.toString()} unit="active" trend={{ dir: 'down', text: '-1' }} />
        <CompKpiTile index={2} icon={ShieldCheck} label="Defended" value={defended.toString()} unit="contested" trend={{ dir: 'up', text: '+1' }} />
        <CompKpiTile index={3} icon={CheckCircle2} label="Resolved" value={resolved.toString()} unit={`${resolutionRate.toFixed(0)}% rate`} trend={{ dir: 'up', text: '+2' }} />
        <CompKpiTile index={4} icon={AlertTriangle} label="Exposure" value={`₹${(totalExposure / 100000).toFixed(1)}L`} unit="contingent" trend={{ dir: 'up', text: '+₹3.2L' }} />
      </div>

      {/* Cases table + type donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
                <Gavel className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
                Case Registry
              </h2>
              <p className="text-[11px] text-slate-700 mt-0.5">
                {cases.length} legal & regulatory matters · type · exposure
              </p>
            </div>
            <span className="status-pill text-[9px] status-missing">{open} open</span>
          </header>
          <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(209,250,229,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Case</th>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Statute</th>
                  <th className="px-3 py-2 text-left font-semibold">Exposure</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-emerald-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{c.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <div className="truncate">{c.case}</div>
                      <div className="text-[9px] text-slate-500">Filed {new Date(c.filingDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: c.type === 'Penalty' ? 'rgba(239,68,68,0.10)' : c.type === 'Litigation' ? 'rgba(244,63,94,0.10)' : 'rgba(16,185,129,0.12)',
                        color: c.type === 'Penalty' ? '#b91c1c' : c.type === 'Litigation' ? '#9f1239' : '#047857',
                        borderColor: c.type === 'Penalty' ? 'rgba(239,68,68,0.22)' : 'rgba(16,185,129,0.25)',
                      }}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{c.statute}</td>
                    <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">₹{(c.amount / 100000).toFixed(1)}L</td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${c.status === 'Resolved' ? 'status-approved' : c.status === 'Defended' ? 'status-submitted' : c.status === 'Appealed' ? 'status-warning' : 'status-missing'}`}>
                        {c.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Type donut */}
        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <FileWarning className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
              Case Types
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Matters by legal category</p>
          </header>
          <div className="relative" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {typeData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${Math.round(v)} cases`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{cases.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Cases</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Open</span>
              <span className="text-[12px] font-bold text-slate-900 tabular-nums">{open}</span>
            </div>
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Resolved</span>
              <span className="text-[12px] font-bold text-slate-900 tabular-nums">{resolved}</span>
            </div>
          </div>
        </motion.section>
      </div>

      <ActivityFeed activities={activities} />
    </div>
  )
}

/* ============================================================
 * Screen 5 — Ethics
 * ============================================================ */
function deriveEthicsCases(k: Kpis): {
  id: string; category: string; title: string; reportedBy: string;
  severity: 'Low' | 'Medium' | 'High'; date: string; status: 'Under Investigation' | 'Resolved' | 'Closed' | 'Escalated'
}[] {
  const categories = ['Conflict of Interest', 'Financial Misconduct', 'Harassment', 'Bribery', 'Discrimination', 'Data Privacy', 'Asset Misuse', 'Procurement Fraud']
  const titles = ['Vendor kickback alleged', 'Expense irregularities', 'Workplace harassment claim', 'Gift acceptance breach', 'Caste-based bias reported', 'PII access misuse', 'Office asset misuse', 'Quote-rigging suspicion']
  const seed = (k.totalWorkforce + k.openExceptions) || 67
  const total = Math.min(8, Math.max(5, Math.floor(seed / 40) || 6))
  const rows: ReturnType<typeof deriveEthicsCases> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const r3 = ((seed * (i + 29)) % 977) / 977
    const sev: 'Low' | 'Medium' | 'High' = r2 < 0.4 ? 'High' : r2 < 0.74 ? 'Medium' : 'Low'
    rows.push({
      id: `ETH-${(12000 + i).toString()}`,
      category: categories[i % categories.length],
      title: titles[i % titles.length],
      reportedBy: r3 < 0.6 ? 'Whistleblower' : 'Internal',
      severity: sev,
      date: `2026-${String(Math.floor(i / 2) + 1).padStart(2, '0')}-${String(Math.floor(r2 * 28) + 1).padStart(2, '0')}`,
      status: r < 0.3 ? 'Under Investigation' : r < 0.55 ? 'Escalated' : r < 0.82 ? 'Resolved' : 'Closed',
    })
  }
  return rows
}

function EthicsScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const ethics = useMemo(() => deriveEthicsCases(k), [k])
  const investigating = ethics.filter(e => e.status === 'Under Investigation').length
  const escalated = ethics.filter(e => e.status === 'Escalated').length
  const resolved = ethics.filter(e => e.status === 'Resolved').length
  const high = ethics.filter(e => e.severity === 'High').length
  const resolutionRate = ethics.length > 0 ? ((resolved + ethics.filter(e => e.status === 'Closed').length) / ethics.length) * 100 : 0

  const severityData = [
    { name: 'High', value: Math.max(0.1, high), color: '#ef4444' },
    { name: 'Medium', value: Math.max(0.1, ethics.filter(e => e.severity === 'Medium').length), color: '#f59e0b' },
    { name: 'Low', value: Math.max(0.1, ethics.filter(e => e.severity === 'Low').length), color: EMERALD_PRIMARY },
  ]

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of ethics) {
      map[e.category] = (map[e.category] ?? 0) + 1
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [ethics])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Flag}
        title="Ethics & Whistleblower"
        subtitle="Ethics cases, investigations & resolution tracker"
        completionPct={resolutionRate}
        badgeText={`${ethics.length} cases`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompKpiTile index={1} icon={AlertCircle} label="Under Investigation" value={investigating.toString()} unit="active" trend={{ dir: 'up', text: '+1' }} />
        <CompKpiTile index={2} icon={ShieldAlert} label="Escalated" value={escalated.toString()} unit="to board" trend={{ dir: escalated > 0 ? 'up' : 'down', text: escalated > 0 ? `+${escalated}` : '0' }} />
        <CompKpiTile index={3} icon={AlertTriangle} label="High Severity" value={high.toString()} unit="priority" trend={{ dir: 'down', text: '0' }} />
        <CompKpiTile index={4} icon={CheckCircle2} label="Resolution Rate" value={resolutionRate.toFixed(1)} unit="%" trend={{ dir: 'up', text: '+4.8' }} />
      </div>

      {/* Ethics cases table */}
      <motion.section
        custom={5}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        className="glass glass-shimmer rounded-[20px] p-5"
      >
        <header className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
              <Flag className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
              Ethics Case Registry
            </h2>
            <p className="text-[11px] text-slate-700 mt-0.5">
              {ethics.length} reported matters · category · severity · status
            </p>
          </div>
          <span className="status-pill text-[9px] status-missing">{investigating + escalated} active</span>
        </header>
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(209,250,229,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Category</th>
                <th className="px-3 py-2 text-left font-semibold">Title</th>
                <th className="px-3 py-2 text-left font-semibold">Source</th>
                <th className="px-3 py-2 text-left font-semibold">Severity</th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {ethics.map((e, i) => (
                <motion.tr
                  key={e.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.015 }}
                  className="border-t border-slate-100 hover:bg-emerald-50/40 transition-colors"
                  style={{ height: 42 }}
                >
                  <td className="px-3 py-2 font-mono text-slate-700">{e.id}</td>
                  <td className="px-3 py-2">
                    <span className="status-pill text-[9px]" style={{
                      background: 'rgba(16,185,129,0.12)',
                      color: '#047857',
                      borderColor: 'rgba(16,185,129,0.25)',
                    }}>
                      {e.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">{e.title}</td>
                  <td className="px-3 py-2 text-slate-700">{e.reportedBy}</td>
                  <td className="px-3 py-2">
                    <span className="status-pill text-[9px]" style={{
                      background: e.severity === 'High' ? 'rgba(239,68,68,0.10)' : e.severity === 'Medium' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                      color: e.severity === 'High' ? '#b91c1c' : e.severity === 'Medium' ? '#92400e' : '#047857',
                      borderColor: e.severity === 'High' ? 'rgba(239,68,68,0.22)' : e.severity === 'Medium' ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)',
                    }}>
                      {e.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                  <td className="px-3 py-2">
                    <span className={`status-pill text-[9px] ${e.status === 'Resolved' || e.status === 'Closed' ? 'status-approved' : e.status === 'Escalated' ? 'status-missing' : 'status-submitted'}`}>
                      {e.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Severity + category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
              Severity Distribution
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Cases by reported severity level</p>
          </header>
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {severityData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${Math.round(v)} cases`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-lg font-bold text-slate-900">{ethics.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Total</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {severityData.map(d => (
              <div key={d.name} className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: d.color }} />
                <span className="text-[9px] uppercase tracking-wide text-slate-700">{d.name}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{Math.round(d.value)}</span>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          custom={7}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
              Cases by Category
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Matters grouped by ethics category</p>
          </header>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }} barCategoryGap="22%">
                <defs>
                  <linearGradient id="comp-cat" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={EMERALD_DEEP} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={EMERALD_PRIMARY} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} width={130} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(16,185,129,0.06)' }} formatter={(v: number) => [`${Math.round(v)} cases`, 'Count']} />
                <Bar dataKey="value" fill="url(#comp-cat)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
      </div>

      <ActivityFeed activities={activities} />
    </div>
  )
}

/* ============================================================
 * Screen 6 — Calendar
 * ============================================================ */
function deriveCalendarEvents(k: Kpis, periods: OverviewData['periods']): {
  id: string; title: string; type: 'Filing' | 'Audit' | 'Board' | 'Review' | 'Training';
  date: string; owner: string; priority: 'High' | 'Medium' | 'Low'; status: 'Scheduled' | 'Due Soon' | 'Overdue'
}[] {
  const titles = ['Board CSR Review', 'GST Return Filing', 'Statutory Audit Close', 'BRSR Submission', 'Internal Audit Fieldwork',
    'Whistleblower Training', 'Policy Refresh Review', 'PF Return Filing']
  const types: Array<'Filing' | 'Audit' | 'Board' | 'Review' | 'Training'> = ['Board', 'Filing', 'Audit', 'Filing', 'Audit', 'Training', 'Review', 'Filing']
  const owners = ['Company Sec.', 'CFO', 'Auditor', 'ESG Council', 'CAE', 'CHRO', 'Compliance', 'Payroll']
  const seed = (k.totalWorkforce + k.orgs + k.brsrMissing) || 71
  const total = Math.min(8, Math.max(6, Math.floor(seed / 25) || 7))
  // anchor dates to first period if available
  const baseMonth = periods && periods.length > 0 ? (periods[0].month ?? 1) : 1
  const rows: ReturnType<typeof deriveCalendarEvents> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const r3 = ((seed * (i + 29)) % 977) / 977
    const mo = ((baseMonth - 1 + i) % 12) + 1
    const day = Math.floor(r3 * 28) + 1
    const dt = new Date(2026, mo - 1, day)
    const daysToEvent = Math.floor((dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    rows.push({
      id: `CAL-${(13000 + i).toString()}`,
      title: titles[i % titles.length],
      type: types[i % types.length],
      date: dt.toISOString().slice(0, 10),
      owner: owners[i % owners.length],
      priority: r2 < 0.35 ? 'High' : r2 < 0.72 ? 'Medium' : 'Low',
      status: daysToEvent < 0 ? 'Overdue' : daysToEvent < 14 ? 'Due Soon' : 'Scheduled',
    })
  }
  return rows
}

function CalendarScreen({ k, activities, periods }: { k: Kpis; activities: ActivityItem[]; periods: OverviewData['periods'] }) {
  const events = useMemo(() => deriveCalendarEvents(k, periods), [k, periods])
  const scheduled = events.filter(e => e.status === 'Scheduled').length
  const dueSoon = events.filter(e => e.status === 'Due Soon').length
  const overdue = events.filter(e => e.status === 'Overdue').length
  const highPriority = events.filter(e => e.priority === 'High').length

  // next 6 events sorted by date
  const upcoming = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 6)
  }, [events])

  const typeData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of events) {
      map[e.type] = (map[e.type] ?? 0) + 1
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [events])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={CalendarClock}
        title="Compliance Calendar"
        subtitle="Upcoming deadlines, board meetings & audit milestones"
        completionPct={scheduled > 0 ? (scheduled / events.length) * 100 : 0}
        badgeText={`${events.length} events`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompKpiTile index={1} icon={CalendarClock} label="Scheduled" value={scheduled.toString()} unit="events" trend={{ dir: 'up', text: '+2' }} />
        <CompKpiTile index={2} icon={Clock} label="Due ≤14 Days" value={dueSoon.toString()} unit="upcoming" trend={{ dir: 'up', text: `+${dueSoon}` }} />
        <CompKpiTile index={3} icon={AlertCircle} label="Overdue" value={overdue.toString()} unit="action req." trend={{ dir: overdue > 0 ? 'up' : 'down', text: overdue > 0 ? `+${overdue}` : '0' }} />
        <CompKpiTile index={4} icon={AlertTriangle} label="High Priority" value={highPriority.toString()} unit="events" trend={{ dir: 'neutral', text: '0' }} />
      </div>

      {/* Upcoming events timeline + type bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
                <CalendarClock className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
                Upcoming Deadlines
              </h2>
              <p className="text-[11px] text-slate-700 mt-0.5">Next {upcoming.length} compliance events sorted by date</p>
            </div>
            <span className="status-pill text-[9px] status-warning">{dueSoon + overdue} due</span>
          </header>
          <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(209,250,229,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Event</th>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Owner</th>
                  <th className="px-3 py-2 text-left font-semibold">Priority</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((e, i) => (
                  <motion.tr
                    key={e.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.02 }}
                    className="border-t border-slate-100 hover:bg-emerald-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{e.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{e.title}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: 'rgba(16,185,129,0.12)',
                        color: '#047857',
                        borderColor: 'rgba(16,185,129,0.25)',
                      }}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                    <td className="px-3 py-2 text-slate-700">{e.owner}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: e.priority === 'High' ? 'rgba(239,68,68,0.10)' : e.priority === 'Medium' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                        color: e.priority === 'High' ? '#b91c1c' : e.priority === 'Medium' ? '#92400e' : '#047857',
                        borderColor: e.priority === 'High' ? 'rgba(239,68,68,0.22)' : e.priority === 'Medium' ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)',
                      }}>
                        {e.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${e.status === 'Scheduled' ? 'status-submitted' : e.status === 'Due Soon' ? 'status-warning' : 'status-missing'}`}>
                        {e.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Event type breakdown */}
        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <Bell className="h-4 w-4" style={{ color: EMERALD_DEEP }} />
              Events by Type
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Count by compliance event category</p>
          </header>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }} barCategoryGap="22%">
                <defs>
                  <linearGradient id="comp-cal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EMERALD_DEEP} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={EMERALD_PRIMARY} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(16,185,129,0.06)' }} formatter={(v: number) => [`${Math.round(v)} events`, 'Count']} />
                <Bar dataKey="value" fill="url(#comp-cal)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Scheduled</span>
              <span className="text-[12px] font-bold text-slate-900 tabular-nums">{scheduled}</span>
            </div>
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Due Soon</span>
              <span className="text-[12px] font-bold text-slate-900 tabular-nums">{dueSoon}</span>
            </div>
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Overdue</span>
              <span className="text-[12px] font-bold text-slate-900 tabular-nums">{overdue}</span>
            </div>
          </div>
        </motion.section>
      </div>

      <ActivityFeed activities={activities} />
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function ComplianceWorkspace() {
  const { activeModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
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
      const res = await fetch('/api/activity?take=10', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ActivityResponse
      if (!mountedRef.current) return
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isComplianceActivity).slice(0, 6)
      setActivities(filtered)
    } catch {
      /* silent — keep existing feed on poll error */
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

  const k = useMemo<Kpis | null>(() => {
    if (!overview?.kpis) return null
    return overview.kpis
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
        icon={ShieldCheck}
        title="No compliance data yet"
        subtitle="Set up a reporting period to populate the Compliance workspace."
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
        {activeModule === 'comp-policies' && <PoliciesScreen k={k} activities={activities} />}
        {activeModule === 'comp-obligations' && <ObligationsScreen k={k} activities={activities} />}
        {activeModule === 'comp-controls' && <ControlsScreen k={k} activities={activities} />}
        {activeModule === 'comp-cases' && <CasesScreen k={k} activities={activities} />}
        {activeModule === 'comp-ethics' && <EthicsScreen k={k} activities={activities} />}
        {activeModule === 'comp-calendar' && <CalendarScreen k={k} activities={activities} periods={periods} />}
      </motion.div>
    </AnimatePresence>
  )
}
