'use client'
/**
 * BrsrWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * BRSR Manager workspace. A single client component that switches content
 * based on `activeModule` from the AppContext. Handles eleven module keys:
 *
 *   - 'brsr-frameworks' → Frameworks (framework list)
 *   - 'brsr-section-a'  → Section A (question list w/ answer status)
 *   - 'brsr-section-b'  → Section B (question list w/ answer status)
 *   - 'brsr-section-c'  → Section C (question list w/ answer status)
 *   - 'brsr-core'       → BRSR Core (core indicators)
 *   - 'brsr-mapping'    → Disclosure Mapping (mapping table)
 *   - 'brsr-sources'    → Evidence & Sources (evidence list)
 *   - 'brsr-validation' → Validation (validation results)
 *   - 'brsr-readiness'  → Readiness (readiness gauge + dimensions)
 *   - 'brsr-builder'    → Report Builder (report generation)
 *   - 'brsr-issuance'  → Approval & Issuance (approval queue)
 *
 * Color theme: Green / Teal-deep (#059669, #0d9488, #047857) — premium
 * sustainable palette aligned with the BRSR disclosure domain.
 *
 * Data:
 *   GET /api/overview          → kpis + trends + periods
 *   GET /api/activity?take=10  → recent activities (filtered client-side)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Layers, BookOpen, ClipboardCheck, CheckCircle2,
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle,
  ChevronRight, CircleCheck, Clock, ShieldCheck, Building2,
  Activity as ActivityIcon, AlertTriangle, FileCheck, Gauge,
  PieChart as PieIcon, Database, Link2, ListChecks, Sparkles,
  Send, Stamp, Scale, Crosshair, Workflow, FileBarChart,
  Paperclip, BarChart3, TrendingUp, BadgeCheck, FilePlus2,
  XCircle, FileWarning, Network, Leaf,
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
 * Theme constants — Green / Teal-deep
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(5,150,105,0.30)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(13,148,136,0.22)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const GREEN_DEEP = '#059669'   // emerald-600
const GREEN_DARK = '#047857'   // emerald-700
const TEAL_DEEP = '#0d9488'    // teal-600
const TEAL_DARK = '#0f766e'    // teal-700
const GREEN_PRIMARY = '#10b981' // emerald-500
const TEAL_PRIMARY = '#14b8a6'  // teal-500
const GREEN_SOFT = '#6ee7b7'   // emerald-300
const GREEN_TINT = '#d1fae5'    // emerald-100

const DONUT_PALETTE = [GREEN_DEEP, TEAL_DEEP, GREEN_DARK, TEAL_DARK, GREEN_PRIMARY]

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

/** Filter activities relevant to BRSR manager. */
function isBrsrActivity(a: ActivityItem): boolean {
  const mod = (a.module ?? '').toUpperCase()
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const brsrMods = ['BRSR', 'DISCLOSURE', 'FRAMEWORK', 'EVIDENCE', 'VALIDATION', 'READINESS']
  const brsrActions = ['BRSR', 'DISCLOSURE', 'ANSWER', 'FRAMEWORK', 'VALIDATE', 'EVIDENCE', 'REPORT', 'ISSUE', 'APPROVE']
  const brsrKeywords = ['brsr', 'disclosure', 'principle', 'section a', 'section b', 'section c', 'framework', 'readiness', 'evidence', 'validation', 'issuance']
  return (
    brsrMods.some(k => mod.includes(k)) ||
    brsrActions.some(k => act.includes(k)) ||
    brsrKeywords.some(k => title.includes(k) || desc.includes(k))
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
            background: `linear-gradient(135deg, ${GREEN_DEEP}, ${TEAL_DARK})`,
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
          <div className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Readiness</div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-20 rounded-full bg-slate-200/70 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${completionPct}%`,
                  background: `linear-gradient(90deg, ${GREEN_DARK}, ${TEAL_DEEP})`,
                  boxShadow: `0 0 8px -1px ${GREEN_DEEP}80`,
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
function BrsrKpiTile({
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
          style={{ background: GREEN_DARK, boxShadow: `0 0 8px 1px ${GREEN_DARK}` }}
        />
      )}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(209,250,229,0.95), rgba(167,243,208,0.75))',
            border: `1px solid rgba(5,150,105,0.35)`,
            color: GREEN_DARK,
            boxShadow: '0 2px 8px -2px rgba(4,120,87,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
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
            <Icon className="h-4 w-4" style={{ color: GREEN_DARK }} />
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
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load BRSR workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${GREEN_DEEP}, ${TEAL_DARK})` }}
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
      <Icon className="h-10 w-10 mb-3" style={{ color: GREEN_DEEP }} />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-[12px] text-slate-700 mb-4">{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${GREEN_DEEP}, ${TEAL_DARK})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/** Activity feed card. */
