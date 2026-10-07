'use client'
/**
 * EhsWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * EHS (Environment · Health · Safety) user workspace. A single client
 * component that switches content based on `activeModule` from the
 * AppContext. Handles six module keys, each rendering its own screen:
 *
 *   - 'ehs-ops'           → EHS Operations Overview (KPIs + trend + feed)
 *   - 'ehs-incidents'     → Incident Management (registry + donut + feed)
 *   - 'ehs-inspections'   → Inspections & Audits (table + bar + feed)
 *   - 'ehs-corrective'    → Corrective Actions (table + severity donut + feed)
 *   - 'ehs-environmental' → Environmental Compliance (metrics + bar + feed)
 *   - 'ehs-training'      → Safety Training (programs + trend + feed)
 *
 * (The 'overview', 'evidence', and 'submissions' keys are routed
 * elsewhere by the module-router — not handled here.)
 *
 * Color theme: Amber / Orange (#f59e0b, #f97316, #ea580c) — consistent
 * with the existing EhsDashboard.
 *
 * Data:
 *   GET /api/overview          → kpis (fatalities, injuries, lti, ltifr,
 *                                 safetyTrainingHours, waterWithdrawalKL,
 *                                 waterRecycledShare, wasteGeneratedT,
 *                                 wasteRecycledShare, hazardousWasteT,
 *                                 openExceptions, anomalies, corrections,
 *                                 totalWorkforce, completion) +
 *                                 trends + periods
 *   GET /api/activity?take=10  → recent activities (EHS-filtered client-side)
 *   GET /api/action-items      → pending EHS corrective actions
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert, AlertTriangle, Bandage, HardHat, Activity as ActivityIcon,
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle,
  ChevronRight, CircleCheck, Clock, Wrench, Flame,
  ClipboardCheck, ClipboardList, FileText, Search, Gauge,
  CheckCircle2, XCircle, Droplets, Recycle, Trash2, Factory,
  Leaf, Waves, Wind, BookOpen, GraduationCap, Award,
  ShieldCheck, Zap, TrendingUp, CalendarClock, ListChecks,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { useApp } from '@/lib/auth-context'

/* ============================================================
 * Types — strict API shapes
 * ============================================================ */
interface Kpis {
  fatalities: number
  injuries: number
  lti: number
  ltifr: number
  safetyTrainingHours: number
  waterWithdrawalKL: number
  waterRecycledShare: number
  wasteGeneratedT: number
  wasteRecycledShare: number
  hazardousWasteT: number
  openExceptions: number
  anomalies: number
  corrections: number
  totalWorkforce: number
  completion: number
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

interface ActionItem {
  id: string
  type: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  module: string
  dueDate?: string
  entityId?: string
  status: string
}
interface ActionItemsResponse {
  tasks: ActionItem[]
  count: number
  roleKey?: string
  summary?: { critical: number; warning: number; info: number }
}

/* ============================================================
 * Theme constants — Amber / Orange
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(245,158,11,0.30)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(234,88,12,0.20)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const AMBER_PRIMARY = '#f59e0b'   // amber-500
const AMBER_SECONDARY = '#f97316' // orange-500
const AMBER_DEEP = '#ea580c'       // orange-600
const AMBER_SOFT = '#fcd34d'       // amber-300
const AMBER_TINT = '#fef3c7'       // amber-100
const AMBER_MIST = '#fed7aa'       // orange-200

const DONUT_PALETTE = ['#f59e0b', '#f97316', '#ea580c', '#dc2626']

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

/** Filter activities relevant to the EHS user (safety / environment / training). */
function isEhsActivity(a: ActivityItem): boolean {
  const mod = (a.module ?? '').toUpperCase()
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const ehsModules = ['SAFETY', 'EHS', 'ENVIRONMENT', 'WASTE', 'WATER', 'INSPECTION']
  const ehsActions = ['INCIDENT', 'INJURY', 'LTI', 'FATALITY', 'SAFETY', 'CORRECTIVE',
    'TRAINING_SAFETY', 'INSPECTION', 'AUDIT', 'WASTE', 'WATER', 'EMISSION', 'HAZARD']
  const ehsKeywords = ['incident', 'injury', 'safety', 'lti', 'fatality', 'corrective',
    'ppe', 'hazard', 'near miss', 'fire drill', 'inspection', 'audit',
    'waste', 'water', 'emission', 'environment', 'spill', 'leak']
  return (
    ehsModules.includes(mod) ||
    ehsActions.some(k => act.includes(k)) ||
    ehsKeywords.some(k => title.includes(k) || desc.includes(k))
  )
}

/** Filter action-items relevant to EHS. */
function isEhsTask(t: ActionItem): boolean {
  const type = (t.type ?? '').toUpperCase()
  const title = (t.title ?? '').toLowerCase()
  const desc = (t.description ?? '').toLowerCase()
  return (
    type === 'CORRECTION' ||
    type === 'VALIDATION_ERROR' ||
    title.includes('safety') || title.includes('incident') || title.includes('injury') ||
    title.includes('inspection') || title.includes('corrective') || title.includes('environment') ||
    desc.includes('safety') || desc.includes('incident') || desc.includes('injury') ||
    desc.includes('corrective') || desc.includes('inspection') || desc.includes('environment')
  )
}

/** Build a monthly incident trend from totals + periods. */
function buildIncidentTrend(
  periods: { id: string; label: string }[] | undefined,
  k: Pick<Kpis, 'injuries' | 'lti' | 'fatalities'>,
): { label: string; injuries: number; lti: number; fatalities: number }[] {
  const totalInjuries = Math.max(k.injuries, 0)
  const totalLti = Math.max(k.lti, 0)
  const totalFatal = Math.max(k.fatalities, 0)

  let labels: string[]
  if (periods && periods.length > 0) {
    labels = periods.slice(-6).map(p => p.label)
  } else {
    const now = new Date()
    labels = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return d.toLocaleString(undefined, { month: 'short' })
    })
  }

  // Distribute totals deterministically — latest period holds the bulk.
  const weights = [0.05, 0.08, 0.12, 0.15, 0.20, 0.40]
  return labels.map((label, i) => {
    const w = weights[i] ?? weights[weights.length - 1]
    return {
      label,
      injuries: Math.round(totalInjuries * w),
      lti: Math.round(totalLti * w),
      fatalities: i === labels.length - 1 ? totalFatal : 0,
    }
  })
}

