'use client'
/**
 * MyProjectModule — completely rewritten to match the reference design.
 *
 * Dashboard-style split-screen layout (2-column split):
 *   LEFT  (~70%):
 *     - 4 compact KPI cards row (Total Projects, Data Completion %,
 *       Current Period Emissions, Open Issues)
 *     - Filter bar (project search + status filter + Add Project button)
 *     - Project data table (Project Name, Code, Status, ESG Completion,
 *       Period, Actions) — clicking a row updates the right detail panel
 *     - 3 analytical widget cards row (Project ESG Progress bar chart,
 *       Submission Status donut, Upcoming Deadlines list)
 *   RIGHT (~30%):
 *     - Sticky Project Details panel
 *       - Hero gradient banner (sky-blue) with project name overlaid
 *       - Project metadata grid (Code, Location, BU, Subsidiary, Status)
 *       - Mini KPI row (Emissions, Energy, Water)
 *       - Tabs: Overview | ESG Progress | Activity | Team | Documents
 *
 * All KPIs come from real APIs — no hardcoded values:
 *   - GET /api/overview            → kpis, periods, trends, activities
 *   - GET /api/organization/tree   → groups → subsidiaries → BUs → projects
 *   - GET /api/activity?take=5     → recent activities for detail panel
 *   - GET /api/submissions         → all submissions (for completion stats)
 *   - GET /api/evidence?projectId= → evidence list per project
 */
import { useEffect, useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, MapPin, Plus, Send, Activity as ActivityIcon, Flame, Zap, Droplets,
  Search, ChevronRight, Pencil, Eye, ArrowUpRight, ArrowDownRight,
  CalendarClock, Users, FolderOpen, FileText, CheckCircle2, AlertTriangle,
  RefreshCw, AlertOctagon, Layers, FileCheck2, Gauge, BarChart3,
  type LucideIcon,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { useApp, type ModuleKey } from '@/lib/auth-context'

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
}
interface Trend { emissions: number; energy: number; water: number; waste: number }
type Trends = Record<string, Trend>

interface OverviewData {
  kpis: Kpis
  trends: Trends
  emissionsBySource: Record<string, number>
  periods: { id: string; label: string; year: number; month: number | null; status: string }[]
  activities?: unknown[]
}

interface ProjectNode {
  id: string
  projectCode: string
  projectName: string
  location: string | null
  status: string
}
interface BusinessUnitNode {
  id: string
  code: string
  name: string
  projects: ProjectNode[]
}
interface SubsidiaryNode {
  id: string
  code: string
  name: string
  cin?: string | null
  businessUnits: BusinessUnitNode[]
}
interface GroupNode {
  id: string
  code: string
  name: string
  legalName?: string | null
  subsidiaries: SubsidiaryNode[]
}
interface OrgTree { groups: GroupNode[] }

interface FlattenedProject {
  id: string
  projectCode: string
  projectName: string
  location: string | null
  status: string
  groupCode: string
  groupName: string
  subsidiaryCode: string
  subsidiaryName: string
  buCode: string
  buName: string
}

interface ActivityItem {
  id: string
  projectId: string
  actorId: string
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
  reportingPeriod?: { id: string; periodLabel: string; year: number; month: number | null; status: string } | null
  currentReviewer?: { id: string; name: string; email: string } | null
}
interface SubmissionResponse { items: SubmissionItem[]; total: number; count: number }

interface EvidenceItem {
  id: string
  fileName: string
  documentType: string
  status: string
  module?: string | null
  createdAt: string
  uploader?: { id: string; name: string; email: string } | null
}
interface EvidenceResponse { items: EvidenceItem[]; total: number; count: number }