function ActivityFeedCard({
  activities, loading, title = 'Recent BRSR Activities',
}: {
  activities: ActivityItem[]
  loading: boolean
  title?: string
}) {
  return (
    <SectionCard
      icon={ActivityIcon}
      title={title}
      subtitle="BRSR feed · polled every 30s"
      index={9}
      action={
        <button className="glass-subtle rounded-lg px-2 py-1 text-[10px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1">
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
          <ol className="relative space-y-1 before:absolute before:left-[16px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-emerald-200/70 before:via-teal-100/40 before:to-transparent">
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
                      style={{ background: `linear-gradient(135deg, ${GREEN_DEEP}, ${TEAL_DARK})` }}
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
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50/80 text-emerald-700 border border-emerald-100">{a.module}</span>
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
 * Derived data builders — used by section screens
 * ============================================================ */

/** Derive a deterministic BRSR framework list from KPIs. */
function deriveFrameworks(k: Kpis) {
  const seed = (k.brsrReadiness + k.evidenceTotal + k.totalSubs) || 1
  const frameworks = [
    { id: 'FW-BRSR-2024', name: 'BRSR Core FY24', version: 'v3.0', year: 2024, tier: 'Core', status: 'Active' },
    { id: 'FW-BRSR-2025', name: 'BRSR Core FY25', version: 'v3.1', year: 2025, tier: 'Core', status: 'Active' },
    { id: 'FW-BRSR-2026', name: 'BRSR Core FY26', version: 'v3.2', year: 2026, tier: 'Core', status: 'Drafting' },
    { id: 'FW-BRSR-Lite', name: 'BRSR Lite SME', version: 'v1.0', year: 2025, tier: 'Lite', status: 'Active' },
    { id: 'FW-GRI-S1', name: 'GRI Standards S1', version: '2021', year: 2025, tier: 'Mapped', status: 'Active' },
    { id: 'FW-TCFD', name: 'TCFD Aligned', version: 'v4.0', year: 2025, tier: 'Cross-mapped', status: 'Active' },
    { id: 'FW-SDG-UN', name: 'UN SDG Mapping', version: '2030', year: 2025, tier: 'Cross-mapped', status: 'Active' },
    { id: 'FW-SASB', name: 'SASB Industry', version: 'v2023', year: 2025, tier: 'Cross-mapped', status: 'Active' },
  ]
  return frameworks.map((f, i) => {
    const r = ((seed * (i + 11)) % 997) / 997
    const sections = 3 + (i === 0 ? 0 : Math.floor(r * 2))
    const principles = 9
    const questions = 140 + Math.floor(r * 30)
    const answers = Math.round(questions * (k.brsrReadiness / 100))
    return { ...f, sections, principles, questions, answers, readiness: i === 2 ? k.brsrReadiness - 5 : k.brsrReadiness }
  })
}

/** Derive a deterministic question list for a given section (A/B/C). */
function deriveSectionQuestions(k: Kpis, section: 'A' | 'B' | 'C') {
  const seed = (k.brsrReadiness + k.evidenceTotal + section.charCodeAt(0)) || 1
  const titlesBySection: Record<'A' | 'B' | 'C', string[]> = {
    A: [
      'Details of the listed entity',
      'Products and services offered',
      'Operations and locations',
      'Employees and workers',
      'CSR and sustainability initiatives',
      'Subsidiaries and joint ventures',
    ],
    B: [
      'Governance structure and composition',
      'Senior management remuneration',
      'Stakeholder engagement',
      'Risk management framework',
      'Anti-corruption and ethics policies',
      'Whistleblower mechanism',
      'Cybersecurity and data privacy',
      'Business responsibility principles',
    ],
    C: [
      'Climate-related disclosures (TCFD-aligned)',
      'GHG emissions (Scope 1, 2, 3)',
      'Energy consumption and renewable mix',
      'Water withdrawal and discharge',
      'Waste management and circularity',
      'Biodiversity impact',
      'Social impact and inclusion',
      'Supply chain sustainability',
      'Employee health and safety metrics',
    ],
  }
  const principles = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']
  const statuses: Array<'Approved' | 'Locked' | 'Evidence Verified' | 'Submitted' | 'Draft' | 'Missing'> =
    ['Approved', 'Locked', 'Evidence Verified', 'Submitted', 'Draft', 'Missing']
  const titles = titlesBySection[section]
  return titles.map((t, i) => {
    const r = ((seed * (i + 7)) % 997) / 997
    const statusIdx = Math.min(5, Math.floor(r * 6))
    const status = statuses[statusIdx]
    return {
      id: `BRSR-${section}-${(100 + i).toString()}`,
      code: `${section}.${(i + 1).toString().padStart(2, '0')}`,
      title: t,
      principle: principles[i % principles.length],
      status,
      evidence: status === 'Missing' ? 0 : 1 + Math.floor(r * 3),
      owner: ['ESG Manager', 'CFO', 'CHRO', 'Company Secretary', 'EHS Lead', 'Head of Procurement'][i % 6],
      lastUpdated: new Date(Date.now() - i * 86400_000 * 3).toISOString(),
    }
  })
}

/* ============================================================
 * Screen 1 — Frameworks (brsr-frameworks)
 * ============================================================ */
function FrameworksScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const frameworks = useMemo(() => deriveFrameworks(k), [k])
  const active = frameworks.filter(f => f.status === 'Active').length
  const totalQuestions = frameworks.reduce((s, f) => s + f.questions, 0)
  const totalAnswers = frameworks.reduce((s, f) => s + f.answers, 0)

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Layers}
        title="BRSR Frameworks"
        subtitle={`${frameworks.length} frameworks · ${active} active · ${totalAnswers}/${totalQuestions} answers`}
        completionPct={k.brsrReadiness}
        badge={{ label: `${active} active`, tone: 'status-approved', icon: Layers }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BrsrKpiTile index={1} icon={Layers} label="Frameworks" value={formatNumber(frameworks.length, 0)} unit="tracked" trend={{ dir: 'up', text: `${active}` }} />
        <BrsrKpiTile index={2} icon={FileText} label="Total Questions" value={formatNumber(totalQuestions, 0)} unit="items" trend={{ dir: 'up', text: `${totalQuestions}` }} />
        <BrsrKpiTile index={3} icon={CheckCircle2} label="Answers" value={formatNumber(totalAnswers, 0)} unit="collected" trend={{ dir: 'up', text: `${(totalAnswers / Math.max(1, totalQuestions) * 100).toFixed(0)}%` }} />
        <BrsrKpiTile index={4} icon={Gauge} label="Avg Readiness" value={`${k.brsrReadiness.toFixed(0)}`} unit="%" trend={{ dir: k.brsrReadiness >= 80 ? 'up' : 'down', text: 'avg' }} />
      </div>

      <SectionCard
        icon={Layers}
        title="Framework Registry"
        subtitle="All BRSR + cross-mapped frameworks"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5">
            New <FilePlus2 className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-[460px] overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(209,250,229,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Framework</th>
                <th className="px-3 py-2 text-left font-semibold">Version</th>
                <th className="px-3 py-2 text-left font-semibold">Tier</th>
                <th className="px-3 py-2 text-right font-semibold">Sections</th>
                <th className="px-3 py-2 text-right font-semibold">Questions</th>
                <th className="px-3 py-2 text-right font-semibold">Answers</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {frameworks.map((f, i) => {
                const tierColor = f.tier === 'Core' ? GREEN_DARK : f.tier === 'Lite' ? TEAL_DEEP : TEAL_DARK
                const statusColor = f.status === 'Active' ? GREEN_PRIMARY : f.status === 'Drafting' ? '#f59e0b' : '#64748b'
                return (
                  <motion.tr
                    key={f.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-emerald-50/40 transition-colors"
                    style={{ height: 44 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{f.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{f.name}</td>
                    <td className="px-3 py-2 text-slate-700">{f.version}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{ background: `${tierColor}1a`, color: tierColor, borderColor: `${tierColor}33` }}>
                        {f.tier}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{f.sections}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{f.questions}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{f.answers}<span className="text-slate-500 font-normal">/{f.questions}</span></td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
                        {f.status}
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
          title="Answers per Framework"
          subtitle="Disclosure count comparison"
          index={6}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={frameworks.map(f => ({ name: f.id.replace('FW-', '').slice(0, 8), answers: f.answers, questions: f.questions }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                barCategoryGap="22%"
              >
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(5,150,105,0.06)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Bar dataKey="questions" fill="#cbd5e1" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} />
                <Bar dataKey="answers" fill={GREEN_DEEP} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Framework Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 2/3/4 — Section A/B/C (shared screen factory)
 * ============================================================ */
function SectionScreen({
  k, activities, activityLoading, section,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
  section: 'A' | 'B' | 'C'
}) {
  const questions = useMemo(() => deriveSectionQuestions(k, section), [k, section])
  const sectionNames: Record<'A' | 'B' | 'C', string> = {
    A: 'Section A — General Disclosures',
    B: 'Section B — Management & Governance',
    C: 'Section C — Principle-wise Performance',
  }
  const approved = questions.filter(q => q.status === 'Approved' || q.status === 'Locked' || q.status === 'Evidence Verified').length
  const missing = questions.filter(q => q.status === 'Missing').length
  const draft = questions.filter(q => q.status === 'Draft' || q.status === 'Submitted').length
  const sectionPct = questions.length > 0 ? (approved / questions.length) * 100 : 0

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={section === 'A' ? BookOpen : section === 'B' ? Scale : Leaf}
        title={sectionNames[section]}
        subtitle={`${questions.length} questions · ${approved} approved · ${missing} missing`}
        completionPct={sectionPct}
        badge={{ label: `${sectionPct.toFixed(0)}% ready`, tone: sectionPct >= 80 ? 'status-approved' : 'status-warning', icon: CircleCheck }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BrsrKpiTile index={1} icon={ListChecks} label="Questions" value={formatNumber(questions.length, 0)} unit="in section" trend={{ dir: 'up', text: `${section}` }} />
        <BrsrKpiTile index={2} icon={CircleCheck} label="Approved" value={formatNumber(approved, 0)} unit="answers" trend={{ dir: 'up', text: 'good' }} />
        <BrsrKpiTile index={3} icon={Clock} label="Draft" value={formatNumber(draft, 0)} unit="in progress" trend={{ dir: draft > 0 ? 'up' : 'neutral', text: draft > 0 ? `${draft}` : '0' }} />
        <BrsrKpiTile index={4} icon={AlertTriangle} label="Missing" value={formatNumber(missing, 0)} unit="not started" trend={{ dir: missing > 0 ? 'up' : 'neutral', text: missing > 0 ? `${missing}` : '0' }} alert={missing > 0} />
      </div>

      <SectionCard
        icon={ClipboardCheck}
        title={`Section ${section} Question List`}
        subtitle="Question code · principle · answer status · evidence count"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-[460px] overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(209,250,229,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">Code</th>
                <th className="px-3 py-2 text-left font-semibold">Question</th>
                <th className="px-3 py-2 text-left font-semibold">Principle</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-right font-semibold">Evidence</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, i) => (
                <motion.tr
                  key={q.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.015 }}
                  className="border-t border-slate-100 hover:bg-emerald-50/40 transition-colors"
                  style={{ height: 44 }}
                >
                  <td className="px-3 py-2 font-mono text-slate-700">{q.code}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{q.title}</td>
                  <td className="px-3 py-2 text-slate-700">{q.principle}</td>
                  <td className="px-3 py-2 text-slate-700">{q.owner}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {q.evidence > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" style={{ color: GREEN_DEEP }} />
                        {q.evidence}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`status-pill text-[9px] ${statusClass(q.status)}`}>
                      {q.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{timeAgo(q.lastUpdated)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={PieIcon}
          title={`Section ${section} Status Distribution`}
          subtitle="Answer status breakdown"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Approved', value: Math.max(0.1, approved), color: GREEN_DARK },
                    { name: 'Draft', value: Math.max(0.1, draft), color: '#f59e0b' },
                    { name: 'Missing', value: Math.max(0.1, missing), color: '#dc2626' },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}
                >
                  {[
                    { color: GREEN_DARK },
                    { color: '#f59e0b' },
                    { color: '#dc2626' },
                  ].map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} questions`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{questions.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Questions</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title={`Section ${section} Activity Feed`} />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 5 — BRSR Core (brsr-core)
 * ============================================================ */
function CoreScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const indicators = useMemo(() => {
    const seed = (k.brsrReadiness + k.evidenceTotal + k.totalSubs) || 1
    const principles = [
      { code: 'P1', name: 'Businesses being ethical', area: 'Ethics' },
      { code: 'P2', name: 'Sustainable & safe products', area: 'Product' },
      { code: 'P3', name: 'Employees well-being', area: 'Social' },
      { code: 'P4', name: 'Stakeholder engagement', area: 'Stakeholder' },
      { code: 'P5', name: 'Human rights', area: 'Social' },
      { code: 'P6', name: 'Environment', area: 'Environment' },
      { code: 'P7', name: 'Public policy advocacy', area: 'Policy' },
      { code: 'P8', name: 'Inclusive growth', area: 'Community' },
      { code: 'P9', name: 'Customer engagement', area: 'Customer' },
    ]
    const ess: Array<'Leadership' | 'Essential' | 'Mandatory'> = ['Leadership', 'Essential', 'Mandatory']
    return principles.map((p, i) => {
      const r = ((seed * (i + 11)) % 997) / 997
      const total = 5 + Math.floor(r * 3)
      const answered = Math.round(total * (k.brsrReadiness / 100))
      const ind = ess[i % ess.length]
      return {
        id: `CORE-${p.code}-${(i + 1).toString().padStart(2, '0')}`,
        ...p,
        indicators: total,
        answered,
        type: ind,
        pct: Math.round((answered / Math.max(1, total)) * 100),
      }
    })
  }, [k])

  const totalIndicators = indicators.reduce((s, i) => s + i.indicators, 0)
  const totalAnswered = indicators.reduce((s, i) => s + i.answered, 0)
  const overallPct = totalIndicators > 0 ? (totalAnswered / totalIndicators) * 100 : 0

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={ShieldCheck}
        title="BRSR Core Indicators"
        subtitle={`${indicators.length} principles · ${totalAnswered}/${totalIndicators} indicators answered`}
        completionPct={overallPct}
        badge={{ label: `${overallPct.toFixed(0)}% answered`, tone: overallPct >= 80 ? 'status-approved' : 'status-warning', icon: CircleCheck }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BrsrKpiTile index={1} icon={ShieldCheck} label="Principles" value={formatNumber(indicators.length, 0)} unit="P1-P9" trend={{ dir: 'up', text: 'all' }} />
        <BrsrKpiTile index={2} icon={ListChecks} label="Indicators" value={formatNumber(totalIndicators, 0)} unit="total" trend={{ dir: 'up', text: `${totalIndicators}` }} />
        <BrsrKpiTile index={3} icon={CheckCircle2} label="Answered" value={formatNumber(totalAnswered, 0)} unit="complete" trend={{ dir: 'up', text: `${overallPct.toFixed(0)}%` }} />
        <BrsrKpiTile index={4} icon={Gauge} label="Avg per P" value={(totalIndicators / Math.max(1, indicators.length)).toFixed(1)} unit="indicators" trend={{ dir: 'up', text: 'avg' }} />
      </div>

      <SectionCard
        icon={ShieldCheck}
        title="Principle-wise Core Indicators"
        subtitle="BRSR Core indicator count and readiness per principle"
        index={5}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {indicators.map((ind, i) => {
            const areaColor = ind.area === 'Environment' ? GREEN_DARK : ind.area === 'Social' ? TEAL_DEEP : ind.area === 'Ethics' ? GREEN_PRIMARY : TEAL_DARK
            return (
              <motion.div
                key={ind.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 text-[10px] font-bold"
                    style={{ background: `${areaColor}1a`, color: areaColor, border: `1px solid ${areaColor}33` }}
                  >
                    {ind.code}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-slate-900 truncate">{ind.name}</div>
                    <div className="text-[9px] text-slate-700">{ind.area} · {ind.type}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-700">{ind.answered}/{ind.indicators} answered</span>
                  <span className="text-[14px] font-bold text-slate-900 tabular-nums">{ind.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${ind.pct}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.04, ease: [0.22, 1, 0.36, 1] as const }}
                    style={{ background: `linear-gradient(90deg, ${areaColor}, ${GREEN_DEEP})`, boxShadow: `0 0 8px -1px ${areaColor}80` }}
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
          title="Indicator Coverage by Principle"
          subtitle="Answered vs total indicators per principle"
          index={6}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={indicators.map(ind => ({ name: ind.code, answered: ind.answered, total: ind.indicators }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                barCategoryGap="22%"
              >
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(5,150,105,0.06)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Bar dataKey="total" fill="#cbd5e1" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} />
                <Bar dataKey="answered" fill={GREEN_DEEP} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="BRSR Core Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 6 — Disclosure Mapping (brsr-mapping)
 * ============================================================ */
function MappingScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const mappings = useMemo(() => {
    const seed = (k.brsrReadiness + k.evidenceTotal) || 1
    const rows = [
      { brsr: 'P1 Ethical Business', gri: 'GRI 2-23', tcfd: 'Gov-a', sdg: 'SDG 16', sasb: 'IF-EH-510a', coverage: 95 },
      { brsr: 'P2 Sustainable Products', gri: 'GRI 416-1', tcfd: '—', sdg: 'SDG 12', sasb: 'IF-RT-430', coverage: 88 },
      { brsr: 'P3 Employee Wellbeing', gri: 'GRI 401-1', tcfd: '—', sdg: 'SDG 8', sasb: 'IF-HZ-320', coverage: 92 },
      { brsr: 'P4 Stakeholder Engagement', gri: 'GRI 2-29', tcfd: '—', sdg: 'SDG 17', sasb: '—', coverage: 78 },
      { brsr: 'P5 Human Rights', gri: 'GRI 412-1', tcfd: '—', sdg: 'SDG 5', sasb: 'IF-HZ-440', coverage: 85 },
      { brsr: 'P6 Environment', gri: 'GRI 302-1', tcfd: 'Met-a', sdg: 'SDG 13', sasb: 'IF-RT-110', coverage: 96 },
      { brsr: 'P7 Public Policy', gri: 'GRI 415-1', tcfd: '—', sdg: 'SDG 16', sasb: '—', coverage: 70 },
      { brsr: 'P8 Inclusive Growth', gri: 'GRI 203-1', tcfd: '—', sdg: 'SDG 1', sasb: '—', coverage: 80 },
      { brsr: 'P9 Customer Engagement', gri: 'GRI 417-1', tcfd: '—', sdg: 'SDG 12', sasb: 'IF-RT-410', coverage: 88 },
    ]
    return rows.map((r, i) => {
      const r2 = ((seed * (i + 11)) % 997) / 997
      return { id: `MAP-${(i + 1).toString().padStart(3, '0')}`, ...r, evidence: 1 + Math.floor(r2 * 4) }
    })
  }, [k])

  const avgCoverage = mappings.reduce((s, m) => s + m.coverage, 0) / mappings.length
  const fullCoverage = mappings.filter(m => m.coverage >= 90).length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Link2}
        title="Disclosure Mapping"
        subtitle={`${mappings.length} BRSR principles mapped to GRI · TCFD · SDG · SASB`}
        completionPct={avgCoverage}
        badge={{ label: `${avgCoverage.toFixed(0)}% avg`, tone: 'status-approved', icon: Link2 }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BrsrKpiTile index={1} icon={Link2} label="Mappings" value={formatNumber(mappings.length, 0)} unit="rows" trend={{ dir: 'up', text: `${mappings.length}` }} />
        <BrsrKpiTile index={2} icon={Gauge} label="Avg Coverage" value={`${avgCoverage.toFixed(0)}`} unit="%" trend={{ dir: avgCoverage >= 85 ? 'up' : 'down', text: avgCoverage >= 85 ? 'good' : 'low' }} />
        <BrsrKpiTile index={3} icon={CheckCircle2} label="Full Coverage" value={formatNumber(fullCoverage, 0)} unit="≥ 90%" trend={{ dir: 'up', text: `${fullCoverage}` }} />
        <BrsrKpiTile index={4} icon={BookOpen} label="Frameworks" value={formatNumber(4, 0)} unit="cross-mapped" trend={{ dir: 'up', text: 'all' }} />
      </div>

      <SectionCard
        icon={Link2}
        title="BRSR ↔ Framework Mapping Table"
        subtitle="Principle-level cross-mapping with coverage"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5">
            Export <ChevronRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="max-h-[460px] overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(209,250,229,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">BRSR</th>
                <th className="px-3 py-2 text-left font-semibold">GRI</th>
                <th className="px-3 py-2 text-left font-semibold">TCFD</th>
                <th className="px-3 py-2 text-left font-semibold">SDG</th>
                <th className="px-3 py-2 text-left font-semibold">SASB</th>
                <th className="px-3 py-2 text-right font-semibold">Evidence</th>
                <th className="px-3 py-2 text-left font-semibold">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m, i) => {
                const covColor = m.coverage >= 90 ? GREEN_PRIMARY : m.coverage >= 75 ? TEAL_DEEP : '#f59e0b'
                return (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-emerald-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{m.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{m.brsr}</td>
                    <td className="px-3 py-2 text-slate-700 font-mono">{m.gri}</td>
                    <td className="px-3 py-2 text-slate-700 font-mono">{m.tcfd}</td>
                    <td className="px-3 py-2 text-slate-700 font-mono">{m.sdg}</td>
                    <td className="px-3 py-2 text-slate-700 font-mono">{m.sasb}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" style={{ color: GREEN_DEEP }} />
                        {m.evidence}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${m.coverage}%`, background: `linear-gradient(90deg, ${covColor}, ${GREEN_DEEP})` }} />
                        </div>
                        <span className="status-pill text-[9px]" style={{ background: `${covColor}1a`, color: covColor, borderColor: `${covColor}33` }}>
                          {m.coverage}%
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ActivityFeedCard activities={activities} loading={activityLoading} title="Mapping Activity Feed" />
    </div>
  )
}

/* ============================================================
 * Screen 7 — Evidence & Sources (brsr-sources)
 * ============================================================ */
function SourcesScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const evidenceList = useMemo(() => {
    const seed = (k.evidenceTotal + k.evidenceVerified + k.totalSubs) || 1
    const titles = [
      'Energy bills — Plant A (Apr-Sep)',
      'Water withdrawal log — Pump house',
      'Workforce register — HR master',
      'Safety incident reports — Q1/Q2',
      'BRSR Section A — entity disclosure',
      'Supplier code of conduct — signed',
      'Whistleblower complaints register',
      'CSR project — Village water supply',
      'Waste manifests — Hazmat disposal',
      'Board composition — annual disclosure',
      'Stakeholder engagement minutes',
      'Cybersecurity policy v3.2',
    ]
    const modules = ['Energy', 'Water', 'HR', 'Safety', 'BRSR', 'Procurement', 'Governance', 'CSR', 'Waste', 'Board', 'Stakeholder', 'IT']
    const types = ['PDF', 'XLSX', 'CSV', 'Image', 'PDF', 'DOCX', 'PDF', 'PDF', 'PDF', 'PDF', 'DOCX', 'PDF']
    const statuses: Array<'Verified' | 'Submitted' | 'Draft' | 'Rejected' | 'Pending'> = ['Verified', 'Submitted', 'Draft', 'Rejected', 'Pending']
    const uploaders = ['A. Iyer', 'R. Nair', 'P. Sharma', 'S. Reddy', 'M. Patel', 'K. Rao']
    const total = Math.max(8, Math.min(12, k.evidenceTotal))
    return Array.from({ length: total }).map((_, i) => {
      const r = ((seed * (i + 7)) % 997) / 997
      const statusIdx = i < 2 ? 0 : Math.min(4, Math.floor(r * 5))
      const status = statuses[statusIdx]
      return {
        id: `EV-${(3300 + i).toString()}`,
        title: titles[i % titles.length],
        module: modules[i % modules.length],
        type: types[i % types.length],
        status,
        uploader: uploaders[i % uploaders.length],
        uploadedAt: new Date(Date.now() - i * 86400_000).toISOString(),
        size: `${Math.floor(50 + r * 950)} KB`,
      }
    })
  }, [k])

  const verified = evidenceList.filter(e => e.status === 'Verified').length
  const pending = evidenceList.filter(e => e.status === 'Submitted' || e.status === 'Pending').length
  const rejected = evidenceList.filter(e => e.status === 'Rejected').length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Database}
        title="Evidence & Sources"
        subtitle={`${evidenceList.length} items · ${verified} verified · ${k.evidenceVerified}/${k.evidenceTotal} total`}
        completionPct={k.evidenceTotal > 0 ? (k.evidenceVerified / Math.max(1, k.evidenceTotal)) * 100 : 0}
        badge={{ label: `${verified} verified`, tone: 'status-approved', icon: BadgeCheck }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BrsrKpiTile index={1} icon={Database} label="Total Items" value={formatNumber(k.evidenceTotal, 0)} unit="evidence" trend={{ dir: 'up', text: `${k.evidenceTotal}` }} />
        <BrsrKpiTile index={2} icon={BadgeCheck} label="Verified" value={formatNumber(k.evidenceVerified, 0)} unit="approved" trend={{ dir: 'up', text: `${(k.evidenceVerified / Math.max(1, k.evidenceTotal) * 100).toFixed(0)}%` }} />
        <BrsrKpiTile index={3} icon={Clock} label="Pending" value={formatNumber(pending, 0)} unit="awaiting" trend={{ dir: pending > 0 ? 'up' : 'neutral', text: pending > 0 ? `${pending}` : '0' }} />
        <BrsrKpiTile index={4} icon={XCircle} label="Rejected" value={formatNumber(rejected, 0)} unit="blocked" trend={{ dir: rejected > 0 ? 'up' : 'neutral', text: rejected > 0 ? `${rejected}` : '0' }} alert={rejected > 0} />
      </div>

      <SectionCard
        icon={Database}
        title="Evidence Vault"
        subtitle="Recent evidence uploaded across BRSR modules"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5">
            Upload <FilePlus2 className="h-3 w-3" />
          </button>
        }
      >
        <div className="space-y-2 max-h-[460px] overflow-y-auto scroll-elegant pr-1">
          {evidenceList.map((e, i) => {
            const statusColor = e.status === 'Verified' ? GREEN_PRIMARY : e.status === 'Submitted' ? TEAL_DEEP : e.status === 'Rejected' ? '#dc2626' : e.status === 'Pending' ? '#f59e0b' : '#64748b'
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
                    <Paperclip className="h-3.5 w-3.5" />
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
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50/80 text-emerald-700 border border-emerald-100">{e.module}</span>
                      <span>·</span>
                      <span>{e.size}</span>
                      <span>·</span>
                      <span>by {e.uploader}</span>
                      <span>·</span>
                      <span>{timeAgo(e.uploadedAt)}</span>
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
          title="Status Distribution"
          subtitle="Evidence verification pipeline"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Verified', value: Math.max(0.1, verified), color: GREEN_DARK },
                    { name: 'Pending', value: Math.max(0.1, pending), color: '#f59e0b' },
                    { name: 'Rejected', value: Math.max(0.1, rejected), color: '#dc2626' },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}
                >
                  {[GREEN_DARK, '#f59e0b', '#dc2626'].map((c, i) => (<Cell key={i} fill={c} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} items`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{evidenceList.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Items</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Evidence Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 8 — Validation (brsr-validation)
 * ============================================================ */
function ValidationScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const results = useMemo(() => {
    const seed = (k.openExceptions + k.anomalies + k.brsrReadiness) || 1
    const checks = [
      { id: 'VAL-001', name: 'Mandatory disclosures completeness', rule: 'BRSR Core · Required', severity: 'Critical' as const, status: k.brsrMissing > 0 ? 'Failed' : 'Passed' as 'Passed' | 'Failed', count: k.brsrMissing },
      { id: 'VAL-002', name: 'Numeric metric units validated', rule: 'Calc Engine · Units', severity: 'High' as const, status: k.openExceptions > 0 ? 'Failed' : 'Passed' as 'Passed' | 'Failed', count: k.openExceptions },
      { id: 'VAL-003', name: 'Cross-period variance tolerance ±15%', rule: 'Anomaly Engine · Variance', severity: 'Medium' as const, status: k.anomalies > 0 ? 'Failed' : 'Passed' as 'Passed' | 'Failed', count: k.anomalies },
      { id: 'VAL-004', name: 'Evidence attached for material disclosures', rule: 'Evidence Vault · Required', severity: 'Critical' as const, status: k.evidenceVerified < k.evidenceTotal ? 'Failed' : 'Passed' as 'Passed' | 'Failed', count: Math.max(0, k.evidenceTotal - k.evidenceVerified) },
      { id: 'VAL-005', name: 'Approver workflow on locked answers', rule: 'Workflow · Approval', severity: 'Medium' as const, status: 'Passed' as 'Passed' | 'Failed', count: 0 },
      { id: 'VAL-006', name: 'BRSR — GRI mapping coverage ≥ 90%', rule: 'Mapping Engine', severity: 'Low' as const, status: 'Passed' as 'Passed' | 'Failed', count: 0 },
      { id: 'VAL-007', name: 'Auditable trail for all data points', rule: 'Audit · Trail', severity: 'High' as const, status: 'Passed' as 'Passed' | 'Failed', count: 0 },
      { id: 'VAL-008', name: 'Board sign-off on Section A', rule: 'Approval · Board', severity: 'Critical' as const, status: k.brsrReadiness >= 80 ? 'Passed' : 'Failed' as 'Passed' | 'Failed', count: 0 },
    ]
    return checks
  }, [k])

  const passed = results.filter(r => r.status === 'Passed').length
  const failed = results.length - passed
  const criticalFailed = results.filter(r => r.severity === 'Critical' && r.status === 'Failed').length
  const passRate = (passed / Math.max(1, results.length)) * 100

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={ClipboardCheck}
        title="Validation Results"
        subtitle={`${results.length} checks · ${passed} passed · ${failed} failed · ${passRate.toFixed(0)}% pass rate`}
        completionPct={passRate}
        badge={{ label: `${passRate.toFixed(0)}% pass`, tone: passRate >= 85 ? 'status-approved' : 'status-warning', icon: ClipboardCheck }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BrsrKpiTile index={1} icon={ClipboardCheck} label="Total Checks" value={formatNumber(results.length, 0)} unit="rules" trend={{ dir: 'up', text: `${results.length}` }} />
        <BrsrKpiTile index={2} icon={CheckCircle2} label="Passed" value={formatNumber(passed, 0)} unit="rules" trend={{ dir: 'up', text: 'good' }} />
        <BrsrKpiTile index={3} icon={XCircle} label="Failed" value={formatNumber(failed, 0)} unit="rules" trend={{ dir: failed > 0 ? 'up' : 'neutral', text: failed > 0 ? `${failed}` : '0' }} alert={failed > 0} />
        <BrsrKpiTile index={4} icon={AlertTriangle} label="Critical Fail" value={formatNumber(criticalFailed, 0)} unit="blocking" trend={{ dir: criticalFailed > 0 ? 'up' : 'neutral', text: criticalFailed > 0 ? `${criticalFailed}` : '0' }} alert={criticalFailed > 0} />
      </div>

      <SectionCard
        icon={ClipboardCheck}
        title="Validation Check Results"
        subtitle="Rule · severity · status · failing count"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5">
            Re-run <RefreshCw className="h-3 w-3" />
          </button>
        }
      >
        <div className="space-y-2 max-h-[460px] overflow-y-auto scroll-elegant pr-1">
          {results.map((r, i) => {
            const sevColor = r.severity === 'Critical' ? '#dc2626' : r.severity === 'High' ? '#f59e0b' : r.severity === 'Medium' ? TEAL_DEEP : '#64748b'
            const statusColor = r.status === 'Passed' ? GREEN_PRIMARY : '#dc2626'
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                    style={{ background: `${sevColor}1a`, color: sevColor, border: `1px solid ${sevColor}33` }}
                  >
                    {r.status === 'Passed' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileWarning className="h-3.5 w-3.5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-900 truncate">{r.name}</span>
                      <span className="status-pill text-[9px]" style={{ background: `${sevColor}1a`, color: sevColor, borderColor: `${sevColor}33` }}>
                        {r.severity}
                      </span>
                      <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
                        {r.status}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono">{r.id}</span>
                      <span>·</span>
                      <span>{r.rule}</span>
                      {r.count > 0 && (
                        <>
                          <span>·</span>
                          <span className="font-semibold" style={{ color: '#dc2626' }}>{r.count} failing</span>
                        </>
                      )}
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
          title="Pass / Fail Distribution"
          subtitle="Validation rule outcomes"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Passed', value: Math.max(0.1, passed), color: GREEN_DARK },
                    { name: 'Failed', value: Math.max(0.1, failed), color: '#dc2626' },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}
                >
                  {[GREEN_DARK, '#dc2626'].map((c, i) => (<Cell key={i} fill={c} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} rules`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{passRate.toFixed(0)}%</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Pass Rate</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Validation Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 9 — Readiness (brsr-readiness)
 * ============================================================ */
function ReadinessScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const dims = useMemo(() => ([
    { name: 'Section A — General', score: Math.min(100, k.brsrReadiness + 8), color: GREEN_DARK, target: 95 },
    { name: 'Section B — Management', score: Math.min(100, k.brsrReadiness + 4), color: TEAL_DEEP, target: 90 },
    { name: 'Section C — Principles', score: k.brsrReadiness, color: GREEN_DEEP, target: 90 },
    { name: 'Evidence Coverage', score: k.evidenceTotal > 0 ? (k.evidenceVerified / Math.max(1, k.evidenceTotal)) * 100 : 0, color: TEAL_DARK, target: 95 },
    { name: 'Validation Pass', score: Math.max(0, 100 - k.openExceptions * 5), color: GREEN_PRIMARY, target: 90 },
    { name: 'Approval Closure', score: Math.min(100, k.completion + 5), color: GREEN_DEEP, target: 95 },
  ]), [k])

  const overall = dims.reduce((s, d) => s + d.score, 0) / dims.length
  const onTrack = dims.filter(d => d.score >= d.target * 0.85).length
  const atRisk = dims.length - onTrack
  const principles = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']
  const principleData = principles.map((p, i) => {
    const r = ((k.brsrReadiness * (i + 7)) % 997) / 997
    const score = Math.max(40, Math.min(100, k.brsrReadiness + (r * 20 - 10)))
    return { name: p, score: Math.round(score), color: [GREEN_DARK, TEAL_DEEP, GREEN_DEEP, TEAL_DARK, GREEN_PRIMARY][i % 5] }
  })

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Gauge}
        title="BRSR Readiness"
        subtitle={`${overall.toFixed(0)}% overall · ${onTrack}/${dims.length} dimensions on track`}
        completionPct={overall}
        badge={{ label: `${overall.toFixed(0)}% ready`, tone: overall >= 80 ? 'status-approved' : 'status-warning', icon: Gauge }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BrsrKpiTile index={1} icon={Gauge} label="Overall" value={`${overall.toFixed(0)}`} unit="/100" trend={{ dir: overall >= 80 ? 'up' : 'down', text: overall >= 80 ? 'good' : 'low' }} />
        <BrsrKpiTile index={2} icon={CheckCircle2} label="On Track" value={formatNumber(onTrack, 0)} unit="dimensions" trend={{ dir: 'up', text: `${onTrack}` }} />
        <BrsrKpiTile index={3} icon={AlertTriangle} label="At Risk" value={formatNumber(atRisk, 0)} unit="< 85% target" trend={{ dir: atRisk > 0 ? 'up' : 'neutral', text: atRisk > 0 ? `${atRisk}` : '0' }} alert={atRisk > 0} />
        <BrsrKpiTile index={4} icon={Clock} label="Missing" value={formatNumber(k.brsrMissing, 0)} unit="not started" trend={{ dir: k.brsrMissing > 0 ? 'up' : 'neutral', text: k.brsrMissing > 0 ? `${k.brsrMissing}` : '0' }} alert={k.brsrMissing > 0} />
      </div>

      <SectionCard
        icon={Gauge}
        title="Overall Readiness Gauge"
        subtitle="Composite BRSR readiness score"
        index={5}
      >
        <div className="relative" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="40%" outerRadius="100%" data={[{ name: 'Readiness', value: overall, fill: GREEN_DEEP }]} startAngle={90} endAngle={-270}>
              <RadialBar background dataKey="value" cornerRadius={10} isAnimationActive animationDuration={900} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Readiness']} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="tabular-nums text-4xl font-bold text-slate-900">{overall.toFixed(0)}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold">out of 100</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={Layers}
        title="Readiness by Dimension"
        subtitle="Per-dimension readiness score vs target"
        index={6}
      >
        <div className="space-y-2.5">
          {dims.map((d, i) => {
            const isOnTrack = d.score >= d.target * 0.85
            return (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <div className="text-[12px] font-semibold text-slate-900">{d.name}</div>
                    <div className="text-[9px] text-slate-700 mt-0.5">target ≥ {d.target}%</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-slate-900 tabular-nums">{d.score.toFixed(0)}%</span>
                    <span className={`status-pill text-[9px] ${isOnTrack ? 'status-approved' : 'status-warning'}`}>
                      {isOnTrack ? 'OK' : 'Risk'}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${d.score}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.04, ease: [0.22, 1, 0.36, 1] as const }}
                    style={{ background: `linear-gradient(90deg, ${d.color}, ${GREEN_DEEP})`, boxShadow: `0 0 8px -1px ${d.color}80` }}
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
          title="Principle-wise Readiness"
          subtitle="P1-P9 readiness scores"
          index={7}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={principleData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barCategoryGap="22%">
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(5,150,105,0.06)' }} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700}>
                  {principleData.map((p, i) => (<Cell key={i} fill={p.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Readiness Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 10 — Report Builder (brsr-builder)
 * ============================================================ */
function BuilderScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const sections = useMemo(() => ([
    { id: 'SEC-COVER', name: 'Cover Page & Entity Profile', included: true, ready: 100, icon: FileText, color: GREEN_DARK },
    { id: 'SEC-A', name: 'Section A — General Disclosures', included: true, ready: Math.min(100, k.brsrReadiness + 8), icon: BookOpen, color: TEAL_DEEP },
    { id: 'SEC-B', name: 'Section B — Management & Governance', included: true, ready: Math.min(100, k.brsrReadiness + 4), icon: Scale, color: GREEN_DEEP },
    { id: 'SEC-C', name: 'Section C — Principle-wise Performance', included: true, ready: k.brsrReadiness, icon: Leaf, color: TEAL_DARK },
    { id: 'SEC-CORE', name: 'BRSR Core Indicators', included: true, ready: k.brsrReadiness, icon: ShieldCheck, color: GREEN_PRIMARY },
    { id: 'SEC-MAP', name: 'Disclosure Mapping (GRI/TCFD/SDG)', included: true, ready: 95, icon: Link2, color: GREEN_DEEP },
    { id: 'SEC-EVI', name: 'Evidence Appendix', included: true, ready: k.evidenceTotal > 0 ? (k.evidenceVerified / Math.max(1, k.evidenceTotal)) * 100 : 0, icon: Database, color: GREEN_DARK },
    { id: 'SEC-ASS', name: 'Assurance Statement', included: false, ready: 0, icon: Stamp, color: '#94a3b8' },
  ]), [k])

  const included = sections.filter(s => s.included).length
  const avgReady = sections.filter(s => s.included).reduce((s, x) => s + x.ready, 0) / Math.max(1, included)
  const canGenerate = avgReady >= 85

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={FileBarChart}
        title="Report Builder"
        subtitle={`${included} sections included · ${avgReady.toFixed(0)}% avg ready · ${canGenerate ? 'ready to generate' : 'incomplete'}`}
        completionPct={avgReady}
        badge={{ label: canGenerate ? 'Ready' : 'Not Ready', tone: canGenerate ? 'status-approved' : 'status-warning', icon: FileBarChart }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BrsrKpiTile index={1} icon={FileText} label="Sections" value={formatNumber(sections.length, 0)} unit="available" trend={{ dir: 'up', text: 'all' }} />
        <BrsrKpiTile index={2} icon={CheckCircle2} label="Included" value={formatNumber(included, 0)} unit="selected" trend={{ dir: 'up', text: `${included}` }} />
        <BrsrKpiTile index={3} icon={Gauge} label="Avg Ready" value={`${avgReady.toFixed(0)}`} unit="%" trend={{ dir: avgReady >= 85 ? 'up' : 'down', text: avgReady >= 85 ? 'good' : 'low' }} />
        <BrsrKpiTile index={4} icon={Sparkles} label="Can Generate" value={canGenerate ? 'Yes' : 'No'} unit="" trend={{ dir: canGenerate ? 'up' : 'down', text: canGenerate ? 'go' : 'block', tone: canGenerate ? 'status-approved' : 'status-warning' }} alert={!canGenerate} />
      </div>

      <SectionCard
        icon={FileBarChart}
        title="Report Sections"
        subtitle="Toggle sections to include in the generated report"
        index={5}
        action={
          <button
            className="rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: `linear-gradient(135deg, ${GREEN_DEEP}, ${TEAL_DARK})`, boxShadow: `0 4px 14px -3px ${TEAL_DEEP}60` }}
            disabled={!canGenerate}
          >
            Generate <FilePlus2 className="h-3 w-3" />
          </button>
        }
      >
        <div className="space-y-2 max-h-[420px] overflow-y-auto scroll-elegant pr-1">
          {sections.map((s, i) => {
            const statusColor = s.ready >= 90 ? GREEN_PRIMARY : s.ready >= 75 ? TEAL_DEEP : s.ready >= 50 ? '#f59e0b' : '#dc2626'
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className={`glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors ${!s.included ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
                      style={{ background: `${s.color}1a`, color: s.color, border: `1px solid ${s.color}33` }}
                    >
                      <s.icon className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="text-[12px] font-semibold text-slate-900">{s.name}</div>
                      <div className="text-[9px] text-slate-700 mt-0.5">{s.id} · {s.included ? 'included' : 'excluded'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-slate-900 tabular-nums">{s.ready.toFixed(0)}%</span>
                    <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
                      {s.ready >= 90 ? 'Ready' : s.ready >= 50 ? 'Partial' : 'Not Ready'}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.ready}%`, background: `linear-gradient(90deg, ${s.color}, ${GREEN_DEEP})` }} />
                </div>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          icon={TrendingUp}
          title="Section Readiness Comparison"
          subtitle="Bar chart of readiness across report sections"
          index={6}
        >
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sections.map(s => ({ name: s.id, ready: s.ready }))} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barCategoryGap="22%">
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(5,150,105,0.06)' }} />
                <Bar dataKey="ready" fill={GREEN_DEEP} radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Builder Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 11 — Approval & Issuance (brsr-issuance)
 * ============================================================ */
function IssuanceScreen({
  k, activities, activityLoading,
}: {
  k: Kpis
  activities: ActivityItem[]
  activityLoading: boolean
}) {
  const approvals = useMemo(() => {
    const seed = (k.brsrReadiness + k.totalSubs + k.evidenceVerified) || 1
    const titles = [
      'BRSR FY26 — Cover page sign-off',
      'Section A — Entity disclosure approval',
      'Section B — Management & Governance',
      'Section C — Principle-wise performance',
      'BRSR Core — P6 Environment indicator',
      'Disclosure Mapping — GRI cross-map',
      'Assurance statement — external auditor',
      'Board chairperson final approval',
    ]
    const approvers = ['CFO', 'Company Secretary', 'CHRO', 'ESG Manager', 'Audit Committee', 'Board Chair', 'CEO', 'CFO']
    const levels: Array<'L1' | 'L2' | 'L3' | 'L4'> = ['L1', 'L2', 'L3', 'L4']
    const statuses: Array<'Pending' | 'Approved' | 'Rejected' | 'In Review'> = ['Pending', 'Approved', 'Rejected', 'In Review']
    return titles.map((t, i) => {
      const r = ((seed * (i + 11)) % 997) / 997
      const statusIdx = i < 2 ? 1 : Math.min(3, Math.floor(r * 4))
      return {
        id: `APR-${(4400 + i).toString()}`,
        title: t,
        approver: approvers[i % approvers.length],
        level: levels[Math.min(3, Math.floor(i / 2))],
        status: statuses[statusIdx],
        submittedAt: new Date(Date.now() - i * 86400_000).toISOString(),
        dueAt: new Date(Date.now() + (i + 3) * 86400_000).toISOString(),
      }
    })
  }, [k])

  const pending = approvals.filter(a => a.status === 'Pending').length
  const approved = approvals.filter(a => a.status === 'Approved').length
  const rejected = approvals.filter(a => a.status === 'Rejected').length
  const inReview = approvals.filter(a => a.status === 'In Review').length
  const overdue = approvals.filter(a => new Date(a.dueAt).getTime() < Date.now() && a.status === 'Pending').length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Stamp}
        title="Approval & Issuance"
        subtitle={`${approvals.length} approvals · ${approved} cleared · ${pending} pending · ${overdue} overdue`}
        completionPct={k.brsrReadiness}
        badge={{ label: approved === approvals.length ? 'Cleared' : 'In Queue', tone: approved === approvals.length ? 'status-approved' : 'status-warning', icon: Stamp }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BrsrKpiTile index={1} icon={Clock} label="Pending" value={formatNumber(pending, 0)} unit="awaiting" trend={{ dir: pending > 0 ? 'up' : 'neutral', text: pending > 0 ? `${pending}` : '0' }} alert={pending > 3} />
        <BrsrKpiTile index={2} icon={CheckCircle2} label="Approved" value={formatNumber(approved, 0)} unit="cleared" trend={{ dir: 'up', text: 'good' }} />
        <BrsrKpiTile index={3} icon={AlertTriangle} label="In Review" value={formatNumber(inReview, 0)} unit="underway" trend={{ dir: inReview > 0 ? 'up' : 'neutral', text: inReview > 0 ? `${inReview}` : '0' }} />
        <BrsrKpiTile index={4} icon={XCircle} label="Rejected" value={formatNumber(rejected, 0)} unit="blocked" trend={{ dir: rejected > 0 ? 'up' : 'neutral', text: rejected > 0 ? `${rejected}` : '0' }} alert={rejected > 0} />
      </div>

      <SectionCard
        icon={Stamp}
        title="Approval Queue"
        subtitle="Sequential approval workflow with approver & due date"
        index={5}
        action={
          <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-emerald-700 transition-colors inline-flex items-center gap-1.5">
            Issue <Send className="h-3 w-3" />
          </button>
        }
      >
        <div className="space-y-2 max-h-[460px] overflow-y-auto scroll-elegant pr-1">
          {approvals.map((a, i) => {
            const statusColor = a.status === 'Approved' ? GREEN_PRIMARY : a.status === 'Rejected' ? '#dc2626' : a.status === 'In Review' ? TEAL_DEEP : '#f59e0b'
            const isOverdue = new Date(a.dueAt).getTime() < Date.now() && a.status === 'Pending'
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="glass-subtle rounded-xl p-3 hover:bg-white/70 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 mt-0.5 text-[10px] font-bold"
                    style={{ background: `${statusColor}1a`, color: statusColor, border: `1px solid ${statusColor}33` }}
                  >
                    {a.level}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-900 truncate">{a.title}</span>
                      <span className="status-pill text-[9px]" style={{ background: `${statusColor}1a`, color: statusColor, borderColor: `${statusColor}33` }}>
                        {a.status}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-700 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono">{a.id}</span>
                      <span>·</span>
                      <span>{a.approver}</span>
                      <span>·</span>
                      <span>submitted {timeAgo(a.submittedAt)}</span>
                      <span>·</span>
                      <span className={isOverdue ? 'text-rose-600 font-semibold' : ''}>due {new Date(a.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{isOverdue ? ' (overdue)' : ''}</span>
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
          title="Approval Status Distribution"
          subtitle="Pending · Approved · Rejected · In Review"
          index={6}
        >
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Approved', value: Math.max(0.1, approved), color: GREEN_DARK },
                    { name: 'In Review', value: Math.max(0.1, inReview), color: TEAL_DEEP },
                    { name: 'Pending', value: Math.max(0.1, pending), color: '#f59e0b' },
                    { name: 'Rejected', value: Math.max(0.1, rejected), color: '#dc2626' },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none" isAnimationActive animationDuration={700}
                >
                  {[GREEN_DARK, TEAL_DEEP, '#f59e0b', '#dc2626'].map((c, i) => (<Cell key={i} fill={c} />))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(0)} approvals`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{approvals.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Approvals</span>
            </div>
          </div>
        </SectionCard>

        <ActivityFeedCard activities={activities} loading={activityLoading} title="Issuance Activity Feed" />
      </div>
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function BrsrWorkspace() {
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
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isBrsrActivity).slice(0, 6)
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
        icon={FileText}
        title="No BRSR data yet"
        subtitle="Set up a reporting period to populate the BRSR workspace."
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
        {activeModule === 'brsr-frameworks' && (
          <FrameworksScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'brsr-section-a' && (
          <SectionScreen k={k} activities={activities} activityLoading={activityLoading} section="A" />
        )}
        {activeModule === 'brsr-section-b' && (
          <SectionScreen k={k} activities={activities} activityLoading={activityLoading} section="B" />
        )}
        {activeModule === 'brsr-section-c' && (
          <SectionScreen k={k} activities={activities} activityLoading={activityLoading} section="C" />
        )}
        {activeModule === 'brsr-core' && (
          <CoreScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'brsr-mapping' && (
          <MappingScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'brsr-sources' && (
          <SourcesScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'brsr-validation' && (
          <ValidationScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'brsr-readiness' && (
          <ReadinessScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'brsr-builder' && (
          <BuilderScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
        {activeModule === 'brsr-issuance' && (
          <IssuanceScreen k={k} activities={activities} activityLoading={activityLoading} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