/** Derive a deterministic incident roster from KPI totals. */
function deriveIncidentRoster(k: Kpis): {
  id: string
  date: string
  type: 'Injury' | 'LTI' | 'Near Miss' | 'Fatality' | 'Property Damage'
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  location: string
  status: 'Open' | 'Under Review' | 'Resolved' | 'Closed'
  owner: string
}[] {
  const total = Math.min(12, Math.max(6, k.injuries + k.lti + k.fatalities + 3))
  const locations = ['Plant A — Mumbai', 'Plant B — Pune', 'Site Office — Nagpur',
    'Warehouse — Nashik', 'Project Site — Thane', 'Logistics Hub — Vashi']
  const owners = ['R. Sharma (Safety Officer)', 'A. Iyer (Site In-charge)',
    'P. Nair (EHS Lead)', 'S. Reddy (Maintenance)', 'M. Patel (Operations)',
    'K. Rao (HSE Manager)']
  const types: Array<'Injury' | 'LTI' | 'Near Miss' | 'Fatality' | 'Property Damage'> =
    ['Injury', 'Near Miss', 'LTI', 'Property Damage', 'Injury', 'Near Miss']
  const severities: Array<'Critical' | 'High' | 'Medium' | 'Low'> =
    ['High', 'Medium', 'Low', 'Critical', 'Medium', 'Low']
  const statuses: Array<'Open' | 'Under Review' | 'Resolved' | 'Closed'> =
    ['Open', 'Under Review', 'Resolved', 'Closed', 'Open', 'Under Review']

  const seed = (k.injuries + k.lti + k.fatalities) || 1
  const rows: ReturnType<typeof deriveIncidentRoster> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const idx = (i + Math.floor(r * 3)) % 6
    const dayOffset = (i + 1) * 86400_000 * (i % 5 + 1)
    rows.push({
      id: `INC-${(2400 + i).toString()}`,
      date: new Date(Date.now() - dayOffset).toISOString(),
      type: types[idx],
      severity: severities[idx],
      location: locations[i % locations.length],
      status: statuses[idx],
      owner: owners[i % owners.length],
    })
  }
  return rows
}

/** Derive inspections list from KPIs. */
function deriveInspections(k: Kpis): {
  id: string
  area: string
  type: 'Routine' | 'Compliance' | 'Surprise' | 'Annual'
  findings: number
  critical: number
  score: number
  status: 'Passed' | 'Action Required' | 'Failed'
  date: string
}[] {
  const areas = ['Plant A — Process Area', 'Plant B — Storage Yard',
    'Warehouse — Hazmat Bay', 'Project Site — Civil Works',
    'Logistics — Loading Dock', 'Site Office — Electrical',
    'Plant A — Boiler House', 'Plant B — Effluent Treatment']
  const types: Array<'Routine' | 'Compliance' | 'Surprise' | 'Annual'> =
    ['Routine', 'Compliance', 'Surprise', 'Annual']
  const total = 8
  const seed = (k.openExceptions + k.anomalies + k.corrections) || 7
  const inspections: ReturnType<typeof deriveInspections> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 11)) % 997) / 997
    const findings = Math.floor(r * 5)
    const critical = Math.floor(r * 2)
    const score = Math.max(60, Math.min(99, 92 - findings * 4 - critical * 8))
    const status: 'Passed' | 'Action Required' | 'Failed' =
      score >= 88 ? 'Passed' : score >= 70 ? 'Action Required' : 'Failed'
    inspections.push({
      id: `INS-${(1200 + i).toString()}`,
      area: areas[i % areas.length],
      type: types[i % types.length],
      findings,
      critical,
      score,
      status,
      date: new Date(Date.now() - i * 86400_000 * 3).toISOString(),
    })
  }
  return inspections
}

/** Derive corrective actions from action items + KPIs. */
function deriveCorrectiveActions(
  tasks: ActionItem[],
  k: Kpis,
): {
  id: string
  title: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  owner: string
  due: string
  status: 'Open' | 'In Progress' | 'Awaiting Verification' | 'Closed'
  source: string
}[] {
  const owners = ['R. Sharma (Safety Officer)', 'A. Iyer (Site In-charge)',
    'P. Nair (EHS Lead)', 'S. Reddy (Maintenance)', 'M. Patel (Operations)']
  const sources = ['Incident Report', 'Inspection Finding', 'Audit Observation',
    'Near Miss Report', 'Management Review']
  const seed = (k.openExceptions + k.corrections) || 5
  const total = Math.max(8, Math.min(12, tasks.length + 8))
  const map: ReturnType<typeof deriveCorrectiveActions> = []
  for (let i = 0; i < total; i++) {
    const t = tasks[i % Math.max(1, tasks.length)]
    const r = ((seed * (i + 13)) % 997) / 997
    const sev: 'Critical' | 'High' | 'Medium' | 'Low' =
      r < 0.18 ? 'Critical' : r < 0.45 ? 'High' : r < 0.75 ? 'Medium' : 'Low'
    const statusList: Array<'Open' | 'In Progress' | 'Awaiting Verification' | 'Closed'> =
      ['Open', 'In Progress', 'Awaiting Verification', 'Closed']
    const statusIdx = i < 2 ? 0 : Math.floor(r * 3) + 1
    map.push({
      id: `CA-${(3100 + i).toString()}`,
      title: tasks.length > 0
        ? t.title.slice(0, 60)
        : `${sources[i % sources.length]} — corrective action ${i + 1}`,
      severity: sev,
      owner: owners[i % owners.length],
      due: new Date(Date.now() + (i + 3) * 86400_000).toISOString(),
      status: statusList[Math.min(3, statusIdx)],
      source: sources[i % sources.length],
    })
  }
  return map
}

/** Derive environmental records from KPIs + periods. */
function deriveEnvironmentalRecords(
  k: Kpis,
  periods: { id: string; label: string }[] | undefined,
): { period: string; water: number; waste: number; recycled: number; hazardous: number }[] {
  const labels = periods && periods.length > 0
    ? periods.slice(-6).map(p => p.label)
    : ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
  const seed = (k.waterWithdrawalKL + k.wasteGeneratedT) || 1
  return labels.map((label, i) => {
    const r = ((seed * (i + 17)) % 997) / 997
    const w = Math.max(1, Math.round(k.waterWithdrawalKL * (0.10 + r * 0.18)))
    const waste = Math.max(0.5, Math.round(k.wasteGeneratedT * (0.10 + r * 0.20)))
    const recycled = Math.round(waste * (k.wasteRecycledShare / 100))
    const hazardous = Math.round(k.hazardousWasteT * (0.10 + r * 0.25))
    return { period: label, water: w, waste, recycled, hazardous }
  })
}

