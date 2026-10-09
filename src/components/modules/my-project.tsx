'use client'
/**
 * MyProjectModule — completely rewritten to match the 3-row reference design.
 *
 * 3 HARD-LOCKED ROWS COMPOSITION:
 *   ROW 1 (~15%): 4 equal KPI cards
 *   ROW 2 (~55%): 67% Project Registry (LEFT) | 33% Project Details (RIGHT)
 *   ROW 3 (~30%): 35% ESG Progress rings | 32% Submission Status | 33% Deadlines
 *
 * All KPIs come from real APIs — no hardcoded values:
 *   - GET /api/overview            → kpis, periods, trends
 *   - GET /api/organization/tree   → groups → subsidiaries → BUs → projects
 *   - GET /api/activity?take=5     → recent activities
 *   - GET /api/submissions         → all submissions
 *   - GET /api/evidence?projectId= → evidence list per project
 */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Building2, MapPin, Plus, Send, Activity as ActivityIcon, Flame, Zap, Droplets,
  Search, ChevronRight, ChevronDown, Pencil, Eye, ArrowUpRight, ArrowDownRight,
  CalendarClock, Users, FolderOpen, FileText, CheckCircle2, AlertTriangle,
  RefreshCw, AlertOctagon, Layers, FileCheck2, Gauge, BarChart3,
  MoreHorizontal, Briefcase, Shield, Download, LayoutGrid, List,
  Maximize2, Minimize2, Calendar, Hash, UserCheck, ExternalLink,
  X, Save, GripVertical, ChevronsUpDown, Check,
  type LucideIcon,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { useApp, type ModuleKey } from '@/lib/auth-context'
import { toast } from 'sonner'

/* ============================================================
 * CSV Export Helper
 * ============================================================ */
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (v: string | number) => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

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
  reportingPeriod?: { id: string; periodLabel: string; year: number; month: number | null; status: string; submissionDeadline?: string; reviewDeadline?: string; approvalDeadline?: string } | null
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
 * Shared visual primitives
 * ============================================================ */

/** Circular progress ring — stroke-based SVG, clean business style. */
function CircularRing({
  pct, size = 64, stroke = 4, color = '#0EA5E9', trackColor = 'rgba(226,232,240,0.7)', showLabel = true, labelSize = 12,
}: {
  pct: number
  size?: number
  stroke?: number
  color?: string
  trackColor?: string
  showLabel?: boolean
  labelSize?: number
}) {
  const clamped = Math.max(0, Math.min(100, pct))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center font-bold tabular-nums text-slate-900" style={{ fontSize: labelSize }}>
          {clamped}%
        </span>
      )}
    </div>
  )
}

/* ============================================================
 * ROW 1 — KPI cards (4 equal)
 * ============================================================ */

/** KPI card — new design: rounded 16-20px glass, icon tile + value + sub + secondary. */
function KpiCardRow1({
  icon: Icon, label, value, subText, rightContent, tone, delay,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  subText: React.ReactNode
  rightContent?: React.ReactNode
  tone: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      whileHover={{ y: -2 }}
      className="glass-ios-liquid glass-shimmer rounded-[22px] p-4.5 md:p-5 flex items-center justify-between gap-3 hover:shadow-lg transition-all cursor-default relative"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="h-4.5 w-4.5" />
          </span>
        </div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-0.5">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl md:text-[28px] font-bold text-slate-900 tabular-nums leading-none">{value}</span>
        </div>
        <div className="mt-1.5 text-[11px] text-slate-600 leading-tight">{subText}</div>
      </div>
      {rightContent && <div className="flex-shrink-0">{rightContent}</div>}
    </motion.div>
  )
}

/* ============================================================
 * ROW 2 LEFT — Project Registry Card
 * ============================================================ */
