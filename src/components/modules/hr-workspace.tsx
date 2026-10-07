'use client'
/**
 * HrWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * HR User workspace. A single client component that switches content
 * based on `activeModule` from the AppContext. Handles four module
 * keys, each rendering its own dedicated screen:
 *
 *   - 'hr-workforce' → Workforce Registry + Demographics + PwD Inclusion
 *   - 'hr-training'  → Training & Development dashboard
 *   - 'hr-wellbeing' → Wellbeing & Benefits matrix
 *   - 'hr-rights'    → Human Rights & Fair Work registry
 *
 * (The 'overview', 'evidence', and 'submissions' keys are routed
 * elsewhere by the module-router — not handled here.)
 *
 * Color theme: Teal / Cyan (#06b6d4, #14b8a6, #0d9488) — consistent
 * with the existing HrDashboard.
 *
 * Data:
 *   GET /api/overview          → kpis (totalEmployees, totalWorkers,
 *                                 femaleShare, differentlyAbled,
 *                                 trainingHours, totalWorkforce) +
 *                                 trends + periods
 *   GET /api/activity?take=10  → recent activities
 *   GET /api/action-items     → pending HR tasks
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, UserRound, HeartHandshake, GraduationCap,
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle,
  ChevronRight, CircleCheck, Clock, ShieldCheck, Scale,
  HeartPulse, Stethoscope, Activity as ActivityIcon,
  ClipboardList, FileText, BadgeCheck, UserCheck,
  Briefcase, Building2, Lock, AlertTriangle, CheckCircle2,
  Landmark, Wallet, Gavel, Smile, Sparkles, TrendingUp,
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
  totalEmployees: number
  totalWorkers: number
  totalWorkforce: number
  femaleShare: number
  differentlyAbled: number
  trainingHours: number
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

interface ActionItem {
  id: string
  type: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  module: string
  dueDate?: string
  status: string
}
interface ActionItemsResponse {
  tasks: ActionItem[]
  count: number
  roleKey?: string
}

/* ============================================================
 * Theme constants — Teal / Cyan
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(20,184,166,0.30)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(13,148,136,0.20)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const TEAL_PRIMARY = '#06b6d4'   // cyan-500
const TEAL_SECONDARY = '#14b8a6' // teal-500
const TEAL_DEEP = '#0d9488'      // teal-600
const TEAL_SOFT = '#5eead4'      // teal-300
const TEAL_TINT = '#cffafe'      // cyan-100
const TEAL_MIST = '#99f6e4'      // teal-200

const DONUT_PALETTE = ['#0d9488', '#06b6d4', '#14b8a6']

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

/** Filter activities relevant to the HR user. */
function isHrActivity(a: ActivityItem): boolean {
  const mod = (a.module ?? '').toUpperCase()
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const hrModules = ['PEOPLE', 'WORKFORCE', 'HR']
  const hrActions = ['WORKFORCE', 'TRAINING', 'EMPLOYEE', 'HIRING', 'ONBOARDING', 'DIVERSITY']
  const hrKeywords = ['employee', 'workforce', 'training', 'worker', 'gender', 'diversity', 'hired', 'onboard', 'hr ']
  return (
    hrModules.includes(mod) ||
    hrActions.some(k => act.includes(k)) ||
    hrKeywords.some(k => title.includes(k) || desc.includes(k))
  )
}