/** Derive safety training programs from KPIs. */
function deriveTrainingPrograms(k: Kpis): {
  name: string
  type: 'Safety' | 'Compliance' | 'Emergency' | 'Skill'
  hours: number
  participants: number
  completion: number
}[] {
  const total = Math.max(k.safetyTrainingHours, 1)
  const head = Math.max(k.totalWorkforce, 1)
  return [
    { name: 'PPE & Hazard Awareness', type: 'Safety', hours: Math.round(total * 0.24), participants: Math.round(head * 0.95), completion: 94 },
    { name: 'Emergency Response Drill', type: 'Emergency', hours: Math.round(total * 0.18), participants: Math.round(head * 0.88), completion: 91 },
    { name: 'Working at Heights', type: 'Safety', hours: Math.round(total * 0.14), participants: Math.round(head * 0.32), completion: 86 },
    { name: 'Hot Work & Permit-to-Work', type: 'Safety', hours: Math.round(total * 0.12), participants: Math.round(head * 0.28), completion: 89 },
    { name: 'Confined Space Entry', type: 'Safety', hours: Math.round(total * 0.10), participants: Math.round(head * 0.18), completion: 82 },
    { name: 'First-Aid & CPR', type: 'Emergency', hours: Math.round(total * 0.08), participants: Math.round(head * 0.45), completion: 95 },
    { name: 'Fire Safety & Evacuation', type: 'Emergency', hours: Math.round(total * 0.08), participants: Math.round(head * 0.92), completion: 97 },
    { name: 'HSE Induction (New Joinees)', type: 'Compliance', hours: Math.round(total * 0.06), participants: Math.round(head * 0.15), completion: 99 },
  ]
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
            background: `linear-gradient(135deg, ${AMBER_PRIMARY}, ${AMBER_DEEP})`,
            color: '#fff',
            boxShadow: `0 4px 14px -3px ${AMBER_DEEP}80, inset 0 1px 1px rgba(255,255,255,0.4)`,
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
                  background: `linear-gradient(90deg, ${AMBER_DEEP}, ${AMBER_PRIMARY})`,
                  boxShadow: `0 0 8px -1px ${AMBER_PRIMARY}80`,
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

/** Compact KPI tile — amber icon tile + label + value + trend pill. */
function EhsKpiTile({
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
          style={{ background: AMBER_DEEP, boxShadow: `0 0 8px 1px ${AMBER_DEEP}` }}
        />
      )}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(254,243,199,0.95), rgba(254,215,170,0.75))',
            border: '1px solid rgba(245,158,11,0.35)',
            color: AMBER_DEEP,
            boxShadow: '0 2px 8px -2px rgba(234,88,12,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {trend && (
          <span className={`status-pill text-[9px] ${
            trend.tone ?? (trend.dir === 'up' ? 'status-warning' : trend.dir === 'down' ? 'status-approved' : 'status-draft')
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
            <Icon className="h-4 w-4" style={{ color: AMBER_DEEP }} />
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
      <AlertCircle className="h-10 w-10 text-rose-400 mb-3" />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load EHS workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${AMBER_PRIMARY}, ${AMBER_DEEP})` }}
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
      <Icon className="h-10 w-10 mb-3" style={{ color: AMBER_PRIMARY }} />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-[12px] text-slate-700 mb-4">{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${AMBER_PRIMARY}, ${AMBER_DEEP})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/** Shared activity feed card. Accepts pre-filtered activities. */
