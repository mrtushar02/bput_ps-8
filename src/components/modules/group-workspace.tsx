'use client'
/**
 * GroupWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * Group / HQ Reviewer (CSO) workspace. A single client component that
 * switches content based on `activeModule` from the AppContext. Handles
 * six module keys, each rendering its own dedicated screen:
 *
 *   - 'grp-consolidation' → Group Consolidation (subsidiary rollup)
 *   - 'grp-enterprise'    → Enterprise ESG (score gauge + KPIs)
 *   - 'grp-brsr'          → BRSR Command (readiness breakdown)
 *   - 'grp-assurance'     → Assurance (audit status)
 *   - 'grp-risk'          → Risk Management (risk matrix)
 *   - 'grp-lock'          → Approvals & Lock (final lock queue)
 *
 * (The 'overview', 'evidence', and 'submissions' keys are routed elsewhere
 * by the module-router — not handled here.)
 *
 * Color theme: Navy / Gold (#1e3a8a navy + #d4a017 gold + #1e40af deep) —
 * authoritative executive palette consistent with the existing
 * GroupReviewerDashboard.
 *
 * Data:
 *   GET /api/overview          → kpis + trends + periods
 *   GET /api/activity?take=10  → recent activities (group/HQ-filtered)
 *   GET /api/submissions       → submissions list (consolidation + lock)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch, BarChart3, FileCheck2, Eye, AlertTriangle, Lock,
  RefreshCw, ArrowUpRight, ArrowDownRight, AlertCircle, ChevronRight,
  CheckCircle2, Clock, Send, FileText, Sparkles, Layers,
  Activity as ActivityIcon, Flame, Zap, Droplet, Users, TrendingUp,
  ShieldCheck, Crown, Award, Gauge, Target, Network, Building2,
  FlaskConical, BadgeCheck, Scale, AlertOctagon, XCircle,
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
  safetyTrainingHours: number
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
 * Theme constants — Navy / Gold
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,253,245,0.97)',
  border: '1px solid rgba(212,160,23,0.45)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(30,58,138,0.32)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const NAVY = '#1e3a8a'         // navy-900
const NAVY_DEEP = '#1e40af'    // blue-800
const NAVY_SOFT = '#3b82f6'    // blue-500
const GOLD = '#d4a017'         // gold
const GOLD_LIGHT = '#f4c842'   // gold light
const GOLD_DEEP = '#b8860b'    // dark gold
const GOLD_TINT = '#fef3c7'    // amber-100

const DONUT_PALETTE = [NAVY, NAVY_DEEP, GOLD, GOLD_LIGHT]

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

/** Filter activities relevant to group/HQ reviewer. */
function isGroupActivity(a: ActivityItem): boolean {
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const groupActions = ['GROUP', 'HQ', 'CONSOLIDATE', 'CONSOLIDATION', 'APPROVE', 'REJECT', 'LOCK', 'ASSURANCE', 'AUDIT']
  const groupKeywords = ['group', 'subsidiary', 'hq', 'consolidat', 'lock', 'assurance', 'audit', 'enterprise', 'brsr command']
  return (
    groupActions.some(k => act.includes(k)) ||
    groupKeywords.some(k => title.includes(k) || desc.includes(k))
  )
}

/** Derive subsidiary rollup list from KPIs + submissions. */
interface SubsidiaryRow {
  id: string
  code: string
  name: string
  bus: number
  submissions: number
  approved: number
  completion: number
  status: 'Consolidated' | 'In Review' | 'Pending' | 'At Risk'
}
function deriveSubsidiaries(k: Kpis, subs: SubmissionItem[]): SubsidiaryRow[] {
  const names = ['MEIL Renewables Ltd', 'MEIL T&D Infra Ltd', 'MEIL EPC Holdings',
    'MEIL Urban Infra Ltd', 'MEIL Manufacturing Ltd', 'MEIL PowerGen Ltd']
  const seed = (k.projects + k.orgs + k.totalSubs) || 41
  const total = Math.min(6, Math.max(3, Math.floor(seed / 60) || 4))
  const rows: SubsidiaryRow[] = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 31)) % 997) / 997
    const r2 = ((seed * (i + 43)) % 991) / 991
    const completion = Math.round(50 + r * 48)
    const status: SubsidiaryRow['status'] =
      completion >= 85 ? 'Consolidated' : completion >= 70 ? 'In Review' :
      r2 < 0.30 ? 'At Risk' : 'Pending'
    const sub = subs[i % Math.max(1, subs.length)]
    rows.push({
      id: sub?.id ?? `SUB-${(6100 + i).toString()}`,
      code: sub?.project?.projectCode ?? `MEIL-SUB-${(6100 + i).toString()}`,
      name: sub?.project?.projectName ?? names[i % names.length],
      bus: Math.max(2, Math.round(3 + r * 6)),
      submissions: Math.max(1, Math.round(4 + r * 14)),
      approved: Math.round(2 + r2 * (Math.max(1, k.approvedSubs / 3))),
      completion,
      status,
    })
  }
  return rows
}

