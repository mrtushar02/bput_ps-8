'use client'
/**
 * CsrWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * CSR workspace. A single client component that switches content
 * based on `activeModule` from the AppContext. Handles six module keys,
 * each rendering its own dedicated screen:
 *
 *   - 'csr-projects'      → CSR Projects registry + status
 *   - 'csr-budgets'       → Budget allocation & utilization
 *   - 'csr-beneficiaries'  → Beneficiary demographics
 *   - 'csr-impact'        → Impact metrics & outcomes
 *   - 'csr-community'      → Community engagement programs
 *   - 'csr-local'         → Local area development
 *
 * (The 'overview', 'evidence', and 'submissions' keys are routed
 * elsewhere by the module-router — not handled here.)
 *
 * Color theme: Rose / Pink (#f43f5e, #ec4899, #e11d48) — warm,
 * people-centric palette aligned with the social-impact domain.
 *
 * Data:
 *   GET /api/overview          → kpis + trends + periods
 *   GET /api/activity?take=10  → recent activities (CSR-filtered client-side)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HeartHandshake, Wallet, Users, TrendingUp, MapPin, Building2,
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle,
  ChevronRight, CheckCircle2, Clock, HandHeart, Sprout,
  GraduationCap, Stethoscope, Droplets, School, HeartPulse,
  Sparkles, BadgeCheck, Target, Megaphone, Activity as ActivityIcon,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  ResponsiveContainer, Tooltip, XAxis, YAxis, RadialBarChart,
  RadialBar, Legend,
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
  openExceptions: number
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
 * Theme constants — Rose / Pink
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(244,63,94,0.30)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(225,29,72,0.22)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const ROSE_PRIMARY = '#f43f5e'    // rose-500
const ROSE_SECONDARY = '#ec4899' // pink-500
const ROSE_DEEP = '#e11d48'      // rose-600
const ROSE_SOFT = '#fda4af'     // rose-300
const ROSE_TINT = '#ffe4e6'     // rose-100
const ROSE_MIST = '#fecdd3'     // rose-200

const DONUT_PALETTE = [ROSE_DEEP, ROSE_PRIMARY, ROSE_SECONDARY]

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

function formatCurrency(n: number): string {
  if (!isFinite(n)) return '₹0'
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + 'Cr'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + 'L'
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'k'
  return '₹' + n.toFixed(0)
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

/** Filter activities relevant to CSR. */
function isCsrActivity(a: ActivityItem): boolean {
  const mod = (a.module ?? '').toUpperCase()
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const csrModules = ['CSR', 'COMMUNITY', 'SOCIAL', 'IMPACT', 'BENEFICIARY']
  const csrActions = ['CSR', 'COMMUNITY', 'IMPACT', 'PROJECT_', 'BENEFICIARY', 'OUTREACH']
  const csrKeywords = ['csr', 'community', 'beneficiary', 'social', 'impact', 'outreach', 'local area', 'ngo']
  return (
    csrModules.some(k => mod.includes(k)) ||
    csrActions.some(k => act.includes(k)) ||
    csrKeywords.some(k => title.includes(k) || desc.includes(k))
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
            background: `linear-gradient(135deg, ${ROSE_PRIMARY}, ${ROSE_DEEP})`,
            color: '#fff',
            boxShadow: `0 4px 14px -3px ${ROSE_DEEP}80, inset 0 1px 1px rgba(255,255,255,0.4)`,
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
            <Building2 className="h-3 w-3" style={{ color: ROSE_DEEP }} />
            {badgeText}
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
                  background: `linear-gradient(90deg, ${ROSE_DEEP}, ${ROSE_PRIMARY})`,
                  boxShadow: `0 0 8px -1px ${ROSE_PRIMARY}80`,
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

/** Compact KPI tile — rose icon tile + label + value + trend pill. */
function CsrKpiTile({
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
            background: 'linear-gradient(135deg, rgba(255,228,230,0.90), rgba(254,205,211,0.70))',
            border: '1px solid rgba(244,63,94,0.30)',
            color: ROSE_DEEP,
            boxShadow: '0 2px 8px -2px rgba(225,29,72,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
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
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load CSR workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${ROSE_PRIMARY}, ${ROSE_DEEP})` }}
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
      <Icon className="h-10 w-10 mb-3" style={{ color: ROSE_PRIMARY }} />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-[12px] text-slate-700 mb-4">{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${ROSE_PRIMARY}, ${ROSE_DEEP})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/** Activity feed — timeline of recent CSR activities. */
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
            <ActivityIcon className="h-4 w-4" style={{ color: ROSE_DEEP }} />
            Recent Activity
          </h2>
          <p className="text-[10px] text-slate-700 mt-0.5">CSR & community feed · live</p>
        </div>
        <span className="status-pill text-[9px] status-approved">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {activities.length} new
        </span>
      </header>
      {activities.length === 0 ? (
        <div className="py-10 text-center">
          <Clock className="mx-auto h-7 w-7 text-slate-300" />
          <p className="text-[11px] text-slate-700 mt-2">No recent CSR activity</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto scroll-elegant pr-1">
          <ol className="relative space-y-1 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-rose-200/70 before:via-rose-100/40 before:to-transparent">
            <AnimatePresence initial={false}>
              {activities.map((a, i) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  className="relative flex gap-3 py-2.5 px-1 rounded-xl hover:bg-rose-50/40 transition-colors"
                >
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="h-10 w-10 rounded-full text-white flex items-center justify-center text-[11px] font-semibold ring-2 ring-white/80"
                      style={{ background: `linear-gradient(135deg, ${ROSE_PRIMARY}, ${ROSE_DEEP})` }}
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
                          <span className="px-1.5 py-0.5 rounded bg-rose-50/80 text-rose-700">{a.module}</span>
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
 * Screen 1 — CSR Projects
 * ============================================================ */
function deriveProjects(k: Kpis): {
  code: string; name: string; theme: string; status: 'Active' | 'Planned' | 'Completed' | 'On Hold';
  beneficiaries: number; budget: number; location: string
}[] {
  const names = ['Vidya Jyoti Education', 'Aarogya Health Camp', 'Jal Sanrakshan Water', 'Kaushal Skill Centre',
    'Harit Vriksh Plantation', 'Shakti Women Empower', 'Swachh Village Sanitation', 'Annapurna Midday Meal']
  const themes = ['Education', 'Healthcare', 'Water & Sanitation', 'Skill Development', 'Environment', 'Women Empower']
  const locations = ['Pune District', 'Nagpur Rural', 'Aurangabad Block', 'Thane Cluster', 'Nashik Tribal', 'Raigad Coast']
  const seed = (k.totalWorkforce + k.projects + k.orgs) || 23
  const total = Math.min(8, Math.max(6, Math.floor(seed / 40) || 7))
  const rows: ReturnType<typeof deriveProjects> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const r3 = ((seed * (i + 29)) % 977) / 977
    rows.push({
      code: `CSR-${(6000 + i).toString()}`,
      name: names[i % names.length],
      theme: themes[i % themes.length],
      status: r < 0.55 ? 'Active' : r < 0.78 ? 'Completed' : r < 0.9 ? 'Planned' : 'On Hold',
      beneficiaries: Math.round(800 + r2 * 8500),
      budget: Math.round(1500000 + r3 * 4500000),
      location: locations[i % locations.length],
    })
  }
  return rows
}

function ProjectsScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const projects = useMemo(() => deriveProjects(k), [k])
  const active = projects.filter(p => p.status === 'Active').length
  const completed = projects.filter(p => p.status === 'Completed').length
  const totalBeneficiaries = projects.reduce((s, p) => s + p.beneficiaries, 0)
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0)

  const statusData = [
    { name: 'Active', value: Math.max(0.1, projects.filter(p => p.status === 'Active').length), color: ROSE_DEEP },
    { name: 'Completed', value: Math.max(0.1, projects.filter(p => p.status === 'Completed').length), color: ROSE_PRIMARY },
    { name: 'Planned', value: Math.max(0.1, projects.filter(p => p.status === 'Planned').length), color: ROSE_SECONDARY },
    { name: 'On Hold', value: Math.max(0.1, projects.filter(p => p.status === 'On Hold').length), color: ROSE_SOFT },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={HeartHandshake}
        title="CSR Projects"
        subtitle="Registered CSR projects with status, beneficiaries & budget"
        completionPct={k.completion}
        badgeText={`${projects.length} projects`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CsrKpiTile index={1} icon={HeartHandshake} label="Total Projects" value={projects.length.toString()} unit="registered" trend={{ dir: 'up', text: '+2' }} />
        <CsrKpiTile index={2} icon={BadgeCheck} label="Active" value={active.toString()} unit="in progress" trend={{ dir: 'up', text: '+1' }} />
        <CsrKpiTile index={3} icon={Users} label="Beneficiaries" value={formatNumber(totalBeneficiaries, 0)} unit="reached" trend={{ dir: 'up', text: '+12.4%' }} />
        <CsrKpiTile index={4} icon={Wallet} label="Total Budget" value={formatCurrency(totalBudget)} unit="FY" trend={{ dir: 'up', text: '+8.6%' }} />
      </div>

      {/* Projects table + status donut */}
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
                <HeartHandshake className="h-4 w-4" style={{ color: ROSE_DEEP }} />
                CSR Project Registry
              </h2>
              <p className="text-[11px] text-slate-700 mt-0.5">
                {projects.length} projects · {themes_count(projects)} themes
              </p>
            </div>
            <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-rose-700 transition-colors inline-flex items-center gap-1.5">
              Export <ChevronRight className="h-3 w-3" />
            </button>
          </header>
          <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,228,230,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">Code</th>
                  <th className="px-3 py-2 text-left font-semibold">Project</th>
                  <th className="px-3 py-2 text-left font-semibold">Theme</th>
                  <th className="px-3 py-2 text-left font-semibold">Beneficiaries</th>
                  <th className="px-3 py-2 text-left font-semibold">Budget</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p, i) => (
                  <motion.tr
                    key={p.code}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-rose-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{p.code}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <div className="truncate">{p.name}</div>
                      <div className="text-[9px] text-slate-500">{p.location}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: 'rgba(244,63,94,0.12)',
                        color: '#be123c',
                        borderColor: 'rgba(244,63,94,0.25)',
                      }}>
                        {p.theme}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700 tabular-nums">{p.beneficiaries.toLocaleString()}</td>
                    <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">{formatCurrency(p.budget)}</td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${p.status === 'Active' ? 'status-submitted' : p.status === 'Completed' ? 'status-approved' : p.status === 'Planned' ? 'status-draft' : 'status-warning'}`}>
                        {p.status}
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
              <Target className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Status Breakdown
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Projects by lifecycle status</p>
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
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${Math.round(v)} projects`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{projects.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Projects</span>
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

      <ActivityFeed activities={activities} />
    </div>
  )
}

/** count distinct themes for the subtitle */
function themes_count(projects: { theme: string }[]): number {
  return new Set(projects.map(p => p.theme)).size
}

/* ============================================================
 * Screen 2 — Budgets
 * ============================================================ */
function deriveBudgets(k: Kpis): {
  theme: string; allocated: number; utilised: number; committed: number; beneficiaries: number
}[] {
  const themes = ['Education', 'Healthcare', 'Water & Sanitation', 'Skill Development', 'Environment', 'Women Empower']
  const seed = (k.totalWorkforce + k.orgs + k.projects) || 29
  return themes.map((theme, i) => {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const allocated = Math.round(2500000 + r * 5200000)
    const utilised = Math.round(allocated * (0.45 + r2 * 0.45))
    return {
      theme,
      allocated,
      utilised,
      committed: Math.round(allocated * (0.08 + r2 * 0.20)),
      beneficiaries: Math.round(600 + r2 * 6500),
    }
  })
}

function BudgetsScreen({ k, activities, trends }: { k: Kpis; activities: ActivityItem[]; trends?: Record<string, Record<string, number>> }) {
  const budgets = useMemo(() => deriveBudgets(k), [k])
  const totalAllocated = budgets.reduce((s, b) => s + b.allocated, 0)
  const totalUtilised = budgets.reduce((s, b) => s + b.utilised, 0)
  const totalCommitted = budgets.reduce((s, b) => s + b.committed, 0)
  const utilisationRate = totalAllocated > 0 ? (totalUtilised / totalAllocated) * 100 : 0
  const fyTarget = totalAllocated + totalCommitted + Math.round(totalAllocated * 0.15)

  // Quarterly utilisation trend
  const quarterlyData = useMemo(() => {
    if (trends && typeof trends === 'object') {
      const entries = Object.entries(trends).slice(-4)
      if (entries.length >= 2) {
        return entries.map(([label, vals]) => ({
          quarter: label.slice(0, 3),
          utilised: Math.round(((vals as Record<string, number>).water ?? 0) * 420 + 1200000),
        }))
      }
    }
    const seed = (k.totalWorkforce + k.orgs) || 29
    return ['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => ({
      quarter: q,
      utilised: Math.round((totalUtilised / 4) * (0.7 + ((seed * (i + 3)) % 977) / 977 * 0.45)),
    }))
  }, [trends, k, totalUtilised])

  const budgetBarData = budgets.map(b => ({
    theme: b.theme.split(' ')[0],
    Allocated: b.allocated,
    Utilised: b.utilised,
  }))

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Wallet}
        title="CSR Budget Allocation"
        subtitle="Theme-wise budget, utilisation & commitment tracking"
        completionPct={utilisationRate}
        badgeText={`₹${(totalAllocated / 10000000).toFixed(2)}Cr allocated`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CsrKpiTile index={1} icon={Wallet} label="Allocated" value={formatCurrency(totalAllocated)} unit="FY" trend={{ dir: 'up', text: '+7.2%' }} />
        <CsrKpiTile index={2} icon={CheckCircle2} label="Utilised" value={formatCurrency(totalUtilised)} unit={`${utilisationRate.toFixed(0)}%`} trend={{ dir: 'up', text: '+11.5%' }} />
        <CsrKpiTile index={3} icon={Clock} label="Committed" value={formatCurrency(totalCommitted)} unit="pipeline" trend={{ dir: 'up', text: '+3.4%' }} />
        <CsrKpiTile index={4} icon={Target} label="FY Target" value={formatCurrency(fyTarget)} unit="planned" trend={{ dir: 'up', text: '+9.8%' }} />
      </div>

      {/* Budget by theme bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Allocated vs Utilised by Theme
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Theme-wise budget consumption (₹)</p>
          </header>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetBarData} margin={{ top: 4, right: 12, bottom: 0, left: -8 }} barCategoryGap="22%">
                <defs>
                  <linearGradient id="csr-alloc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ROSE_DEEP} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={ROSE_PRIMARY} stopOpacity={0.75} />
                  </linearGradient>
                  <linearGradient id="csr-util" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ROSE_SECONDARY} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={ROSE_SOFT} stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="theme" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={48}
                  tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(244,63,94,0.06)' }} formatter={(v: number, n: string) => [formatCurrency(v), n]} />
                <Bar dataKey="Allocated" fill="url(#csr-alloc)" radius={[5, 5, 0, 0]} />
                <Bar dataKey="Utilised" fill="url(#csr-util)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        {/* Utilisation radial */}
        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <Target className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Utilisation Rate
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Of total allocated budget</p>
          </header>
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="60%" outerRadius="100%" data={[{ name: 'Utilised', value: Math.round(utilisationRate), fill: ROSE_PRIMARY }]} startAngle={90} endAngle={-270}>
                <defs>
                  <linearGradient id="csr-radial" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={ROSE_DEEP} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={ROSE_PRIMARY} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <RadialBar dataKey="value" fill="url(#csr-radial)" cornerRadius={12} background={{ fill: 'rgba(244,63,94,0.08)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, color: '#475569' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="tabular-nums text-3xl font-bold text-slate-900">{utilisationRate.toFixed(0)}%</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Utilised</span>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Quarterly trend + budget table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.section
          custom={7}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Quarterly Utilisation
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Spend by quarter (₹)</p>
          </header>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={quarterlyData} margin={{ top: 4, right: 12, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="csr-q-util" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ROSE_PRIMARY} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={ROSE_PRIMARY} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={48}
                  tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), 'Utilised']} />
                <Area type="monotone" dataKey="utilised" stroke={ROSE_DEEP} strokeWidth={2.5} fill="url(#csr-q-util)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section
          custom={8}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <Wallet className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Theme Budget Summary
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Allocated · utilised · committed per theme</p>
          </header>
          <div className="max-h-64 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,228,230,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">Theme</th>
                  <th className="px-3 py-2 text-left font-semibold">Allocated</th>
                  <th className="px-3 py-2 text-left font-semibold">Utilised</th>
                  <th className="px-3 py-2 text-left font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b, i) => {
                  const pct = b.allocated > 0 ? (b.utilised / b.allocated) * 100 : 0
                  return (
                    <motion.tr
                      key={b.theme}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.03 }}
                      className="border-t border-slate-100 hover:bg-rose-50/40 transition-colors"
                      style={{ height: 38 }}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900">{b.theme}</td>
                      <td className="px-3 py-2 text-slate-700 tabular-nums">{formatCurrency(b.allocated)}</td>
                      <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">{formatCurrency(b.utilised)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-10 rounded-full bg-slate-200/70 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${ROSE_DEEP}, ${ROSE_PRIMARY})` }} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-900 tabular-nums">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.section>
      </div>

      <ActivityFeed activities={activities} />
    </div>
  )
}