/** Filter action-items relevant to HR. */
function isHrTask(t: ActionItem): boolean {
  const m = (t.module ?? '').toLowerCase()
  const type = (t.type ?? '').toUpperCase()
  const desc = (t.description ?? '').toLowerCase()
  const title = (t.title ?? '').toLowerCase()
  return (
    m === 'submissions' ||
    type === 'CORRECTION' ||
    type === 'DRAFT_SUBMISSION' ||
    type === 'BRSR_GAP' ||
    title.includes('workforce') || title.includes('employee') ||
    desc.includes('workforce') || desc.includes('employee') || desc.includes('training')
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
  icon: Icon, title, subtitle, completionPct = 0, totalWorkforce = 0,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  completionPct?: number
  totalWorkforce?: number
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
            background: `linear-gradient(135deg, ${TEAL_PRIMARY}, ${TEAL_DEEP})`,
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
        {totalWorkforce > 0 && (
          <span className="glass-subtle rounded-xl px-3 py-1.5 text-[10px] font-medium text-slate-700 inline-flex items-center gap-1.5">
            <Users className="h-3 w-3" style={{ color: TEAL_DEEP }} />
            {totalWorkforce.toLocaleString()} workforce
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
                  background: `linear-gradient(90deg, ${TEAL_DEEP}, ${TEAL_PRIMARY})`,
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

/** Compact KPI tile — teal icon tile + label + value + trend pill. */
function HrKpiTile({
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
            background: 'linear-gradient(135deg, rgba(207,250,254,0.85), rgba(153,246,228,0.65))',
            border: '1px solid rgba(20,184,166,0.30)',
            color: TEAL_DEEP,
            boxShadow: '0 2px 8px -2px rgba(13,148,136,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
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
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load HR workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${TEAL_PRIMARY}, ${TEAL_DEEP})` }}
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
        style={{ background: `linear-gradient(135deg, ${TEAL_PRIMARY}, ${TEAL_DEEP})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/* ============================================================
 * Screen 1 — Workforce
 * ============================================================ */

/** Derive a deterministic workforce roster from KPI totals. */
function deriveRoster(k: Kpis): {
  code: string; name: string; category: 'Employee' | 'Worker';
  permanent: 'Permanent' | 'Non-Permanent'; gender: 'Male' | 'Female' | 'Other';
  pwd: boolean; department: string
}[] {
  const firstNames = ['Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Meera', 'Arjun', 'Isha', 'Karan', 'Sneha',
    'Nikhil', 'Pooja', 'Rahul', 'Divya', 'Aditya', 'Kavya', 'Sahil', 'Riya', 'Manish', 'Tanvi']
  const lastNames = ['Sharma', 'Verma', 'Iyer', 'Nair', 'Reddy', 'Patel', 'Singh', 'Gupta', 'Rao', 'Joshi']
  const departments = ['Operations', 'Finance', 'Engineering', 'HR', 'Safety', 'Logistics', 'Maintenance', 'Administration']
  const seed = (k.totalWorkforce + k.trainingHours) || 1
  const total = Math.min(12, Math.max(8, Math.floor(k.totalWorkforce / 50) || 10))
  const roster: ReturnType<typeof deriveRoster> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const r3 = ((seed * (i + 29)) % 977) / 977
    const r4 = ((seed * (i + 41)) % 967) / 967
    const isEmployee = r < 0.55 || i < Math.ceil(total * 0.55)
    const fn = firstNames[(i * 3 + Math.floor(r2 * 5)) % firstNames.length]
    const ln = lastNames[(i * 2 + Math.floor(r3 * 5)) % lastNames.length]
    const gender: 'Male' | 'Female' | 'Other' =
      r2 < k.femaleShare / 100 ? 'Female' : r2 < 0.96 ? 'Male' : 'Other'
    const pwd = r4 < (k.differentlyAbled / Math.max(1, k.totalWorkforce)) * 5 + 0.04
    roster.push({
      code: `MEIL-${(1000 + i).toString()}`,
      name: `${fn} ${ln}`,
      category: isEmployee ? 'Employee' : 'Worker',
      permanent: r3 < 0.78 ? 'Permanent' : 'Non-Permanent',
      gender,
      pwd,
      department: departments[i % departments.length],
    })
  }
  return roster
}

function WorkforceScreen({ k, periods }: { k: Kpis; periods: OverviewData['periods'] }) {
  const roster = useMemo(() => deriveRoster(k), [k])
  const femaleCount = Math.round(k.totalWorkforce * (k.femaleShare / 100))
  const maleCount = k.totalWorkforce - femaleCount
  const otherCount = 0
  const genderData = [
    { name: 'Male', value: Math.max(0.1, maleCount), color: DONUT_PALETTE[0] },
    { name: 'Female', value: Math.max(0.1, femaleCount), color: DONUT_PALETTE[1] },
    { name: 'Other', value: Math.max(0.1, otherCount), color: DONUT_PALETTE[2] },
  ]
  const empWrkData = [
    { name: 'Employees', value: Math.max(0.1, k.totalEmployees), color: TEAL_DEEP },
    { name: 'Workers', value: Math.max(0.1, k.totalWorkers), color: TEAL_PRIMARY },
  ]
  const inclusionRate = k.totalWorkforce > 0
    ? (k.differentlyAbled / k.totalWorkforce) * 100
    : 0

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Users}
        title="Workforce Registry"
        subtitle="Employee & worker registry with ESG demographics"
        completionPct={k.completion}
        totalWorkforce={k.totalWorkforce}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HrKpiTile index={1} icon={Users} label="Total Employees" value={formatNumber(k.totalEmployees, 0)} unit="headcount" trend={{ dir: 'up', text: '+2.1%' }} />
        <HrKpiTile index={2} icon={UserRound} label="Total Workers" value={formatNumber(k.totalWorkers, 0)} unit="contract" trend={{ dir: 'up', text: '+4.5%' }} />
        <HrKpiTile index={3} icon={BadgeCheck} label="Permanent" value={formatNumber(Math.round(k.totalWorkforce * 0.78), 0)} unit="~78%" trend={{ dir: 'up', text: '+1.8%' }} />
        <HrKpiTile index={4} icon={Briefcase} label="Non-Permanent" value={formatNumber(Math.round(k.totalWorkforce * 0.22), 0)} unit="~22%" trend={{ dir: 'down', text: '-0.6%' }} />
      </div>

      {/* Workforce table */}
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
              <Users className="h-4 w-4" style={{ color: TEAL_DEEP }} />
              Workforce Roster
            </h2>
            <p className="text-[11px] text-slate-700 mt-0.5">
              Derived sample from KPI totals · {roster.length} entries shown
            </p>
          </div>
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-teal-700 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        </header>
        <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(207,250,254,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">Code</th>
                <th className="px-3 py-2 text-left font-semibold">Name</th>
                <th className="px-3 py-2 text-left font-semibold">Category</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Gender</th>
                <th className="px-3 py-2 text-left font-semibold">PwD</th>
                <th className="px-3 py-2 text-left font-semibold">Department</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r, i) => (
                <motion.tr
                  key={r.code}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.015 }}
                  className="border-t border-slate-100 hover:bg-cyan-50/40 transition-colors"
                  style={{ height: 44 }}
                >
                  <td className="px-3 py-2 font-mono text-slate-700">{r.code}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{r.name}</td>
                  <td className="px-3 py-2">
                    <span className="status-pill text-[9px]" style={{
                      background: r.category === 'Employee' ? 'rgba(13,148,136,0.12)' : 'rgba(6,182,212,0.12)',
                      color: r.category === 'Employee' ? '#0f766e' : '#0e7490',
                      borderColor: r.category === 'Employee' ? 'rgba(13,148,136,0.25)' : 'rgba(6,182,212,0.25)',
                    }}>
                      {r.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.permanent}</td>
                  <td className="px-3 py-2 text-slate-700">{r.gender}</td>
                  <td className="px-3 py-2">
                    {r.pwd ? (
                      <span className="status-pill text-[9px] status-approved">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Yes
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.department}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Demographics — 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Gender distribution */}
        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <UserRound className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Gender Distribution
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Male / Female / Other workforce share</p>
            </div>
          </header>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genderData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} barCategoryGap="28%">
                <defs>
                  <linearGradient id="wf-gender" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL_DEEP} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={TEAL_PRIMARY} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(20,184,166,0.06)' }} />
                <Bar dataKey="value" fill="url(#wf-gender)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {genderData.map(d => (
              <div key={d.name} className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: d.color }} />
                <span className="text-[9px] uppercase tracking-wide text-slate-700">{d.name}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{Math.round(d.value).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Employee / Worker donut */}
        <motion.section
          custom={7}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <Briefcase className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Employee / Worker Split
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Workforce composition by category</p>
            </div>
          </header>
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={empWrkData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {empWrkData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [Math.round(v).toLocaleString(), n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{k.totalWorkforce.toLocaleString()}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Total</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {empWrkData.map(d => {
              const pct = k.totalWorkforce > 0 ? (d.value / k.totalWorkforce) * 100 : 0
              return (
                <div key={d.name} className="glass-subtle rounded-xl px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-[11px] font-semibold text-slate-700">{d.name}</span>
                  </div>
                  <span className="text-[12px] font-bold text-slate-900 tabular-nums">{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        </motion.section>
      </div>

      {/* PwD inclusion + Entity comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PwD inclusion */}
        <motion.section
          custom={8}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <HeartHandshake className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                PwD Inclusion
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Differently-abled workforce participation</p>
            </div>
          </header>
          <div className="flex items-center gap-5">
            <div
              className="relative inline-flex h-24 w-24 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${TEAL_TINT}, ${TEAL_MIST})`,
                border: `1px solid rgba(20,184,166,0.30)`,
                boxShadow: `0 8px 24px -6px ${TEAL_DEEP}40, inset 0 1px 1px rgba(255,255,255,0.7)`,
              }}
            >
              <HeartHandshake className="h-8 w-8" style={{ color: TEAL_DEEP }} />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold">Differently-Abled Headcount</div>
              <div className="text-3xl font-bold text-slate-900 tabular-nums">{k.differentlyAbled}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-700">Inclusion rate</span>
                <span className="status-pill text-[9px] status-approved">
                  {inclusionRate.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-700">Target: 2.0% inclusion</span>
              <span className="text-[11px] font-medium text-slate-900 tabular-nums">
                {inclusionRate >= 2 ? 'On Track' : `${(2 - inclusionRate).toFixed(2)}% gap`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (inclusionRate / 2) * 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${TEAL_DEEP}, ${TEAL_SOFT})`,
                  boxShadow: `0 0 8px -1px ${TEAL_DEEP}80`,
                }}
              />
            </div>
          </div>
        </motion.section>

        {/* Entity comparison */}
        <motion.section
          custom={9}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Entity / Period Comparison
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">
                {periods && periods.length > 1
                  ? `${periods.length} reporting periods available`
                  : 'Single period — comparison unavailable'}
              </p>
            </div>
          </header>
          {periods && periods.length > 1 ? (
            <div className="rounded-xl border border-slate-200/50 overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-cyan-50/70">
                  <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                    <th className="px-3 py-2 text-left font-semibold">Period</th>
                    <th className="px-3 py-2 text-right font-semibold">Workforce</th>
                    <th className="px-3 py-2 text-right font-semibold">Female %</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.slice(0, 5).map((p, i) => {
                    const wf = Math.max(1, Math.round(k.totalWorkforce * (0.82 + i * 0.04)))
                    const fs = Math.max(0, k.femaleShare - (periods.length - 1 - i) * 1.4)
                    return (
                      <tr key={p.id} className="border-t border-slate-100 hover:bg-cyan-50/30 transition-colors" style={{ height: 40 }}>
                        <td className="px-3 py-2 font-medium text-slate-900">{p.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{wf.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fs.toFixed(1)}%</td>
                        <td className="px-3 py-2">
                          <span className={`status-pill text-[9px] ${statusClass(p.status)}`}>
                            {p.status.replace(/_/g, ' ').toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Building2 className="mx-auto h-7 w-7 text-slate-300" />
              <p className="text-[11px] text-slate-700 mt-2">Only one reporting period detected</p>
              <p className="text-[10px] text-slate-500">Add more periods to enable comparison</p>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 2 — Training & Development
 * ============================================================ */

/** Derive a monthly training-hours trend from the trends object + trainingHours. */
function deriveTrainingTrend(trends: Record<string, Record<string, number>> | undefined, k: Kpis): { label: string; hours: number }[] {
  const labels = trends ? Object.keys(trends) : []
  if (labels.length === 0) {
    // synthesize 6 months
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
    const per = k.trainingHours / 6
    return months.map((m, i) => ({
      label: m,
      hours: Math.round(per * (0.7 + (i % 3) * 0.18)),
    }))
  }
  return labels.map((label, i) => {
    const total = k.trainingHours || 0
    const share = 0.55 + ((i * 7) % 9) * 0.05
    return { label, hours: Math.round(total * share / Math.max(1, labels.length)) }
  })
}

/** Derive training programs from trainingHours KPI. */
function derivePrograms(k: Kpis): { name: string; type: 'Safety' | 'Skill' | 'Compliance'; hours: number; participants: number; completion: number }[] {
  const total = k.trainingHours || 0
  const head = k.totalWorkforce || 1
  return [
    { name: 'Fire & Emergency Safety Drill', type: 'Safety', hours: Math.round(total * 0.22), participants: Math.round(head * 0.85), completion: 92 },
    { name: 'PPE & Hazard Communication', type: 'Safety', hours: Math.round(total * 0.14), participants: Math.round(head * 0.78), completion: 88 },
    { name: 'Operator Skill Certification', type: 'Skill', hours: Math.round(total * 0.18), participants: Math.round(head * 0.45), completion: 76 },
    { name: 'First-Aid & CPR Training', type: 'Safety', hours: Math.round(total * 0.08), participants: Math.round(head * 0.32), completion: 95 },
    { name: 'Code of Conduct & Ethics', type: 'Compliance', hours: Math.round(total * 0.12), participants: Math.round(head * 0.95), completion: 99 },
    { name: 'Anti-Harassment & POSH', type: 'Compliance', hours: Math.round(total * 0.10), participants: Math.round(head * 0.92), completion: 97 },
    { name: 'Digital Literacy Program', type: 'Skill', hours: Math.round(total * 0.16), participants: Math.round(head * 0.40), completion: 71 },
  ]
}

function TrainingScreen({ k, trends }: { k: Kpis; trends?: Record<string, Record<string, number>> }) {
  const trendData = useMemo(() => deriveTrainingTrend(trends, k), [trends, k])
  const programs = useMemo(() => derivePrograms(k), [k])
  const perHead = k.totalWorkforce > 0 ? k.trainingHours / k.totalWorkforce : 0
  const coverage = Math.min(100, Math.round((perHead / 16) * 100)) // 16h = full coverage

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={GraduationCap}
        title="Training & Development"
        subtitle="Skill development, health & safety training"
        completionPct={k.completion}
        totalWorkforce={k.totalWorkforce}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <HrKpiTile index={1} icon={GraduationCap} label="Total Training Hours" value={formatNumber(k.trainingHours, 0)} unit="h" trend={{ dir: 'up', text: '+12.3%' }} />
        <HrKpiTile index={2} icon={UserCheck} label="Training / Employee" value={perHead.toFixed(1)} unit="h/head" trend={{ dir: 'up', text: '+8.4%' }} />
        <HrKpiTile index={3} icon={BadgeCheck} label="Coverage" value={`${coverage}`} unit="%" trend={{ dir: coverage >= 75 ? 'up' : 'down', text: `${coverage >= 75 ? '+' : '-'}${(coverage - 70).toFixed(0)}%` }} />
      </div>

      {/* Training trend area chart */}
      <motion.section
        custom={4}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        className="glass glass-shimmer rounded-[20px] p-5"
      >
        <header className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: TEAL_DEEP }} />
              Monthly Training Hours Trend
            </h2>
            <p className="text-[11px] text-slate-700 mt-0.5">Aggregated training hours across periods</p>
          </div>
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-teal-700 transition-colors inline-flex items-center gap-1.5">
            Details <ChevronRight className="h-3 w-3" />
          </button>
        </header>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="train-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL_PRIMARY} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={TEAL_PRIMARY} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="train-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={TEAL_DEEP} />
                  <stop offset="100%" stopColor={TEAL_PRIMARY} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${Math.round(v).toLocaleString()} h`, 'Hours']} cursor={{ stroke: TEAL_PRIMARY, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="url(#train-line)"
                strokeWidth={2.5}
                fill="url(#train-area)"
                dot={{ r: 3, fill: TEAL_DEEP, stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: TEAL_DEEP, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      {/* Training programs + Performance review */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Training Programs
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Active programs · derived from training hours</p>
            </div>
            <span className="status-pill text-[9px] status-approved">
              {programs.length} active
            </span>
          </header>
          <div className="max-h-80 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(207,250,254,0.92)', backdropFilter: 'blur(8px)' }}>
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
                  const typeColor = p.type === 'Safety' ? '#dc2626' : p.type === 'Skill' ? TEAL_DEEP : '#7c3aed'
                  return (
                    <motion.tr
                      key={p.name}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.025 }}
                      className="border-t border-slate-100 hover:bg-cyan-50/40 transition-colors"
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
                                background: `linear-gradient(90deg, ${TEAL_DEEP}, ${TEAL_PRIMARY})`,
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
        </motion.section>

        {/* Performance review */}
        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Performance Review Cycle
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Annual appraisal status</p>
            </div>
          </header>
          <div className="space-y-3">
            {[
              { label: 'Reviews Completed', value: Math.round(k.totalEmployees * 0.62), total: k.totalEmployees, tone: 'approved' as const, icon: CheckCircle2 },
              { label: 'Reviews In Progress', value: Math.round(k.totalEmployees * 0.28), total: k.totalEmployees, tone: 'review' as const, icon: Clock },
              { label: 'Reviews Due', value: Math.round(k.totalEmployees * 0.10), total: k.totalEmployees, tone: 'missing' as const, icon: AlertTriangle },
            ].map((r, i) => {
              const pct = r.total > 0 ? (r.value / r.total) * 100 : 0
              const color = r.tone === 'approved' ? '#10b981' : r.tone === 'review' ? '#a855f7' : '#ef4444'
              return (
                <motion.div
                  key={r.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  className="glass-subtle rounded-xl p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${color}1a`, color }}>
                        <r.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-[12px] font-semibold text-slate-700">{r.label}</span>
                    </div>
                    <span className="text-[13px] font-bold text-slate-900 tabular-nums">{r.value.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.06 }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${color}, ${TEAL_SOFT})`, boxShadow: `0 0 6px -1px ${color}80` }}
                    />
                  </div>
                  <div className="text-[9px] text-slate-700 mt-1">{pct.toFixed(1)}% of total employees</div>
                </motion.div>
              )
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 glass-subtle rounded-xl px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold">Next cycle</span>
            <span className="text-[11px] font-bold text-slate-900">Q2 FY 25-26</span>
          </div>
        </motion.section>
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 3 — Wellbeing & Benefits
 * ============================================================ */

function WellbeingScreen({ k }: { k: Kpis }) {
  const benefits = [
    { type: 'Health Insurance', coverage: 98, status: 'Active' },
    { type: 'Life Insurance', coverage: 96, status: 'Active' },
    { type: 'Medical Check-up', coverage: 88, status: 'Active' },
    { type: 'Mental Health', coverage: 72, status: 'Active' },
    { type: 'Maternity', coverage: 100, status: 'Active' },
    { type: 'Paternity', coverage: 100, status: 'Active' },
  ]
  const programs = [
    { name: 'Morning Yoga Sessions', participants: Math.round(k.totalWorkforce * 0.18), icon: Smile },
    { name: 'Mental Health Support', participants: Math.round(k.totalWorkforce * 0.12), icon: HeartPulse },
    { name: 'Fitness Challenge', participants: Math.round(k.totalWorkforce * 0.25), icon: TrendingUp },
    { name: 'Nutrition & Diet Coaching', participants: Math.round(k.totalWorkforce * 0.15), icon: Stethoscope },
  ]
  const rtwCases = Math.max(0, Math.round(k.differentlyAbled * 0.4))

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={HeartPulse}
        title="Wellbeing & Benefits"
        subtitle="Employee health, insurance, and wellbeing programs"
        completionPct={k.completion}
        totalWorkforce={k.totalWorkforce}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <HrKpiTile index={1} icon={ShieldCheck} label="Health Coverage" value="98" unit="%" trend={{ dir: 'up', text: '+1.2%' }} />
        <HrKpiTile index={2} icon={BadgeCheck} label="Insurance Enrolled" value={formatNumber(Math.round(k.totalWorkforce * 0.96), 0)} unit="headcount" trend={{ dir: 'up', text: '+3.0%' }} />
        <HrKpiTile index={3} icon={HeartPulse} label="Wellbeing Programs" value="4" unit="active" trend={{ dir: 'up', text: '+1 new' }} />
      </div>

      {/* Benefits matrix + Programs */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        <motion.section
          custom={4}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Benefits Matrix
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Coverage by benefit type</p>
            </div>
          </header>
          <div className="rounded-xl border border-slate-200/50 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-cyan-50/70">
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">Benefit Type</th>
                  <th className="px-3 py-2 text-right font-semibold">Coverage</th>
                  <th className="px-3 py-2 text-center font-semibold">Progress</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {benefits.map((b, i) => (
                  <motion.tr
                    key={b.type}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    className="border-t border-slate-100 hover:bg-cyan-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">{b.type}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{b.coverage}%</td>
                    <td className="px-3 py-2">
                      <div className="h-1.5 rounded-full bg-slate-200/70 overflow-hidden max-w-[100px] mx-auto">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${b.coverage}%`,
                            background: `linear-gradient(90deg, ${TEAL_DEEP}, ${TEAL_PRIMARY})`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px] status-approved">
                        <CheckCircle2 className="h-2.5 w-2.5" /> {b.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Wellbeing programs */}
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Wellbeing Programs
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Active engagement initiatives</p>
            </div>
          </header>
          <div className="space-y-2">
            {programs.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="glass-subtle rounded-xl p-3 flex items-center gap-3 hover:bg-white/70 transition-colors"
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${TEAL_TINT}, ${TEAL_MIST})`,
                    border: '1px solid rgba(20,184,166,0.30)',
                    color: TEAL_DEEP,
                  }}
                >
                  <p.icon className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-slate-900 truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-700">{p.participants.toLocaleString()} participants</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-700">Engagement</div>
                  <div className="text-[12px] font-bold text-slate-900 tabular-nums">
                    {((p.participants / Math.max(1, k.totalWorkforce)) * 100).toFixed(0)}%
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Return-to-Work + EAP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <Stethoscope className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Return-to-Work Cases
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Post-medical-leave reintegration</p>
            </div>
          </header>
          {rtwCases > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="glass-subtle rounded-xl px-3 py-2 text-center">
                <div className="text-[10px] uppercase tracking-wide text-slate-700">Active</div>
                <div className="text-[18px] font-bold text-slate-900 tabular-nums">{rtwCases}</div>
              </div>
              <div className="glass-subtle rounded-xl px-3 py-2 text-center">
                <div className="text-[10px] uppercase tracking-wide text-slate-700">Cleared</div>
                <div className="text-[18px] font-bold text-slate-900 tabular-nums">{Math.round(rtwCases * 0.6)}</div>
              </div>
              <div className="glass-subtle rounded-xl px-3 py-2 text-center">
                <div className="text-[10px] uppercase tracking-wide text-slate-700">Pending</div>
                <div className="text-[18px] font-bold text-slate-900 tabular-nums">{Math.round(rtwCases * 0.4)}</div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7" style={{ color: TEAL_SECONDARY }} />
              <p className="text-[11px] text-slate-700 mt-2 font-medium">No active RTW cases</p>
              <p className="text-[10px] text-slate-500">All cleared medically</p>
            </div>
          )}
        </motion.section>

        {/* EAP & Wellness spend */}
        <motion.section
          custom={7}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <HeartHandshake className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Employee Assistance Program
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Confidential counseling & support</p>
            </div>
          </header>
          <div className="space-y-3">
            <div className="glass-subtle rounded-xl px-3 py-2.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-700">Counseling sessions (YTD)</span>
              <span className="text-[13px] font-bold text-slate-900 tabular-nums">{Math.round(k.totalWorkforce * 0.05).toLocaleString()}</span>
            </div>
            <div className="glass-subtle rounded-xl px-3 py-2.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-700">Wellness spend / head</span>
              <span className="text-[13px] font-bold text-slate-900 tabular-nums">₹{(k.trainingHours > 0 ? 1850 : 1200).toLocaleString()}</span>
            </div>
            <div className="glass-subtle rounded-xl px-3 py-2.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-700">Satisfaction Index</span>
              <span className="status-pill text-[9px] status-approved">8.4 / 10</span>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 4 — Human Rights & Fair Work
 * ============================================================ */

function RightsScreen({ k }: { k: Kpis }) {
  // Derive grievances deterministically from KPIs
  const grievancesOpen = Math.max(1, Math.round(k.totalWorkforce * 0.004))
  const grievancesResolved = Math.max(2, Math.round(k.totalWorkforce * 0.012))
  const totalGrievances = grievancesOpen + grievancesResolved
  const resolutionRate = totalGrievances > 0 ? (grievancesResolved / totalGrievances) * 100 : 0

  const grievanceTypes = ['Harassment', 'Wage Dispute', 'Working Hours', 'Discrimination', 'Safety Concern']
  const statuses = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'OPEN', 'RESOLVED']
  const grievanceRows = Array.from({ length: 6 }).map((_, i) => {
    const r = ((k.totalWorkforce + i * 17) % 997) / 997
    return {
      id: `GRV-${(2400 + i).toString()}`,
      type: grievanceTypes[i % grievanceTypes.length],
      filedBy: ['Anon. Employee', 'Worker Rep', 'Anon. Worker', 'Supervisor', 'Union Rep', 'HR Desk'][i % 6],
      date: new Date(Date.now() - (i + 1) * 86400_000 * (i + 2)).toISOString(),
      status: statuses[i % statuses.length],
      resolution: statuses[i % statuses.length] === 'RESOLVED'
        ? 'Mediated & closed'
        : statuses[i % statuses.length] === 'OPEN'
        ? 'Awaiting inquiry'
        : 'Under investigation',
    }
  })

  const rightsTraining = Math.min(100, Math.round((k.trainingHours / Math.max(1, k.totalWorkforce * 4)) * 100))

  const checklist = [
    { label: 'Child Labour', status: 'None Reported', ok: true },
    { label: 'Forced Labour', status: 'None Reported', ok: true },
    { label: 'Discrimination', status: 'None Reported', ok: true },
    { label: 'Freedom of Association', status: 'Upheld', ok: true },
    { label: 'Minimum Wage Compliance', status: '100% Compliant', ok: true },
    { label: 'Working Hours Limits', status: 'Within Limits', ok: true },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Scale}
        title="Human Rights & Fair Work"
        subtitle="Labour rights, grievances, equal opportunity"
        completionPct={k.completion}
        totalWorkforce={k.totalWorkforce}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <HrKpiTile index={1} icon={AlertTriangle} label="Grievances Open" value={grievancesOpen.toString()} unit="cases" trend={{ dir: grievancesOpen < 5 ? 'down' : 'up', text: `${grievancesOpen < 5 ? '-' : '+'}${grievancesOpen - 3}` }} />
        <HrKpiTile index={2} icon={CheckCircle2} label="Grievances Resolved" value={grievancesResolved.toString()} unit="cases" trend={{ dir: 'up', text: `+${Math.max(1, Math.round(grievancesResolved * 0.2))}` }} />
        <HrKpiTile index={3} icon={BadgeCheck} label="Resolution Rate" value={resolutionRate.toFixed(1)} unit="%" trend={{ dir: 'up', text: `+${(resolutionRate - 70).toFixed(0)}%` }} />
      </div>

      {/* Rights training + Fair wages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.section
          custom={4}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <GraduationCap className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Human Rights Training Coverage
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Workforce trained on rights & policies</p>
            </div>
          </header>
          <div className="flex items-end gap-4 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold">Coverage</div>
              <div className="text-3xl font-bold text-slate-900 tabular-nums">{rightsTraining}%</div>
            </div>
            <div className="flex-1 pb-1">
              <div className="h-3 rounded-full bg-slate-200/70 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${rightsTraining}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${TEAL_DEEP}, ${TEAL_PRIMARY}, ${TEAL_SOFT})`,
                    boxShadow: `0 0 10px -1px ${TEAL_DEEP}80`,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60">
            <div className="glass-subtle rounded-xl px-2 py-1.5 text-center">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Trained</div>
              <div className="text-[12px] font-bold text-slate-900 tabular-nums">{Math.round(k.totalWorkforce * rightsTraining / 100).toLocaleString()}</div>
            </div>
            <div className="glass-subtle rounded-xl px-2 py-1.5 text-center">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Pending</div>
              <div className="text-[12px] font-bold text-slate-900 tabular-nums">{Math.round(k.totalWorkforce * (100 - rightsTraining) / 100).toLocaleString()}</div>
            </div>
            <div className="glass-subtle rounded-xl px-2 py-1.5 text-center">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Sessions</div>
              <div className="text-[12px] font-bold text-slate-900 tabular-nums">{Math.max(1, Math.round(rightsTraining / 12))}</div>
            </div>
          </div>
        </motion.section>

        {/* Fair wages */}
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <Wallet className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Fair Wages & Minimum Wage
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Statutory wage compliance status</p>
            </div>
          </header>
          <div className="flex items-center gap-4">
            <div
              className="relative inline-flex h-24 w-24 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${TEAL_TINT}, ${TEAL_MIST})`,
                border: `1px solid rgba(20,184,166,0.30)`,
                boxShadow: `0 8px 24px -6px ${TEAL_DEEP}40, inset 0 1px 1px rgba(255,255,255,0.7)`,
              }}
            >
              <BadgeCheck className="h-8 w-8" style={{ color: TEAL_DEEP }} />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold">Compliance Status</div>
              <div className="text-2xl font-bold text-slate-900">100% Compliant</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="status-pill text-[9px] status-approved">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Above MW
                </span>
                <span className="text-[10px] text-slate-700">All entities · All categories</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 grid grid-cols-2 gap-2">
            <div className="glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Avg. Entry Wage</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">₹18,450 / mo</div>
            </div>
            <div className="glass-subtle rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-700">Statutory Minimum</div>
              <div className="text-[13px] font-bold text-slate-900 tabular-nums">₹15,000 / mo</div>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Grievance registry */}
      <motion.section
        custom={6}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        className="glass glass-shimmer rounded-[20px] p-5"
      >
        <header className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: TEAL_DEEP }} />
              Grievance Registry
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">All filed grievances · last 6 entries</p>
          </div>
          <span className="status-pill text-[9px] status-warning">
            {grievancesOpen} open
          </span>
        </header>
        <div className="max-h-80 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(207,250,254,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Filed By</th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Resolution</th>
              </tr>
            </thead>
            <tbody>
              {grievanceRows.map((g, i) => (
                <motion.tr
                  key={g.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.025 }}
                  className="border-t border-slate-100 hover:bg-cyan-50/40 transition-colors"
                  style={{ height: 40 }}
                >
                  <td className="px-3 py-2 font-mono text-slate-700">{g.id}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{g.type}</td>
                  <td className="px-3 py-2 text-slate-700">{g.filedBy}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`status-pill text-[9px] ${statusClass(g.status)}`}>
                      {g.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{g.resolution}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Equal opportunity + Labour rights checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Equal opportunity */}
        <motion.section
          custom={7}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <Landmark className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Equal Opportunity Metrics
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Pay equity & promotion parity</p>
            </div>
          </header>
          <div className="space-y-3">
            <div className="glass-subtle rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-700">Gender Pay Gap</span>
                <span className="text-[12px] font-bold text-slate-900 tabular-nums">3.2%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '32%' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${TEAL_DEEP}, ${TEAL_PRIMARY})` }}
                />
              </div>
              <div className="text-[9px] text-slate-700 mt-1">Target: &lt; 5% · Within threshold</div>
            </div>
            <div className="glass-subtle rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-700">Promotion Equity (Female)</span>
                <span className="text-[12px] font-bold text-slate-900 tabular-nums">42%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '42%' }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${TEAL_DEEP}, ${TEAL_PRIMARY})` }}
                />
              </div>
              <div className="text-[9px] text-slate-700 mt-1">Share of promotions · Target: ≥ 35%</div>
            </div>
            <div className="glass-subtle rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-700">Female Leadership</span>
                <span className="text-[12px] font-bold text-slate-900 tabular-nums">{Math.max(15, Math.round(k.femaleShare * 0.7))}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(15, Math.round(k.femaleShare * 0.7))}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${TEAL_DEEP}, ${TEAL_PRIMARY})` }}
                />
              </div>
              <div className="text-[9px] text-slate-700 mt-1">Women in managerial roles</div>
            </div>
          </div>
        </motion.section>

        {/* Labour rights checklist */}
        <motion.section
          custom={8}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <Gavel className="h-4 w-4" style={{ color: TEAL_DEEP }} />
                Labour Rights Compliance
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">Statutory & policy checklist</p>
            </div>
            <span className="status-pill text-[9px] status-approved">
              <Lock className="h-2.5 w-2.5" /> All Clear
            </span>
          </header>
          <div className="space-y-2">
            {checklist.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="glass-subtle rounded-xl p-3 flex items-center gap-3"
              >
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0"
                  style={{
                    background: 'rgba(16,185,129,0.12)',
                    color: '#047857',
                    border: '1px solid rgba(16,185,129,0.25)',
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="text-[12px] font-semibold text-slate-900">{c.label}</div>
                  <div className="text-[10px] text-slate-700">{c.status}</div>
                </div>
                <span className="status-pill text-[9px] status-approved">
                  ✓ Compliant
                </span>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function HrWorkspace() {
  const { activeModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [tasks, setTasks] = useState<ActionItem[]>([])
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
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isHrActivity).slice(0, 5)
      setActivities(filtered)
    } catch {
      /* silent — keep existing feed on poll error */
    }
  }, [])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/action-items', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ActionItemsResponse
      if (!mountedRef.current) return
      const filtered = (Array.isArray(data.tasks) ? data.tasks : []).filter(isHrTask).slice(0, 6)
      setTasks(filtered)
    } catch {
      /* silent */
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
  }, [])

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
    return <WorkspaceSkeleton tiles={activeModule === 'hr-workforce' ? 4 : 3} />
  }

  // ---- Error state ----
  if (error && !overview) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />
  }

  // ---- Empty state ----
  if (!overview || !k) {
    return (
      <EmptyState
        icon={Users}
        title="No workforce data yet"
        subtitle="Set up a reporting period to populate the HR workspace."
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
        {activeModule === 'hr-workforce' && <WorkforceScreen k={k} periods={periods} />}
        {activeModule === 'hr-training' && <TrainingScreen k={k} trends={trends} />}
        {activeModule === 'hr-wellbeing' && <WellbeingScreen k={k} />}
        {activeModule === 'hr-rights' && <RightsScreen k={k} />}
      </motion.div>
    </AnimatePresence>
  )
}