/** Derive audit engagements from KPIs. */
interface AuditRow {
  id: string
  type: 'Internal' | 'External' | 'BRSR Audit' | 'ESG Audit' | 'Compliance'
  scope: string
  auditor: string
  startDate: string
  status: 'Planned' | 'Fieldwork' | 'Reporting' | 'Concluded' | 'On Hold'
  findings: number
  materiality: 'High' | 'Medium' | 'Low'
}
function deriveAudits(k: Kpis): AuditRow[] {
  const scopes = ['Scope 1 & 2 emissions', 'Renewable energy procurement', 'Water & waste',
    'Workforce & labour practices', 'BRSR Section A & B', 'CSR projects', 'Supply chain', 'Health & safety']
  const auditors = ['DNV India', 'TÜV SÜD', 'KPMG ESG', 'EY Sustainability', 'Bureau Veritas', 'SGS India']
  const types: AuditRow['type'][] = ['Internal', 'External', 'BRSR Audit', 'ESG Audit', 'Compliance']
  const seed = (k.brsrReadiness + k.evidenceTotal + k.totalSubs) || 17
  const total = Math.min(8, Math.max(5, Math.floor(seed / 30) || 6))
  const rows: AuditRow[] = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 37)) % 997) / 997
    const r2 = ((seed * (i + 41)) % 991) / 991
    const status: AuditRow['status'] =
      r2 < 0.20 ? 'Planned' : r2 < 0.45 ? 'Fieldwork' : r2 < 0.70 ? 'Reporting' :
      r2 < 0.90 ? 'Concluded' : 'On Hold'
    const materiality: AuditRow['materiality'] =
      r < 0.30 ? 'High' : r < 0.65 ? 'Medium' : 'Low'
    rows.push({
      id: `AUD-${(7700 + i).toString()}`,
      type: types[i % types.length],
      scope: scopes[i % scopes.length],
      auditor: auditors[i % auditors.length],
      startDate: new Date(Date.now() - (i + 1) * 7 * 86400_000).toISOString(),
      status,
      findings: Math.round(r * 8),
      materiality,
    })
  }
  return rows
}

/** Derive risk matrix items from KPIs. */
interface RiskRow {
  id: string
  category: 'Climate' | 'Compliance' | 'Operational' | 'Social' | 'Governance' | 'Financial'
  title: string
  likelihood: 1 | 2 | 3 | 4
  impact: 1 | 2 | 3 | 4
  owner: string
  mitigation: string
}
function deriveRisks(k: Kpis): RiskRow[] {
  const titles = [
    'Carbon pricing exposure (Scope 1+2)',
    'Regulatory non-compliance (BRSR)',
    'Water stress at high-stress sites',
    'Supply chain disruption (Tier-2)',
    'Workforce safety LTIFR trend',
    'Female workforce underrepresentation',
    'Hazardous waste mishandling',
    'Board independence & diversity',
    'Cybersecurity breach (ESG data)',
    'Energy price volatility',
    'Community opposition to projects',
    'Audit finding — emission factors',
  ]
  const cats: RiskRow['category'][] = ['Climate', 'Compliance', 'Operational', 'Social', 'Governance', 'Financial']
  const owners = ['CSO Office', 'Head — Compliance', 'Head — EHS', 'Head — Procurement',
    'Head — HR', 'Head — Operations', 'CFO', 'Head — IT Security']
  const mitigations = ['Net-zero roadmap by 2030', 'BRSR readiness programme', 'ZLD rollout at 3 sites',
    'Supplier ESG code + audits', 'Safety training refresh', 'DEI hiring targets',
    'Hazardous waste SOP refresh', 'Board refresh cycle', 'SOC2 + ISO 27001', 'Renewable PPA hedge',
    'Community engagement plan', 'Factor version refresh']
  const seed = (k.openExceptions + k.anomalies + k.corrections + k.brsrMissing) || 19
  const total = Math.min(12, Math.max(8, Math.floor(seed / 4) + 8))
  const rows: RiskRow[] = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 53)) % 997) / 997
    const r2 = ((seed * (i + 61)) % 991) / 991
    rows.push({
      id: `RSK-${(8200 + i).toString()}`,
      category: cats[i % cats.length],
      title: titles[i % titles.length],
      likelihood: (Math.floor(r * 4) + 1) as RiskRow['likelihood'],
      impact: (Math.floor(r2 * 4) + 1) as RiskRow['impact'],
      owner: owners[i % owners.length],
      mitigation: mitigations[i % mitigations.length],
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
            background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DEEP})`,
            color: GOLD_LIGHT,
            boxShadow: `0 4px 14px -3px ${NAVY}80, inset 0 1px 1px rgba(255,255,255,0.35)`,
            border: `1px solid ${GOLD}55`,
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
          <span className={`status-pill text-[10px] ${badge.tone}`}
            style={badge.tone === 'status-approved' ? {
              background: `rgba(212,160,23,0.15)`, color: GOLD_DEEP, borderColor: `${GOLD}55`,
            } : undefined}
          >
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
                  background: `linear-gradient(90deg, ${NAVY_DEEP}, ${GOLD})`,
                  boxShadow: `0 0 8px -1px ${GOLD}80`,
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

/** Compact KPI tile — navy/gold icon tile + label + value + trend pill. */
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
          style={{ background: GOLD_DEEP, boxShadow: `0 0 8px 1px ${GOLD_DEEP}` }}
        />
      )}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(30,58,138,0.10), rgba(212,160,23,0.15))',
            border: `1px solid ${NAVY}33`,
            color: NAVY,
            boxShadow: '0 2px 8px -2px rgba(30,58,138,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
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
            <Icon className="h-4 w-4" style={{ color: NAVY }} />
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
      <AlertCircle className="h-10 w-10 text-blue-900 mb-3" />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load group workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DEEP})`, color: GOLD_LIGHT }}
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
      <Icon className="h-10 w-10 mb-3" style={{ color: NAVY }} />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-[12px] text-slate-700 mb-4">{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DEEP})`, color: GOLD_LIGHT }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/** Shared activity feed card. */