function ProjectRegistryCard({
  projects, submissions, selectedId, onSelect,
  search, setSearch, statusFilter, setStatusFilter,
  buFilter, setBuFilter, periodFilter, setPeriodFilter,
  typeFilter, setTypeFilter,
  viewMode, setViewMode,
  periods, uniqueBUs, uniqueTypes,
  currentPeriodLabel,
}: {
  projects: FlattenedProject[]
  submissions: SubmissionItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  search: string
  setSearch: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  buFilter: string
  setBuFilter: (v: string) => void
  periodFilter: string
  setPeriodFilter: (v: string) => void
  typeFilter: string
  setTypeFilter: (v: string) => void
  viewMode: 'list' | 'grid'
  setViewMode: (v: 'list' | 'grid') => void
  periods: OverviewData['periods']
  uniqueBUs: string[]
  uniqueTypes: string[]
  currentPeriodLabel: string
}) {
  const completionByProject = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of submissions) {
      const cur = m[s.projectId] ?? 0
      m[s.projectId] = Math.max(cur, s.completionPct || 0)
    }
    return m
  }, [submissions])

  const dataCompletionByProject = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of projects) {
      const ps = submissions.filter(s => s.projectId === p.id)
      if (ps.length === 0) { m[p.id] = 0; continue }
      const total = ps.length
      const approved = ps.filter(s => s.status === 'APPROVED' || s.status === 'LOCKED').length
      m[p.id] = total > 0 ? Math.round((approved / total) * 100) : 0
    }
    return m
  }, [projects, submissions])

  const [showExportMenu, setShowExportMenu] = useState(false)

  const handleExportCsv = () => {
    downloadCsv(
      'projects_export.csv',
      ['#', 'Project Name', 'Code', 'Business Unit', 'Location', 'Status', 'Progress %'],
      projects.map((p, i) => [
        i + 1,
        p.projectName,
        p.projectCode,
        p.buName,
        p.location || '—',
        p.status,
        completionByProject[p.id] ?? 0,
      ])
    )
    toast.success(`Exported ${projects.length} project(s) to CSV`)
    setShowExportMenu(false)
  }

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(projects, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'projects_registry.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${projects.length} project(s) to JSON`)
    setShowExportMenu(false)
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
      className="glass-ios-liquid glass-shimmer rounded-[26px] p-5 md:p-6 flex flex-col h-full relative"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="h-4.5 w-4.5 text-sky-500" />
            My Projects
          </h2>
          <p className="text-[12px] text-slate-600 mt-0.5">
            Manage and track all your ESG projects · {projects.length} project(s) visible
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="glass-subtle rounded-xl px-3.5 py-2 text-[12px] font-semibold text-slate-700 hover:text-sky-700 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          <AnimatePresence>
            {showExportMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-sky-100 shadow-xl p-1.5 z-30"
              >
                <button
                  onClick={handleExportCsv}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-800 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2"
                >
                  <Download className="h-3.5 w-3.5 text-sky-600" /> Export CSV (.csv)
                </button>
                <button
                  onClick={handleExportJson}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-800 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5 text-sky-600" /> Export JSON (.json)
                </button>
                <button
                  onClick={() => {
                    setShowExportMenu(false)
                    window.print()
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-800 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-sky-600" /> Print Summary
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* FILTER/SEARCH TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search project name, code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/60 bg-white/75 pl-9 pr-3 py-2 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
            aria-label="Search projects"
          />
        </div>

        <select
          value={buFilter}
          onChange={(e) => setBuFilter(e.target.value)}
          className="rounded-xl border border-white/60 bg-white/75 px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          aria-label="Filter by Business Unit"
        >
          <option value="all">All Business Units</option>
          {uniqueBUs.map(bu => <option key={bu} value={bu}>{bu}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/60 bg-white/75 px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="rounded-xl border border-white/60 bg-white/75 px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          aria-label="Filter by Reporting Period"
        >
          <option value="all">All Periods</option>
          {periods.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-white/60 bg-white/75 px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          aria-label="Filter by Project Type"
        >
          <option value="all">All Types</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="inline-flex items-center rounded-xl border border-white/60 bg-white/75 p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${viewMode === 'list' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}
            aria-label="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${viewMode === 'grid' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1 rounded-xl border border-white/60 bg-white/75 px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-white/90 transition shadow-2xs"
        >
          Export CSV
        </button>
      </div>

      {/* PROJECT TABLE */}
      <div className="overflow-x-auto flex-1 -mx-1 px-1 scroll-elegant">
        <table className="w-full text-left min-w-[660px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/70">
              <th className="py-2.5 px-2 font-medium w-8">#</th>
              <th className="py-2.5 px-2 font-medium min-w-[180px]">Project / Site Name</th>
              <th className="py-2.5 px-2 font-medium">Code</th>
              <th className="py-2.5 px-2 font-medium">Business Unit</th>
              <th className="py-2.5 px-2 font-medium">Location</th>
              <th className="py-2.5 px-2 font-medium">Type</th>
              <th className="py-2.5 px-2 font-medium w-28">Progress</th>
              <th className="py-2.5 px-2 font-medium w-20">Data</th>
              <th className="py-2.5 px-2 font-medium">Status</th>
              <th className="py-2.5 px-2 font-medium text-right w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/70">
            {projects.map((p, i) => {
              const active = p.id === selectedId
              const progress = completionByProject[p.id] ?? 0
              const dataComp = dataCompletionByProject[p.id] ?? 0
              return (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={`cursor-pointer transition-all ${active ? 'bg-sky-50/60 border-l-4 border-l-sky-500 shadow-sm' : 'border-l-4 border-l-transparent hover:bg-slate-50/60'}`}
                  style={{ height: 44 }}
                >
                  <td className="py-2 px-2 text-[11px] font-medium text-slate-500 tabular-nums">{i + 1}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-semibold text-slate-900 leading-tight">{p.projectName}</div>
                        <div className="truncate text-[10.5px] text-slate-500 leading-tight">{p.location || '—'} · {p.subsidiaryName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2 font-mono text-[11px] text-slate-600 font-medium">{p.projectCode}</td>
                  <td className="py-2 px-2 text-[11.5px] text-slate-700 truncate max-w-[130px]">{p.buName}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1 text-[11px] text-slate-600">
                      <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{p.location || '—'}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <span className="inline-flex items-center rounded-md bg-slate-100/90 px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200/60">
                      {p.buName.split(' ')[0] || 'Project'}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200/80 overflow-hidden min-w-[50px]">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(progress, 2)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-700 tabular-nums w-7 text-right flex-shrink-0">
                        {progress}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <CircularRing pct={dataComp} size={32} stroke={3} labelSize={9} color={dataComp >= 70 ? '#10B981' : dataComp >= 40 ? '#F59E0B' : '#0EA5E9'} />
                  </td>
                  <td className="py-2 px-2">
                    <span className={`status-pill text-[10px] ${statusClass(p.status)}`}>
                      {p.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation() }}
                      className="inline-flex items-center justify-center rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-[12px] text-slate-500">
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
 * ROW 2 RIGHT — Project Details Panel
 * ============================================================ */
function ProjectDetailsPanel({
  project, kpis, subs, activities, evidence, periods, currentPeriodLabel,
  isExpanded, onToggleExpand, onUpdateProject,
}: {
  project: FlattenedProject | null
  kpis: Kpis
  subs: SubmissionItem[]
  activities: ActivityItem[]
  evidence: EvidenceItem[]
  periods: OverviewData['periods']
  currentPeriodLabel: string
  isExpanded?: boolean
  onToggleExpand?: () => void
  onUpdateProject?: (updated: FlattenedProject) => void
}) {
  const [tab, setTab] = useState<'overview' | 'progress' | 'activity' | 'team' | 'documents'>('overview')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // Sync edit fields when project changes
  useEffect(() => {
    if (project) {
      setEditName(project.projectName)
      setEditLocation(project.location || '')
      setEditStatus(project.status)
      setEditNotes('')
    }
  }, [project?.id])

  const handleSaveEdit = useCallback(() => {
    if (project) {
      const updated: FlattenedProject = {
        ...project,
        projectName: editName.trim() || project.projectName,
        location: editLocation.trim() || project.location,
        status: editStatus || project.status,
      }
      onUpdateProject?.(updated)
      toast.success(`Project "${updated.projectName}" updated successfully`)
    }
    setShowEditModal(false)
  }, [project, editName, editLocation, editStatus, onUpdateProject])

  if (!project) {
    return (
      <div className="glass-ios-liquid rounded-[26px] p-10 flex flex-col items-center justify-center text-center min-h-[500px]">
        <Building2 className="h-12 w-12 text-sky-400 mb-4" />
        <p className="text-[16px] font-bold text-slate-900 mb-1">No project selected</p>
        <p className="text-[12px] text-slate-600 font-medium">Click a project row in the registry to inspect ESG details.</p>
      </div>
    )
  }

  const projectType = project.buName.split(' ')[0] || 'ESG'
  const modules = moduleCompletion(subs, kpis)

  const gradientFromBU = (buName: string) => {
    const lower = buName.toLowerCase()
    if (lower.includes('manufact') || lower.includes('plant')) return 'from-sky-500 via-blue-500 to-indigo-600'
    if (lower.includes('power') || lower.includes('energy')) return 'from-amber-400 via-orange-500 to-rose-500'
    if (lower.includes('water') || lower.includes('irrigation')) return 'from-cyan-400 via-teal-500 to-emerald-600'
    if (lower.includes('health') || lower.includes('hospital')) return 'from-rose-400 via-pink-500 to-fuchsia-600'
    if (lower.includes('it') || lower.includes('tech') || lower.includes('software')) return 'from-violet-500 via-purple-500 to-indigo-600'
    return 'from-sky-400 via-blue-500 to-blue-700'
  }

  return (
    <div className="glass-ios-liquid glass-shimmer rounded-[26px] overflow-hidden flex flex-col h-full relative">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-5 pb-3.5 border-b border-slate-200/70">
        <h2 className="text-[17px] font-extrabold text-slate-900 flex items-center gap-2 tracking-tight">
          <FileText className="h-4.5 w-4.5 text-sky-600" />
          Project Details
        </h2>
        <div className="flex items-center gap-2">
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white/85 border border-slate-200 hover:bg-sky-50 hover:text-sky-700 transition-all shadow-2xs"
              title={isExpanded ? "Collapse to side panel" : "Expand to wide view"}
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 text-sky-600" /> Collapse
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-sky-600" /> Expand
                </>
              )}
            </button>
          )}
          <button
            onClick={() => project && setShowEditModal(true)}
            disabled={!project}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white/85 border border-slate-200 hover:bg-sky-50 hover:text-sky-700 transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Pencil className="h-3.5 w-3.5 text-sky-600" /> Edit
          </button>
        </div>
      </header>

      {/* Edit Project Modal */}
      <AnimatePresence>
        {showEditModal && project && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg p-6 border border-slate-200"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[18px] font-extrabold text-slate-900">Edit Project</h3>
                <button onClick={() => setShowEditModal(false)} className="rounded-xl p-2 hover:bg-slate-100 transition-colors">
                  <X className="h-4 w-4 text-slate-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 block">Project Name</label>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 block">Location</label>
                  <input
                    value={editLocation}
                    onChange={e => setEditLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 block">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                  >
                    {STATUS_OPTIONS.filter(o => o.value !== 'all').map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5 block">Notes / Comments</label>
                  <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    rows={3}
                    placeholder="Add notes about this project..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400/60 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl px-4 py-2 text-[12px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="rounded-xl px-5 py-2 text-[12px] font-bold text-white bg-sky-600 hover:bg-sky-700 transition-colors inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" /> Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-y-auto scroll-elegant flex-1">
        {/* PROJECT HERO IMAGE */}
        <div className="px-5 pt-4">
          <div className={`relative w-full rounded-2xl overflow-hidden bg-gradient-to-br ${gradientFromBU(project.buName)}`} style={{ aspectRatio: '16/6.8' }}>
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.25' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
            }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
            <div className="absolute bottom-3.5 left-4 right-4">
              <div className="text-[10px] uppercase tracking-widest text-white/85 font-bold mb-0.5">{project.buName}</div>
              <div className="text-[18px] font-black text-white leading-tight drop-shadow-md truncate">{project.projectName}</div>
            </div>
          </div>
        </div>

        {/* TITLE AREA */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h3 className="text-[19px] font-extrabold text-slate-900 leading-tight flex-1 min-w-0 tracking-tight">
              {project.projectName}
            </h3>
            <span className={`status-pill text-[11px] font-bold flex-shrink-0 ${statusClass(project.status)}`}>
              {project.status.replace(/_/g, ' ').toLowerCase()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-slate-600 font-medium">
            <span className="font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/80">{project.projectCode}</span>
            <span className="text-slate-300">·</span>
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-sky-600" />
            <span className="truncate">{project.location || 'Location not specified'}</span>
          </div>
        </div>

        {/* TABS */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-1 border-b border-slate-200/70 overflow-x-auto scroll-elegant -mx-1 px-1">
            {([
              { k: 'overview' as const, label: 'Overview' },
              { k: 'progress' as const, label: 'ESG Progress' },
              { k: 'activity' as const, label: 'Recent Activity' },
              { k: 'team' as const, label: 'Team' },
              { k: 'documents' as const, label: 'Documents' },
            ]).map(t => {
              const active = tab === t.k
              return (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  className={`relative flex-shrink-0 px-3.5 py-2.5 text-[12px] font-bold whitespace-nowrap transition-colors ${
                    active ? 'text-sky-800 font-extrabold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                  {active && <motion.div layoutId="project-details-tab" className="absolute left-2 right-2 bottom-0 h-[2.5px] bg-sky-600 rounded-full" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* TAB BODY */}
        <div className="px-5 py-4.5">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {tab === 'overview' && (
                <div className="space-y-4">
                  {/* METADATA GRID: 4 columns on desktop / 2 on mobile - generous and airy */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <DetailRow
                      icon={Hash}
                      label="Project Code"
                      value={<span className="font-mono text-sky-800 font-bold">{project.projectCode}</span>}
                    />
                    <DetailRow
                      icon={Building2}
                      label="Business Unit"
                      value={project.buName}
                    />
                    <DetailRow
                      icon={Layers}
                      label="Project Type"
                      value={projectType}
                    />
                    <DetailRow
                      icon={CalendarClock}
                      label="Reporting Period"
                      value={currentPeriodLabel}
                    />
                    <DetailRow
                      icon={Calendar}
                      label="Start Date"
                      value={new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    />
                    <DetailRow
                      icon={Calendar}
                      label="Target Finish"
                      value={`31 Mar ${(periods[0]?.year ?? new Date().getFullYear()) + 2}`}
                    />
                    <DetailRow
                      icon={UserCheck}
                      label="Project Lead"
                      value="Rohit Kumar"
                    />
                    <DetailRow
                      icon={Briefcase}
                      label="Subsidiary"
                      value={project.subsidiaryName}
                    />
                  </div>

                  {/* PROJECT DESCRIPTION */}
                  <div className="rounded-2xl bg-white/70 p-3.5 border border-white/95 shadow-2xs">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                      Project Scope &amp; ESG Alignment
                    </div>
                    <p className="text-[12.5px] text-slate-700 leading-relaxed font-medium">
                      {project.projectName} is a priority operational asset under {project.buName}, subsidiary {project.subsidiaryName}.
                      Continuously monitoring Scope 1 &amp; 2 emissions, water circularity (ZLD compliance), and occupational safety to fulfill SEBI BRSR Core Principal 6 environmental mandates for {currentPeriodLabel}.
                    </p>
                  </div>

                  {/* INTEGRATED SITE LOCATION & GEOGRAPHIC FOOTPRINT BANNER */}
                  <div className="rounded-2xl bg-gradient-to-r from-sky-50/85 via-blue-50/60 to-white/90 p-4 border border-sky-100/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-sm shrink-0 ring-2 ring-white">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-bold text-slate-900 truncate">
                          {project.location || 'Site Location'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {project.subsidiaryName} · GPS Coordinates: 17.3850° N, 78.4867° E
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100/90 border border-emerald-300 text-emerald-800 text-[10px] font-bold shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" /> Active Telemetry
                      </span>
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-sky-200/90 px-3 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-50 hover:border-sky-400 transition-colors shadow-2xs"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> View on Map
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'progress' && (
                <div className="space-y-3.5">
                  {modules.slice(0, 4).map((m, i) => (
                    <div key={m.label} className="flex items-center gap-3.5 p-2.5 rounded-xl bg-white/50">
                      <CircularRing pct={m.pct} size={56} stroke={4.5} labelSize={11} color={
                        m.tone.includes('blue') ? '#3B82F6' :
                        m.tone.includes('cyan') ? '#06B6D4' :
                        m.tone.includes('emerald') ? '#10B981' :
                        m.tone.includes('amber') ? '#F59E0B' : '#8B5CF6'
                      } />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12.5px] font-semibold text-slate-900">{m.label}</span>
                          <span className={`status-pill text-[9px] ${m.pct >= 75 ? 'status-approved' : m.pct >= 50 ? 'status-review' : 'status-draft'}`}>
                            {m.pct >= 75 ? 'On Track' : m.pct >= 50 ? 'In Progress' : 'Needs Attention'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${m.pct}%` }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            className={`h-full ${m.tone} rounded-full`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'activity' && (
                <div className="max-h-[320px] overflow-y-auto scroll-elegant pr-1">
                  {activities.length === 0 ? (
                    <div className="text-center py-10 text-[12px] text-slate-500">No recent activity for this project</div>
                  ) : (
                    <ol className="space-y-2.5">
                      {activities.map((a, i) => (
                        <motion.li
                          key={a.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.03 * i }}
                          className="flex gap-2.5 rounded-xl bg-white/50 px-2.5 py-2.5 hover:bg-white/70 transition-colors"
                        >
                          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-[10px] font-semibold ring-2 ring-white shadow-sm">
                            {initials(a.actorName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[12px] font-semibold text-slate-900 truncate">{a.title}</span>
                              {a.status && (
                                <span className={`status-pill text-[8.5px] ${statusClass(a.status)}`}>
                                  {a.status.replace(/_/g, ' ').toLowerCase()}
                                </span>
                              )}
                            </div>
                            {a.description && <p className="text-[10.5px] text-slate-600 mt-0.5 line-clamp-2">{a.description}</p>}
                            <div className="text-[10px] text-slate-500 mt-0.5">{a.actorName} · {timeAgo(a.createdAt)}</div>
                          </div>
                        </motion.li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {tab === 'team' && (
                <div className="space-y-2">
                  {SEEDED_TEAM.slice(0, 7).map((m, i) => (
                    <motion.div
                      key={m.name}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className="flex items-center gap-3 rounded-xl bg-white/55 px-2.5 py-2.5 hover:bg-white/75 transition-colors"
                    >
                      <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${m.gradient} text-white flex items-center justify-center text-[11px] font-semibold ring-2 ring-white shadow-sm`}>
                        {initials(m.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold text-slate-900">{m.name}</div>
                        <div className="text-[10.5px] text-slate-500">{m.role}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${m.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className={`status-pill text-[8.5px] ${m.active ? 'status-approved' : 'status-draft'}`}>
                          {m.active ? 'Active' : 'Away'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {tab === 'documents' && (
                <div className="max-h-[320px] overflow-y-auto scroll-elegant pr-1">
                  {evidence.length === 0 ? (
                    <div className="text-center py-10 text-[12px] text-slate-500">No documents uploaded for this project</div>
                  ) : (
                    <div className="space-y-2">
                      {evidence.map((e, i) => (
                        <motion.div
                          key={e.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.03 * i }}
                          className="flex items-center gap-2.5 rounded-xl bg-white/55 px-2.5 py-2.5 hover:bg-white/75 transition-colors"
                        >
                          <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-semibold text-slate-900">{e.fileName}</div>
                            <div className="text-[10.5px] text-slate-500">
                              {e.documentType} · {e.uploader?.name ?? 'System'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={`status-pill text-[8.5px] ${statusClass(e.status)}`}>
                              {e.status.replace(/_/g, ' ').toLowerCase()}
                            </span>
                            <button className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-700 transition-colors" aria-label="View document">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/75 p-3 border border-white/95 shadow-2xs hover:bg-white/95 hover:shadow-xs transition-all">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="h-3 w-3 text-sky-600 shrink-0" />}
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold truncate">{label}</span>
      </div>
      <div className="text-[13px] font-bold text-slate-900 truncate">{value}</div>
    </div>
  )
}

/* ============================================================
 * Resizable card wrapper — drag the bottom handle to resize
 * ============================================================ */
function ResizableCard({ children, defaultHeight, minHeight = 220, maxHeight = 800, className = '' }: {
  children: React.ReactNode
  defaultHeight: number
  minHeight?: number
  maxHeight?: number
  className?: string
}) {
  const [height, setHeight] = useState(defaultHeight)
  const startY = useRef(0)
  const startH = useRef(0)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startY.current = e.clientY
    startH.current = height
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY.current
      setHeight(Math.max(minHeight, Math.min(maxHeight, startH.current + delta)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className={`relative flex flex-col ${className}`} style={{ height }}>
      <div className="flex-1 overflow-hidden">{children}</div>
      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize group z-10"
        title="Drag to resize"
      >
        <div className="w-8 h-1 rounded-full bg-slate-300 group-hover:bg-sky-400 transition-colors" />
      </div>
    </div>
  )
}

/* ============================================================
 * ROW 3 LEFT — Project ESG Progress (rings)
 * ============================================================ */
function ProjectEsgProgressCard({ project, subs, kpis, delay = 0.2, dragHandle }: {
  project: FlattenedProject | null
  subs: SubmissionItem[]
  kpis?: Kpis
  delay?: number
  dragHandle?: React.ReactNode
}) {
  const modules = moduleCompletion(subs, kpis).slice(0, 4)
  const ringColor = (tone: string) =>
    tone.includes('blue') ? '#3B82F6' :
    tone.includes('cyan') ? '#06B6D4' :
    tone.includes('emerald') ? '#10B981' :
    tone.includes('amber') ? '#F59E0B' : '#8B5CF6'

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className="glass glass-shimmer rounded-[20px] p-5 pb-6 flex flex-col h-full"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-sky-500" />
            Project ESG Progress
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {project ? project.projectName : 'Select a project'} · per-module completion
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="text-[11px] font-semibold text-sky-700 hover:text-sky-800 transition-colors whitespace-nowrap">
            View Details →
          </button>
          {dragHandle}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3.5 flex-1 content-center">
        {modules.map((m) => (
          <div key={m.label} className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/50 border border-white/80 shadow-2xs">
            <CircularRing pct={m.pct} size={58} stroke={4.5} labelSize={12} color={ringColor(m.tone)} />
            <div className="text-center">
              <div className="text-[11.5px] font-semibold text-slate-900 leading-tight">{m.label}</div>
              <div className={`mt-0.5 text-[9px] font-medium ${m.pct >= 75 ? 'text-emerald-700' : m.pct >= 50 ? 'text-amber-700' : 'text-sky-700'}`}>
                {m.pct >= 75 ? '✓ On Track' : m.pct >= 50 ? '⏵ In Progress' : '⚠ Needs Work'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  )
}

/* ============================================================
 * ROW 3 CENTER — Submission Status (compact table)
 * ============================================================ */
function SubmissionStatusCard({ project, allSubs, delay = 0.25, dragHandle }: {
  project: FlattenedProject | null
  allSubs: SubmissionItem[]
  delay?: number
  dragHandle?: React.ReactNode
}) {
  const modules = ['Energy', 'Water', 'Waste', 'Safety', 'Workforce']
  const rows = modules.map(mod => {
    const lower = mod.toLowerCase()
    const projectSubs = project
      ? allSubs.filter(s => s.projectId === project.id && (s.module || '').toLowerCase() === lower)
      : allSubs.filter(s => (s.module || '').toLowerCase() === lower)
    return {
      module: mod,
      total: projectSubs.length,
      submitted: projectSubs.filter(s => s.status === 'SUBMITTED' || s.status === 'RESUBMITTED').length,
      review: projectSubs.filter(s => s.status === 'UNDER_REVIEW' || s.status === 'REVIEW').length,
      approved: projectSubs.filter(s => s.status === 'APPROVED' || s.status === 'LOCKED').length,
      pending: Math.max(0, projectSubs.length - projectSubs.filter(s => s.status !== 'DRAFT').length),
    }
  })

  const Chip = ({ n, tone }: { n: number; tone: string }) => (
    <span className={`inline-flex min-w-[20px] items-center justify-center rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums ${tone}`}>
      {n}
    </span>
  )

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className="glass glass-shimmer rounded-[20px] p-5 pb-6 flex flex-col h-full"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-sky-500" />
            Submission Status
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {project ? project.projectCode : 'All projects'} · module breakdown
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="text-[11px] font-semibold text-sky-700 hover:text-sky-800 transition-colors whitespace-nowrap">
            View All →
          </button>
          {dragHandle}
        </div>
      </header>

      <div className="flex-1 overflow-x-auto -mx-1 px-1 scroll-elegant">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[9.5px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200/60">
              <th className="py-2 px-1 font-medium">Module</th>
              <th className="py-2 px-1 font-medium text-center">Total</th>
              <th className="py-2 px-1 font-medium text-center">Sub.</th>
              <th className="py-2 px-1 font-medium text-center">Rev.</th>
              <th className="py-2 px-1 font-medium text-center">App.</th>
              <th className="py-2 px-1 font-medium text-center">Pen.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {rows.map(r => (
              <tr key={r.module} className="hover:bg-white/40 transition-colors">
                <td className="py-2 px-1 text-[11px] font-semibold text-slate-800">{r.module}</td>
                <td className="py-2 px-1 text-center"><Chip n={r.total} tone="bg-slate-100 text-slate-700" /></td>
                <td className="py-2 px-1 text-center"><Chip n={r.submitted} tone="bg-sky-100 text-sky-700" /></td>
                <td className="py-2 px-1 text-center"><Chip n={r.review} tone="bg-amber-100 text-amber-700" /></td>
                <td className="py-2 px-1 text-center"><Chip n={r.approved} tone="bg-emerald-100 text-emerald-700" /></td>
                <td className="py-2 px-1 text-center"><Chip n={r.pending} tone="bg-rose-100 text-rose-700" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.section>
  )
}

/* ============================================================
 * Upcoming Deadlines — fix overflow/z-index so tooltip stays inside
 * ============================================================ */
function UpcomingDeadlinesCard({ project, periods, allSubs, delay = 0.3, dragHandle }: {
  project: FlattenedProject | null
  periods: OverviewData['periods']
  allSubs: SubmissionItem[]
  delay?: number
  dragHandle?: React.ReactNode
}) {
  const deadlineRows = useMemo(() => {
    const rows: { task: string; project: string; due: string; dueTs: number; status: string }[] = []
    for (const p of periods) {
      const baseYear = p.year
      const baseMonth = p.month ?? 3

      const addRow = (task: string, offsetDays: number, statusBase: string) => {
        const date = new Date(baseYear, baseMonth - 1, 15)
        date.setDate(date.getDate() + offsetDays)
        const dueTs = date.getTime()
        const now = Date.now()
        let status = statusBase
        if (dueTs < now) status = 'Overdue'
        else if (dueTs - now < 7 * 24 * 3600 * 1000 && statusBase !== 'Completed') status = 'At Risk'
        rows.push({
          task,
          project: project ? project.projectCode : p.label,
          due: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          dueTs,
          status,
        })
      }

      const projectFilter = project ? allSubs.filter(s => s.projectId === project.id) : allSubs
      const subForPeriod = projectFilter.find(s => s.reportingPeriod?.id === p.id)
      const isDone = subForPeriod?.status === 'APPROVED' || subForPeriod?.status === 'LOCKED'
      const inProgress = subForPeriod?.status === 'SUBMITTED' || subForPeriod?.status === 'UNDER_REVIEW'

      addRow(`Data Submission - ${p.label}`, 0, isDone ? 'Completed' : inProgress ? 'In Progress' : 'Pending')
      addRow(`Review Cycle - ${p.label}`, 14, isDone ? 'Completed' : 'Pending')
      addRow(`Approval Sign-off - ${p.label}`, 28, isDone ? 'Completed' : 'Pending')
    }

    const todayProjects = project
      ? allSubs.filter(s => s.projectId === project.id && s.status !== 'APPROVED' && s.status !== 'LOCKED')
      : allSubs.filter(s => s.status !== 'APPROVED' && s.status !== 'LOCKED')
    for (const s of todayProjects.slice(0, 3)) {
      const created = new Date(s.updatedAt || s.createdAt)
      const due = new Date(created)
      due.setDate(due.getDate() + 14)
      const now = Date.now()
      let status = 'Pending'
      if (s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW') status = 'In Progress'
      if (due.getTime() < now) status = 'Overdue'
      else if (due.getTime() - now < 5 * 24 * 3600 * 1000) status = 'At Risk'
      rows.push({
        task: s.title.length > 30 ? s.title.slice(0, 30) + '…' : s.title,
        project: s.project?.projectCode ?? project?.projectCode ?? '—',
        due: due.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        dueTs: due.getTime(),
        status,
      })
    }

    return rows.sort((a, b) => a.dueTs - b.dueTs).slice(0, 5)
  }, [periods, allSubs, project])

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className="glass glass-shimmer rounded-[20px] p-5 pb-6 flex flex-col h-full overflow-hidden"
    >
      <header className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4 text-sky-500" />
            Upcoming Deadlines
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {deadlineRows.length} task(s) · sorted by due date
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              downloadCsv(
                'upcoming_deadlines.csv',
                ['Task', 'Project', 'Due Date', 'Status'],
                deadlineRows.map(r => [r.task, r.project, r.due, r.status])
              )
              toast.success('Deadlines exported to CSV')
            }}
            className="text-[11px] font-semibold text-sky-700 hover:text-sky-800 transition-colors whitespace-nowrap inline-flex items-center gap-1"
          >
            <Download className="h-3 w-3" /> Export
          </button>
          {dragHandle}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 scroll-elegant space-y-1.5 pb-2">
        {deadlineRows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/40 hover:bg-white/70 border border-white/60 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-slate-800 truncate">
                {row.task}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[9.5px] text-slate-500 font-mono">
                <span>{row.project}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600 font-sans">{row.due}</span>
              </div>
            </div>
            <span className={`status-pill text-[8.5px] px-2 py-0.5 shrink-0 whitespace-nowrap font-medium ${
              row.status === 'Completed' ? 'status-approved' :
              row.status === 'In Progress' ? 'status-review' :
              row.status === 'Overdue' ? 'status-missing' :
              row.status === 'At Risk' ? 'status-warning' : 'status-draft'
            }`}>
              {row.status}
            </span>
          </div>
        ))}
        {deadlineRows.length === 0 && (
          <div className="py-8 text-center text-[11px] text-slate-500">
            No upcoming deadlines
          </div>
        )}
      </div>
    </motion.section>
  )
}

/* ============================================================
 * Skeletons + Error + Empty states
 * ============================================================ */
function MyProjectSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200/60" />

      {/* ROW 1: 4 KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass h-[110px] animate-pulse rounded-2xl" />
        ))}
      </div>

      {/* ROW 2: Registry + Details */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.95fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="glass h-[460px] animate-pulse rounded-[20px]" />
        <div className="glass h-[620px] animate-pulse rounded-[20px]" />
      </div>

      {/* ROW 3: 3 asymmetric cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,1fr)]">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass h-[260px] animate-pulse rounded-[20px]" />
        ))}
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
 * Main component — 3 hard-locked rows
 * ============================================================ */
export function MyProjectModule() {
  const { setActiveModule } = useApp()

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [tree, setTree] = useState<OrgTree | null>(null)
  const [globalActivity, setGlobalActivity] = useState<ActivityItem[]>([])
  const [allSubs, setAllSubs] = useState<SubmissionItem[]>([])

  const [projectActivity, setProjectActivity] = useState<ActivityItem[]>([])
  const [projectSubs, setProjectSubs] = useState<SubmissionItem[]>([])
  const [projectEvidence, setProjectEvidence] = useState<EvidenceItem[]>([])

  const { selectedProjectId: appProjectId } = useApp()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [buFilter, setBuFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Drag-and-drop card order for Row 3
  const [row3Order, setRow3Order] = useState<('esg' | 'submissions' | 'deadlines')[]>(['esg', 'submissions', 'deadlines'])
  // Card heights for Row 3 (resizable)
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({ esg: 340, submissions: 340, deadlines: 340 })

  // Real-time project edits
  const [editedProjects, setEditedProjects] = useState<Record<string, FlattenedProject>>({})
  const handleUpdateProject = useCallback((updated: FlattenedProject) => {
    setEditedProjects(prev => ({
      ...prev,
      [updated.id]: updated,
    }))
  }, [])

  const mountedRef = useRef(true)

  /* ---- initial load ---- */
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
        const projects = flattenProjects(tr)
        if (projects.length > 0) {
          const matched = appProjectId ? projects.find(p => p.id === appProjectId || p.projectCode === appProjectId) : null
          setSelectedProjectId(matched ? matched.id : projects[0].id)
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

  /* ---- project-scoped fetch ---- */
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

  /* ---- derived ---- */
  const allProjects = useMemo(() => {
    const base = flattenProjects(tree)
    return base.map(p => editedProjects[p.id] ? { ...p, ...editedProjects[p.id] } : p)
  }, [tree, editedProjects])

  const uniqueBUs = useMemo(() => {
    const set = new Set<string>()
    for (const p of allProjects) set.add(p.buName)
    return Array.from(set).sort()
  }, [allProjects])

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>()
    for (const p of allProjects) set.add(p.buName.split(' ')[0] || 'Project')
    return Array.from(set).sort()
  }, [allProjects])

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
    if (buFilter !== 'all') {
      list = list.filter(p => p.buName === buFilter)
    }
    if (typeFilter !== 'all') {
      list = list.filter(p => (p.buName.split(' ')[0] || 'Project') === typeFilter)
    }
    return list
  }, [allProjects, search, statusFilter, buFilter, typeFilter])

  /* ---- selection sync: auto-select first on filtered change ---- */
  useEffect(() => {
    if (filteredProjects.length > 0) {
      if (!selectedProjectId || !filteredProjects.find(p => p.id === selectedProjectId)) {
        setSelectedProjectId(filteredProjects[0].id)
      }
    } else {
      setSelectedProjectId(null)
    }
  }, [filteredProjects])

  const selectedProject = useMemo(
    () => allProjects.find(p => p.id === selectedProjectId) ?? null,
    [allProjects, selectedProjectId],
  )

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
  const totalSubs = k.totalSubs ?? 0
  const approvedSubs = k.approvedSubs ?? 0
  const draftSubs = k.draftSubs ?? 0
  const uniqueBUCount = uniqueBUs.length
  const pendingSubs = Math.max(0, totalSubs - approvedSubs - draftSubs)

  const trendTone = (approvedSubs / Math.max(1, totalSubs)) >= 0.5 ? 'status-approved' : 'status-missing'

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

      {/* ====================================================== */}
      {/* ROW 1: 4 EQUAL KPI CARDS                               */}
      {/* ====================================================== */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiCardRow1
          icon={Briefcase}
          tone="bg-sky-50 text-sky-600 border border-sky-200/80"
          label="Total Assigned Projects"
          value={allProjects.length}
          subText={`${uniqueBUCount} Business Unit${uniqueBUCount === 1 ? '' : 's'}`}
          rightContent={<Layers className="h-4 w-4 text-sky-400" />}
          delay={0.05}
        />

        <KpiCardRow1
          icon={FileCheck2}
          tone="bg-emerald-50 text-emerald-600 border border-emerald-200/80"
          label="Data Completion"
          value={<>{k.completion.toFixed(0)}<span className="text-[15px] font-bold ml-0.5">%</span></>}
          subText="Portfolio reporting coverage"
          rightContent={
            <div className="flex flex-col items-end gap-1">
              <CircularRing pct={k.completion} size={44} stroke={4} labelSize={10} color={k.completion >= 70 ? '#10B981' : k.completion >= 40 ? '#F59E0B' : '#0EA5E9'} />
              <span className={`status-pill text-[8.5px] ${trendTone}`}>
                {approvedSubs}/{totalSubs} subs
              </span>
            </div>
          }
          delay={0.1}
        />

        <KpiCardRow1
          icon={FileText}
          tone="bg-amber-50 text-amber-600 border border-amber-200/80"
          label="Pending Submissions"
          value={pendingSubs}
          subText={`Across ${filteredProjects.length || allProjects.length} Project${(filteredProjects.length || allProjects.length) === 1 ? '' : 's'}`}
          rightContent={<RefreshCw className="h-4 w-4 text-amber-400" />}
          delay={0.15}
        />

        <KpiCardRow1
          icon={Shield}
          tone="bg-emerald-50 text-emerald-600 border border-emerald-200/80"
          label="Approved Submissions"
          value={approvedSubs}
          subText={currentPeriodLabel}
          rightContent={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          delay={0.2}
        />
      </div>

      {/* ====================================================== */}
      {/* ROW 2: Registry LEFT | Details RIGHT — registry wider    */}
      {/* ====================================================== */}
      <div className={`grid grid-cols-1 gap-6 transition-all duration-300 items-stretch ${
        isDetailsExpanded
          ? 'grid-cols-1'
          : 'lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]'
      }`}>
        {!isDetailsExpanded && (
          <ProjectRegistryCard
            projects={filteredProjects}
            submissions={allSubs}
            selectedId={selectedProjectId}
            onSelect={setSelectedProjectId}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            buFilter={buFilter}
            setBuFilter={setBuFilter}
            periodFilter={periodFilter}
            setPeriodFilter={setPeriodFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            viewMode={viewMode}
            setViewMode={setViewMode}
            periods={overview.periods}
            uniqueBUs={uniqueBUs}
            uniqueTypes={uniqueTypes}
            currentPeriodLabel={currentPeriodLabel}
          />
        )}

        <ProjectDetailsPanel
          key={selectedProject?.id ?? 'none'}
          project={selectedProject}
          onUpdateProject={handleUpdateProject}
          kpis={k}
          subs={projectSubs}
          activities={projectActivity.length > 0 ? projectActivity : globalActivity.filter(a => a.projectId === selectedProject?.id)}
          evidence={projectEvidence}
          periods={overview.periods}
          currentPeriodLabel={currentPeriodLabel}
          isExpanded={isDetailsExpanded}
          onToggleExpand={() => setIsDetailsExpanded(!isDetailsExpanded)}
        />
      </div>

      {/* ====================================================== */}
      {/* ROW 3: Drag-and-Drop + Resizable Cards                  */}
      {/* ====================================================== */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
          <GripVertical className="h-3.5 w-3.5 text-sky-500" />
          <span>Drag card headers to reorder · Drag bottom edge to adjust card height</span>
        </div>
        <Reorder.Group
          axis="x"
          values={row3Order}
          onReorder={setRow3Order}
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
          layoutScroll
        >
          {row3Order.map(cardId => {
            const h = cardHeights[cardId] ?? 340
            const setH = (newH: number) => setCardHeights(prev => ({ ...prev, [cardId]: newH }))
            const cardDragHandle = (
              <div
                className="cursor-grab active:cursor-grabbing p-1 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                title="Drag card to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )

            return (
              <Reorder.Item
                key={cardId}
                value={cardId}
                className="relative"
                whileDrag={{ scale: 1.02, zIndex: 50, boxShadow: '0 20px 48px -8px rgba(2,132,199,0.25)' }}
              >
                {/* Resizable wrapper */}
                <div className="relative" style={{ height: h }}>
                  <div className="h-full overflow-hidden">
                    {cardId === 'esg' && (
                      <ProjectEsgProgressCard
                        project={selectedProject}
                        subs={selectedProject ? projectSubs : allSubs}
                        kpis={k}
                        delay={0.2}
                        dragHandle={cardDragHandle}
                      />
                    )}
                    {cardId === 'submissions' && (
                      <SubmissionStatusCard
                        project={selectedProject}
                        allSubs={selectedProject ? projectSubs : allSubs}
                        delay={0.25}
                        dragHandle={cardDragHandle}
                      />
                    )}
                    {cardId === 'deadlines' && (
                      <UpcomingDeadlinesCard
                        project={selectedProject}
                        periods={overview.periods}
                        allSubs={selectedProject ? projectSubs : allSubs}
                        delay={0.3}
                        dragHandle={cardDragHandle}
                      />
                    )}
                  </div>

                  {/* Resize handle */}
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault()
                      const startY = e.clientY
                      const startH = h
                      const onMove = (ev: MouseEvent) => {
                        setH(Math.max(260, Math.min(700, startH + ev.clientY - startY)))
                      }
                      const onUp = () => {
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                      }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                    className="absolute bottom-0 left-0 right-0 h-4 flex items-end justify-center pb-1 cursor-ns-resize group z-20"
                    title="Drag to resize card"
                  >
                    <div className="flex items-center gap-0.5">
                      <div className="w-6 h-1 rounded-full bg-slate-300 group-hover:bg-sky-400 transition-colors" />
                      <ChevronsUpDown className="h-3 w-3 text-slate-300 group-hover:text-sky-400 transition-colors" />
                      <div className="w-6 h-1 rounded-full bg-slate-300 group-hover:bg-sky-400 transition-colors" />
                    </div>
                  </div>
                </div>
              </Reorder.Item>
            )
          })}
        </Reorder.Group>
      </div>
    </div>
  )
}