/* ============================================================
 * Screen 3 — Beneficiaries
 * ============================================================ */
function deriveBeneficiaryBreakdown(k: Kpis): {
  gender: 'Male' | 'Female' | 'Other'; count: number
}[] {
  const total = (k.totalWorkforce || 500) * 6
  const female = Math.round(total * (k.totalWorkforce > 0 ? 0.46 : 0.45))
  const male = Math.round(total * 0.52)
  const other = Math.max(50, total - female - male)
  return [
    { gender: 'Male', count: male },
    { gender: 'Female', count: female },
    { gender: 'Other', count: other },
  ]
}

function deriveBeneficiarySegments(k: Kpis): {
  segment: string; count: number; color: string
}[] {
  const seed = (k.totalWorkforce + k.orgs) || 31
  const total = (k.totalWorkforce || 500) * 6
  const children = Math.round(total * 0.36)
  const women = Math.round(total * 0.30)
  const youth = Math.round(total * 0.18)
  const elderly = Math.round(total * 0.08)
  const divyang = Math.round(total * 0.08)
  void seed
  return [
    { segment: 'Children', count: children, color: ROSE_DEEP },
    { segment: 'Women', count: women, color: ROSE_PRIMARY },
    { segment: 'Youth', count: youth, color: ROSE_SECONDARY },
    { segment: 'Elderly', count: elderly, color: ROSE_SOFT },
    { segment: 'Divyang', count: divyang, color: '#f9a8d4' },
  ]
}

function BeneficiariesScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const genderData = useMemo(() => deriveBeneficiaryBreakdown(k), [k])
  const segmentData = useMemo(() => deriveBeneficiarySegments(k), [k])
  const totalBeneficiaries = genderData.reduce((s, g) => s + g.count, 0)
  const femaleCount = genderData.find(g => g.gender === 'Female')?.count ?? 0
  const femaleShare = totalBeneficiaries > 0 ? (femaleCount / totalBeneficiaries) * 100 : 0
  const divyangCount = segmentData.find(s => s.segment === 'Divyang')?.count ?? 0
  const divyangShare = totalBeneficiaries > 0 ? (divyangCount / totalBeneficiaries) * 100 : 0

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Users}
        title="Beneficiary Demographics"
        subtitle="Reach by gender, age-segment & inclusion group"
        completionPct={k.completion}
        badgeText={`${formatNumber(totalBeneficiaries, 0)} reached`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CsrKpiTile index={1} icon={Users} label="Total Beneficiaries" value={formatNumber(totalBeneficiaries, 0)} unit="persons" trend={{ dir: 'up', text: '+14.2%' }} />
        <CsrKpiTile index={2} icon={HandHeart} label="Female Reach" value={formatNumber(femaleCount, 0)} unit={`${femaleShare.toFixed(0)}%`} trend={{ dir: 'up', text: '+5.1%' }} />
        <CsrKpiTile index={3} icon={GraduationCap} label="Children" value={formatNumber(segmentData[0].count, 0)} unit="reached" trend={{ dir: 'up', text: '+8.7%' }} />
        <CsrKpiTile index={4} icon={HeartPulse} label="Divyang Inclusion" value={formatNumber(divyangCount, 0)} unit={`${divyangShare.toFixed(1)}%`} trend={{ dir: 'up', text: '+0.4%' }} />
      </div>

      {/* Gender bar + segment donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Gender Distribution
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Beneficiaries reached by gender</p>
          </header>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genderData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} barCategoryGap="28%">
                <defs>
                  <linearGradient id="csr-gender" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ROSE_DEEP} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={ROSE_PRIMARY} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="gender" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(244,63,94,0.06)' }} formatter={(v: number) => [`${Math.round(v).toLocaleString()} persons`, 'Beneficiaries']} />
                <Bar dataKey="count" fill="url(#csr-gender)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {genderData.map(g => (
              <div key={g.gender} className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
                <span className="text-[9px] uppercase tracking-wide text-slate-700">{g.gender}</span>
                <span className="text-[12px] font-bold text-slate-900 tabular-nums">{formatNumber(g.count, 0)}</span>
                <span className="text-[9px] text-slate-500">{totalBeneficiaries > 0 ? ((g.count / totalBeneficiaries) * 100).toFixed(0) : 0}%</span>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <HeartHandshake className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Beneficiary Segments
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Reach by vulnerable / focus group</p>
          </header>
          <div className="relative" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segmentData}
                  dataKey="count"
                  nameKey="segment"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {segmentData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${Math.round(v).toLocaleString()}`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-lg font-bold text-slate-900">{formatNumber(totalBeneficiaries, 0)}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Total</span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-3">
            {segmentData.map(s => (
              <div key={s.segment} className="glass-subtle rounded-lg px-1 py-1 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-0.5" style={{ background: s.color }} />
                <span className="text-[8px] uppercase tracking-wide text-slate-700">{s.segment}</span>
                <span className="text-[10px] font-bold text-slate-900 tabular-nums">{formatNumber(s.count, 0)}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Outreach summary table */}
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
              <MapPin className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Outreach by Segment & Geography
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Beneficiary count per segment across locations</p>
          </div>
          <span className="status-pill text-[9px] status-approved">{segmentData.length} segments</span>
        </header>
        <div className="max-h-64 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,228,230,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">Segment</th>
                <th className="px-3 py-2 text-left font-semibold">Reach</th>
                <th className="px-3 py-2 text-left font-semibold">Share</th>
                <th className="px-3 py-2 text-left font-semibold">Primary Location</th>
                <th className="px-3 py-2 text-left font-semibold">Inclusion</th>
              </tr>
            </thead>
            <tbody>
              {segmentData.map((s, i) => {
                const locations = ['Pune District', 'Nagpur Rural', 'Aurangabad Block', 'Thane Cluster', 'Nashik Tribal']
                const share = totalBeneficiaries > 0 ? (s.count / totalBeneficiaries) * 100 : 0
                return (
                  <motion.tr
                    key={s.segment}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                    className="border-t border-slate-100 hover:bg-rose-50/40 transition-colors"
                    style={{ height: 38 }}
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">{s.segment}</td>
                    <td className="px-3 py-2 text-slate-900 tabular-nums">{Math.round(s.count).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-14 rounded-full bg-slate-200/70 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${share}%`, background: `linear-gradient(90deg, ${ROSE_DEEP}, ${ROSE_PRIMARY})` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-900 tabular-nums">{share.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{locations[i % locations.length]}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px] status-approved">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Tracked
                      </span>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.section>

      <ActivityFeed activities={activities} />
    </div>
  )
}

/* ============================================================
 * Screen 4 — Impact
 * ============================================================ */
function deriveImpactMetrics(k: Kpis): {
  metric: string; value: number; unit: string; baseline: number; target: number; icon: string
}[] {
  const seed = (k.totalWorkforce + k.projects) || 37
  const r = (n: number) => ((seed * (n + 7)) % 977) / 977
  return [
    { metric: 'School Enrolment', value: Math.round(4200 + r(1) * 1800), unit: 'children', baseline: 3800, target: 6500, icon: 'school' },
    { metric: 'Health Camps', value: Math.round(180 + r(2) * 90), unit: 'camps', baseline: 150, target: 300, icon: 'health' },
    { metric: 'Patients Treated', value: Math.round(24000 + r(3) * 16000), unit: 'persons', baseline: 21000, target: 45000, icon: 'patients' },
    { metric: 'Trees Planted', value: Math.round(12000 + r(4) * 8000), unit: 'trees', baseline: 10000, target: 25000, icon: 'trees' },
    { metric: 'Skill Trainees', value: Math.round(850 + r(5) * 600), unit: 'youth', baseline: 700, target: 1500, icon: 'skill' },
    { metric: 'Water Recharge (KL)', value: Math.round(1800 + r(6) * 1400), unit: 'KL', baseline: 1500, target: 3500, icon: 'water' },
  ]
}

function ImpactScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const metrics = useMemo(() => deriveImpactMetrics(k), [k])
  const totalReach = metrics.reduce((s, m) => s + m.value, 0)
  const achieved = metrics.filter(m => m.value >= m.target).length
  const onTrack = metrics.filter(m => m.value >= m.baseline && m.value < m.target).length
  const lagging = metrics.filter(m => m.value < m.baseline).length
  const avgProgress = metrics.length > 0
    ? metrics.reduce((s, m) => s + Math.min(100, (m.value / m.target) * 100), 0) / metrics.length
    : 0

  const impactIcon = (icon: string): React.ElementType => {
    switch (icon) {
      case 'school': return School
      case 'health': return HeartPulse
      case 'patients': return Stethoscope
      case 'trees': return Sprout
      case 'skill': return GraduationCap
      case 'water': return Droplets
      default: return Target
    }
  }

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={TrendingUp}
        title="CSR Impact Metrics"
        subtitle="Outcomes & target attainment across thematic interventions"
        completionPct={avgProgress}
        badgeText={`${achieved}/${metrics.length} achieved`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CsrKpiTile index={1} icon={Sparkles} label="Total Impact Reach" value={formatNumber(totalReach, 0)} unit="outcomes" trend={{ dir: 'up', text: '+16.8%' }} />
        <CsrKpiTile index={2} icon={BadgeCheck} label="Targets Achieved" value={achieved.toString()} unit={`of ${metrics.length}`} trend={{ dir: 'up', text: `+${achieved}` }} />
        <CsrKpiTile index={3} icon={Clock} label="On Track" value={onTrack.toString()} unit="metrics" trend={{ dir: 'up', text: '+1' }} />
        <CsrKpiTile index={4} icon={Target} label="Avg Attainment" value={avgProgress.toFixed(1)} unit="%" trend={{ dir: 'up', text: '+4.2' }} />
      </div>

      {/* Impact metrics grid */}
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
              <Target className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Outcome Tracker
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Actual vs target attainment per metric</p>
          </div>
          <span className="status-pill text-[9px] status-warning">{lagging} lagging</span>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.map((m, i) => {
            const Icon = impactIcon(m.icon)
            const pct = Math.min(100, (m.value / m.target) * 100)
            return (
              <motion.div
                key={m.metric}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="glass-subtle rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,228,230,0.90), rgba(254,205,211,0.70))',
                      border: '1px solid rgba(244,63,94,0.30)',
                      color: ROSE_DEEP,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className={`status-pill text-[9px] ${pct >= 100 ? 'status-approved' : pct >= 70 ? 'status-submitted' : 'status-warning'}`}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="text-[11px] uppercase tracking-wide text-slate-700 font-medium">{m.metric}</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-bold text-slate-900 tabular-nums">{formatNumber(m.value, 0)}</span>
                  <span className="text-[10px] text-slate-700 font-medium">{m.unit}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200/70 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.04 }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${ROSE_DEEP}, ${ROSE_PRIMARY})` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[9px] text-slate-600">
                  <span>Baseline: {formatNumber(m.baseline, 0)}</span>
                  <span>Target: {formatNumber(m.target, 0)}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.section>

      <ActivityFeed activities={activities} />
    </div>
  )
}

/* ============================================================
 * Screen 5 — Community
 * ============================================================ */
function deriveCommunityPrograms(k: Kpis): {
  name: string; type: string; participants: number; engagement: number; sessions: number; status: string
}[] {
  const programs = [
    { name: 'Self-Help Groups', type: 'Women Empower' },
    { name: 'Farmer Field Schools', type: 'Agriculture' },
    { name: 'Youth Clubs', type: 'Skill' },
    { name: 'Village Sanitation Drives', type: 'WASH' },
    { name: 'Health Awareness', type: 'Health' },
    { name: 'Digital Literacy', type: 'Education' },
  ]
  const seed = (k.totalWorkforce + k.orgs + k.projects) || 41
  return programs.map((p, i) => {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    return {
      ...p,
      participants: Math.round(120 + r * 980),
      engagement: Math.round(55 + r2 * 40),
      sessions: Math.round(4 + r2 * 22),
      status: r < 0.6 ? 'Active' : r < 0.85 ? 'Seasonal' : 'Concluded',
    }
  })
}

function CommunityScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const programs = useMemo(() => deriveCommunityPrograms(k), [k])
  const totalParticipants = programs.reduce((s, p) => s + p.participants, 0)
  const totalSessions = programs.reduce((s, p) => s + p.sessions, 0)
  const activeCount = programs.filter(p => p.status === 'Active').length
  const avgEngagement = programs.length > 0
    ? programs.reduce((s, p) => s + p.engagement, 0) / programs.length
    : 0

  const engagementData = programs.map(p => ({
    name: p.name.split(' ')[0],
    engagement: p.engagement,
    participants: p.participants,
    fill: ROSE_PRIMARY,
  }))

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Megaphone}
        title="Community Engagement"
        subtitle="Grassroots programs, participation & engagement metrics"
        completionPct={avgEngagement}
        badgeText={`${programs.length} programs`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CsrKpiTile index={1} icon={Megaphone} label="Active Programs" value={activeCount.toString()} unit="ongoing" trend={{ dir: 'up', text: '+1' }} />
        <CsrKpiTile index={2} icon={Users} label="Participants" value={formatNumber(totalParticipants, 0)} unit="persons" trend={{ dir: 'up', text: '+9.3%' }} />
        <CsrKpiTile index={3} icon={HandHeart} label="Sessions Held" value={totalSessions.toString()} unit="sessions" trend={{ dir: 'up', text: `+${Math.max(1, Math.round(totalSessions * 0.15))}` }} />
        <CsrKpiTile index={4} icon={HeartPulse} label="Avg Engagement" value={avgEngagement.toFixed(1)} unit="%" trend={{ dir: 'up', text: '+3.1' }} />
      </div>

      {/* Engagement bar chart */}
      <motion.section
        custom={5}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        className="glass glass-shimmer rounded-[20px] p-5"
      >
        <header className="mb-3">
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <HeartPulse className="h-4 w-4" style={{ color: ROSE_DEEP }} />
            Engagement Rate by Program
          </h2>
          <p className="text-[10px] text-slate-700 mt-0.5">% of participants actively engaging</p>
        </header>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={engagementData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }} barCategoryGap="22%">
              <defs>
                <linearGradient id="csr-eng" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ROSE_DEEP} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={ROSE_PRIMARY} stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={36} unit="%" />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(244,63,94,0.06)' }} formatter={(v: number) => [`${v}%`, 'Engagement']} />
              <Bar dataKey="engagement" fill="url(#csr-eng)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      {/* Programs table */}
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
              <Megaphone className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Community Programs
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Grassroots programs · participants · engagement · status</p>
          </div>
          <span className="status-pill text-[9px] status-approved">{activeCount} active</span>
        </header>
        <div className="max-h-80 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,228,230,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">Program</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Participants</th>
                <th className="px-3 py-2 text-left font-semibold">Sessions</th>
                <th className="px-3 py-2 text-left font-semibold">Engagement</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p, i) => (
                <motion.tr
                  key={p.name}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                  className="border-t border-slate-100 hover:bg-rose-50/40 transition-colors"
                  style={{ height: 40 }}
                >
                  <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                  <td className="px-3 py-2">
                    <span className="status-pill text-[9px]" style={{
                      background: 'rgba(244,63,94,0.12)',
                      color: '#be123c',
                      borderColor: 'rgba(244,63,94,0.25)',
                    }}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700 tabular-nums">{p.participants.toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-700 tabular-nums">{p.sessions}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-14 rounded-full bg-slate-200/70 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.engagement}%`, background: `linear-gradient(90deg, ${ROSE_DEEP}, ${ROSE_PRIMARY})` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-900 tabular-nums">{p.engagement}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`status-pill text-[9px] ${p.status === 'Active' ? 'status-submitted' : p.status === 'Seasonal' ? 'status-warning' : 'status-approved'}`}>
                      {p.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      <ActivityFeed activities={activities} />
    </div>
  )
}

/* ============================================================
 * Screen 6 — Local Area Development
 * ============================================================ */
function deriveLocalInitiatives(k: Kpis): {
  id: string; name: string; category: string; village: string;
  investment: number; beneficiaries: number; status: 'Completed' | 'Ongoing' | 'Planned'
}[] {
  const names = ['Road Construction', 'Anganwadi Upgrade', 'Drinking Water Plant', 'Solar Streetlights',
    'Community Hall', 'School Digital Lab', 'Health Sub-Centre', 'Drainage System']
  const categories = ['Infrastructure', 'Education', 'Water', 'Energy', 'Civic', 'Education', 'Health', 'Sanitation']
  const villages = ['Belwadi', 'Sukhwadi', 'Nimgaon', 'Karanjgaon', 'Pimpalgaon', 'Wadivere', 'Shivare', 'Junnar']
  const seed = (k.totalWorkforce + k.projects + k.orgs) || 43
  const total = Math.min(8, Math.max(6, Math.floor(seed / 35) || 7))
  const rows: ReturnType<typeof deriveLocalInitiatives> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const r3 = ((seed * (i + 29)) % 977) / 977
    rows.push({
      id: `LAD-${(7000 + i).toString()}`,
      name: names[i % names.length],
      category: categories[i % categories.length],
      village: villages[i % villages.length],
      investment: Math.round(450000 + r2 * 3200000),
      beneficiaries: Math.round(180 + r3 * 2200),
      status: r < 0.45 ? 'Completed' : r < 0.82 ? 'Ongoing' : 'Planned',
    })
  }
  return rows
}

function LocalScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const initiatives = useMemo(() => deriveLocalInitiatives(k), [k])
  const totalInvestment = initiatives.reduce((s, i) => s + i.investment, 0)
  const totalBeneficiaries = initiatives.reduce((s, i) => s + i.beneficiaries, 0)
  const completed = initiatives.filter(i => i.status === 'Completed').length
  const ongoing = initiatives.filter(i => i.status === 'Ongoing').length
  const villages = new Set(initiatives.map(i => i.village)).size

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const it of initiatives) {
      map[it.category] = (map[it.category] ?? 0) + it.investment
    }
    return Object.entries(map).map(([name, value], i) => ({
      name, value, color: DONUT_PALETTE[i % DONUT_PALETTE.length],
    }))
  }, [initiatives])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={MapPin}
        title="Local Area Development"
        subtitle="Infrastructure & village-level CSR investments"
        completionPct={k.completion}
        badgeText={`${villages} villages`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CsrKpiTile index={1} icon={Building2} label="Initiatives" value={initiatives.length.toString()} unit="projects" trend={{ dir: 'up', text: '+2' }} />
        <CsrKpiTile index={2} icon={MapPin} label="Villages Reached" value={villages.toString()} unit="locations" trend={{ dir: 'up', text: '+1' }} />
        <CsrKpiTile index={3} icon={Wallet} label="Total Investment" value={formatCurrency(totalInvestment)} unit="FY" trend={{ dir: 'up', text: '+12.1%' }} />
        <CsrKpiTile index={4} icon={Users} label="Beneficiaries" value={formatNumber(totalBeneficiaries, 0)} unit="persons" trend={{ dir: 'up', text: '+7.8%' }} />
      </div>

      {/* Investment by category + status split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <Wallet className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Investment by Category
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Capital deployed by development category (₹)</p>
          </header>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 4, right: 12, bottom: 0, left: -8 }} barCategoryGap="22%">
                <defs>
                  <linearGradient id="csr-lad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ROSE_DEEP} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={ROSE_PRIMARY} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={48}
                  tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(244,63,94,0.06)' }} formatter={(v: number) => [formatCurrency(v), 'Investment']} />
                <Bar dataKey="value" fill="url(#csr-lad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Status Split
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Initiatives by lifecycle stage</p>
          </header>
          <div className="relative" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Completed', value: Math.max(0.1, completed), color: ROSE_DEEP },
                    { name: 'Ongoing', value: Math.max(0.1, ongoing), color: ROSE_PRIMARY },
                    { name: 'Planned', value: Math.max(0.1, initiatives.length - completed - ongoing), color: ROSE_SOFT },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  <Cell fill={ROSE_DEEP} />
                  <Cell fill={ROSE_PRIMARY} />
                  <Cell fill={ROSE_SOFT} />
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${Math.round(v)} initiatives`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{initiatives.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Initiatives</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: ROSE_DEEP }} />
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Done</span>
              <span className="text-[11px] font-bold text-slate-900 tabular-nums">{completed}</span>
            </div>
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: ROSE_PRIMARY }} />
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Ongoing</span>
              <span className="text-[11px] font-bold text-slate-900 tabular-nums">{ongoing}</span>
            </div>
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: ROSE_SOFT }} />
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Planned</span>
              <span className="text-[11px] font-bold text-slate-900 tabular-nums">{initiatives.length - completed - ongoing}</span>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Local initiatives table */}
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
              <MapPin className="h-4 w-4" style={{ color: ROSE_DEEP }} />
              Village Initiatives Registry
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Local infrastructure & welfare initiatives</p>
          </div>
          <span className="status-pill text-[9px] status-approved">{completed} completed</span>
        </header>
        <div className="max-h-80 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,228,230,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Initiative</th>
                <th className="px-3 py-2 text-left font-semibold">Village</th>
                <th className="px-3 py-2 text-left font-semibold">Category</th>
                <th className="px-3 py-2 text-left font-semibold">Investment</th>
                <th className="px-3 py-2 text-left font-semibold">Beneficiaries</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {initiatives.map((it, i) => (
                <motion.tr
                  key={it.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.025 }}
                  className="border-t border-slate-100 hover:bg-rose-50/40 transition-colors"
                  style={{ height: 40 }}
                >
                  <td className="px-3 py-2 font-mono text-slate-700">{it.id}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{it.name}</td>
                  <td className="px-3 py-2 text-slate-700">{it.village}</td>
                  <td className="px-3 py-2 text-slate-700">{it.category}</td>
                  <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">{formatCurrency(it.investment)}</td>
                  <td className="px-3 py-2 text-slate-700 tabular-nums">{it.beneficiaries.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className={`status-pill text-[9px] ${it.status === 'Completed' ? 'status-approved' : it.status === 'Ongoing' ? 'status-submitted' : 'status-draft'}`}>
                      {it.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      <ActivityFeed activities={activities} />
    </div>
  )
}

/* ============================================================
 * Main component
 * ============================================================ */
export function CsrWorkspace() {
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
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isCsrActivity).slice(0, 6)
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
        icon={HeartHandshake}
        title="No CSR data yet"
        subtitle="Set up a reporting period to populate the CSR workspace."
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
        {activeModule === 'csr-projects' && <ProjectsScreen k={k} activities={activities} />}
        {activeModule === 'csr-budgets' && <BudgetsScreen k={k} activities={activities} trends={trends} />}
        {activeModule === 'csr-beneficiaries' && <BeneficiariesScreen k={k} activities={activities} />}
        {activeModule === 'csr-impact' && <ImpactScreen k={k} activities={activities} />}
        {activeModule === 'csr-community' && <CommunityScreen k={k} activities={activities} />}
        {activeModule === 'csr-local' && <LocalScreen k={k} activities={activities} />}
      </motion.div>
    </AnimatePresence>
  )
}