function ActivityFeedCard({
  activities, loading, title = 'Recent Group Activity',
}: {
  activities: ActivityItem[]
  loading: boolean
  title?: string
}) {
  return (
    <SectionCard
      icon={ActivityIcon}
      title={title}
      subtitle="Group actions · polled every 30s"
      index={9}
      action={
        <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-blue-900 transition-colors inline-flex items-center gap-1">
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
            <p className="text-[11px] text-slate-700 mt-2">No group activities yet</p>
          </div>
        ) : (
          <ol className="relative space-y-1 before:absolute before:left-[16px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-amber-200/70 before:via-blue-200/40 before:to-transparent">
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
                      style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DEEP})` }}
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
                          <span className="px-1.5 py-0.5 rounded bg-blue-50/80 text-blue-900 border border-blue-200">{a.module}</span>
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
 * Screen 1 — Group Consolidation (grp-consolidation)
 * ============================================================ */
function GroupConsolidationScreen({
  k, subs, activities, activityLoading,
}: {
  k: Kpis
  subs: SubmissionItem[]
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const subsidiaries = useMemo(() => deriveSubsidiaries(k, subs), [k, subs])
  const total = subsidiaries.length
  const consolidated = subsidiaries.filter(s => s.status === 'Consolidated').length
  const inReview = subsidiaries.filter(s => s.status === 'In Review').length
  const atRisk = subsidiaries.filter(s => s.status === 'At Risk').length
  const totalSubs = subsidiaries.reduce((s, x) => s + x.submissions, 0)
  const totalApproved = subsidiaries.reduce((s, x) => s + x.approved, 0)
  const avgCompletion = total > 0 ? subsidiaries.reduce((s, x) => s + x.completion, 0) / total : k.completion

  const statusData = [
    { name: 'Consolidated', value: Math.max(0.1, consolidated), color: NAVY },
    { name: 'In Review', value: Math.max(0.1, inReview), color: NAVY_DEEP },
    { name: 'Pending', value: Math.max(0.1, total - consolidated - inReview - atRisk), color: GOLD },
    { name: 'At Risk', value: Math.max(0.1, atRisk), color: '#dc2626' },
  ]
  const barData = subsidiaries.map(s => ({ name: s.code, label: s.name, submissions: s.submissions, approved: s.approved }))

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={GitBranch}
        title="Group Consolidation"
        subtitle={`${total} subsidiaries · ${totalSubs} submissions · ${avgCompletion.toFixed(0)}% avg completion`}
        completionPct={avgCompletion}
        badge={{ label: `${consolidated} consolidated`, tone: 'status-approved', icon: CheckCircle2 }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={Network} label="Subsidiaries" value={formatNumber(total, 0)} unit="in group"
          trend={{ dir: 'up', text: `+${Math.min(total, 5)}` }} />
        <KpiTile index={2} icon={CheckCircle2} label="Consolidated" value={formatNumber(consolidated, 0)} unit="subsidiaries"
          trend={{ dir: 'up', text: `${Math.round((consolidated / Math.max(1, total)) * 100)}%`, tone: 'status-approved' }} />
        <KpiTile index={3} icon={Eye} label="In Review" value={formatNumber(inReview, 0)} unit="subsidiaries"
          trend={{ dir: inReview > 0 ? 'up' : 'neutral', text: inReview > 0 ? `+${inReview}` : '0',
            tone: inReview > 0 ? 'status-submitted' : 'status-approved' }}
          alert={inReview > 0} />
        <KpiTile index={4} icon={AlertTriangle} label="At Risk" value={formatNumber(atRisk, 0)} unit="subsidiaries"
          trend={{ dir: atRisk > 0 ? 'up' : 'neutral', text: atRisk > 0 ? `+${atRisk}` : '0',
            tone: atRisk > 0 ? 'status-missing' : 'status-approved' }}
          alert={atRisk > 0} />
      </div>

      {/* Subsidiary rollup table */}
      <SectionCard
        icon={GitBranch}
        title="Subsidiary Rollup"
        subtitle="Per-subsidiary consolidation status · submissions · approvals"
        index={5}
        action={
          <span className="status-pill text-[9px] status-submitted">
            <ActivityIcon className="h-2.5 w-2.5" />
            {subsidiaries.length} subsidiaries
          </span>
        }
      >
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(219,234,254,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">Code</th>
                <th className="px-3 py-2 text-left font-semibold">Subsidiary</th>
                <th className="px-3 py-2 text-right font-semibold">BUs</th>
                <th className="px-3 py-2 text-right font-semibold">Subs</th>
                <th className="px-3 py-2 text-right font-semibold">Approved</th>
                <th className="px-3 py-2 text-right font-semibold">Completion</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {subsidiaries.map((s, i) => {
                const stColor = s.status === 'Consolidated' ? '#10b981' :
                  s.status === 'In Review' ? NAVY_DEEP :
                  s.status === 'At Risk' ? '#dc2626' : GOLD
                return (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.025 }}
                    className="border-t border-slate-100 hover:bg-blue-50/40 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{s.code}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{s.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{s.bus}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{s.submissions}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{s.approved}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${s.completion}%`,
                              background: `linear-gradient(90deg, ${NAVY_DEEP}, ${GOLD})`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-900 tabular-nums w-8 text-right">{s.completion}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: `${stColor}1a`, color: stColor, borderColor: `${stColor}33`,
                      }}>
                        {s.status}
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Subsidiary mix bar + status donut + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={BarChart3}
          title="Submissions per Subsidiary"
          subtitle="Total vs approved submissions"
          index={6}
          action={
            <span className="status-pill text-[9px] status-approved">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {totalApproved}/{totalSubs} approved
            </span>
          }
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="grp-cons-sub" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} />
                    <stop offset="100%" stopColor={NAVY_DEEP} />
                  </linearGradient>
                  <linearGradient id="grp-cons-appr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} />
                    <stop offset="100%" stopColor={GOLD_DEEP} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(30,58,138,0.08)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Bar dataKey="submissions" name="Submissions" fill="url(#grp-cons-sub)" radius={[4, 4, 0, 0]} barSize={14} isAnimationActive animationDuration={600} />
                <Bar dataKey="approved" name="Approved" fill="url(#grp-cons-appr)" radius={[4, 4, 0, 0]} barSize={14} isAnimationActive animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          icon={Network}
          title="Status Breakdown"
          subtitle="Subsidiaries by consolidation status"
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
                  formatter={(v: number, n: string) => [`${v.toFixed(0)} subsidiaries`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Subsidiaries</span>
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
        </SectionCard>
      </div>

      <ActivityFeedCard activities={activities} loading={activityLoading} title="Consolidation Activity" />
    </div>
  )
}

/* ============================================================
 * Screen 2 — Enterprise ESG (grp-enterprise)
 * ============================================================ */