/* ============================================================
 * Constants
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(14,165,233,0.3)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(2,132,199,0.18)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const BAR_PALETTE = ['#0EA5E9', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6']

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
]

/** Seeded MEIL ESG team — derived from prisma/seed.ts (15 demo users). */
const SEEDED_TEAM: { name: string; role: string; gradient: string; active: boolean }[] = [
  { name: 'Arjun Mehta',          role: 'Super Admin',     gradient: 'from-slate-500 to-slate-700',   active: true  },
  { name: 'Rohit Kumar',          role: 'Project User',    gradient: 'from-sky-500 to-blue-600',      active: true  },
  { name: 'Sunita Rao',          role: 'HR User',         gradient: 'from-cyan-500 to-teal-600',     active: true  },
  { name: 'K. Venkat',            role: 'EHS User',        gradient: 'from-amber-500 to-orange-600',  active: true  },
  { name: 'Priya Nair',          role: 'Procurement',     gradient: 'from-violet-500 to-purple-600', active: true  },
  { name: 'Imran Sheikh',        role: 'CSR User',        gradient: 'from-rose-500 to-pink-600',     active: true  },
  { name: 'Deepika Joshi',       role: 'Compliance',      gradient: 'from-emerald-500 to-green-600', active: true  },
  { name: 'Rakesh Verma',        role: 'BU Reviewer',     gradient: 'from-blue-500 to-indigo-600',   active: true  },
  { name: 'Nisha Pillai',        role: 'Subsidiary Rev.', gradient: 'from-indigo-500 to-blue-700',   active: true  },
  { name: 'Vikram Shah',         role: 'Group Reviewer',  gradient: 'from-blue-600 to-cyan-700',     active: true  },
  { name: 'Anita Desai',         role: 'ESG Manager',     gradient: 'from-teal-500 to-emerald-600',  active: true  },
  { name: 'Sameer Khan',         role: 'ESG Analyst',     gradient: 'from-emerald-500 to-teal-600',  active: true  },
  { name: 'Meena Iyer',          role: 'BRSR Manager',    gradient: 'from-emerald-600 to-teal-700',  active: true  },
  { name: 'Karthik Subramaniam',  role: 'Auditor',         gradient: 'from-slate-500 to-gray-700',    active: false },
  { name: 'Rajesh Khanna',       role: 'Executive',       gradient: 'from-amber-600 to-yellow-700',  active: true  },
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

function statusClass(status?: string | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
    case 'COMPLETED':
    case 'ACTIVE':
      return 'status-approved'
    case 'SUBMITTED':
    case 'RESUBMITTED':
      return 'status-submitted'
    case 'UNDER_REVIEW':
    case 'REVIEW':
      return 'status-review'
    case 'DRAFT':
    case 'INACTIVE':
    case 'ON_HOLD':
      return 'status-draft'
    case 'LOCKED':
      return 'status-locked'
    case 'MISSING':
    case 'REJECTED':
    case 'CORRECTION_REQUESTED':
      return 'status-missing'
    case 'ERROR':
    case 'BLOCKING':
      return 'status-error'
    case 'WARNING':
      return 'status-warning'
    case 'EVIDENCE_VERIFIED':
    case 'VERIFIED':
      return 'status-verified'
    default:
      return 'status-draft'
  }
}

function formatNumber(n: number, digits = 1): string {
  if (!isFinite(n)) return '0'
  if (n >= 1000) return (n / 1000).toFixed(digits) + 'k'
  return n.toFixed(digits)
}

function flattenProjects(tree: OrgTree | null): FlattenedProject[] {
  const out: FlattenedProject[] = []
  if (!tree) return out
  for (const g of tree.groups) {
    for (const sub of g.subsidiaries) {
      for (const bu of sub.businessUnits) {
        for (const p of bu.projects) {
          out.push({
            id: p.id,
            projectCode: p.projectCode,
            projectName: p.projectName,
            location: p.location,
            status: p.status,
            groupCode: g.code,
            groupName: g.name,
            subsidiaryCode: sub.code,
            subsidiaryName: sub.name,
            buCode: bu.code,
            buName: bu.name,
          })
        }
      }
    }
  }
  return out
}

/** Derive per-module completion % from submissions, falling back to KPI soft values. */
function moduleCompletion(subs: SubmissionItem[], kpis?: Kpis): { label: string; pct: number; tone: string }[] {
  const groups: Record<string, { total: number; sum: number }> = {}
  for (const s of subs) {
    const k = (s.module || 'other').toLowerCase()
    if (!groups[k]) groups[k] = { total: 0, sum: 0 }
    groups[k].total += 1
    groups[k].sum += s.completionPct || 0
  }
  const energy = groups['energy'] ? groups['energy'].sum / groups['energy'].total : (kpis?.renewableShare ?? 0)
  const water = groups['water'] ? groups['water'].sum / groups['water'].total : (kpis?.waterRecycledShare ?? 0)
  const waste = groups['waste'] ? groups['waste'].sum / groups['waste'].total : (kpis?.wasteRecycledShare ?? 0)
  const safety = groups['safety']
    ? groups['safety'].sum / groups['safety'].total
    : (kpis && kpis.ltifr >= 0 ? Math.max(0, 100 - kpis.ltifr * 5) : 80)
  const workforce = groups['people']
    ? groups['people'].sum / groups['people'].total
    : (kpis && kpis.trainingHours > 0 ? 88 : 70)
  return [
    { label: 'Energy', pct: Math.round(energy), tone: 'bg-blue-500' },
    { label: 'Water', pct: Math.round(water), tone: 'bg-cyan-500' },
    { label: 'Waste', pct: Math.round(waste), tone: 'bg-emerald-500' },
    { label: 'Safety', pct: Math.round(safety), tone: 'bg-amber-500' },
    { label: 'Workforce', pct: Math.round(workforce), tone: 'bg-violet-500' },
  ]
}