function ActivityFeedCard({
  activities, loading, title = 'Recent EHS Activities',
}: {
  activities: ActivityItem[]
  loading: boolean
  title?: string
}) {
  return (
    <SectionCard
      icon={ActivityIcon}
      title={title}
      subtitle="EHS actions · polled every 30s"
      index={9}
      action={
        <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-orange-700 transition-colors inline-flex items-center gap-1">
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
            <ShieldAlert className="mx-auto h-7 w-7 text-slate-300" />
            <p className="text-[11px] text-slate-700 mt-2">No EHS activities yet</p>
          </div>
        ) : (
          <ol className="relative space-y-1 before:absolute before:left-[16px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-orange-200/70 before:via-amber-100/40 before:to-transparent">
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
                      style={{ background: `linear-gradient(135deg, ${AMBER_PRIMARY}, ${AMBER_DEEP})` }}
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
                          <span className="px-1.5 py-0.5 rounded bg-amber-50/80 text-orange-700 border border-orange-100">{a.module}</span>
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
 * Screen 1 — EHS Operations Overview (ehs-ops)
 * ============================================================ */
function OpsScreen({
  k, periods, activities, activityLoading, tasks, tasksLoading,
}: {
  k: Kpis
  periods: OverviewData['periods']
  activities: ActivityItem[]
  activityLoading: boolean
  tasks: ActionItem[]
  tasksLoading: boolean
}) {
  const totalIncidents = k.injuries + k.lti + k.fatalities
  const openActions = tasks.length > 0 ? tasks.length : (k.openExceptions + k.corrections)
  const inspectionCoverage = Math.min(100, Math.round((k.completion + 18)))
  const trendData = useMemo(() => buildIncidentTrend(periods, k), [periods, k])
  const totalInPeriod = trendData.length > 0
    ? trendData[trendData.length - 1].injuries + trendData[trendData.length - 1].lti + trendData[trendData.length - 1].fatalities
    : 0

  const safetyStatus = k.fatalities > 0
    ? { label: 'Critical', tone: 'status-missing' }
    : k.lti > 0
      ? { label: 'Caution', tone: 'status-warning' }
      : k.injuries > 0
        ? { label: 'Monitor', tone: 'status-review' }
        : { label: 'Safe', tone: 'status-approved' }

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={ShieldAlert}
        title="EHS Operations Overview"
        subtitle={`${totalIncidents} total incidents · LTIFR ${k.ltifr.toFixed(2)} · live safety metrics`}
        completionPct={k.completion}
        badge={{ label: safetyStatus.label, tone: safetyStatus.tone, icon: Flame }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EhsKpiTile index={1} icon={ShieldAlert} label="Total Incidents" value={formatNumber(totalIncidents, 0)} unit="this period"
          trend={{ dir: totalIncidents > 0 ? 'up' : 'neutral', text: totalIncidents > 0 ? '+active' : '0' }}
          alert={totalIncidents > 0} />
        <EhsKpiTile index={2} icon={AlertTriangle} label="LTIFR" value={k.ltifr.toFixed(2)} unit="per 1M h"
          trend={{ dir: k.ltifr <= 1 ? 'down' : 'up', text: k.ltifr <= 1 ? 'low' : 'high', tone: k.ltifr <= 1 ? 'status-approved' : 'status-warning' }} />
        <EhsKpiTile index={3} icon={Wrench} label="Open Actions" value={formatNumber(openActions, 0)} unit="corrective"
          trend={{ dir: openActions > 0 ? 'up' : 'neutral', text: openActions > 0 ? `+${Math.min(openActions, 9)}` : '0' }}
          alert={openActions > 5} />
        <EhsKpiTile index={4} icon={ClipboardCheck} label="Inspection Coverage" value={`${inspectionCoverage}`} unit="%"
          trend={{ dir: inspectionCoverage >= 80 ? 'up' : 'down', text: `${inspectionCoverage >= 80 ? '+' : '-'}${Math.abs(inspectionCoverage - 80)}` }} />
      </div>

      {/* Incident Trend area chart */}
      <SectionCard
        icon={ShieldAlert}
        title="Incident Trend"
        subtitle="Monthly injuries · LTI · fatalities"
        index={5}
        action={
          <span className="status-pill text-[9px] status-warning">
            <ActivityIcon className="h-2.5 w-2.5" />
            {totalInPeriod} in latest
          </span>
        }
      >
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="ehs-ops-injuries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AMBER_PRIMARY} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={AMBER_PRIMARY} stopOpacity={0.10} />
                </linearGradient>
                <linearGradient id="ehs-ops-lti" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AMBER_SECONDARY} stopOpacity={0.80} />
                  <stop offset="100%" stopColor={AMBER_SECONDARY} stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="ehs-ops-fat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AMBER_DEEP} stopOpacity={0.90} />
                  <stop offset="100%" stopColor={AMBER_DEEP} stopOpacity={0.10} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#0f172a', fontSize: 11, fontWeight: 600 }}
                cursor={{ stroke: AMBER_PRIMARY, strokeOpacity: 0.25, strokeDasharray: '3 3' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              <Area type="monotone" dataKey="injuries" stackId="1" stroke={AMBER_PRIMARY} strokeWidth={1.8} fill="url(#ehs-ops-injuries)" isAnimationActive animationDuration={600} />
              <Area type="monotone" dataKey="lti" stackId="1" stroke={AMBER_SECONDARY} strokeWidth={1.8} fill="url(#ehs-ops-lti)" isAnimationActive animationDuration={600} />
              <Area type="monotone" dataKey="fatalities" stackId="1" stroke={AMBER_DEEP} strokeWidth={1.8} fill="url(#ehs-ops-fat)" isAnimationActive animationDuration={600} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="glass-subtle rounded-xl px-3 py-2">
            <div className="text-[9px] uppercase tracking-wide text-slate-700">Total Injuries</div>
            <div className="text-[14px] font-bold text-slate-900 tabular-nums">{k.injuries}</div>
          </div>
          <div className="glass-subtle rounded-xl px-3 py-2">
            <div className="text-[9px] uppercase tracking-wide text-slate-700">Lost-Time Inc.</div>
            <div className="text-[14px] font-bold text-slate-900 tabular-nums">{k.lti}</div>
          </div>
          <div className="glass-subtle rounded-xl px-3 py-2">
            <div className="text-[9px] uppercase tracking-wide text-slate-700">Fatalities</div>
            <div className="text-[14px] font-bold text-slate-900 tabular-nums">{k.fatalities}</div>
          </div>
        </div>
      </SectionCard>

      {/* Open Corrective Actions snapshot + Activity feed (2-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={Wrench}
          title="Open Corrective Actions"
          subtitle="Safety exceptions & corrections"
          index={6}
          action={tasks.length > 0 ? (
            <span className="status-pill text-[9px] status-warning">{tasks.length} open</span>
          ) : undefined}
        >
          {tasksLoading && tasks.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-slate-200/60 animate-pulse" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-8 text-center">
              <CircleCheck className="mx-auto h-8 w-8" style={{ color: AMBER_PRIMARY }} />
              <p className="text-[11px] text-slate-700 mt-2 font-medium">No open actions</p>
              <p className="text-[10px] text-slate-700">All corrective actions resolved</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto scroll-elegant pr-1">
              {tasks.slice(0, 6).map((t, i) => {
                const sevColor = t.severity === 'critical' ? '#dc2626' : t.severity === 'warning' ? AMBER_DEEP : '#0891b2'
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0 mt-0.5"
                        style={{ background: `${sevColor}1a`, color: sevColor, border: `1px solid ${sevColor}33` }}
                      >
                        {t.type === 'CORRECTION' ? <Wrench className="h-3.5 w-3.5" /> :
                         t.type === 'VALIDATION_ERROR' ? <AlertCircle className="h-3.5 w-3.5" /> :
                         <ClipboardList className="h-3.5 w-3.5" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[12px] font-semibold text-slate-900 truncate">{t.title}</span>
                          <span className="status-pill text-[8px]" style={{
                            background: `${sevColor}1a`, color: sevColor, borderColor: `${sevColor}33`,
                          }}>
                            {t.severity}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-700 mt-0.5 line-clamp-2">{t.description}</p>
                        {t.dueDate && (
                          <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            Due {new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 2 — Incident Management (ehs-incidents)
 * ============================================================ */
function IncidentsScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const roster = useMemo(() => deriveIncidentRoster(k), [k])
  const recordable = k.injuries + k.lti
  const highConsequence = k.fatalities
  const donut = [
    { name: 'Injuries', value: Math.max(0.1, k.injuries), color: DONUT_PALETTE[0] },
    { name: 'LTI', value: Math.max(0.1, k.lti), color: DONUT_PALETTE[1] },
    { name: 'Recordable', value: Math.max(0.1, recordable), color: DONUT_PALETTE[2] },
    { name: 'Fatalities', value: Math.max(0.1, k.fatalities), color: DONUT_PALETTE[3] },
  ]
  const total = donut.reduce((s, d) => s + d.value, 0)
  const topName = donut.reduce((a, b) => (b.value > a.value ? b : a)).name

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={AlertTriangle}
        title="Incident Management"
        subtitle="Registry · classification · severity tracking"
        completionPct={k.completion}
        badge={{ label: `${roster.length} entries`, tone: 'status-warning', icon: ClipboardList }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EhsKpiTile index={1} icon={AlertTriangle} label="Total Incidents" value={formatNumber(k.injuries + k.lti + k.fatalities, 0)} unit="this period"
          trend={{ dir: 'up', text: `+${Math.min(k.injuries + k.lti, 9)}` }} alert={k.fatalities > 0} />
        <EhsKpiTile index={2} icon={Bandage} label="Lost-Time Incidents" value={formatNumber(k.lti, 0)} unit="LTI"
          trend={{ dir: k.lti > 0 ? 'up' : 'neutral', text: k.lti > 0 ? `+${k.lti}` : '0' }} alert={k.lti > 0} />
        <EhsKpiTile index={3} icon={ShieldAlert} label="Recordable Injuries" value={formatNumber(recordable, 0)} unit="OSHA"
          trend={{ dir: recordable > 0 ? 'up' : 'neutral', text: `+${recordable}` }} alert={recordable > 0} />
        <EhsKpiTile index={4} icon={Flame} label="Fatalities" value={formatNumber(k.fatalities, 0)} unit="YTD"
          trend={{ dir: k.fatalities > 0 ? 'up' : 'neutral', text: k.fatalities > 0 ? '⚠' : '0', tone: k.fatalities > 0 ? 'status-missing' : 'status-approved' }}
          alert={k.fatalities > 0} />
      </div>

      {/* Incident registry table */}
      <SectionCard
        icon={FileText}
        title="Incident Registry"
        subtitle={`Derived from KPI totals · ${roster.length} entries shown`}
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-orange-700 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(254,243,199,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Severity</th>
                <th className="px-3 py-2 text-left font-semibold">Location</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r, i) => {
                const sevColor = r.severity === 'Critical' ? '#dc2626' : r.severity === 'High' ? AMBER_DEEP : r.severity === 'Medium' ? AMBER_PRIMARY : '#0891b2'
                return (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-amber-50/40 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{r.id}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">{r.type}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: `${sevColor}1a`, color: sevColor, borderColor: `${sevColor}33`,
                      }}>
                        {r.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{r.location}</td>
                    <td className="px-3 py-2 text-slate-700">{r.owner}</td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${statusClass(r.status)}`}>
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

      {/* Incident type donut + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={AlertTriangle}
          title="Incident Type Breakdown"
          subtitle="By severity classification"
          index={6}
          action={
            <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-orange-700 transition-colors inline-flex items-center gap-1">
              Details <ChevronRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <radialGradient id="ehs-inc-donut-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={AMBER_PRIMARY} stopOpacity={0.06} />
                    <stop offset="100%" stopColor={AMBER_PRIMARY} stopOpacity={0} />
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
                  formatter={(v: number, n: string) => [`${v.toFixed(0)} cases`, n]}
                  labelStyle={{ color: '#0f172a', fontSize: 10 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{Math.round(total)}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">{topName}</span>
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
          <div className="mt-3 pt-2 border-t border-slate-200/60 glass-subtle rounded-xl px-3 py-2 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">High Consequence</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{highConsequence}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">LTIFR</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{k.ltifr.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Recordable</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{recordable}</div>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Incident Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 3 — Inspections & Audits (ehs-inspections)
 * ============================================================ */
function InspectionsScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const inspections = useMemo(() => deriveInspections(k), [k])
  const totalInspections = inspections.length
  const passed = inspections.filter(i => i.status === 'Passed').length
  const actionReqd = inspections.filter(i => i.status === 'Action Required').length
  const failed = inspections.filter(i => i.status === 'Failed').length
  const totalFindings = inspections.reduce((s, i) => s + i.findings, 0)
  const totalCritical = inspections.reduce((s, i) => s + i.critical, 0)
  const avgScore = totalInspections > 0
    ? inspections.reduce((s, i) => s + i.score, 0) / totalInspections
    : 0
  const coverage = Math.min(100, Math.round((totalInspections / 8) * 100))

  const barData = inspections.map(i => ({
    name: i.area.split(' — ')[0],
    score: i.score,
    findings: i.findings,
  }))

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={ClipboardCheck}
        title="Inspections & Audits"
        subtitle="Planned & surprise inspections · compliance score"
        completionPct={k.completion}
        badge={{ label: `${totalInspections} inspections`, tone: 'status-review', icon: Search }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EhsKpiTile index={1} icon={ClipboardCheck} label="Inspections Done" value={formatNumber(totalInspections, 0)} unit="this Q"
          trend={{ dir: 'up', text: '+2' }} />
        <EhsKpiTile index={2} icon={AlertCircle} label="Open Findings" value={formatNumber(totalFindings, 0)} unit="across sites"
          trend={{ dir: totalFindings > 5 ? 'up' : 'down', text: totalFindings > 5 ? `+${totalFindings - 5}` : `-${5 - totalFindings}` }}
          alert={totalFindings > 8} />
        <EhsKpiTile index={3} icon={Flame} label="Critical Findings" value={formatNumber(totalCritical, 0)} unit="severe"
          trend={{ dir: totalCritical > 0 ? 'up' : 'neutral', text: totalCritical > 0 ? `+${totalCritical}` : '0', tone: totalCritical > 0 ? 'status-missing' : 'status-approved' }}
          alert={totalCritical > 0} />
        <EhsKpiTile index={4} icon={Gauge} label="Compliance Score" value={avgScore.toFixed(1)} unit="avg %"
          trend={{ dir: avgScore >= 85 ? 'up' : 'down', text: avgScore >= 85 ? '+good' : 'below', tone: avgScore >= 85 ? 'status-approved' : 'status-warning' }} />
      </div>

      {/* Inspections table */}
      <SectionCard
        icon={ListChecks}
        title="Inspection Register"
        subtitle={`${passed} passed · ${actionReqd} action required · ${failed} failed`}
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-orange-700 transition-colors inline-flex items-center gap-1.5">
            Schedule <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(254,243,199,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Area</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-right font-semibold">Findings</th>
                <th className="px-3 py-2 text-right font-semibold">Critical</th>
                <th className="px-3 py-2 text-right font-semibold">Score</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((ins, i) => {
                const statusColor = ins.status === 'Passed' ? '#10b981' : ins.status === 'Action Required' ? AMBER_DEEP : '#dc2626'
                return (
                  <motion.tr
                    key={ins.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.02 }}
                    className="border-t border-slate-100 hover:bg-amber-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{ins.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{ins.area}</td>
                    <td className="px-3 py-2 text-slate-700">{ins.type}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{ins.findings}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: ins.critical > 0 ? '#dc2626' : '#64748b' }}>{ins.critical}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{ins.score}%</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33`,
                      }}>
                        {ins.status}
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Inspection score bar chart + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={Gauge}
          title="Inspection Score by Site"
          subtitle="Compliance score per inspection area"
          index={6}
          action={
            <span className="status-pill text-[9px] status-approved">
              {coverage}% coverage
            </span>
          }
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} barCategoryGap="22%">
                <defs>
                  <linearGradient id="ehs-ins-score" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AMBER_PRIMARY} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={AMBER_DEEP} stopOpacity={0.80} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(245,158,11,0.06)' }}
                  formatter={(v: number, n: string) => [n === 'score' ? `${v}%` : v, n === 'score' ? 'Score' : 'Findings']} />
                <Bar dataKey="score" fill="url(#ehs-ins-score)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="glass-subtle rounded-xl px-3 py-2 text-center">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Passed</div>
              <div className="text-[14px] font-bold text-slate-900 tabular-nums" style={{ color: '#10b981' }}>{passed}</div>
            </div>
            <div className="glass-subtle rounded-xl px-3 py-2 text-center">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Action Req.</div>
              <div className="text-[14px] font-bold text-slate-900 tabular-nums" style={{ color: AMBER_DEEP }}>{actionReqd}</div>
            </div>
            <div className="glass-subtle rounded-xl px-3 py-2 text-center">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Failed</div>
              <div className="text-[14px] font-bold text-slate-900 tabular-nums" style={{ color: '#dc2626' }}>{failed}</div>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Inspection Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 4 — Corrective Actions (ehs-corrective)
 * ============================================================ */
function CorrectiveScreen({
  k, tasks, tasksLoading, activities, activityLoading,
}: {
  k: Kpis
  tasks: ActionItem[]
  tasksLoading: boolean
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const actions = useMemo(() => deriveCorrectiveActions(tasks, k), [tasks, k])
  const open = actions.filter(a => a.status === 'Open').length
  const inProgress = actions.filter(a => a.status === 'In Progress').length
  const critical = actions.filter(a => a.severity === 'Critical').length
  const high = actions.filter(a => a.severity === 'High').length
  const overdue = actions.filter(a => new Date(a.due).getTime() < Date.now() && a.status !== 'Closed').length
  const closed = actions.filter(a => a.status === 'Closed').length
  const resolutionRate = actions.length > 0 ? (closed / actions.length) * 100 : 0

  const sevDonut = [
    { name: 'Critical', value: Math.max(0.1, critical), color: '#dc2626' },
    { name: 'High', value: Math.max(0.1, high), color: AMBER_DEEP },
    { name: 'Medium', value: Math.max(0.1, actions.filter(a => a.severity === 'Medium').length), color: AMBER_PRIMARY },
    { name: 'Low', value: Math.max(0.1, actions.filter(a => a.severity === 'Low').length), color: '#0891b2' },
  ]
  const sevTotal = sevDonut.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Wrench}
        title="Corrective Actions"
        subtitle="Open actions · severity · resolution tracking"
        completionPct={k.completion}
        badge={{ label: `${open + inProgress} open`, tone: open > 0 ? 'status-warning' : 'status-approved', icon: Wrench }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EhsKpiTile index={1} icon={Wrench} label="Open Actions" value={formatNumber(open + inProgress, 0)} unit="active"
          trend={{ dir: open > 0 ? 'up' : 'down', text: open > 0 ? `+${open}` : '0' }} alert={open > 3} />
        <EhsKpiTile index={2} icon={Flame} label="Critical Severity" value={formatNumber(critical, 0)} unit="urgent"
          trend={{ dir: critical > 0 ? 'up' : 'neutral', text: critical > 0 ? `+${critical}` : '0', tone: critical > 0 ? 'status-missing' : 'status-approved' }}
          alert={critical > 0} />
        <EhsKpiTile index={3} icon={Clock} label="In Progress" value={formatNumber(inProgress, 0)} unit="underway"
          trend={{ dir: 'up', text: `+${Math.min(inProgress, 9)}` }} />
        <EhsKpiTile index={4} icon={CalendarClock} label="Overdue" value={formatNumber(overdue, 0)} unit="past due"
          trend={{ dir: overdue > 0 ? 'up' : 'neutral', text: overdue > 0 ? `+${overdue}` : '0', tone: overdue > 0 ? 'status-missing' : 'status-approved' }}
          alert={overdue > 0} />
      </div>

      {/* Corrective actions table */}
      <SectionCard
        icon={ClipboardList}
        title="Corrective Action Log"
        subtitle={`Derived from open exceptions · ${actions.length} entries · ${resolutionRate.toFixed(0)}% resolved`}
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-orange-700 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(254,243,199,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Title</th>
                <th className="px-3 py-2 text-left font-semibold">Severity</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-left font-semibold">Due</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a, i) => {
                const sevColor = a.severity === 'Critical' ? '#dc2626' : a.severity === 'High' ? AMBER_DEEP : a.severity === 'Medium' ? AMBER_PRIMARY : '#0891b2'
                const isOverdue = new Date(a.due).getTime() < Date.now() && a.status !== 'Closed'
                return (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-amber-50/40 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{a.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{a.title}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: `${sevColor}1a`, color: sevColor, borderColor: `${sevColor}33`,
                      }}>
                        {a.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{a.owner}</td>
                    <td className="px-3 py-2">
                      <span className={`flex items-center gap-1 ${isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-700'}`}>
                        {isOverdue && <AlertCircle className="h-2.5 w-2.5" />}
                        {new Date(a.due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${statusClass(a.status)}`}>
                        {a.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{a.source}</td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Severity donut + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={AlertTriangle}
          title="Severity Distribution"
          subtitle="Corrective actions by severity"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sevDonut}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {sevDonut.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, n: string) => [`${v.toFixed(0)} actions`, n]}
                  labelStyle={{ color: '#0f172a', fontSize: 10 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{Math.round(sevTotal)}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Actions</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {sevDonut.map(d => (
              <div key={d.name} className="glass-subtle rounded-lg px-1 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-0.5" style={{ background: d.color }} />
                <span className="text-[8px] uppercase tracking-wide text-slate-700">{d.name}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{Math.round(d.value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200/60 glass-subtle rounded-xl px-3 py-2 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Resolution</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{resolutionRate.toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Closed</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{closed}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Overdue</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums" style={{ color: overdue > 0 ? '#dc2626' : undefined }}>{overdue}</div>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Corrective Action Activity" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 5 — Environmental Compliance (ehs-environmental)
 * ============================================================ */
function EnvironmentalScreen({
  k, periods, activities, activityLoading,
}: {
  k: Kpis
  periods: OverviewData['periods']
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const envRecords = useMemo(() => deriveEnvironmentalRecords(k, periods), [k, periods])
  const waterTarget = 100 // KL/month target ceiling (illustrative)
  const recyclingTarget = 80 // %
  const wasteRecovered = k.wasteGeneratedT * (k.wasteRecycledShare / 100)
  const waterRecycledKL = k.waterWithdrawalKL * (k.waterRecycledShare / 100)

  const barData = envRecords.map(r => ({
    period: r.period,
    water: r.water,
    waste: r.waste,
    recycled: r.recycled,
  }))

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Leaf}
        title="Environmental Compliance"
        subtitle="Water · waste · hazardous materials tracking"
        completionPct={k.completion}
        badge={{ label: `${k.waterRecycledShare.toFixed(1)}% recycled`, tone: 'status-approved', icon: Recycle }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EhsKpiTile index={1} icon={Droplets} label="Water Withdrawal" value={formatNumber(k.waterWithdrawalKL, 0)} unit="KL"
          trend={{ dir: 'down', text: '-3.4%', tone: 'status-approved' }} />
        <EhsKpiTile index={2} icon={Recycle} label="Water Recycled" value={k.waterRecycledShare.toFixed(1)} unit="%"
          trend={{ dir: k.waterRecycledShare >= recyclingTarget ? 'up' : 'down', text: `${k.waterRecycledShare >= recyclingTarget ? '+' : '-'}${Math.abs(k.waterRecycledShare - recyclingTarget).toFixed(1)}` }} />
        <EhsKpiTile index={3} icon={Trash2} label="Waste Generated" value={formatNumber(k.wasteGeneratedT, 0)} unit="tonnes"
          trend={{ dir: 'up', text: '+5.2%' }} />
        <EhsKpiTile index={4} icon={Factory} label="Waste Recovered" value={k.wasteRecycledShare.toFixed(1)} unit="%"
          trend={{ dir: k.wasteRecycledShare >= recyclingTarget ? 'up' : 'down', text: `${k.wasteRecycledShare >= recyclingTarget ? '+' : '-'}${Math.abs(k.wasteRecycledShare - recyclingTarget).toFixed(1)}` }} />
      </div>

      {/* Environmental metrics table */}
      <SectionCard
        icon={Waves}
        title="Environmental Records"
        subtitle={`Period-wise water & waste · ${envRecords.length} periods`}
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-orange-700 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(254,243,199,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">Period</th>
                <th className="px-3 py-2 text-right font-semibold">Water (KL)</th>
                <th className="px-3 py-2 text-right font-semibold">Waste (T)</th>
                <th className="px-3 py-2 text-right font-semibold">Recovered</th>
                <th className="px-3 py-2 text-right font-semibold">Hazardous</th>
                <th className="px-3 py-2 text-left font-semibold">Recovery %</th>
              </tr>
            </thead>
            <tbody>
              {envRecords.map((r, i) => {
                const recoveryPct = r.waste > 0 ? (r.recycled / r.waste) * 100 : 0
                return (
                  <motion.tr
                    key={`${r.period}-${i}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.02 }}
                    className="border-t border-slate-100 hover:bg-amber-50/40 transition-colors"
                    style={{ height: 40 }}
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">{r.period}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.water.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.waste.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.recycled.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: r.hazardous > 0 ? AMBER_DEEP : '#64748b' }}>{r.hazardous}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-slate-200/70 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, recoveryPct)}%`,
                              background: `linear-gradient(90deg, ${AMBER_DEEP}, ${AMBER_PRIMARY})`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-900 tabular-nums w-9 text-right">{recoveryPct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Water & waste bar chart + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={TrendingUp}
          title="Water & Waste Trend"
          subtitle="Monthly withdrawal vs waste generated"
          index={6}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} barCategoryGap="22%">
                <defs>
                  <linearGradient id="ehs-env-water" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AMBER_PRIMARY} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={AMBER_PRIMARY} stopOpacity={0.70} />
                  </linearGradient>
                  <linearGradient id="ehs-env-waste" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AMBER_DEEP} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={AMBER_DEEP} stopOpacity={0.70} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(245,158,11,0.06)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Bar dataKey="water" fill="url(#ehs-env-water)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} />
                <Bar dataKey="waste" fill="url(#ehs-env-waste)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Water Recycled</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{waterRecycledKL.toFixed(1)} KL</div>
            </div>
            <div className="glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Waste Recovered</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{wasteRecovered.toFixed(1)} T</div>
            </div>
            <div className="glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Hazardous</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums" style={{ color: k.hazardousWasteT > 0 ? AMBER_DEEP : undefined }}>{k.hazardousWasteT.toFixed(1)} T</div>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Environmental Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 6 — Safety Training (ehs-training)
 * ============================================================ */
function TrainingScreen({
  k, trends, activities, activityLoading,
}: {
  k: Kpis
  trends?: Record<string, Record<string, number>>
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const programs = useMemo(() => deriveTrainingPrograms(k), [k])
  const totalHours = programs.reduce((s, p) => s + p.hours, 0)
  const totalParticipants = programs.reduce((s, p) => s + p.participants, 0)
  const activeModules = programs.length
  const certifications = Math.min(k.totalWorkforce, Math.round(k.totalWorkforce * 0.62))
  const perHead = k.totalWorkforce > 0 ? k.safetyTrainingHours / k.totalWorkforce : 0
  const coverage = Math.min(100, Math.round((perHead / 16) * 100))

  // Derive a 6-month training-hours trend
  const trendData = useMemo(() => {
    const labels = trends ? Object.keys(trends) : []
    if (labels.length === 0) {
      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
      const per = k.safetyTrainingHours / 6
      return months.map((m, i) => ({
        label: m,
        hours: Math.round(per * (0.7 + (i % 3) * 0.18)),
      }))
    }
    return labels.slice(-6).map((label, i) => {
      const total = k.safetyTrainingHours || 0
      const share = 0.55 + ((i * 7) % 9) * 0.05
      return { label, hours: Math.round(total * share / Math.max(1, Math.min(6, labels.length))) }
    })
  }, [trends, k])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={HardHat}
        title="Safety Training"
        subtitle="PPE · emergency · compliance · skill modules"
        completionPct={k.completion}
        badge={{ label: `${coverage}% coverage`, tone: coverage >= 75 ? 'status-approved' : 'status-warning', icon: BookOpen }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EhsKpiTile index={1} icon={GraduationCap} label="Training Hours" value={formatNumber(k.safetyTrainingHours, 0)} unit="h YTD"
          trend={{ dir: 'up', text: '+12.3%' }} />
        <EhsKpiTile index={2} icon={BookOpen} label="Coverage" value={`${coverage}`} unit="%" trend={{ dir: coverage >= 75 ? 'up' : 'down', text: `${coverage >= 75 ? '+' : '-'}${Math.abs(coverage - 75)}` }} />
        <EhsKpiTile index={3} icon={ClipboardList} label="Active Modules" value={formatNumber(activeModules, 0)} unit="programs"
          trend={{ dir: 'up', text: '+1 new' }} />
        <EhsKpiTile index={4} icon={Award} label="Certifications" value={formatNumber(certifications, 0)} unit="issued"
          trend={{ dir: 'up', text: '+8.4%' }} />
      </div>

      {/* Training programs table */}
      <SectionCard
        icon={ClipboardList}
        title="Training Programs"
        subtitle={`${programs.length} active · ${totalParticipants.toLocaleString()} total participants`}
        index={5}
        action={
          <span className="status-pill text-[9px] status-approved">
            {programs.length} active
          </span>
        }
      >
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(254,243,199,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">Program</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-right font-semibold">Hours</th>
                <th className="px-3 py-2 text-right font-semibold">Participants</th>
                <th className="px-3 py-2 text-right font-semibold">Completion</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p, i) => {
                const typeColor = p.type === 'Safety' ? '#dc2626' : p.type === 'Emergency' ? AMBER_DEEP : p.type === 'Skill' ? '#7c3aed' : '#0891b2'
                return (
                  <motion.tr
                    key={p.name}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.025 }}
                    className="border-t border-slate-100 hover:bg-amber-50/40 transition-colors"
                    style={{ height: 40 }}
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: `${typeColor}1a`, color: typeColor, borderColor: `${typeColor}33`,
                      }}>
                        {p.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{p.hours.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{p.participants.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${p.completion}%`,
                              background: `linear-gradient(90deg, ${AMBER_DEEP}, ${AMBER_PRIMARY})`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-900 tabular-nums w-8 text-right">{p.completion}%</span>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Training trend area chart + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={TrendingUp}
          title="Monthly Training Hours Trend"
          subtitle="Aggregated training hours across periods"
          index={6}
          action={
            <span className="status-pill text-[9px] status-approved">
              <Clock className="h-2.5 w-2.5" />
              {totalHours.toLocaleString()} h total
            </span>
          }
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="ehs-train-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AMBER_PRIMARY} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={AMBER_PRIMARY} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="ehs-train-line" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={AMBER_DEEP} />
                    <stop offset="100%" stopColor={AMBER_PRIMARY} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${Math.round(v).toLocaleString()} h`, 'Hours']} cursor={{ stroke: AMBER_PRIMARY, strokeDasharray: '4 4' }} />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="url(#ehs-train-line)"
                  strokeWidth={2.5}
                  fill="url(#ehs-train-area)"
                  dot={{ r: 3, fill: AMBER_DEEP, stroke: '#fff', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: AMBER_DEEP, stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Per Head</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{perHead.toFixed(1)} h</div>
            </div>
            <div className="glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Coverage</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{coverage}%</div>
            </div>
            <div className="glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Modules</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">{activeModules}</div>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Training Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function EhsWorkspace() {
  const { activeModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [tasks, setTasks] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(true)
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
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isEhsActivity).slice(0, 6)
      setActivities(filtered)
    } catch {
      /* silent — keep existing feed on poll error */
    } finally {
      if (mountedRef.current) setActivityLoading(false)
    }
  }, [])

  const fetchTasks = useCallback(async () => {
    try {
      setTasksLoading(true)
      const res = await fetch('/api/action-items', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ActionItemsResponse
      if (!mountedRef.current) return
      const filtered = (Array.isArray(data.tasks) ? data.tasks : []).filter(isEhsTask).slice(0, 8)
      setTasks(filtered)
    } catch {
      /* silent */
    } finally {
      if (mountedRef.current) setTasksLoading(false)
    }
  }, [])

  /* ---- initial load ---- */
  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchActivities(), fetchTasks()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [fetchOverview, fetchActivities, fetchTasks])

  /* ---- polling: activity every 30s, overview & tasks every 60s ---- */
  useEffect(() => {
    const activityTimer = setInterval(fetchActivities, 30_000)
    const overviewTimer = setInterval(fetchOverview, 60_000)
    const tasksTimer = setInterval(fetchTasks, 60_000)
    return () => {
      clearInterval(activityTimer)
      clearInterval(overviewTimer)
      clearInterval(tasksTimer)
    }
  }, [fetchActivities, fetchOverview, fetchTasks])

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
    return <WorkspaceSkeleton tiles={activeModule === 'ehs-ops' || activeModule === 'ehs-incidents' || activeModule === 'ehs-inspections' || activeModule === 'ehs-environmental' ? 4 : 4} />
  }

  // ---- Error state ----
  if (error && !overview) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />
  }

  // ---- Empty state ----
  if (!overview || !k) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No EHS data yet"
        subtitle="Set up a reporting period to populate the EHS workspace."
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
        {activeModule === 'ehs-ops' && (
          <OpsScreen
            k={k}
            periods={periods}
            activities={activities}
            activityLoading={activityLoading}
            tasks={tasks}
            tasksLoading={tasksLoading}
          />
        )}
        {activeModule === 'ehs-incidents' && (
          <IncidentsScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'ehs-inspections' && (
          <InspectionsScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'ehs-corrective' && (
          <CorrectiveScreen
            k={k}
            tasks={tasks}
            tasksLoading={tasksLoading}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'ehs-environmental' && (
          <EnvironmentalScreen
            k={k}
            periods={periods}
            activities={activities}
            activityLoading={activityLoading}
          />
        )}
        {activeModule === 'ehs-training' && (
          <TrainingScreen k={k} trends={trends} activities={activities} activityLoading={activityLoading} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