function EnterpriseEsgScreen({
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
      }))
    }
    return Object.entries(trends).slice(-6).map(([label, v]) => ({
      label,
      emissions: Math.round((v as Record<string, number>).emissions ?? 0),
      energy: Math.round((v as Record<string, number>).energy ?? 0),
    }))
  }, [trends, k])

  // Enterprise ESG score — composite
  const esgScore = Math.min(100, Math.round(
    (k.completion * 0.30) + (k.brsrReadiness * 0.35) +
    ((k.evidenceTotal > 0 ? (k.evidenceVerified / k.evidenceTotal) * 100 : 0) * 0.15) +
    (Math.max(0, 100 - k.openExceptions * 4) * 0.10) +
    (Math.max(0, 100 - k.ltifr * 25) * 0.10),
  ))
  const eScore = Math.min(100, Math.round((k.renewableShare + (100 - Math.min(100, k.totalEmissions / Math.max(1, k.totalEmissions + 100) * 100)) + k.wasteRecycledShare + k.waterRecycledShare) / 4))
  const sScore = Math.min(100, Math.round((k.completion + k.brsrReadiness + Math.min(100, k.femaleShare * 2) + Math.min(100, 100 - k.ltifr * 25)) / 4))
  const gScore = Math.min(100, Math.round((k.brsrReadiness + k.completion + (k.evidenceTotal > 0 ? (k.evidenceVerified / k.evidenceTotal) * 100 : 0)) / 3))

  const radialData = [{ name: 'ESG Score', value: esgScore, fill: NAVY }]
  const esgBreakdown = [
    { name: 'Environment', value: eScore, fill: NAVY },
    { name: 'Social', value: sScore, fill: NAVY_DEEP },
    { name: 'Governance', value: gScore, fill: GOLD },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={BarChart3}
        title="Enterprise ESG Performance"
        subtitle={`Enterprise ESG score ${esgScore}/100 · ${k.orgs} entities consolidated`}
        completionPct={k.completion}
        badge={{ label: esgScore >= 75 ? 'Excellent' : esgScore >= 60 ? 'On Track' : 'Needs Work',
          tone: 'status-approved', icon: Crown }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={Flame} label="Group Emissions" value={formatNumber(k.totalEmissions, 0)} unit="tCO₂e"
          trend={{ dir: 'down', text: `S1:${k.scope1.toFixed(0)}`, tone: 'status-approved' }} />
        <KpiTile index={2} icon={Zap} label="Energy" value={formatNumber(k.energyGJ, 0)} unit="GJ"
          trend={{ dir: 'up', text: `${k.renewableShare.toFixed(0)}% renew`, tone: 'status-approved' }} />
        <KpiTile index={3} icon={Users} label="Workforce" value={formatNumber(k.totalWorkforce, 0)} unit="headcount"
          trend={{ dir: 'up', text: `${k.femaleShare.toFixed(0)}% F` }} />
        <KpiTile index={4} icon={ShieldCheck} label="LTIFR" value={k.ltifr.toFixed(2)} unit="per 1M h"
          trend={{ dir: k.ltifr <= 1 ? 'down' : 'up', text: k.ltifr <= 1 ? 'low' : 'high',
            tone: k.ltifr <= 1 ? 'status-approved' : 'status-warning' }}
          alert={k.ltifr > 1} />
      </div>

      {/* ESG gauge + breakdown bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={Gauge}
          title="Enterprise ESG Score"
          subtitle="Composite of completion, BRSR, evidence, safety"
          index={5}
          action={
            <span className="status-pill text-[9px]" style={{
              background: `${GOLD}22`, color: GOLD_DEEP, borderColor: `${GOLD}55`,
            }}>
              <Crown className="h-2.5 w-2.5" />
              Group
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
                  <linearGradient id="grp-esg-radial" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={NAVY_DEEP} />
                    <stop offset="60%" stopColor={NAVY} />
                    <stop offset="100%" stopColor={GOLD} />
                  </linearGradient>
                </defs>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={20} fill="url(#grp-esg-radial)" background={{ fill: 'rgba(30,58,138,0.08)' }} />
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
          title="Enterprise ESG Trend"
          subtitle="Emissions & energy over time"
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
                  <linearGradient id="grp-esg-emis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={NAVY} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="grp-esg-energy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={GOLD} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: NAVY, strokeDasharray: '4 4' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Area type="monotone" dataKey="emissions" name="Emissions (tCO₂e)" stroke={NAVY} strokeWidth={1.8} fill="url(#grp-esg-emis)" isAnimationActive animationDuration={600} />
                <Area type="monotone" dataKey="energy" name="Energy (GJ)" stroke={GOLD} strokeWidth={1.8} fill="url(#grp-esg-energy)" isAnimationActive animationDuration={600} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <ActivityFeedCard activities={activities} loading={activityLoading} title="Enterprise Activity Feed" />
    </div>
  )
}

/* ============================================================
 * Screen 3 — BRSR Command (grp-brsr)
 * ============================================================ */
function BrsrCommandScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  // Section-wise readiness — derived from KPIs
  const sections = useMemo(() => {
    const seed = (k.brsrReadiness + k.brsrMissing + k.totalSubs) || 13
    const defs = [
      { code: 'A', name: 'Section A — General', desc: 'Entity profile, operations & value chain' },
      { code: 'B1', name: 'Section B1 — Environment', desc: 'GHG, energy, water, waste, biodiversity' },
      { code: 'B2', name: 'Section B2 — Social', desc: 'Workforce, human rights, communities' },
      { code: 'B3', name: 'Section B3 — Governance', desc: 'Board, ethics, regulatory, risk' },
      { code: 'B4', name: 'Section B4 — Principles', desc: '9 NGBC principles' },
      { code: 'B5', name: 'Section B5 — Climate', desc: 'Climate risk & TCFD-aligned disclosures' },
    ]
    return defs.map((d, i) => {
      const r = ((seed * (i + 19)) % 997) / 997
      const readiness = Math.round(35 + r * 60)
      const total = Math.max(8, Math.round((k.totalSubs + 4) / Math.max(1, k.orgs)))
      const answered = Math.round(total * (readiness / 100))
      const missing = Math.max(0, total - answered)
      const status = readiness >= 80 ? 'Ready' : readiness >= 60 ? 'On Track' : readiness >= 40 ? 'At Risk' : 'Missing'
      return { ...d, readiness, answered, total, missing, status }
    })
  }, [k])

  const readyCount = sections.filter(s => s.status === 'Ready').length
  const onTrack = sections.filter(s => s.status === 'On Track').length
  const atRisk = sections.filter(s => s.status === 'At Risk').length
  const missingCount = sections.filter(s => s.status === 'Missing').length

  const statusData = [
    { name: 'Ready', value: Math.max(0.1, readyCount), color: NAVY },
    { name: 'On Track', value: Math.max(0.1, onTrack), color: NAVY_DEEP },
    { name: 'At Risk', value: Math.max(0.1, atRisk), color: GOLD },
    { name: 'Missing', value: Math.max(0.1, missingCount), color: '#dc2626' },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={FileCheck2}
        title="BRSR Command Center"
        subtitle={`${sections.length} sections · ${k.brsrReadiness.toFixed(0)}% readiness · ${k.brsrMissing} missing items`}
        completionPct={k.brsrReadiness}
        badge={{ label: `${readyCount} ready`, tone: 'status-approved', icon: BadgeCheck }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={Layers} label="Sections" value={formatNumber(sections.length, 0)} unit="tracked"
          trend={{ dir: 'up', text: '6 BRSR' }} />
        <KpiTile index={2} icon={CheckCircle2} label="Ready" value={formatNumber(readyCount, 0)} unit="sections"
          trend={{ dir: 'up', text: `${Math.round((readyCount / Math.max(1, sections.length)) * 100)}%`, tone: 'status-approved' }} />
        <KpiTile index={3} icon={AlertTriangle} label="At Risk" value={formatNumber(atRisk, 0)} unit="sections"
          trend={{ dir: atRisk > 0 ? 'up' : 'neutral', text: atRisk > 0 ? `+${atRisk}` : '0',
            tone: atRisk > 0 ? 'status-warning' : 'status-approved' }}
          alert={atRisk > 0} />
        <KpiTile index={4} icon={AlertCircle} label="Missing" value={formatNumber(k.brsrMissing, 0)} unit="items"
          trend={{ dir: k.brsrMissing > 0 ? 'up' : 'neutral', text: k.brsrMissing > 0 ? `+${k.brsrMissing}` : '0',
            tone: k.brsrMissing > 0 ? 'status-missing' : 'status-approved' }}
          alert={k.brsrMissing > 0} />
      </div>

      {/* Readiness bar chart */}
      <SectionCard
        icon={FileCheck2}
        title="Section Readiness Breakdown"
        subtitle="BRSR section-wise readiness scores"
        index={5}
        action={
          <span className="status-pill text-[9px]" style={{
            background: `${GOLD}22`, color: GOLD_DEEP, borderColor: `${GOLD}55`,
          }}>
            <Gauge className="h-2.5 w-2.5" />
            {k.brsrReadiness.toFixed(0)}% avg
          </span>
        }
      >
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sections} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="grp-brsr-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={NAVY} />
                  <stop offset="100%" stopColor={NAVY_DEEP} />
                </linearGradient>
              </defs>
              <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} domain={[0, 100]} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number, n: string) => [`${v.toFixed(0)}${n === 'Readiness' ? '%' : ''}`, n]}
                labelFormatter={(l: unknown) => {
                  const item = sections.find(d => d.code === String(l))
                  return item ? item.name : String(l)
                }}
                cursor={{ fill: 'rgba(30,58,138,0.08)' }}
              />
              <Bar dataKey="readiness" name="Readiness" fill="url(#grp-brsr-bar)" radius={[6, 6, 0, 0]} barSize={32} isAnimationActive animationDuration={700} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Section table + status donut */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
        <SectionCard
          icon={Layers}
          title="Section Detail"
          subtitle="Per-section readiness, answered/missing, status"
          index={6}
          action={
            <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-blue-900 transition-colors inline-flex items-center gap-1.5">
              Export <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(219,234,254,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">Section</th>
                  <th className="px-3 py-2 text-right font-semibold">Answered</th>
                  <th className="px-3 py-2 text-right font-semibold">Missing</th>
                  <th className="px-3 py-2 text-right font-semibold">Readiness</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s, i) => {
                  const stColor = s.status === 'Ready' ? '#10b981' :
                    s.status === 'On Track' ? NAVY_DEEP :
                    s.status === 'At Risk' ? GOLD : '#dc2626'
                  return (
                    <motion.tr
                      key={s.code}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.025 }}
                      className="border-t border-slate-100 hover:bg-blue-50/40 transition-colors"
                      style={{ height: 44 }}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900 truncate max-w-[240px]">{s.name}</div>
                        <div className="text-[9px] text-slate-500">{s.desc}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{s.answered}/{s.total}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: s.missing > 0 ? '#dc2626' : undefined }}>
                        {s.missing}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${s.readiness}%`,
                                background: `linear-gradient(90deg, ${NAVY}, ${GOLD})`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-900 tabular-nums w-8 text-right">{s.readiness}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="status-pill text-[9px]" style={{
                          background: `${stColor}1a`, color: stColor, borderColor: `${stColor}33`,
                        }}>
                          {s.status}
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
          title="Section Status"
          subtitle="Sections by readiness status"
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
                  formatter={(v: number, n: string) => [`${v.toFixed(0)} sections`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{sections.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Sections</span>
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
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Readiness</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.brsrReadiness.toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Missing</div>
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
 * Screen 4 — Assurance (grp-assurance)
 * ============================================================ */
function AssuranceScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const audits = useMemo(() => deriveAudits(k), [k])
  const total = audits.length
  const inFieldwork = audits.filter(a => a.status === 'Fieldwork').length
  const concluded = audits.filter(a => a.status === 'Concluded').length
  const totalFindings = audits.reduce((s, a) => s + a.findings, 0)
  const highMateriality = audits.filter(a => a.materiality === 'High').length

  const statusData = [
    { name: 'Fieldwork', value: Math.max(0.1, inFieldwork), color: NAVY },
    { name: 'Reporting', value: Math.max(0.1, audits.filter(a => a.status === 'Reporting').length), color: NAVY_DEEP },
    { name: 'Concluded', value: Math.max(0.1, concluded), color: GOLD },
    { name: 'Planned', value: Math.max(0.1, audits.filter(a => a.status === 'Planned').length), color: NAVY_SOFT },
    { name: 'On Hold', value: Math.max(0.1, audits.filter(a => a.status === 'On Hold').length), color: '#dc2626' },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Eye}
        title="Assurance & Audit"
        subtitle={`${total} engagements · ${inFieldwork} in fieldwork · ${totalFindings} findings · ${highMateriality} high materiality`}
        completionPct={k.completion}
        badge={{ label: `${concluded} concluded`, tone: 'status-approved', icon: BadgeCheck }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={FlaskConical} label="Engagements" value={formatNumber(total, 0)} unit="active"
          trend={{ dir: 'up', text: `+${Math.min(total, 5)}` }} />
        <KpiTile index={2} icon={Eye} label="In Fieldwork" value={formatNumber(inFieldwork, 0)} unit="audits"
          trend={{ dir: inFieldwork > 0 ? 'up' : 'neutral', text: inFieldwork > 0 ? `+${inFieldwork}` : '0',
            tone: inFieldwork > 0 ? 'status-submitted' : 'status-approved' }}
          alert={inFieldwork > 0} />
        <KpiTile index={3} icon={AlertTriangle} label="Total Findings" value={formatNumber(totalFindings, 0)} unit="across"
          trend={{ dir: totalFindings > 0 ? 'up' : 'neutral', text: totalFindings > 0 ? `+${totalFindings}` : '0',
            tone: totalFindings > 0 ? 'status-warning' : 'status-approved' }}
          alert={totalFindings > 5} />
        <KpiTile index={4} icon={AlertOctagon} label="High Materiality" value={formatNumber(highMateriality, 0)} unit="audits"
          trend={{ dir: highMateriality > 0 ? 'up' : 'neutral', text: highMateriality > 0 ? `+${highMateriality}` : '0',
            tone: highMateriality > 0 ? 'status-missing' : 'status-approved' }}
          alert={highMateriality > 0} />
      </div>

      {/* Audit engagements table */}
      <SectionCard
        icon={FlaskConical}
        title="Audit Engagements"
        subtitle="Internal, external, BRSR & ESG audit register"
        index={5}
        action={
          <span className="status-pill text-[9px] status-submitted">
            <ActivityIcon className="h-2.5 w-2.5" />
            {audits.length} engagements
          </span>
        }
      >
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(219,234,254,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Scope</th>
                <th className="px-3 py-2 text-left font-semibold">Auditor</th>
                <th className="px-3 py-2 text-left font-semibold">Started</th>
                <th className="px-3 py-2 text-right font-semibold">Findings</th>
                <th className="px-3 py-2 text-left font-semibold">Materiality</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a, i) => {
                const stColor = a.status === 'Concluded' ? '#10b981' :
                  a.status === 'Fieldwork' ? NAVY_DEEP :
                  a.status === 'Reporting' ? GOLD :
                  a.status === 'On Hold' ? '#dc2626' : NAVY_SOFT
                const matColor = a.materiality === 'High' ? '#dc2626' :
                  a.materiality === 'Medium' ? GOLD : NAVY_SOFT
                return (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.025 }}
                    className="border-t border-slate-100 hover:bg-blue-50/40 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{a.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{a.type}</td>
                    <td className="px-3 py-2 text-slate-700">{a.scope}</td>
                    <td className="px-3 py-2 text-slate-700">{a.auditor}</td>
                    <td className="px-3 py-2 text-slate-700">{timeAgo(a.startDate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: a.findings > 0 ? '#dc2626' : undefined }}>
                      {a.findings}
                    </td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: `${matColor}1a`, color: matColor, borderColor: `${matColor}33`,
                      }}>
                        {a.materiality}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: `${stColor}1a`, color: stColor, borderColor: `${stColor}33`,
                      }}>
                        {a.status}
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Audit status donut + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={Award}
          title="Engagement Status"
          subtitle="Audits by lifecycle stage"
          index={6}
          action={
            <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-blue-900 transition-colors inline-flex items-center gap-1">
              Filter <ChevronRight className="h-3 w-3" />
            </button>
          }
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
                  formatter={(v: number, n: string) => [`${v.toFixed(0)} engagements`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Audits</span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1 mt-2">
            {statusData.map(d => (
              <div key={d.name} className="glass-subtle rounded-lg px-0.5 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-0.5" style={{ background: d.color }} />
                <span className="text-[7px] uppercase tracking-wide text-slate-700">{d.name}</span>
                <span className="text-[10px] font-bold text-slate-900 tabular-nums">{Math.round(d.value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200/60 glass-subtle rounded-xl px-3 py-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Evidence Verified</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.evidenceVerified}/{k.evidenceTotal}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Verified Rate</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">
                {k.evidenceTotal > 0 ? Math.round((k.evidenceVerified / k.evidenceTotal) * 100) : 0}%
              </div>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Assurance Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 5 — Risk Management (grp-risk)
 * ============================================================ */
function RiskScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const risks = useMemo(() => deriveRisks(k), [k])
  const total = risks.length
  const critical = risks.filter(r => r.likelihood * r.impact >= 12).length  // 4x4=16, but >=12 means high-high or 4x3+/3x4
  const high = risks.filter(r => {
    const score = r.likelihood * r.impact
    return score >= 8 && score < 12
  }).length
  const medium = risks.filter(r => {
    const score = r.likelihood * r.impact
    return score >= 4 && score < 8
  }).length
  const low = risks.filter(r => r.likelihood * r.impact < 4).length

  // Heat-map matrix: 4x4 (likelihood rows × impact cols)
  const matrix: { cell: string; risks: RiskRow[]; tone: string }[][] = []
  for (let L = 4; L >= 1; L--) {
    const row: { cell: string; risks: RiskRow[]; tone: string }[] = []
    for (let I = 1; I <= 4; I++) {
      const cellRisks = risks.filter(r => r.likelihood === L && r.impact === I)
      const score = L * I
      const tone = score >= 12 ? '#dc2626' : score >= 8 ? '#f59e0b' :
        score >= 4 ? GOLD : '#10b981'
      row.push({ cell: `${L}×${I}`, risks: cellRisks, tone })
    }
    matrix.push(row)
  }

  const catData = useMemo(() => {
    const cats: Record<string, number> = {}
    for (const r of risks) {
      cats[r.category] = (cats[r.category] || 0) + 1
    }
    return Object.entries(cats).map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  }, [risks])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={AlertTriangle}
        title="Risk Management"
        subtitle={`${total} risks tracked · ${critical} critical · ${high} high · ${medium} medium · ${low} low`}
        completionPct={k.completion}
        badge={{ label: critical > 0 ? `${critical} critical` : 'No critical', tone: critical > 0 ? 'status-missing' : 'status-approved', icon: AlertOctagon }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={AlertTriangle} label="Total Risks" value={formatNumber(total, 0)} unit="tracked"
          trend={{ dir: 'up', text: `+${Math.min(total, 5)}` }} />
        <KpiTile index={2} icon={AlertOctagon} label="Critical" value={formatNumber(critical, 0)} unit="red zone"
          trend={{ dir: critical > 0 ? 'up' : 'neutral', text: critical > 0 ? '⚠' : '0',
            tone: critical > 0 ? 'status-missing' : 'status-approved' }}
          alert={critical > 0} />
        <KpiTile index={3} icon={AlertCircle} label="High" value={formatNumber(high, 0)} unit="severity"
          trend={{ dir: high > 0 ? 'up' : 'neutral', text: high > 0 ? `+${high}` : '0',
            tone: high > 0 ? 'status-warning' : 'status-approved' }}
          alert={high > 0} />
        <KpiTile index={4} icon={CheckCircle2} label="Low" value={formatNumber(low, 0)} unit="residual"
          trend={{ dir: 'up', text: `${Math.round((low / Math.max(1, total)) * 100)}%`, tone: 'status-approved' }} />
      </div>

      {/* Risk matrix */}
      <SectionCard
        icon={Target}
        title="Risk Heat Map"
        subtitle="4×4 matrix: likelihood (rows) × impact (cols)"
        index={5}
        action={
          <span className="status-pill text-[9px] status-missing">
            <AlertOctagon className="h-2.5 w-2.5" />
            {critical} critical
          </span>
        }
      >
        <div className="overflow-x-auto">
          <div className="min-w-[480px]">
            {/* Column headers (impact) */}
            <div className="grid grid-cols-[60px_repeat(4,1fr)] gap-1 mb-1">
              <div className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold flex items-center justify-center">
                <span className="rotate-0">L ↓ / I →</span>
              </div>
              {[1, 2, 3, 4].map(I => (
                <div key={I} className="glass-subtle rounded-lg py-1 text-center text-[10px] font-semibold text-slate-700">
                  Impact {I}
                </div>
              ))}
            </div>
            {/* Rows */}
            {matrix.map((row, ri) => (
              <div key={ri} className="grid grid-cols-[60px_repeat(4,1fr)] gap-1 mb-1">
                <div className="glass-subtle rounded-lg flex items-center justify-center text-[10px] font-semibold text-slate-700">
                  L{5 - (ri + 1) + 0} {/* row index = 4..1 */}
                </div>
                {row.map((cell, ci) => (
                  <motion.div
                    key={ci}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: (ri * 4 + ci) * 0.015 }}
                    className="rounded-xl p-2 min-h-[72px] flex flex-col items-stretch"
                    style={{
                      background: `linear-gradient(135deg, ${cell.tone}22, ${cell.tone}11)`,
                      border: `1px solid ${cell.tone}55`,
                      boxShadow: cell.risks.length > 0 ? `0 2px 8px -2px ${cell.tone}55` : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] uppercase tracking-wide font-bold" style={{ color: cell.tone }}>
                        {cell.cell}
                      </span>
                      {cell.risks.length > 0 && (
                        <span className="status-pill text-[8px]" style={{
                          background: `${cell.tone}22`, color: cell.tone, borderColor: `${cell.tone}55`,
                        }}>
                          {cell.risks.length}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 space-y-0.5 overflow-y-auto scroll-elegant max-h-[40px]">
                      {cell.risks.map(r => (
                        <div key={r.id} className="text-[8px] font-medium text-slate-700 truncate" title={`${r.id} — ${r.title}`}>
                          {r.title}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Risk register table */}
      <SectionCard
        icon={Scale}
        title="Risk Register"
        subtitle="All tracked risks with likelihood, impact, mitigation"
        index={6}
        action={
          <span className="status-pill text-[9px] status-submitted">
            <ActivityIcon className="h-2.5 w-2.5" />
            {risks.length} risks
          </span>
        }
      >
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(219,234,254,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Category</th>
                <th className="px-3 py-2 text-left font-semibold">Title</th>
                <th className="px-3 py-2 text-right font-semibold">L</th>
                <th className="px-3 py-2 text-right font-semibold">I</th>
                <th className="px-3 py-2 text-right font-semibold">Score</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-left font-semibold">Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => {
                const score = r.likelihood * r.impact
                const scoreColor = score >= 12 ? '#dc2626' : score >= 8 ? '#f59e0b' :
                  score >= 4 ? GOLD : '#10b981'
                return (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-blue-50/40 transition-colors"
                    style={{ height: 40 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{r.id}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px] status-locked">{r.category}</span>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900 truncate max-w-[260px]">{r.title}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.likelihood}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.impact}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="status-pill text-[9px]" style={{
                        background: `${scoreColor}1a`, color: scoreColor, borderColor: `${scoreColor}33`,
                      }}>
                        {score}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{r.owner}</td>
                    <td className="px-3 py-2 text-slate-700 truncate max-w-[180px]">{r.mitigation}</td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Risk category bar + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={Layers}
          title="Risks by Category"
          subtitle="Group-level risk distribution"
          index={7}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catData} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="grp-risk-cat" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={NAVY} />
                    <stop offset="100%" stopColor={NAVY_DEEP} />
                  </linearGradient>
                </defs>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} risks`, n]}
                  cursor={{ fill: 'rgba(30,58,138,0.08)' }} />
                <Bar dataKey="count" name="Risks" fill="url(#grp-risk-cat)" radius={[0, 6, 6, 0]} barSize={16} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Risk Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 6 — Approvals & Lock (grp-lock)
 * ============================================================ */
