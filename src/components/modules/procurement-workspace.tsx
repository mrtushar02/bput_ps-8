'use client'
/**
 * ProcurementWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * Procurement workspace. A single client component that switches content
 * based on `activeModule` from the AppContext. Handles five module keys,
 * each rendering its own dedicated screen:
 *
 *   - 'proc-suppliers'    → Supplier Registry + ESG tiering + spend
 *   - 'proc-assessments'  → Supplier ESG Assessments + risk scoring
 *   - 'proc-sourcing'     → Strategic Sourcing pipeline + RFx tracker
 *   - 'proc-transactions' → Purchase Transactions + category spend
 *   - 'proc-valuechain'   → Value Chain mapping + Scope 3 hotspots
 *
 * (The 'overview', 'evidence', and 'submissions' keys are routed
 * elsewhere by the module-router — not handled here.)
 *
 * Color theme: Violet / Purple (#8b5cf6, #a855f7, #7c3aed) —
 * premium, regal palette aligned with the procurement domain.
 *
 * Data:
 *   GET /api/overview          → kpis + trends + periods
 *   GET /api/activity?take=10  → recent activities (proc-filtered client-side)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, PackageCheck, FileBarChart, ShoppingCart, Network,
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle,
  ChevronRight, CheckCircle2, Clock, ShieldCheck, Globe2,
  Building2, Layers, TrendingUp, Leaf, Factory, DollarSign,
  Handshake, BadgeCheck, Star, Gauge, Sparkles, Users,
  Activity as ActivityIcon,
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
  scope1: number
  scope2: number
  scope3: number
  energyGJ: number
  renewableShare: number
  waterWithdrawalKL: number
  wasteGeneratedT: number
  totalEmployees: number
  totalWorkers: number
  totalWorkforce: number
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
 * Theme constants — Violet / Purple
 * ============================================================ */
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(139,92,246,0.30)',
  borderRadius: 12,
  fontSize: 11,
  color: '#0f172a',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(124,58,237,0.22)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

const VIOLET_PRIMARY = '#8b5cf6'   // violet-500
const VIOLET_SECONDARY = '#a855f7' // purple-500
const VIOLET_DEEP = '#7c3aed'      // violet-600
const VIOLET_SOFT = '#c4b5fd'     // violet-300
const VIOLET_TINT = '#ede9fe'     // violet-100
const VIOLET_MIST = '#ddd6fe'     // violet-200

const DONUT_PALETTE = [VIOLET_DEEP, VIOLET_PRIMARY, VIOLET_SECONDARY]

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

/** Filter activities relevant to procurement. */
function isProcActivity(a: ActivityItem): boolean {
  const mod = (a.module ?? '').toUpperCase()
  const act = (a.action ?? '').toUpperCase()
  const title = (a.title ?? '').toLowerCase()
  const desc = (a.description ?? '').toLowerCase()
  const procModules = ['PROCUREMENT', 'SUPPLIER', 'SOURCING', 'VALUE_CHAIN', 'VENDOR']
  const procActions = ['SUPPLIER', 'SOURCING', 'PURCHASE', 'VENDOR', 'ASSESSMENT', 'RFQ', 'PO_']
  const procKeywords = ['supplier', 'vendor', 'procurement', 'sourcing', 'purchase', 'po ', 'rfq', 'value chain', 'scope 3']
  return (
    procModules.some(k => mod.includes(k)) ||
    procActions.some(k => act.includes(k)) ||
    procKeywords.some(k => title.includes(k) || desc.includes(k))
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
            background: `linear-gradient(135deg, ${VIOLET_PRIMARY}, ${VIOLET_DEEP})`,
            color: '#fff',
            boxShadow: `0 4px 14px -3px ${VIOLET_DEEP}80, inset 0 1px 1px rgba(255,255,255,0.4)`,
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
            <Building2 className="h-3 w-3" style={{ color: VIOLET_DEEP }} />
            {badgeText}
          </span>
        )}
        <span className="status-pill text-[10px] status-approved">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
        <div className="glass-subtle rounded-xl px-3 py-1.5 flex items-center gap-2">
          <div className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">ESG Coverage</div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-20 rounded-full bg-slate-200/70 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${completionPct}%`,
                  background: `linear-gradient(90deg, ${VIOLET_DEEP}, ${VIOLET_PRIMARY})`,
                  boxShadow: `0 0 8px -1px ${VIOLET_PRIMARY}80`,
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