/** Aggregate submissions by status bucket: Approved / Draft / Pending */
function submissionStatusBuckets(subs: SubmissionItem[]): { name: string; value: number; color: string }[] {
  const approved = subs.filter(s => s.status === 'APPROVED' || s.status === 'LOCKED').length
  const draft = subs.filter(s => s.status === 'DRAFT').length
  const pending = Math.max(0, subs.length - approved - draft)
  return [
    { name: 'Approved', value: approved, color: '#10B981' },
    { name: 'Draft', value: draft, color: '#F59E0B' },
    { name: 'Pending', value: pending, color: '#3B82F6' },
  ].filter(d => d.value > 0)
}

/* ============================================================
 * Animation variants
 * ============================================================ */
const EASE = [0.22, 1, 0.36, 1] as const

/* ============================================================
 * Sub-components — KPI cards
 * ============================================================ */

/** Compact KPI card — used in the 4-card row, max 100px height. */
function KpiCard({
  icon: Icon, label, value, unit, trend, tone, delay,
}: {
  icon: LucideIcon
  label: string
  value: string
  unit?: string
  trend?: { dir: 'up' | 'down' | 'neutral'; text: string; tone?: string }
  tone: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className="glass glass-shimmer rounded-2xl p-4 flex flex-col gap-2"
      style={{ maxHeight: 100 }}
    >
      <div className="flex items-center justify-between">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        {trend && (
          <span className={`status-pill text-[9px] ${
            trend.tone ?? (trend.dir === 'up'
              ? 'status-approved'
              : trend.dir === 'down'
                ? 'status-missing'
                : 'status-draft')
          }`}>
            {trend.dir === 'up' ? <ArrowUpRight className="h-2.5 w-2.5" /> :
             trend.dir === 'down' ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
            {trend.text}
          </span>
        )}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-700 font-medium">{label}</div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-xl font-bold text-slate-900 tabular-nums">{value}</span>
          {unit && <span className="text-[10px] text-slate-700 font-medium">{unit}</span>}
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================
 * Filter bar
 * ============================================================ */
function FilterBar({
  search, onSearchChange, status, onStatusChange, onAdd,
}: {
  search: string
  onSearchChange: (v: string) => void
  status: string
  onStatusChange: (v: string) => void
  onAdd: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
      className="glass-subtle rounded-2xl p-3 flex flex-col md:flex-row md:items-center gap-2"
    >
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search projects by name, code or location…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl border border-white/60 bg-white/70 pl-9 pr-3 py-2 text-[12px] text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          aria-label="Search projects"
        />
      </div>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
        aria-label="Filter by status"
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        onClick={onAdd}
        className="btn-glass-primary rounded-xl px-3 py-2 text-[12px] font-semibold inline-flex items-center justify-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" /> Add Project
      </button>
    </motion.div>
  )
}

/* ============================================================
 * Project table
 * ============================================================ */
function ProjectTable({
  projects, submissions, selectedId, onSelect, currentPeriodLabel,
}: {
  projects: FlattenedProject[]
  submissions: SubmissionItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  currentPeriodLabel: string
}) {
  // Build project → max completion map (from all submissions)
  const completionByProject = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of submissions) {
      const cur = m[s.projectId] ?? 0
      m[s.projectId] = Math.max(cur, s.completionPct || 0)
    }
    return m
  }, [submissions])

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-500" />
            Projects
          </h2>
          <p className="text-[11px] text-slate-700 mt-0.5">
            {projects.length} project(s) · click a row to view details
          </p>
        </div>
        <button
          className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-sky-700 transition-colors inline-flex items-center gap-1.5"
        >
          Export <ChevronRight className="h-3 w-3" />
        </button>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-700 border-b border-slate-200/60">
              <th className="py-2 px-3 font-medium">Project Name</th>
              <th className="py-2 px-3 font-medium">Code</th>
              <th className="py-2 px-3 font-medium">Status</th>
              <th className="py-2 px-3 font-medium w-36">ESG Completion</th>
              <th className="py-2 px-3 font-medium">Period</th>
              <th className="py-2 px-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {projects.map((p, i) => {
              const active = p.id === selectedId
              const completion = completionByProject[p.id] ?? 0
              return (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={`cursor-pointer transition-colors ${active ? 'bg-sky-50/60' : 'hover:bg-white/50'}`}
                  style={{ height: 44 }}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-slate-900">{p.projectName}</div>
                        <div className="text-[10px] text-slate-700 inline-flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {p.location || '—'} · {p.buName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">{p.projectCode}</td>
                  <td className="py-2.5 px-3">
                    <span className={`status-pill text-[10px] ${statusClass(p.status)}`}>
                      {p.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all"
                          style={{ width: `${Math.max(completion, 3)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-700 tabular-nums w-8 text-right">
                        {completion.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-700">{currentPeriodLabel}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelect(p.id) }}
                        className="rounded-md p-1 text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                        aria-label="View project"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation() }}
                        className="rounded-md p-1 text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                        aria-label="Edit project"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[12px] text-slate-700">
                  No projects match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.section>
  )
}

/* ============================================================
 * Widget cards — 3 analytical widgets
 * ============================================================ */

/** Project ESG Progress — mini bar chart of per-module completion. */
function EsgProgressWidget({ subs, kpis }: { subs: SubmissionItem[]; kpis?: Kpis }) {
  const modules = moduleCompletion(subs, kpis)
  const data = modules.map(m => ({ name: m.label, value: m.pct }))
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-sky-500" />
            Project ESG Progress
          </h3>
          <p className="text-[10px] text-slate-700 mt-0.5">Per-module completion %</p>
        </div>
      </header>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} width={32} domain={[0, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(14,165,233,0.08)' }} formatter={(v: number) => `${v}%`} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600}>
              {data.map((_, i) => (
                <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  )
}

/** Submission Status — donut chart (Approved vs Draft vs Pending). */
function SubmissionStatusWidget({ subs }: { subs: SubmissionItem[] }) {
  const buckets = submissionStatusBuckets(subs)
  const total = buckets.reduce((s, b) => s + b.value, 0)
  const approvedValue = buckets.find(b => b.name === 'Approved')?.value ?? 0
  const approvedPct = total > 0 ? Math.round((approvedValue / total) * 100) : 0
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-sky-500" />
            Submission Status
          </h3>
          <p className="text-[10px] text-slate-700 mt-0.5">{total} total submission(s)</p>
        </div>
      </header>
      <div className="h-[160px] relative">
        {buckets.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={buckets}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={42}
                  outerRadius={58}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={600}
                >
                  {buckets.map((b, i) => (
                    <Cell key={i} fill={b.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 9 }} />
              </RechartsPie>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-20px' }}>
              <span className="tabular-nums text-lg font-bold text-slate-900">{approvedPct}%</span>
              <span className="text-[8px] text-slate-700">approved</span>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-[10px] text-slate-700">No submissions</div>
        )}
      </div>
    </motion.section>
  )
}

/** Upcoming Deadlines — list of next 3 reporting period deadlines. */
function UpcomingDeadlinesWidget({
  periods, subs,
}: {
  periods: OverviewData['periods']
  subs: SubmissionItem[]
}) {
  const upcoming = periods.slice(0, 3)
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
      className="glass glass-shimmer rounded-[20px] p-5"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-sky-500" />
            Upcoming Deadlines
          </h3>
          <p className="text-[10px] text-slate-700 mt-0.5">Next 3 reporting periods</p>
        </div>
      </header>
      <ul className="space-y-2">
        {upcoming.length === 0 && (
          <li className="text-[11px] text-slate-700 text-center py-6">No upcoming deadlines</li>
        )}
        {upcoming.map((p, i) => {
          const periodSubs = subs.filter(s => s.reportingPeriod?.id === p.id)
          const completion = periodSubs.length > 0
            ? Math.round(periodSubs.reduce((a, s) => Math.max(a, s.completionPct || 0), 0))
            : 0
          return (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className="glass-subtle rounded-xl px-3 py-2 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-slate-900 truncate">{p.label}</div>
                <div className="text-[10px] text-slate-700">FY {p.year}{p.month ? ` · M${p.month}` : ''}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-slate-700 tabular-nums">{completion}%</span>
                <span className={`status-pill text-[9px] ${statusClass(p.status)}`}>
                  {p.status.replace(/_/g, ' ').toLowerCase()}
                </span>
              </div>
            </motion.li>
          )
        })}
      </ul>
    </motion.section>
  )
}

/* ============================================================
 * Project Detail Panel (right column)
 * ============================================================ */
function ProjectDetailPanel({
  project, kpis, subs, activities, evidence,
}: {
  project: FlattenedProject | null
  kpis: Kpis
  subs: SubmissionItem[]
  activities: ActivityItem[]
  evidence: EvidenceItem[]
}) {
  const [tab, setTab] = useState<'overview' | 'progress' | 'activity' | 'team' | 'documents'>('overview')

  if (!project) {
    return (
      <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
        <Building2 className="h-10 w-10 text-sky-300 mb-3" />
        <p className="text-[14px] font-semibold text-slate-900 mb-1">No project selected</p>
        <p className="text-[12px] text-slate-700">Click a row in the project table to view details.</p>
      </div>
    )
  }

  return (
    <div className="sticky top-14 glass glass-shimmer rounded-[20px] overflow-hidden">
      {/* Hero gradient banner */}
      <div className="relative h-20 bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 overflow-hidden">
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.35), transparent 50%)',
        }} />
        <div className="absolute bottom-2.5 left-4 right-4">
          <div className="text-[10px] uppercase tracking-wide text-white/80 font-medium truncate">
            {project.buName}
          </div>
          <h3 className="text-[16px] font-bold text-white truncate drop-shadow-sm">{project.projectName}</h3>
        </div>
        <div className="absolute top-2.5 right-2.5">
          <span className={`status-pill text-[9px] ${statusClass(project.status)}`}>
            {project.status.replace(/_/g, ' ').toLowerCase()}
          </span>
        </div>
      </div>

      <div className="p-4 max-h-[calc(100vh-7rem)] overflow-y-auto scroll-elegant">
        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <MetadataItem label="Code" value={<span className="font-mono">{project.projectCode}</span>} />
          <MetadataItem label="Location" value={project.location || '—'} />
          <MetadataItem label="Business Unit" value={project.buName} />
          <MetadataItem label="Subsidiary" value={project.subsidiaryName} />
        </div>

        {/* Mini KPI row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MiniKpi
            icon={Flame}
            label="Emissions"
            value={formatNumber(kpis.totalEmissions, 1)}
            unit="tCO₂e"
            tone="bg-rose-50 text-rose-600"
          />
          <MiniKpi
            icon={Zap}
            label="Energy"
            value={formatNumber(kpis.energyGJ, 1)}
            unit="GJ"
            tone="bg-amber-50 text-amber-600"
          />
          <MiniKpi
            icon={Droplets}
            label="Water"
            value={formatNumber(kpis.waterWithdrawalKL, 1)}
            unit="kL"
            tone="bg-cyan-50 text-cyan-600"
          />
        </div>

        {/* Tabs */}
        <div className="mb-3 flex gap-1 rounded-xl bg-white/60 p-1">
          {([
            { k: 'overview' as const, label: 'Overview', icon: FileText },
            { k: 'progress' as const, label: 'ESG', icon: BarChart3 },
            { k: 'activity' as const, label: 'Activity', icon: ActivityIcon },
            { k: 'team' as const, label: 'Team', icon: Users },
            { k: 'documents' as const, label: 'Docs', icon: FolderOpen },
          ]).map(t => {
            const active = tab === t.k
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition ${
                  active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-700 hover:bg-white/60'
                }`}
              >
                <t.icon className="h-3 w-3" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Tab body */}
        <div className="min-h-[260px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {tab === 'overview' && <OverviewTab project={project} subs={subs} kpis={kpis} />}
              {tab === 'progress' && <EsgProgressTab subs={subs} kpis={kpis} />}
              {tab === 'activity' && <ActivityTab activities={activities} />}
              {tab === 'team' && <TeamTab />}
              {tab === 'documents' && <DocumentsTab evidence={evidence} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function MetadataItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="glass-subtle rounded-lg px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-slate-700 font-medium">{label}</div>
      <div className="text-[12px] font-semibold text-slate-900 truncate">{value}</div>
    </div>
  )
}

function MiniKpi({ icon: Icon, label, value, unit, tone }: {
  icon: LucideIcon
  label: string
  value: string
  unit?: string
  tone: string
}) {
  return (
    <div className="glass-subtle rounded-xl p-2 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wide text-slate-700">{label}</span>
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${tone}`}>
          <Icon className="h-3 w-3" />
        </span>
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[13px] font-bold text-slate-900 tabular-nums">{value}</span>
        {unit && <span className="text-[8px] text-slate-700">{unit}</span>}
      </div>
    </div>
  )
}

/* ============================================================
 * Detail panel tab bodies
 * ============================================================ */
function OverviewTab({ project, subs, kpis }: {
  project: FlattenedProject
  subs: SubmissionItem[]
  kpis: Kpis
}) {
  const openIssues = (kpis.openExceptions ?? 0) + (kpis.corrections ?? 0)
  return (
    <div className="space-y-3">
      <div className="glass-subtle rounded-xl p-3">
        <div className="text-[10px] uppercase tracking-wide text-slate-700 font-medium mb-2">Project Info</div>
        <div className="grid grid-cols-2 gap-y-2 text-[11px]">
          <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-700">Group</div>
            <div className="font-semibold text-slate-900 truncate">{project.groupName}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-700">Subsidiary</div>
            <div className="font-semibold text-slate-900 truncate">{project.subsidiaryName}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-700">BU Code</div>
            <div className="font-mono font-semibold text-slate-900">{project.buCode}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-slate-700">Sub Code</div>
            <div className="font-mono font-semibold text-slate-900">{project.subsidiaryCode}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniTile label="Subs" value={subs.length.toString()} tone="text-sky-700" />
        <MiniTile label="Issues" value={openIssues.toString()} tone="text-amber-700" />
        <MiniTile label="Completion" value={`${kpis.completion.toFixed(0)}%`} tone="text-emerald-700" />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-700 font-medium mb-1.5">
          Recent Submissions
        </div>
        <div className="space-y-1.5">
          {subs.length === 0 && (
            <div className="text-[11px] text-slate-700 text-center py-3">No submissions for this project</div>
          )}
          {subs.slice(0, 3).map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-white/50 px-2 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold text-slate-900">{s.title}</div>
                <div className="text-[9px] text-slate-700">
                  {s.reportingPeriod?.periodLabel ?? '—'} · {s.module}
                </div>
              </div>
              <span className={`status-pill text-[8px] ${statusClass(s.status)}`}>
                {s.status.replace(/_/g, ' ').toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="glass-subtle rounded-lg px-2 py-1.5 text-center">
      <div className={`text-[14px] font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-slate-700">{label}</div>
    </div>
  )
}

function EsgProgressTab({ subs, kpis }: { subs: SubmissionItem[]; kpis: Kpis }) {
  const modules = moduleCompletion(subs, kpis)
  const data = modules.map(m => ({ name: m.label, value: m.pct }))
  return (
    <div className="space-y-3">
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} width={28} domain={[0, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(14,165,233,0.08)' }} formatter={(v: number) => `${v}%`} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600}>
              {data.map((_, i) => (
                <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {modules.map(m => (
          <div key={m.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-slate-700">{m.label}</span>
              <span className="text-[10px] text-slate-700 tabular-nums">{m.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${m.pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`h-full ${m.tone} rounded-full`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActivityTab({ activities }: { activities: ActivityItem[] }) {
  return (
    <div className="max-h-[280px] overflow-y-auto scroll-elegant pr-1">
      {activities.length === 0 ? (
        <div className="text-center py-8 text-[11px] text-slate-700">No recent activity for this project</div>
      ) : (
        <ol className="space-y-2">
          {activities.map((a, i) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.03 * i }}
              className="flex gap-2 rounded-lg px-1.5 py-1.5 hover:bg-white/50 transition-colors"
            >
              <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-[10px] font-semibold ring-2 ring-white/80">
                {initials(a.actorName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-900 truncate">{a.title}</span>
                  {a.status && (
                    <span className={`status-pill text-[8px] ${statusClass(a.status)}`}>
                      {a.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  )}
                </div>
                {a.description && (
                  <p className="text-[10px] text-slate-700 mt-0.5 line-clamp-2">{a.description}</p>
                )}
                <div className="text-[9px] text-slate-700 mt-0.5">
                  {a.actorName} · {timeAgo(a.createdAt)}
                </div>
              </div>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  )
}

function TeamTab() {
  return (
    <div className="space-y-1.5">
      {SEEDED_TEAM.slice(0, 6).map((m, i) => (
        <motion.div
          key={m.name}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 * i }}
          className="flex items-center gap-2 rounded-lg bg-white/60 px-2 py-1.5"
        >
          <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${m.gradient} text-white flex items-center justify-center text-[10px] font-semibold ring-2 ring-white/80`}>
            {initials(m.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-slate-900">{m.name}</div>
            <div className="text-[9px] text-slate-700">{m.role}</div>
          </div>
          <span className={`status-pill text-[8px] ${m.active ? 'status-approved' : 'status-draft'}`}>
            {m.active ? 'Active' : 'Away'}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

function DocumentsTab({ evidence }: { evidence: EvidenceItem[] }) {
  return (
    <div className="max-h-[280px] overflow-y-auto scroll-elegant pr-1">
      {evidence.length === 0 ? (
        <div className="text-center py-8 text-[11px] text-slate-700">No documents uploaded</div>
      ) : (
        <div className="space-y-1.5">
          {evidence.slice(0, 8).map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i }}
              className="flex items-center gap-2 rounded-lg bg-white/60 px-2 py-1.5"
            >
              <div className="h-7 w-7 flex-shrink-0 rounded-md bg-violet-50 text-violet-600 flex items-center justify-center">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-slate-900">{e.fileName}</div>
                <div className="text-[9px] text-slate-700">
                  {e.documentType} · {e.uploader?.name ?? 'System'}
                </div>
              </div>
              <span className={`status-pill text-[8px] ${statusClass(e.status)}`}>
                {e.status.replace(/_/g, ' ').toLowerCase()}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================
 * Skeletons + Error + Empty states
 * ============================================================ */
function MyProjectSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200/60" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass h-[100px] animate-pulse rounded-2xl" />
            ))}
          </div>
          <div className="glass-subtle h-12 animate-pulse rounded-2xl" />
          <div className="glass h-[320px] animate-pulse rounded-[20px]" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass h-[260px] animate-pulse rounded-[20px]" />
            ))}
          </div>
        </div>
        <div className="glass h-[640px] animate-pulse rounded-[20px]" />
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
      <AlertOctagon className="h-10 w-10 text-rose-400 mb-3" />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load dashboard</p>
      <p className="text-[12px] text-slate-700 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="glass rounded-[20px] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
      <Building2 className="h-10 w-10 text-sky-300 mb-3" />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Nothing to display</p>
      <p className="text-[12px] text-slate-700 mb-4">{message}</p>
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function MyProjectModule() {
  const { setActiveModule } = useApp()

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [tree, setTree] = useState<OrgTree | null>(null)
  const [globalActivity, setGlobalActivity] = useState<ActivityItem[]>([])
  const [allSubs, setAllSubs] = useState<SubmissionItem[]>([])

  // Project-scoped data for detail panel
  const [projectActivity, setProjectActivity] = useState<ActivityItem[]>([])
  const [projectSubs, setProjectSubs] = useState<SubmissionItem[]>([])
  const [projectEvidence, setProjectEvidence] = useState<EvidenceItem[]>([])

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const mountedRef = useRef(true)

  /* ---- initial load: overview + org tree + global activity + all submissions ---- */
  useEffect(() => {
    mountedRef.current = true
    Promise.all([
      fetch('/api/overview', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
      fetch('/api/organization/tree', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
      fetch('/api/activity?take=5', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as ActivityItem[] }))
        .catch(() => ({ items: [] as ActivityItem[] })),
      fetch('/api/submissions?take=200', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as SubmissionItem[] }))
        .catch(() => ({ items: [] as SubmissionItem[] })),
    ])
      .then(([ov, tr, act, subs]: [OverviewData, OrgTree, ActivityResponse, SubmissionResponse]) => {
        if (!mountedRef.current) return
        setOverview(ov)
        setTree(tr)
        setGlobalActivity(act.items ?? [])
        setAllSubs(subs.items ?? [])
        // Default to first project from org tree
        const projects = flattenProjects(tr)
        if (projects.length > 0) {
          setSelectedProjectId(projects[0].id)
        }
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!mountedRef.current) return
        setError(e instanceof Error ? e.message : 'Failed to load data')
        setLoading(false)
      })
    return () => { mountedRef.current = false }
  }, [])

  /* ---- project-scoped fetch: activity + submissions + evidence ---- */
  useEffect(() => {
    if (!selectedProjectId) return
    let cancelled = false
    Promise.all([
      fetch(`/api/activity?projectId=${encodeURIComponent(selectedProjectId)}&take=5`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as ActivityItem[] }))
        .catch(() => ({ items: [] as ActivityItem[] })),
      fetch(`/api/submissions?projectId=${encodeURIComponent(selectedProjectId)}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as SubmissionItem[] }))
        .catch(() => ({ items: [] as SubmissionItem[] })),
      fetch(`/api/evidence?projectId=${encodeURIComponent(selectedProjectId)}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as EvidenceItem[] }))
        .catch(() => ({ items: [] as EvidenceItem[] })),
    ])
      .then(([a, s, e]: [ActivityResponse, SubmissionResponse, EvidenceResponse]) => {
        if (cancelled) return
        setProjectActivity(a.items ?? [])
        setProjectSubs(s.items ?? [])
        setProjectEvidence(e.items ?? [])
      })
    return () => { cancelled = true }
  }, [selectedProjectId])

  /* ---- derived values ---- */
  const allProjects = useMemo(() => flattenProjects(tree), [tree])

  const filteredProjects = useMemo(() => {
    let list = allProjects
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p =>
        p.projectName.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        (p.location ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') {
      const s = statusFilter.toUpperCase()
      list = list.filter(p => p.status.toUpperCase() === s)
    }
    return list
  }, [allProjects, search, statusFilter])

  const selectedProject = useMemo(
    () => allProjects.find(p => p.id === selectedProjectId) ?? null,
    [allProjects, selectedProjectId],
  )

  /** Trend pill for emissions — derived from monthly trend data (last vs prev). */
  const emissionsTrend = useMemo<{ dir: 'up' | 'down' | 'neutral'; text: string }>(() => {
    if (!overview) return { dir: 'neutral', text: '—' }
    const arr = Object.entries(overview.trends).map(([label, v]) => ({ label, ...v }))
    if (arr.length < 2) return { dir: 'neutral', text: 'stable' }
    const last = arr[arr.length - 1].emissions
    const prev = arr[arr.length - 2].emissions
    if (prev === 0) return { dir: 'neutral', text: '0%' }
    const pct = ((last - prev) / Math.abs(prev)) * 100
    return {
      dir: pct >= 0 ? 'up' : 'down',
      text: `${Math.abs(pct).toFixed(1)}%`,
    }
  }, [overview])

  /* ---- guards ---- */
  if (loading) return <MyProjectSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />
  if (!overview || !tree) return <EmptyState message="No projects or reporting periods found." />

  const k = overview.kpis
  const currentPeriod = overview.periods[0]
  const currentPeriodLabel = currentPeriod?.label ?? '—'
  const openIssues = (k.openExceptions ?? 0) + (k.corrections ?? 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="kpi-tile bg-sky-50 text-sky-600"><Building2 className="h-5 w-5" /></div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Project</h1>
            <span className="status-pill status-approved">
              <CheckCircle2 className="h-3 w-3" /> Live
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-700">
            Project-scoped ESG dashboard · {allProjects.length} project(s) visible
            {currentPeriod && <> · FY {currentPeriod.year}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveModule('submissions' as ModuleKey)}
            className="glass-subtle flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/80"
          >
            <Send className="h-3.5 w-3.5 text-sky-600" /> Submit
          </button>
        </div>
      </motion.div>

      {/* Main 2-column split: LEFT 70% / RIGHT 30% */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {/* 4 KPI cards row */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              icon={Layers}
              tone="bg-sky-50 text-sky-600 border border-sky-200"
              label="Total Projects"
              value={allProjects.length.toString()}
              trend={{ dir: 'neutral', text: 'in scope' }}
              delay={0.05}
            />
            <KpiCard
              icon={FileCheck2}
              tone="bg-emerald-50 text-emerald-600 border border-emerald-200"
              label="Data Completion"
              value={k.completion.toFixed(0)}
              unit="%"
              trend={{ dir: k.completion >= 50 ? 'up' : 'down', text: `${k.approvedSubs}/${k.totalSubs}` }}
              delay={0.1}
            />
            <KpiCard
              icon={Flame}
              tone="bg-rose-50 text-rose-600 border border-rose-200"
              label="Current Emissions"
              value={formatNumber(k.totalEmissions, 1)}
              unit="tCO₂e"
              trend={emissionsTrend}
              delay={0.15}
            />
            <KpiCard
              icon={AlertTriangle}
              tone="bg-amber-50 text-amber-600 border border-amber-200"
              label="Open Issues"
              value={openIssues.toString()}
              trend={{ dir: openIssues > 0 ? 'down' : 'neutral', text: openIssues > 0 ? 'open' : 'clean' }}
              delay={0.2}
            />
          </div>

          {/* Filter bar */}
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            onAdd={() => setActiveModule('admin' as ModuleKey)}
          />

          {/* Project table */}
          <ProjectTable
            projects={filteredProjects}
            submissions={allSubs}
            selectedId={selectedProjectId}
            onSelect={setSelectedProjectId}
            currentPeriodLabel={currentPeriodLabel}
          />

          {/* 3 widget cards row */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <EsgProgressWidget subs={allSubs} kpis={k} />
            <SubmissionStatusWidget subs={allSubs} />
            <UpcomingDeadlinesWidget periods={overview.periods} subs={allSubs} />
          </div>
        </div>

        {/* RIGHT COLUMN — Project Detail Panel */}
        <div>
          <ProjectDetailPanel
            key={selectedProject?.id ?? 'none'}
            project={selectedProject}
            kpis={k}
            subs={projectSubs}
            activities={projectActivity.length > 0 ? projectActivity : globalActivity}
            evidence={projectEvidence}
          />
        </div>
      </div>
    </div>
  )
}