function ApprovalsLockScreen({
  k, subs, subsLoading, activities, activityLoading,
  onApprove, onReject, onLock, actingId,
}: {
  k: Kpis
  subs: SubmissionItem[]
  subsLoading: boolean
  activities: ActivityItem[]
  activityLoading: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onLock: (id: string) => void
  actingId: string | null
}) {
  // Group-level final review = items that have reached HQ_REVIEW (subsidiary approved, awaiting final group blessing/lock)
  const finalActionable = ['SUBSIDIARY_APPROVED', 'HQ_REVIEW']
  const queue = useMemo(
    () => subs.filter(s => finalActionable.includes((s.status || '').toUpperCase()))
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)),
    [subs],
  )
  const pending = queue.length
  const lockedAlready = subs.filter(s => (s.status || '').toUpperCase() === 'LOCKED').length
  const withErrors = queue.filter(s => s.validationErrors > 0).length
  const totalEvidence = queue.reduce((s, x) => s + x.evidenceCount, 0)

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Lock}
        title="Approvals & Final Lock"
        subtitle={`${pending} awaiting group lock · ${lockedAlready} locked · ${withErrors} with errors`}
        completionPct={k.completion}
        badge={{ label: `${pending} pending lock`, tone: 'status-warning', icon: Lock }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile index={1} icon={Lock} label="Pending Lock" value={formatNumber(pending, 0)} unit="items"
          trend={{ dir: pending > 0 ? 'up' : 'neutral', text: pending > 0 ? `+${Math.min(pending, 9)}` : '0' }}
          alert={pending > 0} />
        <KpiTile index={2} icon={CheckCircle2} label="Locked" value={formatNumber(lockedAlready, 0)} unit="finalized"
          trend={{ dir: 'up', text: `+${Math.min(lockedAlready, 9)}`, tone: 'status-approved' }} />
        <KpiTile index={3} icon={AlertTriangle} label="With Errors" value={formatNumber(withErrors, 0)} unit="items"
          trend={{ dir: withErrors > 0 ? 'up' : 'neutral', text: withErrors > 0 ? '⚠' : '0',
            tone: withErrors > 0 ? 'status-missing' : 'status-approved' }}
          alert={withErrors > 0} />
        <KpiTile index={4} icon={BadgeCheck} label="Total Evidence" value={formatNumber(totalEvidence, 0)} unit="verified"
          trend={{ dir: 'up', text: `${k.evidenceVerified}/${k.evidenceTotal}`, tone: 'status-approved' }} />
      </div>

      {/* Final lock queue table */}
      <SectionCard
        icon={Lock}
        title="Final Lock Queue"
        subtitle="Approve / Reject / Lock — items awaiting final group sign-off"
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
            <CheckCircle2 className="mx-auto h-9 w-9" style={{ color: NAVY }} />
            <p className="text-[12px] text-slate-900 font-semibold mt-2">Lock queue is clear</p>
            <p className="text-[11px] text-slate-700">No submissions are awaiting final group lock right now.</p>
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
                          <button
                            disabled={isActing}
                            onClick={() => onLock(s.id)}
                            title="Lock — finalize"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-300 bg-amber-50/80 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: isActing ? undefined : `linear-gradient(135deg, ${GOLD_TINT}, ${GOLD}22)` }}
                          >
                            <Lock className="h-3.5 w-3.5" />
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

      <ActivityFeedCard activities={activities} loading={activityLoading} title="Lock Activity Feed" />
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function GroupWorkspace() {
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
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isGroupActivity).slice(0, 6)
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

  /* ---- approve / reject / lock actions ---- */
  const handleApprove = useCallback(async (id: string) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/submissions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'Approved from Group Workspace' }),
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
        body: JSON.stringify({ comment: 'Rejected from Group Workspace — please revise' }),
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

  const handleLock = useCallback(async (id: string) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/submissions/${id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: 'Locked from Group Workspace — final sign-off' }),
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
        icon={Network}
        title="No group data yet"
        subtitle="Set up a reporting period to populate the group workspace."
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
        {activeModule === 'grp-consolidation' && (
          <GroupConsolidationScreen
            k={k}
            subs={submissions}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'grp-enterprise' && (
          <EnterpriseEsgScreen
            k={k}
            trends={trends}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'grp-brsr' && (
          <BrsrCommandScreen
            k={k}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'grp-assurance' && (
          <AssuranceScreen
            k={k}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'grp-risk' && (
          <RiskScreen
            k={k}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'grp-lock' && (
          <ApprovalsLockScreen
            k={k}
            subs={submissions}
            subsLoading={subsLoading}
            activities={activities}
            activityLoading={activityLoading}
            onApprove={handleApprove}
            onReject={handleReject}
            onLock={handleLock}
            actingId={actingId}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