/** Compact KPI tile — violet icon tile + label + value + trend pill. */
function ProcKpiTile({
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
            background: 'linear-gradient(135deg, rgba(237,233,254,0.90), rgba(221,214,254,0.70))',
            border: '1px solid rgba(139,92,246,0.30)',
            color: VIOLET_DEEP,
            boxShadow: '0 2px 8px -2px rgba(124,58,237,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
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
      <p className="text-[14px] font-semibold text-slate-900 mb-1">Unable to load Procurement workspace</p>
      <p className="text-[12px] text-slate-700 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${VIOLET_PRIMARY}, ${VIOLET_DEEP})` }}
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
      <Icon className="h-10 w-10 mb-3" style={{ color: VIOLET_PRIMARY }} />
      <p className="text-[14px] font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-[12px] text-slate-700 mb-4">{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${VIOLET_PRIMARY}, ${VIOLET_DEEP})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/** Activity feed — timeline of recent procurement activities. */
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
            <ActivityIcon className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
            Recent Activity
          </h2>
          <p className="text-[10px] text-slate-700 mt-0.5">Procurement & supplier feed · live</p>
        </div>
        <span className="status-pill text-[9px] status-approved">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {activities.length} new
        </span>
      </header>
      {activities.length === 0 ? (
        <div className="py-10 text-center">
          <Clock className="mx-auto h-7 w-7 text-slate-300" />
          <p className="text-[11px] text-slate-700 mt-2">No recent procurement activity</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto scroll-elegant pr-1">
          <ol className="relative space-y-1 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-violet-200/70 before:via-violet-100/40 before:to-transparent">
            <AnimatePresence initial={false}>
              {activities.map((a, i) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  className="relative flex gap-3 py-2.5 px-1 rounded-xl hover:bg-violet-50/40 transition-colors"
                >
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="h-10 w-10 rounded-full text-white flex items-center justify-center text-[11px] font-semibold ring-2 ring-white/80"
                      style={{ background: `linear-gradient(135deg, ${VIOLET_PRIMARY}, ${VIOLET_DEEP})` }}
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
                          <span className="px-1.5 py-0.5 rounded bg-violet-50/80 text-violet-700">{a.module}</span>
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
 * Screen 1 — Suppliers
 * ============================================================ */
function deriveSuppliers(k: Kpis): {
  code: string; name: string; category: string; tier: 1 | 2 | 3;
  esgScore: number; spend: number; country: string; status: 'Approved' | 'Onboarding' | 'Suspended'
}[] {
  const names = ['Tata Steels', 'Reliance Polymers', 'Adani Logistics', 'L&T Fabrication', 'Bharat Forge',
    'Mahindra Castings', 'JSW Cement', 'Hindalco Alloys', 'Bosch Components', 'Siemens Drives',
    'Ashok Leyland Parts', 'Godrej Materials']
  const countries = ['India', 'India', 'India', 'UAE', 'Singapore', 'India', 'Germany', 'India', 'Japan', 'India']
  const categories = ['Raw Materials', 'Logistics', 'Fabrication', 'Electricals', 'Consumables', 'Packaging']
  const seed = (k.totalEmissions + k.totalWorkforce + k.projects) || 7
  const total = Math.min(10, Math.max(6, Math.floor(seed / 50) || 8))
  const rows: ReturnType<typeof deriveSuppliers> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const r3 = ((seed * (i + 29)) % 977) / 977
    const tier: 1 | 2 | 3 = r < 0.4 ? 1 : r < 0.78 ? 2 : 3
    rows.push({
      code: `SUP-${(2000 + i).toString()}`,
      name: names[i % names.length],
      category: categories[i % categories.length],
      tier,
      esgScore: Math.round(55 + r2 * 40),
      spend: Math.round(800000 + r3 * 4500000),
      country: countries[i % countries.length],
      status: r3 < 0.82 ? 'Approved' : r3 < 0.93 ? 'Onboarding' : 'Suspended',
    })
  }
  return rows
}

function SuppliersScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const suppliers = useMemo(() => deriveSuppliers(k), [k])
  const tier1 = suppliers.filter(s => s.tier === 1).length
  const tier2 = suppliers.filter(s => s.tier === 2).length
  const tier3 = suppliers.filter(s => s.tier === 3).length
  const approved = suppliers.filter(s => s.status === 'Approved').length
  const totalSpend = suppliers.reduce((s, x) => s + x.spend, 0)
  const avgEsg = suppliers.length > 0
    ? suppliers.reduce((s, x) => s + x.esgScore, 0) / suppliers.length
    : 0

  const tierData = [
    { name: 'Tier 1', value: Math.max(0.1, tier1), color: VIOLET_DEEP },
    { name: 'Tier 2', value: Math.max(0.1, tier2), color: VIOLET_PRIMARY },
    { name: 'Tier 3', value: Math.max(0.1, tier3), color: VIOLET_SOFT },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Truck}
        title="Supplier Registry"
        subtitle="ESG-tiered supplier master with spend & country exposure"
        completionPct={k.completion}
        badgeText={`${suppliers.length} suppliers`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ProcKpiTile index={1} icon={Truck} label="Active Suppliers" value={suppliers.length.toString()} unit="vendors" trend={{ dir: 'up', text: '+3' }} />
        <ProcKpiTile index={2} icon={BadgeCheck} label="Approved" value={approved.toString()} unit={`${Math.round(approved / suppliers.length * 100)}%`} trend={{ dir: 'up', text: '+2' }} />
        <ProcKpiTile index={3} icon={DollarSign} label="Total Spend" value={formatCurrency(totalSpend)} unit="FY" trend={{ dir: 'up', text: '+8.4%' }} />
        <ProcKpiTile index={4} icon={Star} label="Avg ESG Score" value={avgEsg.toFixed(1)} unit="/100" trend={{ dir: 'up', text: '+2.1' }} />
      </div>

      {/* Suppliers table + tier donut */}
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
                <Truck className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
                Supplier Master
              </h2>
              <p className="text-[11px] text-slate-700 mt-0.5">
                Derived sample · {suppliers.length} suppliers across tiers
              </p>
            </div>
            <button className="glass-subtle rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:text-violet-700 transition-colors inline-flex items-center gap-1.5">
              Export <ChevronRight className="h-3 w-3" />
            </button>
          </header>
          <div className="max-h-96 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(237,233,254,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">Code</th>
                  <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                  <th className="px-3 py-2 text-left font-semibold">Tier</th>
                  <th className="px-3 py-2 text-left font-semibold">ESG</th>
                  <th className="px-3 py-2 text-left font-semibold">Spend</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s, i) => (
                  <motion.tr
                    key={s.code}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.015 }}
                    className="border-t border-slate-100 hover:bg-violet-50/40 transition-colors"
                    style={{ height: 42 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{s.code}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <div className="truncate">{s.name}</div>
                      <div className="text-[9px] text-slate-500">{s.country}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{s.category}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: s.tier === 1 ? 'rgba(124,58,237,0.12)' : s.tier === 2 ? 'rgba(139,92,246,0.12)' : 'rgba(196,181,253,0.18)',
                        color: s.tier === 1 ? '#6d28d9' : s.tier === 2 ? '#7c3aed' : '#8b5cf6',
                        borderColor: s.tier === 1 ? 'rgba(124,58,237,0.25)' : 'rgba(139,92,246,0.25)',
                      }}>
                        Tier {s.tier}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.esgScore}%`, background: `linear-gradient(90deg, ${VIOLET_DEEP}, ${VIOLET_PRIMARY})` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-900 tabular-nums">{s.esgScore}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">{formatCurrency(s.spend)}</td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${s.status === 'Approved' ? 'status-approved' : s.status === 'Onboarding' ? 'status-submitted' : 'status-missing'}`}>
                        {s.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Tier distribution donut */}
        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
              Tier Distribution
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Suppliers by procurement tier</p>
          </header>
          <div className="relative" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tierData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {tierData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${Math.round(v)} suppliers`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{suppliers.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Total</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {tierData.map(d => (
              <div key={d.name} className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: d.color }} />
                <span className="text-[9px] uppercase tracking-wide text-slate-700">{d.name}</span>
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

/* ============================================================
 * Screen 2 — Assessments
 * ============================================================ */
function deriveAssessments(k: Kpis): {
  id: string; supplier: string; type: string; score: number;
  risk: 'Low' | 'Medium' | 'High'; date: string; status: 'Completed' | 'In Progress' | 'Overdue'
}[] {
  const suppliers = ['Tata Steels', 'Reliance Polymers', 'Adani Logistics', 'L&T Fabrication', 'Bharat Forge', 'Mahindra Castings']
  const types = ['ESG Screening', 'Labour Audit', 'Environmental', 'Governance', 'Code of Conduct']
  const seed = (k.totalEmissions + k.evidenceTotal) || 11
  const total = Math.min(8, Math.max(5, Math.floor(seed / 40) || 6))
  const rows: ReturnType<typeof deriveAssessments> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const r3 = ((seed * (i + 29)) % 977) / 977
    const score = Math.round(48 + r2 * 48)
    const risk: 'Low' | 'Medium' | 'High' = score >= 80 ? 'Low' : score >= 60 ? 'Medium' : 'High'
    const day = Math.floor(r3 * 28) + 1
    rows.push({
      id: `ASM-${(3000 + i).toString()}`,
      supplier: suppliers[i % suppliers.length],
      type: types[i % types.length],
      score,
      risk,
      date: `2026-${String(Math.floor(i / 3) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      status: r < 0.6 ? 'Completed' : r < 0.88 ? 'In Progress' : 'Overdue',
    })
  }
  return rows
}

function AssessmentsScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const assessments = useMemo(() => deriveAssessments(k), [k])
  const completed = assessments.filter(a => a.status === 'Completed').length
  const inProgress = assessments.filter(a => a.status === 'In Progress').length
  const overdue = assessments.filter(a => a.status === 'Overdue').length
  const avgScore = assessments.length > 0
    ? assessments.reduce((s, a) => s + a.score, 0) / assessments.length
    : 0
  const completionRate = assessments.length > 0 ? (completed / assessments.length) * 100 : 0

  const riskData = [
    { name: 'Low Risk', value: Math.max(0.1, assessments.filter(a => a.risk === 'Low').length), color: '#10b981' },
    { name: 'Medium Risk', value: Math.max(0.1, assessments.filter(a => a.risk === 'Medium').length), color: '#f59e0b' },
    { name: 'High Risk', value: Math.max(0.1, assessments.filter(a => a.risk === 'High').length), color: '#ef4444' },
  ]

  const radialData = [
    { name: 'Coverage', value: Math.round(completionRate), fill: VIOLET_PRIMARY },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={FileBarChart}
        title="Supplier ESG Assessments"
        subtitle="Risk-scored assessments with completion tracking"
        completionPct={completionRate}
        badgeText={`${assessments.length} assessments`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ProcKpiTile index={1} icon={CheckCircle2} label="Completed" value={completed.toString()} unit="assessments" trend={{ dir: 'up', text: `+${Math.max(1, Math.round(completed * 0.2))}` }} />
        <ProcKpiTile index={2} icon={Clock} label="In Progress" value={inProgress.toString()} unit="pending" trend={{ dir: 'neutral', text: '0' }} />
        <ProcKpiTile index={3} icon={AlertCircle} label="Overdue" value={overdue.toString()} unit="action req." trend={{ dir: overdue > 0 ? 'up' : 'down', text: overdue > 0 ? `+${overdue}` : '0' }} />
        <ProcKpiTile index={4} icon={Star} label="Avg Score" value={avgScore.toFixed(1)} unit="/100" trend={{ dir: 'up', text: '+3.2' }} />
      </div>

      {/* Coverage radial + risk donut */}
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
              <Gauge className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
              Assessment Coverage
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Suppliers assessed vs. total active</p>
          </header>
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="60%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                <defs>
                  <linearGradient id="proc-radial" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={VIOLET_DEEP} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={VIOLET_PRIMARY} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <RadialBar dataKey="value" fill="url(#proc-radial)" cornerRadius={12} background={{ fill: 'rgba(139,92,246,0.08)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, color: '#475569' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="tabular-nums text-3xl font-bold text-slate-900">{completionRate.toFixed(0)}%</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Coverage</span>
            </div>
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
              <ShieldCheck className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
              Risk Distribution
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Suppliers by assessed risk level</p>
          </header>
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {riskData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${Math.round(v)} suppliers`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-2xl font-bold text-slate-900">{assessments.length}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Assessed</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {riskData.map(d => (
              <div key={d.name} className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
                <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: d.color }} />
                <span className="text-[9px] uppercase tracking-wide text-slate-700">{d.name.replace(' Risk', '')}</span>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{Math.round(d.value)}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Assessment registry */}
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
              <FileBarChart className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
              Assessment Registry
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">All scheduled & completed supplier assessments</p>
          </div>
          <span className="status-pill text-[9px] status-warning">{overdue} overdue</span>
        </header>
        <div className="max-h-80 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(237,233,254,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">ID</th>
                <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Score</th>
                <th className="px-3 py-2 text-left font-semibold">Risk</th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a, i) => (
                <motion.tr
                  key={a.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.025 }}
                  className="border-t border-slate-100 hover:bg-violet-50/40 transition-colors"
                  style={{ height: 40 }}
                >
                  <td className="px-3 py-2 font-mono text-slate-700">{a.id}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{a.supplier}</td>
                  <td className="px-3 py-2 text-slate-700">{a.type}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-10 rounded-full bg-slate-200/70 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${a.score}%`, background: `linear-gradient(90deg, ${VIOLET_DEEP}, ${VIOLET_PRIMARY})` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-900 tabular-nums">{a.score}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="status-pill text-[9px]" style={{
                      background: a.risk === 'Low' ? 'rgba(16,185,129,0.12)' : a.risk === 'Medium' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.10)',
                      color: a.risk === 'Low' ? '#047857' : a.risk === 'Medium' ? '#92400e' : '#b91c1c',
                      borderColor: a.risk === 'Low' ? 'rgba(16,185,129,0.25)' : a.risk === 'Medium' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.22)',
                    }}>
                      {a.risk}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{new Date(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="px-3 py-2">
                    <span className={`status-pill text-[9px] ${a.status === 'Completed' ? 'status-approved' : a.status === 'In Progress' ? 'status-submitted' : 'status-missing'}`}>
                      {a.status}
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
 * Screen 3 — Sourcing
 * ============================================================ */
function deriveSourcingPipeline(k: Kpis): {
  id: string; title: string; category: string; stage: 'RFx' | 'Bid' | 'Negotiation' | 'Award' | 'Contract';
  value: number; vendors: number; days: number
}[] {
  const titles = ['Cement Annual Procurement', 'Steel Framework Deal', 'Electricals RFP', 'Logistics Renewal', 'Packaging RFQ',
    'Fabrication Contract', 'Consumables Bundle', 'Polymers Framework']
  const categories = ['Raw Materials', 'Fabrication', 'Electricals', 'Logistics', 'Packaging', 'Consumables']
  const stages: Array<'RFx' | 'Bid' | 'Negotiation' | 'Award' | 'Contract'> = ['RFx', 'Bid', 'Negotiation', 'Award', 'Contract']
  const seed = (k.totalEmissions + k.totalSubs + k.projects) || 13
  const total = Math.min(7, Math.max(5, Math.floor(seed / 60) || 6))
  const rows: ReturnType<typeof deriveSourcingPipeline> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const r3 = ((seed * (i + 29)) % 977) / 977
    rows.push({
      id: `SOP-${(4000 + i).toString()}`,
      title: titles[i % titles.length],
      category: categories[i % categories.length],
      stage: stages[Math.floor(r * stages.length) % stages.length],
      value: Math.round(1500000 + r2 * 8000000),
      vendors: Math.floor(r3 * 8) + 2,
      days: Math.floor(r2 * 45) + 3,
    })
  }
  return rows
}

function SourcingScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const pipeline = useMemo(() => deriveSourcingPipeline(k), [k])
  const totalValue = pipeline.reduce((s, p) => s + p.value, 0)
  const rfxCount = pipeline.filter(p => p.stage === 'RFx').length
  const contractCount = pipeline.filter(p => p.stage === 'Contract').length
  const avgVendors = pipeline.length > 0
    ? pipeline.reduce((s, p) => s + p.vendors, 0) / pipeline.length
    : 0

  const stageData = [
    { stage: 'RFx', count: pipeline.filter(p => p.stage === 'RFx').length, fill: VIOLET_SOFT },
    { stage: 'Bid', count: pipeline.filter(p => p.stage === 'Bid').length, fill: VIOLET_PRIMARY },
    { stage: 'Negotiation', count: pipeline.filter(p => p.stage === 'Negotiation').length, fill: VIOLET_SECONDARY },
    { stage: 'Award', count: pipeline.filter(p => p.stage === 'Award').length, fill: VIOLET_DEEP },
    { stage: 'Contract', count: pipeline.filter(p => p.stage === 'Contract').length, fill: '#6d28d9' },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={PackageCheck}
        title="Strategic Sourcing"
        subtitle="RFx pipeline tracker with stage & vendor count"
        completionPct={k.completion}
        badgeText={`${pipeline.length} events`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ProcKpiTile index={1} icon={PackageCheck} label="Open RFx" value={rfxCount.toString()} unit="events" trend={{ dir: 'up', text: '+1' }} />
        <ProcKpiTile index={2} icon={Handshake} label="In Contract" value={contractCount.toString()} unit="awarded" trend={{ dir: 'up', text: `+${Math.max(1, Math.round(contractCount * 0.3))}` }} />
        <ProcKpiTile index={3} icon={DollarSign} label="Pipeline Value" value={formatCurrency(totalValue)} unit="FY" trend={{ dir: 'up', text: '+12.6%' }} />
        <ProcKpiTile index={4} icon={Users} label="Avg Vendors / Rfx" value={avgVendors.toFixed(1)} unit="bids" trend={{ dir: 'up', text: '+0.4' }} />
      </div>

      {/* Pipeline funnel + table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.section
          custom={5}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
              Sourcing Funnel
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Events by procurement stage</p>
          </header>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }} barCategoryGap="22%">
                <defs>
                  <linearGradient id="proc-funnel" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={VIOLET_DEEP} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={VIOLET_PRIMARY} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} width={78} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(139,92,246,0.06)' }} formatter={(v: number, n: string) => [`${Math.round(v)} events`, n]} />
                <Bar dataKey="count" fill="url(#proc-funnel)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section
          custom={6}
          variants={cardEnter}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 glass glass-shimmer rounded-[20px] p-5"
        >
          <header className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
                Pipeline Tracker
              </h2>
              <p className="text-[10px] text-slate-700 mt-0.5">All open sourcing events · stage + value + days open</p>
            </div>
            <span className="status-pill text-[9px] status-submitted">{rfxCount} in RFx</span>
          </header>
          <div className="max-h-80 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(237,233,254,0.92)', backdropFilter: 'blur(8px)' }}>
                <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                  <th className="px-3 py-2 text-left font-semibold">ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Title</th>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                  <th className="px-3 py-2 text-left font-semibold">Stage</th>
                  <th className="px-3 py-2 text-left font-semibold">Value</th>
                  <th className="px-3 py-2 text-left font-semibold">Vendors</th>
                  <th className="px-3 py-2 text-left font-semibold">Days</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.025 }}
                    className="border-t border-slate-100 hover:bg-violet-50/40 transition-colors"
                    style={{ height: 40 }}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">{p.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{p.title}</td>
                    <td className="px-3 py-2 text-slate-700">{p.category}</td>
                    <td className="px-3 py-2">
                      <span className="status-pill text-[9px]" style={{
                        background: 'rgba(139,92,246,0.12)',
                        color: '#6d28d9',
                        borderColor: 'rgba(139,92,246,0.25)',
                      }}>
                        {p.stage}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">{formatCurrency(p.value)}</td>
                    <td className="px-3 py-2 text-slate-700 tabular-nums">{p.vendors}</td>
                    <td className="px-3 py-2">
                      <span className={`status-pill text-[9px] ${p.days > 30 ? 'status-missing' : p.days > 14 ? 'status-warning' : 'status-approved'}`}>
                        {p.days}d
                      </span>
                    </td>
                  </motion.tr>
                ))}
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
 * Screen 4 — Transactions
 * ============================================================ */
function deriveTransactions(k: Kpis): {
  po: string; supplier: string; category: string; date: string;
  amount: number; status: 'Released' | 'Partial' | 'Closed' | 'Cancelled'
}[] {
  const suppliers = ['Tata Steels', 'Reliance Polymers', 'Adani Logistics', 'L&T Fabrication', 'Bharat Forge', 'JSW Cement', 'Hindalco Alloys']
  const categories = ['Raw Materials', 'Logistics', 'Fabrication', 'Electricals', 'Consumables', 'Packaging']
  const seed = (k.totalEmissions + k.totalWorkforce + k.orgs) || 17
  const total = Math.min(9, Math.max(6, Math.floor(seed / 30) || 8))
  const rows: ReturnType<typeof deriveTransactions> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const r3 = ((seed * (i + 29)) % 977) / 977
    const day = Math.floor(r3 * 28) + 1
    const month = Math.floor(r2 * 12) + 1
    const status: 'Released' | 'Partial' | 'Closed' | 'Cancelled' =
      r < 0.5 ? 'Released' : r < 0.75 ? 'Partial' : r < 0.9 ? 'Closed' : 'Cancelled'
    rows.push({
      po: `PO-${(5000 + i).toString()}`,
      supplier: suppliers[i % suppliers.length],
      category: categories[i % categories.length],
      date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      amount: Math.round(120000 + r2 * 3200000),
      status,
    })
  }
  return rows
}

function TransactionsScreen({ k, activities, trends }: { k: Kpis; activities: ActivityItem[]; trends?: Record<string, Record<string, number>> }) {
  const transactions = useMemo(() => deriveTransactions(k), [k])
  const totalSpend = transactions.reduce((s, t) => s + t.amount, 0)
  const released = transactions.filter(t => t.status === 'Released').length
  const closed = transactions.filter(t => t.status === 'Closed').length
  const avgPo = transactions.length > 0 ? totalSpend / transactions.length : 0

  // Monthly spend series (derived from trends energy as proxy, or synthetic)
  const monthlyData = useMemo(() => {
    if (trends && typeof trends === 'object') {
      const entries = Object.entries(trends).slice(-6)
      if (entries.length >= 3) {
        return entries.map(([label, vals]) => ({
          month: label.slice(0, 3),
          spend: Math.round(((vals as Record<string, number>).energy ?? 0) * 8500 + 1200000),
        }))
      }
    }
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
    const seed = (k.totalEmissions + k.orgs) || 17
    return months.map((m, i) => ({
      month: m,
      spend: Math.round(1200000 + ((seed * (i + 3)) % 977) / 977 * 1800000),
    }))
  }, [trends, k])

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of transactions) {
      map[t.category] = (map[t.category] ?? 0) + t.amount
    }
    return Object.entries(map).map(([name, value], i) => ({
      name, value, color: DONUT_PALETTE[i % DONUT_PALETTE.length],
    }))
  }, [transactions])

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={ShoppingCart}
        title="Purchase Transactions"
        subtitle="PO registry with category spend & monthly trend"
        completionPct={k.completion}
        badgeText={`${transactions.length} POs`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ProcKpiTile index={1} icon={ShoppingCart} label="Total POs" value={transactions.length.toString()} unit="orders" trend={{ dir: 'up', text: '+5' }} />
        <ProcKpiTile index={2} icon={DollarSign} label="Total Spend" value={formatCurrency(totalSpend)} unit="FY" trend={{ dir: 'up', text: '+9.2%' }} />
        <ProcKpiTile index={3} icon={CheckCircle2} label="Closed" value={closed.toString()} unit="fulfilled" trend={{ dir: 'up', text: `+${Math.max(1, Math.round(closed * 0.25))}` }} />
        <ProcKpiTile index={4} icon={Sparkles} label="Avg PO Value" value={formatCurrency(avgPo)} unit="per order" trend={{ dir: 'up', text: '+4.1%' }} />
      </div>

      {/* Monthly spend trend + category donut */}
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
              <TrendingUp className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
              Monthly Spend Trend
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Procurement spend by month (₹)</p>
          </header>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 4, right: 12, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="proc-spend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIOLET_PRIMARY} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={VIOLET_PRIMARY} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={48}
                  tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), 'Spend']} />
                <Area type="monotone" dataKey="spend" stroke={VIOLET_DEEP} strokeWidth={2.5} fill="url(#proc-spend)" />
              </AreaChart>
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
              <Layers className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
              Category Spend
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Distribution by procurement category</p>
          </header>
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive
                  animationDuration={700}
                >
                  {categoryData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [formatCurrency(v), n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-lg font-bold text-slate-900">{formatCurrency(totalSpend)}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">Total Spend</span>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {categoryData.slice(0, 4).map(d => (
              <div key={d.name} className="glass-subtle rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-[11px] font-medium text-slate-700">{d.name}</span>
                </div>
                <span className="text-[11px] font-bold text-slate-900 tabular-nums">{formatCurrency(d.value)}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Transactions table */}
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
              <ShoppingCart className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
              Purchase Order Registry
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">All released POs with status & amount</p>
          </div>
          <span className="status-pill text-[9px] status-submitted">{released} released</span>
        </header>
        <div className="max-h-80 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(237,233,254,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">PO No.</th>
                <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                <th className="px-3 py-2 text-left font-semibold">Category</th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Amount</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <motion.tr
                  key={t.po}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.025 }}
                  className="border-t border-slate-100 hover:bg-violet-50/40 transition-colors"
                  style={{ height: 38 }}
                >
                  <td className="px-3 py-2 font-mono text-slate-700">{t.po}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{t.supplier}</td>
                  <td className="px-3 py-2 text-slate-700">{t.category}</td>
                  <td className="px-3 py-2 text-slate-700">{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">{formatCurrency(t.amount)}</td>
                  <td className="px-3 py-2">
                    <span className={`status-pill text-[9px] ${t.status === 'Closed' ? 'status-approved' : t.status === 'Released' ? 'status-submitted' : t.status === 'Partial' ? 'status-warning' : 'status-missing'}`}>
                      {t.status}
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
 * Screen 5 — Value Chain
 * ============================================================ */
function deriveValueChain(k: Kpis): {
  node: string; type: 'Upstream' | 'Downstream'; emissions: number;
  spend: number; criticality: 'Low' | 'Medium' | 'High'; share: number
}[] {
  const nodes = [
    { node: 'Raw Material Sourcing', type: 'Upstream' as const },
    { node: 'Inbound Logistics', type: 'Upstream' as const },
    { node: 'Manufacturing', type: 'Upstream' as const },
    { node: 'Outbound Logistics', type: 'Downstream' as const },
    { node: 'Distribution', type: 'Downstream' as const },
    { node: 'End-use Products', type: 'Downstream' as const },
  ]
  const seed = (k.totalEmissions + k.scope3) || 19
  const total = nodes.length
  const baseEm = k.scope3 > 0 ? k.scope3 : k.totalEmissions
  const rows: ReturnType<typeof deriveValueChain> = []
  for (let i = 0; i < total; i++) {
    const r = ((seed * (i + 7)) % 997) / 997
    const r2 = ((seed * (i + 13)) % 991) / 991
    const share = Math.round((0.06 + r * 0.34) * 100) / 100
    rows.push({
      node: nodes[i].node,
      type: nodes[i].type,
      emissions: Math.round(baseEm * share * 10) / 10,
      spend: Math.round(900000 + r2 * 5400000),
      criticality: r2 < 0.35 ? 'High' : r2 < 0.72 ? 'Medium' : 'Low',
      share: Math.round(share * 1000) / 10,
    })
  }
  return rows
}

function ValueChainScreen({ k, activities }: { k: Kpis; activities: ActivityItem[] }) {
  const chain = useMemo(() => deriveValueChain(k), [k])
  const upstream = chain.filter(c => c.type === 'Upstream')
  const downstream = chain.filter(c => c.type === 'Downstream')
  const upstreamEm = upstream.reduce((s, c) => s + c.emissions, 0)
  const downstreamEm = downstream.reduce((s, c) => s + c.emissions, 0)
  const totalEm = upstreamEm + downstreamEm
  const highCrit = chain.filter(c => c.criticality === 'High').length

  const flowData = chain.map(c => ({
    node: c.node.split(' ')[0],
    emissions: c.emissions,
    fill: c.type === 'Upstream' ? VIOLET_DEEP : VIOLET_PRIMARY,
  }))

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Network}
        title="Value Chain Mapping"
        subtitle="Upstream / downstream emissions & Scope 3 hotspots"
        completionPct={k.brsrReadiness}
        badgeText={`${chain.length} nodes`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ProcKpiTile index={1} icon={Factory} label="Upstream Em." value={formatNumber(upstreamEm, 1)} unit="tCO₂e" trend={{ dir: 'up', text: '+5.3%' }} />
        <ProcKpiTile index={2} icon={Globe2} label="Downstream Em." value={formatNumber(downstreamEm, 1)} unit="tCO₂e" trend={{ dir: 'up', text: '+3.8%' }} />
        <ProcKpiTile index={3} icon={Leaf} label="Scope 3 Total" value={formatNumber(k.scope3 > 0 ? k.scope3 : totalEm, 1)} unit="tCO₂e" trend={{ dir: 'down', text: '-1.2%' }} />
        <ProcKpiTile index={4} icon={AlertCircle} label="High-Criticality" value={highCrit.toString()} unit="nodes" trend={{ dir: 'neutral', text: '0' }} />
      </div>

      {/* Value chain flow + breakdown */}
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
              <Network className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
              Value Chain Emissions Flow
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">tCO₂e by node · upstream vs downstream</p>
          </header>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowData} margin={{ top: 4, right: 12, bottom: 0, left: -8 }} barCategoryGap="22%">
                <XAxis dataKey="node" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={42} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(139,92,246,0.06)' }} formatter={(v: number) => [`${v} tCO₂e`, 'Emissions']} />
                <Bar dataKey="emissions" radius={[6, 6, 0, 0]} />
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
              <Layers className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
              Upstream / Downstream
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Emissions share by flow direction</p>
          </header>
          <div className="relative" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Upstream', value: Math.max(0.1, upstreamEm), color: VIOLET_DEEP },
                    { name: 'Downstream', value: Math.max(0.1, downstreamEm), color: VIOLET_PRIMARY },
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
                  <Cell fill={VIOLET_DEEP} />
                  <Cell fill={VIOLET_PRIMARY} />
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${formatNumber(v, 1)} tCO₂e`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-10px' }}>
              <span className="tabular-nums text-lg font-bold text-slate-900">{formatNumber(totalEm, 1)}</span>
              <span className="text-[9px] uppercase tracking-wide text-slate-700 font-semibold">tCO₂e</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: VIOLET_DEEP }} />
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Upstream</span>
              <span className="text-[11px] font-bold text-slate-900 tabular-nums">{totalEm > 0 ? ((upstreamEm / totalEm) * 100).toFixed(0) : 0}%</span>
            </div>
            <div className="glass-subtle rounded-xl px-2 py-1.5 flex flex-col items-center text-center">
              <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: VIOLET_PRIMARY }} />
              <span className="text-[9px] uppercase tracking-wide text-slate-700">Downstream</span>
              <span className="text-[11px] font-bold text-slate-900 tabular-nums">{totalEm > 0 ? ((downstreamEm / totalEm) * 100).toFixed(0) : 0}%</span>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Value chain node table */}
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
              <Network className="h-4 w-4" style={{ color: VIOLET_DEEP }} />
              Value Chain Nodes
            </h2>
            <p className="text-[10px] text-slate-700 mt-0.5">Emissions, spend & criticality per node</p>
          </div>
          <span className="status-pill text-[9px] status-warning">{highCrit} high-critical</span>
        </header>
        <div className="max-h-80 overflow-y-auto scroll-elegant rounded-xl border border-slate-200/50">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(237,233,254,0.92)', backdropFilter: 'blur(8px)' }}>
              <tr className="text-[10px] uppercase tracking-wide text-slate-700">
                <th className="px-3 py-2 text-left font-semibold">Node</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Emissions</th>
                <th className="px-3 py-2 text-left font-semibold">Share</th>
                <th className="px-3 py-2 text-left font-semibold">Spend</th>
                <th className="px-3 py-2 text-left font-semibold">Criticality</th>
              </tr>
            </thead>
            <tbody>
              {chain.map((c, i) => (
                <motion.tr
                  key={c.node}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.025 }}
                  className="border-t border-slate-100 hover:bg-violet-50/40 transition-colors"
                  style={{ height: 40 }}
                >
                  <td className="px-3 py-2 font-medium text-slate-900">{c.node}</td>
                  <td className="px-3 py-2">
                    <span className="status-pill text-[9px]" style={{
                      background: c.type === 'Upstream' ? 'rgba(124,58,237,0.12)' : 'rgba(139,92,246,0.12)',
                      color: c.type === 'Upstream' ? '#6d28d9' : '#7c3aed',
                      borderColor: 'rgba(139,92,246,0.25)',
                    }}>
                      {c.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">{formatNumber(c.emissions, 1)} t</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 rounded-full bg-slate-200/70 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.share}%`, background: `linear-gradient(90deg, ${VIOLET_DEEP}, ${VIOLET_PRIMARY})` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-900 tabular-nums">{c.share.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">{formatCurrency(c.spend)}</td>
                  <td className="px-3 py-2">
                    <span className="status-pill text-[9px]" style={{
                      background: c.criticality === 'High' ? 'rgba(239,68,68,0.10)' : c.criticality === 'Medium' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                      color: c.criticality === 'High' ? '#b91c1c' : c.criticality === 'Medium' ? '#92400e' : '#047857',
                      borderColor: c.criticality === 'High' ? 'rgba(239,68,68,0.22)' : c.criticality === 'Medium' ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)',
                    }}>
                      {c.criticality}
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
export function ProcurementWorkspace() {
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
      const filtered = (Array.isArray(data.items) ? data.items : []).filter(isProcActivity).slice(0, 6)
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
    return <WorkspaceSkeleton tiles={activeModule === 'proc-suppliers' ? 4 : 4} />
  }

  // ---- Error state ----
  if (error && !overview) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />
  }

  // ---- Empty state ----
  if (!overview || !k) {
    return (
      <EmptyState
        icon={Truck}
        title="No procurement data yet"
        subtitle="Set up a reporting period to populate the Procurement workspace."
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
        {activeModule === 'proc-suppliers' && <SuppliersScreen k={k} activities={activities} />}
        {activeModule === 'proc-assessments' && <AssessmentsScreen k={k} activities={activities} />}
        {activeModule === 'proc-sourcing' && <SourcingScreen k={k} activities={activities} />}
        {activeModule === 'proc-transactions' && <TransactionsScreen k={k} activities={activities} trends={trends} />}
        {activeModule === 'proc-valuechain' && <ValueChainScreen k={k} activities={activities} />}
      </motion.div>
    </AnimatePresence>
  )
}
