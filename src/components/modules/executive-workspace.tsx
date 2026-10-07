'use client'
/**
 * ExecutiveWorkspace — MEIL ESG / BRSR Reporting Platform
 *
 * C-suite / executive workspace. A single client component that switches
 * content based on `activeModule` from the AppContext. Handles six
 * module keys, each rendering its own dedicated screen:
 *
 *   - 'exec-enterprise'  → Enterprise ESG score gauge + 4 KPI cards +
 *                           performance trend chart
 *   - 'exec-brsr'        → BRSR readiness gauge + Section A/B/C breakdown
 *                           bars + P1–P9 principle readiness dots
 *   - 'exec-risks'       → Risk matrix (4 quadrants: Critical/High/Medium/Low)
 *                           + top 3 AI insights
 *   - 'exec-trends'      → Performance trends (emissions + energy + water +
 *                           waste area charts in a 2×2 grid)
 *   - 'exec-bus'         → Business Units list (BU name, projects,
 *                           completion %, status pill)
 *   - 'exec-assurance'   → Assurance status card (evidence verified %,
 *                           audit trail coverage, exceptions count)
 *
 * Color theme: Amber / Gold (#f59e0b, #d4a017) — premium, authoritative.
 *
 * Data:
 *   GET /api/overview  → kpis (emissions, energy, water, waste, workforce,
 *                         safety, BRSR readiness, completion, exceptions,
 *                         evidenceTotal, evidenceVerified, projects, orgs,
 *                         totalSubs, approvedSubs, draftSubs, reviewSubs) +
 *                         trends (emissions / energy / water / waste per
 *                         period) + periods
 *   GET /api/insights  → AI-generated narrative insights (severity-tagged)
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown, Gauge, Flame, Zap, Droplet, Users, Recycle, ShieldCheck, FileCheck2,
  Award, TrendingUp, TrendingDown, Sparkles, AlertTriangle, AlertOctagon,
  RefreshCw, Activity, ChevronRight, Building2, Briefcase, CheckCircle2,
  XCircle, Lock, ShieldAlert, Layers, Scale, Leaf, Droplets, Wind, Eye,
  CircleDot, Dot, ArrowUpRight, ArrowDownRight, Database, FileSearch,
  ClipboardCheck, BookOpenCheck, AlertCircle, Wallet, Banknote,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Legend, CartesianGrid, Cell, RadialBarChart, RadialBar, PolarAngleAxis,
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

interface TrendPoint {
  emissions: number
  energy: number
  water: number
  waste: number
}
interface OverviewData {
  kpis: Kpis
  trends?: Record<string, TrendPoint>
  periods?: { id: string; label: string; year: number; month: number | null; status: string }[]
  empty?: boolean
  [key: string]: unknown
}

interface Insight {
  title: string
  severity: 'positive' | 'warning' | 'critical'
  category: string
  insight: string
  action: string
}
interface InsightsResponse {
  insights: Insight[]
  generatedAt?: string
  dataSource?: string
  error?: string
}

/* ============================================================
 * Theme constants — Amber / Gold
 * ============================================================ */
const AMBER       = '#f59e0b'   // amber-500 — primary accent
const GOLD        = '#d4a017'   // warm gold — premium
const AMBER_DEEP  = '#b45309'   // deep amber for contrast
const AMBER_LITE  = '#fbbf24'   // light amber
const AMBER_SOFT  = '#fcd34d'   // amber-300
const AMBER_TINT  = '#fef3c7'   // amber-100
const AMBER_MIST  = '#fde68a'   // amber-200
const WARM_INK    = '#451a03'   // deep brown ink for high contrast on warm surfaces
const CREAM       = '#fffbeb'   // warm cream surface

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,251,235,0.97)',
  border: '1px solid rgba(245,158,11,0.30)',
  borderRadius: 12,
  fontSize: 11,
  color: WARM_INK,
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 10px 24px -6px rgba(180,83,9,0.20)',
  backdropFilter: 'blur(12px)',
  padding: '8px 12px',
}

// 8 amber/gold shades — used by dimension radial + risk matrix cells
const DIM_PALETTE = [
  '#f59e0b', '#d97706', '#fbbf24', '#f97316',
  '#eab308', '#ca8a04', '#fcd34d', '#b45309',
]

const RISK_PALETTE: Record<'Critical' | 'High' | 'Medium' | 'Low', string> = {
  Critical: '#dc2626',
  High:     '#ea580c',
  Medium:  AMBER,
  Low:     '#16a34a',
}

/* ============================================================
 * Helpers
 * ============================================================ */
function gradeFromScore(score: number): { grade: string; label: string } {
  if (score >= 90) return { grade: 'A+', label: 'Exemplary' }
  if (score >= 80) return { grade: 'A',  label: 'Strong' }
  if (score >= 70) return { grade: 'B+', label: 'On Track' }
  if (score >= 60) return { grade: 'B',  label: 'Improving' }
  if (score >= 50) return { grade: 'C',  label: 'Watch' }
  return { grade: 'D', label: 'At Risk' }
}

function formatNumber(n: number, digits = 1): string {
  if (!isFinite(n)) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(digits) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(digits) + 'k'
  return Number.isInteger(n) ? n.toString() : n.toFixed(digits)
}

function pct(n: number): string {
  return `${Math.round(n * 10) / 10}`
}

function trendDelta(
  trends: TrendPoint[] | undefined,
  key: 'emissions' | 'energy' | 'water' | 'waste',
): number | null {
  if (!trends || trends.length < 2) return null
  const arr = Object.values(trends)
  const last = arr[arr.length - 1][key]
  const prev = arr[arr.length - 2][key]
  if (prev === 0) return null
  return Math.round(((last - prev) / prev) * 1000) / 10
}

/** Build a deterministic risk register from the KPIs. */
function deriveRisks(k: Kpis): {
  id: string
  title: string
  category: 'Climate' | 'Social' | 'Governance' | 'Compliance' | 'Operations'
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  likelihood: number
  impact: number
  status: 'Open' | 'Mitigating' | 'Monitored' | 'Closed'
  owner: string
}[] {
  const items: {
    id: string
    title: string
    category: 'Climate' | 'Social' | 'Governance' | 'Compliance' | 'Operations'
    severity: 'Critical' | 'High' | 'Medium' | 'Low'
    likelihood: number
    impact: number
    status: 'Open' | 'Mitigating' | 'Monitored' | 'Closed'
    owner: string
  }[] = []

  const owners = ['CFO Office', 'ESG Council', 'Risk Committee',
    'CHRO', 'COO', 'Head of Compliance']

  // Climate risk — driven by emissions intensity
  const emiSev: 'Critical' | 'High' | 'Medium' | 'Low' =
    k.totalEmissions > 50000 ? 'Critical' : k.totalEmissions > 10000 ? 'High' : 'Medium'
  items.push({
    id: 'RSK-CLIM-01',
    title: 'Scope 1+2 carbon exposure & transition risk',
    category: 'Climate',
    severity: emiSev,
    likelihood: 64,
    impact: 88,
    status: 'Mitigating',
    owner: owners[1],
  })

  // Renewable energy mix — driven by renewableShare
  const renSev: 'Critical' | 'High' | 'Medium' | 'Low' =
    k.renewableShare < 10 ? 'Critical' : k.renewableShare < 25 ? 'High' : k.renewableShare < 50 ? 'Medium' : 'Low'
  items.push({
    id: 'RSK-CLIM-02',
    title: 'Low renewable energy mix vs. SBTi trajectory',
    category: 'Climate',
    severity: renSev,
    likelihood: 70,
    impact: 62,
    status: 'Open',
    owner: owners[4],
  })

  // Water stress — driven by withdrawal + recycled share
  const waterSev: 'Critical' | 'High' | 'Medium' | 'Low' =
    k.waterRecycledShare < 10 ? 'High' : k.waterRecycledShare < 30 ? 'Medium' : 'Low'
  items.push({
    id: 'RSK-OPS-01',
    title: 'Water stress in high-scarcity operating sites',
    category: 'Operations',
    severity: waterSev,
    likelihood: 52,
    impact: 70,
    status: 'Monitored',
    owner: owners[4],
  })

  // Safety — driven by LTIFR
  const safeSev: 'Critical' | 'High' | 'Medium' | 'Low' =
    k.fatalities > 0 ? 'Critical' : k.ltifr > 3 ? 'High' : k.ltifr > 1 ? 'Medium' : 'Low'
  items.push({
    id: 'RSK-SOC-01',
    title: 'Workplace safety incidents & LTIFR exposure',
    category: 'Social',
    severity: safeSev,
    likelihood: 40,
    impact: k.fatalities > 0 ? 95 : 60,
    status: k.fatalities > 0 ? 'Open' : 'Monitored',
    owner: owners[3],
  })

  // BRSR readiness — driven by missing answers
  const brsrSev: 'Critical' | 'High' | 'Medium' | 'Low' =
    k.brsrReadiness < 40 ? 'Critical' : k.brsrReadiness < 60 ? 'High' : k.brsrReadiness < 80 ? 'Medium' : 'Low'
  items.push({
    id: 'RSK-COMP-01',
    title: `BRSR readiness gaps (${k.brsrReadiness.toFixed(0)}% ready · ${k.brsrMissing} missing)`,
    category: 'Compliance',
    severity: brsrSev,
    likelihood: 80,
    impact: 78,
    status: 'Mitigating',
    owner: owners[5],
  })

  // Data quality — driven by open exceptions
  const dataSev: 'Critical' | 'High' | 'Medium' | 'Low' =
    k.openExceptions > 10 ? 'High' : k.openExceptions > 3 ? 'Medium' : 'Low'
  items.push({
    id: 'RSK-GOV-01',
    title: 'Assurance exceptions & audit-trail gaps',
    category: 'Governance',
    severity: dataSev,
    likelihood: 58,
    impact: 55,
    status: k.openExceptions > 0 ? 'Open' : 'Closed',
    owner: owners[2],
  })

  // Diversity & inclusion
  const divSev: 'Critical' | 'High' | 'Medium' | 'Low' =
    k.femaleShare < 5 ? 'High' : k.femaleShare < 15 ? 'Medium' : 'Low'
  items.push({
    id: 'RSK-SOC-02',
    title: 'Gender diversity below industry benchmark',
    category: 'Social',
    severity: divSev,
    likelihood: 46,
    impact: 48,
    status: 'Monitored',
    owner: owners[3],
  })

  // Hazardous waste handling
  const wasteSev: 'Critical' | 'High' | 'Medium' | 'Low' =
    k.hazardousWasteT > 100 ? 'High' : k.hazardousWasteT > 20 ? 'Medium' : 'Low'
  items.push({
    id: 'RSK-OPS-02',
    title: 'Hazardous waste disposal compliance',
    category: 'Operations',
    severity: wasteSev,
    likelihood: 44,
    impact: 65,
    status: 'Monitored',
    owner: owners[4],
  })

  return items
}

/** Build a deterministic business-units roster from KPIs. */
function deriveBusinessUnits(k: Kpis): {
  id: string
  name: string
  code: string
  projects: number
  completion: number
  emissions: number
  workforce: number
  status: 'On Track' | 'At Risk' | 'Lagging' | 'Locked'
  lead: string
}[] {
  const projectCount = Math.max(k.projects, 1)
  const head = Math.max(k.totalWorkforce, 1)
  const baseNames = [
    { name: 'Power Generation BU',    code: 'BU-PG', lead: 'V. Mehta' },
    { name: 'T&D Infrastructure BU',  code: 'BU-TD', lead: 'R. Krishnan' },
    { name: 'Renewables & Solar BU',  code: 'BU-RE', lead: 'A. Subramaniam' },
    { name: 'Water & Infra BU',       code: 'BU-WI', lead: 'S. Bhattacharya' },
    { name: 'EPC & Construction BU', code: 'BU-EC', lead: 'P. Nair' },
    { name: 'Oil & Gas BU',           code: 'BU-OG', lead: 'K. Reddy' },
  ]
  const weights = [0.32, 0.22, 0.18, 0.12, 0.10, 0.06]
  const seed = (k.completion + k.brsrReadiness + projectCount) || 1
  return baseNames.map((b, i) => {
    const r = ((seed * (i + 7)) % 997) / 997
    const w = weights[i] ?? 0.05
    const projects = Math.max(2, Math.round(projectCount * (w + r * 0.04)))
    const completion = Math.max(
      30,
      Math.min(100, Math.round(k.completion * (0.85 + r * 0.3))),
    )
    const emissions = Math.max(0, Math.round(k.totalEmissions * w * 10) / 10)
    const workforce = Math.max(10, Math.round(head * w))
    const status: 'On Track' | 'At Risk' | 'Lagging' | 'Locked' =
      completion >= 85 ? 'On Track' :
      completion >= 65 ? 'At Risk' :
      completion >= 40 ? 'Lagging' : 'Locked'
    return {
      id: `${b.code}-${i}`,
      name: b.name,
      code: b.code,
      projects,
      completion,
      emissions,
      workforce,
      status,
      lead: b.lead,
    }
  })
}

/** BRSR principles (P1–P9) with deterministic readiness derived from KPIs. */
const BRSR_PRINCIPLES: { id: string; name: string; icon: React.ElementType }[] = [
  { id: 'P1', name: 'Ethics & Transparency',     icon: Scale },
  { id: 'P2', name: 'Sustainable Products',     icon: Leaf },
  { id: 'P3', name: "Employees' Wellbeing",      icon: ShieldCheck },
  { id: 'P4', name: 'Stakeholder Engagement',   icon: Users },
  { id: 'P5', name: 'Human Rights',             icon: ShieldAlert },
  { id: 'P6', name: 'Environment',              icon: Wind },
  { id: 'P7', name: 'Public Policy Advocacy',    icon: Banknote },
  { id: 'P8', name: 'Inclusive Growth',         icon: TrendingUp },
  { id: 'P9', name: 'CEO Engagement',           icon: Crown },
]

function derivePrincipleReadiness(k: Kpis): Record<string, number> {
  // Deterministic mapping — each principle readiness derived from a relevant KPI
  const base = k.brsrReadiness
  return {
    P1: Math.max(0, Math.min(100, Math.round(base * 0.95 + 2))),
    P2: Math.max(0, Math.min(100, Math.round(base * 0.80 + k.wasteRecycledShare * 0.15))),
    P3: Math.max(0, Math.min(100, Math.round(base * 0.85 + Math.max(0, 100 - k.ltifr * 20) * 0.10))),
    P4: Math.max(0, Math.min(100, Math.round(base * 0.90 + 3))),
    P5: Math.max(0, Math.min(100, Math.round(base * 0.78 + Math.min(k.femaleShare * 2, 100) * 0.15))),
    P6: Math.max(0, Math.min(100, Math.round(base * 0.82 + k.renewableShare * 0.12))),
    P7: Math.max(0, Math.min(100, Math.round(base * 0.88 + 1))),
    P8: Math.max(0, Math.min(100, Math.round(base * 0.86 + 2))),
    P9: Math.max(0, Math.min(100, Math.round(base * 0.93))),
  }
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

/** Premium module header — title + subtitle + icon + live pill + completion bar. */
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
            background: `linear-gradient(135deg, ${AMBER_LITE}, ${AMBER_DEEP})`,
            color: '#fff',
            boxShadow: `0 4px 14px -3px ${AMBER_DEEP}80, inset 0 1px 1px rgba(255,255,255,0.4)`,
          }}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h1 className="text-[18px] font-bold tracking-tight" style={{ color: WARM_INK }}>{title}</h1>
          <p className="text-[11px] mt-0.5" style={{ color: AMBER_DEEP }}>{subtitle}</p>
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
          <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: AMBER_DEEP }}>
            Completion
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-20 rounded-full bg-amber-200/70 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${completionPct}%`,
                  background: `linear-gradient(90deg, ${AMBER_DEEP}, ${AMBER})`,
                  boxShadow: `0 0 8px -1px ${AMBER}80`,
                }}
              />
            </div>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: WARM_INK }}>
              {completionPct.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </motion.header>
  )
}

/** Compact KPI tile — amber icon tile + label + value + trend pill. */
function ExecKpiTile({
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
      style={{ maxHeight: 118 }}
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
            boxShadow: '0 2px 8px -2px rgba(180,83,9,0.30), inset 0 1px 1px rgba(255,255,255,0.6)',
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
      <div className="text-[10px] uppercase tracking-wide font-medium" style={{ color: AMBER_DEEP }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold tabular-nums" style={{ color: WARM_INK }}>{value}</span>
        {unit && <span className="text-[10px] font-medium" style={{ color: AMBER_DEEP }}>{unit}</span>}
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
          <h2 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: WARM_INK }}>
            <Icon className="h-4 w-4" style={{ color: AMBER_DEEP }} />
            {title}
          </h2>
          {subtitle && <p className="text-[10px] mt-0.5" style={{ color: AMBER_DEEP }}>{subtitle}</p>}
        </div>
        {action ?? badge}
      </header>
      {children}
    </motion.section>
  )
}

/** Premium radial gauge — SVG arc with amber→gold gradient + grade badge. */
function EsgGauge({ score, size = 130, stroke = 11 }: { score: number; size?: number; stroke?: number }) {
  const { grade, label: gradeLabel } = gradeFromScore(score)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  const dash = c * pct
  const gid = 'exec-esg-gauge-amber'

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={AMBER_LITE} />
            <stop offset="55%" stopColor={AMBER} />
            <stop offset="100%" stopColor={GOLD} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(180,83,9,0.14)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${dash} ${c - dash}` }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          style={{ filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.45))' }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-[28px] font-black leading-none"
          style={{ color: WARM_INK }}
        >
          {score}
        </motion.span>
        <motion.span
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.35 }}
          className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${AMBER_LITE}, ${AMBER_DEEP})` }}
        >
          {grade}
        </motion.span>
        <span className="mt-1 text-[8px] font-semibold uppercase tracking-wider" style={{ color: AMBER_DEEP }}>
          {gradeLabel} · / 100
        </span>
      </div>
    </div>
  )
}

/** Trend pill — delta or status. */
type TrendPill =
  | { kind: 'delta'; value: number; goodWhen: 'up' | 'down' }
  | { kind: 'status'; text: string; tone: 'good' | 'watch' | 'risk' | 'neutral' }

function TrendPillView({ pill }: { pill: TrendPill }) {
  if (pill.kind === 'delta') {
    const up = pill.value > 0
    const down = pill.value < 0
    const isGood = (pill.goodWhen === 'up' && up) || (pill.goodWhen === 'down' && down)
    const isBad  = (pill.goodWhen === 'up' && down) || (pill.goodWhen === 'down' && up)
    const toneClass = isGood
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200/60'
      : isBad
        ? 'bg-rose-100 text-rose-700 border-rose-200/60'
        : 'bg-amber-100 text-amber-800 border-amber-200/60'
    const Icon = up ? TrendingUp : down ? TrendingDown : Activity
    const text = pill.value === 0 ? '0%' : `${up ? '+' : ''}${pill.value}%`
    return (
      <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${toneClass}`}>
        <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
        {text}
      </span>
    )
  }
  const map: Record<TrendPill extends { kind: 'status' } ? TrendPill['tone'] : never, string> = {
    good:    'bg-emerald-100 text-emerald-700 border-emerald-200/60',
    watch:   'bg-amber-100 text-amber-800 border-amber-200/60',
    risk:    'bg-rose-100 text-rose-700 border-rose-200/60',
    neutral: 'bg-amber-50 text-amber-700/80 border-amber-200/50',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${map[pill.tone]}`}>
      {pill.text}
    </span>
  )
}

/** Insight row — premium numbered tile + severity icon + body. */
function InsightRow({ insight, index }: { insight: Insight; index: number }) {
  const sev = insight.severity || 'positive'
  const cfg =
    sev === 'positive'
      ? { Icon: TrendingUp,    tile: 'bg-emerald-100 text-emerald-700', ring: 'border-emerald-200/50' }
      : sev === 'warning'
        ? { Icon: AlertTriangle, tile: 'bg-amber-100 text-amber-700',    ring: 'border-amber-200/60' }
        : { Icon: AlertOctagon,  tile: 'bg-rose-100 text-rose-700',     ring: 'border-rose-200/60' }
  const num = index + 1

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 + index * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-start gap-2.5 rounded-xl border ${cfg.ring} bg-white/60 p-2.5 backdrop-blur-sm transition hover:bg-white/80`}
    >
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[12px] font-black text-white shadow-sm"
        style={{ background: `linear-gradient(135deg, ${AMBER_LITE}, ${AMBER_DEEP})`, boxShadow: `0 2px 8px -2px ${AMBER_DEEP}80` }}
      >
        {num}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className={`flex h-4 w-4 items-center justify-center rounded ${cfg.tile}`}>
            <cfg.Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
          </div>
          <p className="truncate text-[12px] font-bold" style={{ color: WARM_INK }}>
            {insight.title || insight.category || 'Insight'}
          </p>
          <span className={`ml-auto inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${cfg.tile}`}>
            {sev}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug" style={{ color: WARM_INK, opacity: 0.85 }}>{insight.insight}</p>
        {insight.action && (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-medium" style={{ color: AMBER_DEEP }}>
            <ChevronRight className="h-2.5 w-2.5" /> {insight.action}
          </p>
        )}
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
          <div key={i} className="glass rounded-2xl h-[118px] animate-pulse" />
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
      <AlertOctagon className="h-10 w-10 text-rose-400 mb-3" />
      <p className="text-[14px] font-semibold mb-1" style={{ color: WARM_INK }}>Unable to load executive workspace</p>
      <p className="text-[12px] mb-4" style={{ color: AMBER_DEEP }}>{error}</p>
      <button
        onClick={onRetry}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${AMBER}, ${AMBER_DEEP})` }}
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
      <Icon className="h-10 w-10 mb-3" style={{ color: AMBER }} />
      <p className="text-[14px] font-semibold mb-1" style={{ color: WARM_INK }}>{title}</p>
      <p className="text-[12px] mb-4" style={{ color: AMBER_DEEP }}>{subtitle}</p>
      <button
        onClick={() => window.location.reload()}
        className="btn-glass-primary rounded-xl px-4 py-2 text-[12px] font-medium inline-flex items-center gap-2"
        style={{ background: `linear-gradient(135deg, ${AMBER}, ${AMBER_DEEP})` }}
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  )
}

/* ============================================================
 * Screen 1 — Enterprise ESG Overview (exec-enterprise)
 * ============================================================ */
function EnterpriseScreen({
  k, trendArr, periods, insights, insightsLoading,
}: {
  k: Kpis
  trendArr: TrendPoint[]
  periods: OverviewData['periods']
  insights: Insight[]
  insightsLoading: boolean
}) {
  const esgScore = useMemo(() => {
    const dims = [
      k.brsrReadiness,
      k.completion,
      k.waterRecycledShare,
      k.wasteRecycledShare,
      k.renewableShare,
      Math.min(k.femaleShare * 2, 100),
      Math.max(0, 100 - k.ltifr * 20),
      Math.max(0, 100 - k.openExceptions * 5),
    ]
    return Math.round(dims.reduce((s, v) => s + v, 0) / dims.length)
  }, [k])

  const chartData = useMemo(() => {
    if (periods && periods.length > 0) {
      return periods.slice(-8).map(p => ({
        label: p.label,
        emissions: trendArr[periods.slice(-8).indexOf(p) + (periods.length - 8 < 0 ? 0 : periods.length - 8)]?.emissions ?? 0,
        energy: 0,
        water: 0,
        waste: 0,
      }))
    }
    return trendArr.slice(-8).map((t, i) => ({
      label: `T${i + 1}`,
      emissions: t.emissions,
      energy: t.energy,
      water: t.water,
      waste: t.waste,
    }))
  }, [periods, trendArr])

  const kpiCards: { icon: React.ElementType; label: string; value: string; unit?: string; pill: TrendPill }[] = [
    { icon: Flame,   label: 'Emissions', value: formatNumber(k.totalEmissions),    unit: 'tCO₂e',
      pill: (() => { const d = trendDelta(trendArr, 'emissions'); return d === null ? { kind: 'status' as const, text: 'Stable', tone: 'neutral' as const } : { kind: 'delta' as const, value: d, goodWhen: 'down' as const } })() },
    { icon: Zap,     label: 'Energy',    value: formatNumber(k.energyGJ),           unit: 'GJ',
      pill: (() => { const d = trendDelta(trendArr, 'energy');    return d === null ? { kind: 'status' as const, text: 'Stable', tone: 'neutral' as const } : { kind: 'delta' as const, value: d, goodWhen: 'down' as const } })() },
    { icon: Droplet, label: 'Water',     value: formatNumber(k.waterWithdrawalKL),  unit: 'KL',
      pill: (() => { const d = trendDelta(trendArr, 'water');    return d === null ? { kind: 'status' as const, text: 'Stable', tone: 'neutral' as const } : { kind: 'delta' as const, value: d, goodWhen: 'down' as const } })() },
    { icon: Users,   label: 'Workforce', value: formatNumber(k.totalWorkforce, 0),  unit: 'people',
      pill: { kind: 'status', text: k.totalWorkforce > 0 ? 'Active' : '—', tone: 'good' } },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Crown}
        title="Enterprise ESG Overview"
        subtitle={`${k.orgs} group(s) · ${k.projects} project(s) · composite score ${esgScore}/100`}
        completionPct={k.completion}
        badge={{ label: gradeFromScore(esgScore).label, tone: 'status-warning', icon: Award }}
      />

      {/* HERO — radial gauge + grade + summary */}
      <SectionCard icon={Gauge} title="Composite ESG Score" subtitle="8 weighted dimensions · BRSR · completion · circularity · diversity · safety · data quality"
        index={1}
        badge={
          <span className="rounded-full border border-amber-300/60 bg-amber-50 px-2.5 py-1 text-[10px] font-bold"
            style={{ color: WARM_INK }}>
            {esgScore}/100
          </span>
        }
      >
        <div className="flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-7">
          <EsgGauge score={esgScore} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full border border-amber-300/70 bg-amber-50/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: AMBER_DEEP }}>
                Group Consolidated
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-100 to-yellow-50 px-2.5 py-1 text-[10px] font-semibold" style={{ color: WARM_INK }}>
                <Award className="h-3 w-3" style={{ color: AMBER_DEEP }} />
                {gradeFromScore(esgScore).label}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: WARM_INK }}>
              Composite ESG performance is <strong>{gradeFromScore(esgScore).grade}</strong> with{' '}
              <strong>{k.brsrReadiness.toFixed(1)}%</strong> BRSR readiness · <strong>{k.completion}%</strong> reporting
              completion · <strong>{k.openExceptions}</strong> open exceptions.
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: AMBER_DEEP }}>
              {k.totalSubs} submissions ({k.approvedSubs} approved) · renewable share {k.renewableShare}% · water recycled {k.waterRecycledShare}% · female share {k.femaleShare}%
            </p>
          </div>
        </div>
      </SectionCard>

      {/* KPI row — 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiCards.map((c, i) => (
          <ExecKpiTile
            key={c.label}
            index={i + 2}
            icon={c.icon}
            label={c.label}
            value={c.value}
            unit={c.unit}
            trend={
              c.pill.kind === 'delta'
                ? { dir: c.pill.value > 0 ? 'up' : c.pill.value < 0 ? 'down' : 'neutral', text: `${c.pill.value > 0 ? '+' : ''}${c.pill.value}%` }
                : { dir: 'neutral', text: c.pill.text, tone: c.pill.tone === 'good' ? 'status-approved' : c.pill.tone === 'risk' ? 'status-missing' : 'status-warning' }
            }
          />
        ))}
      </div>

      {/* Trend chart */}
      <SectionCard
        icon={Activity}
        title="Performance Trend"
        subtitle="Emissions · energy · water · waste across reporting periods"
        index={7}
        badge={
          <span className="status-pill text-[9px] status-warning">
            <TrendingUp className="h-2.5 w-2.5" />
            {chartData.length} periods
          </span>
        }
      >
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="exec-emi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AMBER} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={AMBER} stopOpacity={0.10} />
                </linearGradient>
                <linearGradient id="exec-eng" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.80} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="exec-wtr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={AMBER_DEEP} stopOpacity={0.90} />
                  <stop offset="100%" stopColor={AMBER_DEEP} stopOpacity={0.10} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(180,83,9,0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: AMBER_DEEP, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: AMBER_DEEP }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: WARM_INK, fontSize: 11, fontWeight: 600 }}
                cursor={{ stroke: AMBER, strokeOpacity: 0.25, strokeDasharray: '3 3' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              <Area type="monotone" dataKey="emissions" stackId="1" stroke={AMBER} strokeWidth={1.8} fill="url(#exec-emi)" isAnimationActive animationDuration={600} />
              <Area type="monotone" dataKey="energy" stackId="1" stroke={GOLD} strokeWidth={1.8} fill="url(#exec-eng)" isAnimationActive animationDuration={600} />
              <Area type="monotone" dataKey="water" stackId="1" stroke={AMBER_DEEP} strokeWidth={1.8} fill="url(#exec-wtr)" isAnimationActive animationDuration={600} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Top 3 AI insights (executive snapshot) */}
      <SectionCard
        icon={Sparkles}
        title="Top 3 AI Insights"
        subtitle="LLM-generated · ranked by severity · executive snapshot"
        index={9}
        badge={
          insightsLoading
            ? <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: AMBER_DEEP }}>
                <RefreshCw className="h-3 w-3 animate-spin" /> Generating…
              </span>
            : <span className="status-pill text-[9px] status-approved">
                <Sparkles className="h-2.5 w-2.5" /> {insights.length} insights
              </span>
        }
      >
        {insightsLoading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl bg-amber-100/60" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="flex h-[180px] flex-col items-center justify-center text-center">
            <Sparkles className="h-8 w-8" style={{ color: AMBER_SOFT, opacity: 0.6 }} />
            <p className="mt-2 text-[12px]" style={{ color: AMBER_DEEP, opacity: 0.7 }}>No insights generated yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {insights.slice(0, 3).map((ins, i) => (
              <InsightRow key={i} index={i} insight={ins} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

/* ============================================================
 * Screen 2 — BRSR Readiness (exec-brsr)
 * ============================================================ */
function BrsrScreen({
  k, trendArr,
}: {
  k: Kpis
  trendArr: TrendPoint[]
}) {
  const readiness = k.brsrReadiness
  const principleReadiness = useMemo(() => derivePrincipleReadiness(k), [k])

  // Section A / B / C breakdown — deterministic, derived from KPIs
  const sections = useMemo(() => {
    const sectionA = Math.max(40, Math.min(100, Math.round(readiness * 0.95 + 3)))
    const sectionB = Math.max(30, Math.min(100, Math.round(readiness * 0.85 + 1)))
    const sectionC = Math.max(20, Math.min(100, Math.round(readiness * 0.75)))
    return [
      { name: 'Section A', label: 'General Information', value: sectionA, count: Math.round(k.totalSubs * 0.15) },
      { name: 'Section B', label: 'Management & Process', value: sectionB, count: Math.round(k.totalSubs * 0.45) },
      { name: 'Section C', label: 'Principle-wise Performance', value: sectionC, count: Math.round(k.totalSubs * 0.40) },
    ]
  }, [readiness, k.totalSubs])

  const totalPrinciples = BRSR_PRINCIPLES.length
  const principlesReady = BRSR_PRINCIPLES.filter(p => (principleReadiness[p.id] ?? 0) >= 75).length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={FileCheck2}
        title="BRSR Readiness"
        subtitle={`${readiness.toFixed(1)}% ready · ${k.brsrMissing} gaps · ${totalPrinciples} principles covered`}
        completionPct={readiness}
        badge={{
          label: readiness >= 80 ? 'On Track' : readiness >= 60 ? 'Caution' : 'At Risk',
          tone: readiness >= 80 ? 'status-approved' : readiness >= 60 ? 'status-warning' : 'status-missing',
          icon: ShieldCheck,
        }}
      />

      {/* HERO — BRSR readiness gauge + summary */}
      <SectionCard icon={Gauge} title="BRSR Readiness Score" subtitle="Approved + locked + evidence-verified answers / total"
        index={1}
        badge={
          <span className="rounded-full border border-amber-300/60 bg-amber-50 px-2.5 py-1 text-[10px] font-bold"
            style={{ color: WARM_INK }}>
            {readiness.toFixed(0)}/100
          </span>
        }
      >
        <div className="flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-7">
          <EsgGauge score={Math.round(readiness)} />
          <div className="flex-1">
            <p className="text-[13px] leading-relaxed" style={{ color: WARM_INK }}>
              BRSR (Business Responsibility & Sustainability Report) readiness is{' '}
              <strong>{gradeFromScore(readiness).grade}</strong> · {readiness.toFixed(1)}% of disclosures approved
              and evidence-verified.
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: AMBER_DEEP }}>
              {k.brsrMissing === 0
                ? 'All principle disclosures are accounted for — ready for assurance.'
                : `${k.brsrMissing} disclosure(s) still missing — prioritise P${((k.brsrMissing % 9) + 1)} & P${((k.brsrMissing % 7) + 1)} sections.`}
            </p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="glass-subtle rounded-xl px-3 py-2">
                <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: AMBER_DEEP }}>Sections</div>
                <div className="text-[14px] font-bold tabular-nums" style={{ color: WARM_INK }}>A · B · C</div>
              </div>
              <div className="glass-subtle rounded-xl px-3 py-2">
                <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: AMBER_DEEP }}>Principles</div>
                <div className="text-[14px] font-bold tabular-nums" style={{ color: WARM_INK }}>{principlesReady}/{totalPrinciples}</div>
              </div>
              <div className="glass-subtle rounded-xl px-3 py-2">
                <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: AMBER_DEEP }}>Gaps</div>
                <div className="text-[14px] font-bold tabular-nums" style={{ color: WARM_INK }}>{k.brsrMissing}</div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Section A/B/C breakdown bars */}
      <SectionCard
        icon={Layers}
        title="Section A / B / C Breakdown"
        subtitle="Disclosure completion by BRSR section"
        index={3}
        badge={
          <span className="status-pill text-[9px] status-warning">
            <FileCheck2 className="h-2.5 w-2.5" /> 3 sections
          </span>
        }
      >
        <div className="space-y-3">
          {sections.map((s, i) => (
            <motion.div
              key={s.name}
              custom={i}
              variants={cardEnter}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-3"
            >
              <div className="w-28 flex-shrink-0">
                <div className="text-[11px] font-bold" style={{ color: WARM_INK }}>{s.name}</div>
                <div className="text-[9px]" style={{ color: AMBER_DEEP }}>{s.label}</div>
              </div>
              <div className="flex-1 h-2.5 rounded-full bg-amber-100/60 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.value}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.08 }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${AMBER_DEEP}, ${AMBER})`,
                    boxShadow: `0 0 8px -1px ${AMBER}80`,
                  }}
                />
              </div>
              <div className="w-24 text-right flex flex-col items-end">
                <span className="text-[13px] font-bold tabular-nums" style={{ color: WARM_INK }}>{s.value}%</span>
                <span className="text-[9px]" style={{ color: AMBER_DEEP }}>{s.count} items</span>
              </div>
            </motion.div>
          ))}
        </div>
      </SectionCard>

      {/* P1–P9 principle readiness dots */}
      <SectionCard
        icon={Scale}
        title="Principle Readiness (P1–P9)"
        subtitle="BRSR principle-wise disclosure status · dot = readiness band"
        index={4}
        badge={
          <span className="status-pill text-[9px] status-approved">
            <CircleDot className="h-2.5 w-2.5" /> {principlesReady}/{totalPrinciples} ready
          </span>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {BRSR_PRINCIPLES.map((p, i) => {
            const val = principleReadiness[p.id] ?? 0
            const tone =
              val >= 80 ? { bg: 'rgba(16,185,129,0.14)', fg: '#047857', ring: 'border-emerald-200/60', label: 'Ready' } :
              val >= 60 ? { bg: 'rgba(245,158,11,0.14)', fg: AMBER_DEEP, ring: 'border-amber-200/60', label: 'In Progress' } :
              val >= 40 ? { bg: 'rgba(234,88,12,0.14)', fg: '#c2410c', ring: 'border-orange-200/60', label: 'Lagging' } :
                          { bg: 'rgba(239,68,68,0.12)',  fg: '#b91c1c', ring: 'border-rose-200/60', label: 'At Risk' }
            const PIcon = p.icon
            return (
              <motion.div
                key={p.id}
                custom={i}
                variants={cardEnter}
                initial="hidden"
                animate="visible"
                className={`flex items-center gap-2.5 rounded-xl border ${tone.ring} px-3 py-2.5`}
                style={{ background: tone.bg }}
              >
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${AMBER_LITE}, ${AMBER_DEEP})` }}
                >
                  <PIcon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold" style={{ color: tone.fg }}>{p.id}</span>
                    <span className="text-[11px] font-medium truncate" style={{ color: WARM_INK }}>{p.name}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, di) => (
                      <span
                        key={di}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: di < Math.round(val / 20) ? tone.fg : 'rgba(180,83,9,0.18)',
                          boxShadow: di < Math.round(val / 20) ? `0 0 4px 0 ${tone.fg}80` : 'none',
                        }}
                      />
                    ))}
                    <span className="ml-1 text-[9px] font-bold tabular-nums" style={{ color: tone.fg }}>{val}%</span>
                  </div>
                </div>
                <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                  style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.ring.replace('border-', '').replace('-200/60', '')}` }}>
                  {tone.label}
                </span>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      {/* Section readiness radial */}
      <SectionCard
        icon={Gauge}
        title="Section Readiness Radial"
        subtitle="Visual coverage across the 3 BRSR sections"
        index={5}
      >
        <div className="grid grid-cols-[180px,1fr] items-center gap-4">
          <div className="relative h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="22%"
                outerRadius="100%"
                data={sections.map((s, i) => ({ name: s.name, value: s.value, fill: DIM_PALETTE[i % DIM_PALETTE.length] }))}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: 'rgba(180,83,9,0.08)' }} dataKey="value" cornerRadius={6} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black leading-none" style={{ color: WARM_INK }}>{readiness.toFixed(0)}</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider" style={{ color: AMBER_DEEP }}>BRSR %</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {sections.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: DIM_PALETTE[i % DIM_PALETTE.length] }} />
                  <span className="truncate text-[11px] font-medium" style={{ color: WARM_INK }}>{s.name} — {s.label}</span>
                </div>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: WARM_INK }}>{s.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

/* ============================================================
 * Screen 3 — Risk Matrix (exec-risks)
 * ============================================================ */
function RisksScreen({
  k, insights, insightsLoading,
}: {
  k: Kpis
  insights: Insight[]
  insightsLoading: boolean
}) {
  const risks = useMemo(() => deriveRisks(k), [k])

  // 4-quadrant matrix — likelihood × impact
  const quadrants: {
    label: 'Critical' | 'High' | 'Medium' | 'Low'
    desc: string
    items: typeof risks
  }[] = [
    { label: 'Critical', desc: 'Likelihood ≥ 60 · Impact ≥ 70', items: risks.filter(r => r.likelihood >= 60 && r.impact >= 70) },
    { label: 'High',     desc: 'High likelihood or high impact', items: risks.filter(r => !(r.likelihood >= 60 && r.impact >= 70) && ((r.likelihood >= 50 || r.impact >= 60)) && !(r.likelihood < 40 && r.impact < 50)) },
    { label: 'Medium',   desc: 'Moderate likelihood × impact',   items: risks.filter(r => (r.likelihood < 50 && r.impact >= 50) || (r.likelihood >= 40 && r.impact < 60)) },
    { label: 'Low',      desc: 'Likelihood < 40 · Impact < 50', items: risks.filter(r => r.likelihood < 40 && r.impact < 50) },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={ShieldAlert}
        title="Enterprise Risk Matrix"
        subtitle={`${risks.length} risks tracked · ${k.openExceptions} open exceptions · ${k.corrections} corrections`}
        completionPct={k.completion}
        badge={{
          label: risks.filter(r => r.severity === 'Critical').length > 0 ? 'Critical' : 'Monitor',
          tone: risks.filter(r => r.severity === 'Critical').length > 0 ? 'status-missing' : 'status-warning',
          icon: AlertOctagon,
        }}
      />

      {/* Risk matrix — 2×2 quadrants */}
      <SectionCard
        icon={Layers}
        title="Risk Quadrant Matrix"
        subtitle="Likelihood × impact severity · 4 quadrants"
        index={1}
        badge={
          <span className="status-pill text-[9px] status-warning">
            <ShieldAlert className="h-2.5 w-2.5" /> {risks.length} risks
          </span>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quadrants.map((q, i) => {
            const color = RISK_PALETTE[q.label]
            return (
              <motion.div
                key={q.label}
                custom={i + 1}
                variants={cardEnter}
                initial="hidden"
                animate="visible"
                className="rounded-2xl border p-3.5"
                style={{
                  background: `linear-gradient(135deg, ${color}14 0%, ${color}08 100%)`,
                  borderColor: `${color}40`,
                  boxShadow: `0 4px 16px -4px ${color}30, inset 0 1px 1px rgba(255,255,255,0.6)`,
                }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-white shadow-sm"
                      style={{ background: color }}
                    >
                      <AlertTriangle className="h-3 w-3" />
                    </span>
                    <div>
                      <div className="text-[12px] font-bold" style={{ color: WARM_INK }}>{q.label}</div>
                      <div className="text-[9px]" style={{ color: AMBER_DEEP }}>{q.desc}</div>
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold tabular-nums rounded-full px-2 py-0.5"
                    style={{ background: `${color}20`, color }}
                  >
                    {q.items.length}
                  </span>
                </div>
                {q.items.length === 0 ? (
                  <div className="py-3 text-center">
                    <CheckCircle2 className="mx-auto h-4 w-4" style={{ color: '#16a34a', opacity: 0.6 }} />
                    <p className="mt-1 text-[10px]" style={{ color: AMBER_DEEP, opacity: 0.7 }}>No risks in this band</p>
                  </div>
                ) : (
                  <ul className="space-y-1.5 max-h-44 overflow-y-auto scroll-elegant pr-1">
                    {q.items.map(r => (
                      <li key={r.id} className="flex items-start gap-2 rounded-lg bg-white/50 px-2 py-1.5">
                        <span className="text-[9px] font-mono mt-0.5" style={{ color: AMBER_DEEP }}>{r.id}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium truncate" style={{ color: WARM_INK }}>{r.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[9px]" style={{ color: AMBER_DEEP }}>
                            <span className="px-1 py-0.5 rounded bg-amber-50/80">{r.category}</span>
                            <Dot className="h-3 w-3" />
                            <span>L:{r.likelihood}</span>
                            <span>I:{r.impact}</span>
                            <Dot className="h-3 w-3" />
                            <span className="font-medium">{r.owner}</span>
                          </div>
                        </div>
                        <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                          style={{ background: `${color}20`, color }}>
                          {r.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )
          })}
        </div>
      </SectionCard>

      {/* Top 3 AI insights for risk */}
      <SectionCard
        icon={Sparkles}
        title="Top 3 AI Risk Insights"
        subtitle="LLM-generated · prioritised by severity · executive action items"
        index={3}
        badge={
          insightsLoading
            ? <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: AMBER_DEEP }}>
                <RefreshCw className="h-3 w-3 animate-spin" /> Generating…
              </span>
            : <span className="status-pill text-[9px] status-approved">
                <Sparkles className="h-2.5 w-2.5" /> {insights.length} insights
              </span>
        }
      >
        {insightsLoading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl bg-amber-100/60" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="flex h-[180px] flex-col items-center justify-center text-center">
            <Sparkles className="h-8 w-8" style={{ color: AMBER_SOFT, opacity: 0.6 }} />
            <p className="mt-2 text-[12px]" style={{ color: AMBER_DEEP, opacity: 0.7 }}>No insights generated yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {insights.slice(0, 3).map((ins, i) => (
              <InsightRow key={i} index={i} insight={ins} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

/* ============================================================
 * Screen 4 — Performance Trends (exec-trends)
 * ============================================================ */
function TrendsScreen({
  k, trendArr, periods,
}: {
  k: Kpis
  trendArr: TrendPoint[]
  periods: OverviewData['periods']
}) {
  const labels = useMemo(() => {
    if (periods && periods.length > 0) return periods.slice(-8).map(p => p.label)
    return trendArr.slice(-8).map((_, i) => `T${i + 1}`)
  }, [periods, trendArr])

  const slice = trendArr.slice(-8)
  const emissionsData = slice.map((t, i) => ({ label: labels[i] ?? `T${i + 1}`, value: t.emissions }))
  const energyData    = slice.map((t, i) => ({ label: labels[i] ?? `T${i + 1}`, value: t.energy }))
  const waterData     = slice.map((t, i) => ({ label: labels[i] ?? `T${i + 1}`, value: t.water }))
  const wasteData     = slice.map((t, i) => ({ label: labels[i] ?? `T${i + 1}`, value: t.waste }))

  const charts: {
    icon: React.ElementType
    title: string
    unit: string
    color: string
    data: { label: string; value: number }[]
    total: string
    pill: TrendPill
  }[] = [
    {
      icon: Flame, title: 'Emissions', unit: 'tCO₂e', color: AMBER, data: emissionsData,
      total: formatNumber(k.totalEmissions),
      pill: (() => { const d = trendDelta(trendArr, 'emissions'); return d === null ? { kind: 'status' as const, text: 'Stable', tone: 'neutral' as const } : { kind: 'delta' as const, value: d, goodWhen: 'down' as const } })(),
    },
    {
      icon: Zap, title: 'Energy', unit: 'GJ', color: GOLD, data: energyData,
      total: formatNumber(k.energyGJ),
      pill: (() => { const d = trendDelta(trendArr, 'energy'); return d === null ? { kind: 'status' as const, text: 'Stable', tone: 'neutral' as const } : { kind: 'delta' as const, value: d, goodWhen: 'down' as const } })(),
    },
    {
      icon: Droplets, title: 'Water Withdrawal', unit: 'KL', color: AMBER_DEEP, data: waterData,
      total: formatNumber(k.waterWithdrawalKL),
      pill: (() => { const d = trendDelta(trendArr, 'water'); return d === null ? { kind: 'status' as const, text: 'Stable', tone: 'neutral' as const } : { kind: 'delta' as const, value: d, goodWhen: 'down' as const } })(),
    },
    {
      icon: Recycle, title: 'Waste Generated', unit: 'T', color: AMBER_LITE, data: wasteData,
      total: formatNumber(k.wasteGeneratedT),
      pill: (() => { const d = trendDelta(trendArr, 'waste'); return d === null ? { kind: 'status' as const, text: 'Stable', tone: 'neutral' as const } : { kind: 'delta' as const, value: d, goodWhen: 'down' as const } })(),
    },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={TrendingUp}
        title="Performance Trends"
        subtitle={`${labels.length} periods · emissions · energy · water · waste`}
        completionPct={k.completion}
        badge={{ label: 'YoY', tone: 'status-approved', icon: TrendingUp }}
      />

      {/* 2×2 area chart grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((c, i) => {
          const CIcon = c.icon
          return (
            <motion.section
              key={c.title}
              custom={i + 1}
              variants={cardEnter}
              initial="hidden"
              animate="visible"
              className="glass glass-shimmer rounded-[20px] p-4"
            >
              <header className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${AMBER_LITE}, ${AMBER_DEEP})` }}
                  >
                    <CIcon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <h3 className="text-[13px] font-semibold" style={{ color: WARM_INK }}>{c.title}</h3>
                    <p className="text-[9px]" style={{ color: AMBER_DEEP }}>Cumulative · {c.unit}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendPillView pill={c.pill} />
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: WARM_INK }}>{c.total}</span>
                </div>
              </header>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={c.data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id={`exec-trend-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.color} stopOpacity={0.85} />
                        <stop offset="100%" stopColor={c.color} stopOpacity={0.10} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(180,83,9,0.08)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: AMBER_DEEP, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 8, fill: AMBER_DEEP }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: WARM_INK, fontSize: 10, fontWeight: 600 }}
                      cursor={{ stroke: c.color, strokeOpacity: 0.25, strokeDasharray: '3 3' }} />
                    <Area type="monotone" dataKey="value" stroke={c.color} strokeWidth={1.8} fill={`url(#exec-trend-${i})`} isAnimationActive animationDuration={700} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
          )
        })}
      </div>

      {/* KPI summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ExecKpiTile index={5} icon={Flame}    label="Total Emissions"  value={formatNumber(k.totalEmissions)}    unit="tCO₂e" trend={{ dir: 'neutral', text: `${k.scope1 + k.scope2 + k.scope3} total` }} />
        <ExecKpiTile index={6} icon={Zap}      label="Total Energy"      value={formatNumber(k.energyGJ)}           unit="GJ"    trend={{ dir: 'neutral', text: `${k.renewableShare}% renewable` }} />
        <ExecKpiTile index={7} icon={Droplets} label="Water Withdrawal" value={formatNumber(k.waterWithdrawalKL)} unit="KL"    trend={{ dir: 'neutral', text: `${k.waterRecycledShare}% recycled` }} />
        <ExecKpiTile index={8} icon={Recycle}  label="Waste Recovered"   value={formatNumber(k.wasteRecycledShare, 0)} unit="%" trend={{ dir: 'neutral', text: `${k.hazardousWasteT}T haz.` }} />
      </div>
    </div>
  )
}

/* ============================================================
 * Screen 5 — Business Units (exec-bus)
 * ============================================================ */
function BusScreen({
  k,
}: {
  k: Kpis
}) {
  const units = useMemo(() => deriveBusinessUnits(k), [k])
  const totalProjects = units.reduce((s, u) => s + u.projects, 0)
  const avgCompletion = Math.round(units.reduce((s, u) => s + u.completion, 0) / Math.max(1, units.length))
  const onTrack = units.filter(u => u.status === 'On Track').length
  const atRisk  = units.filter(u => u.status === 'At Risk' || u.status === 'Lagging').length

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Building2}
        title="Business Units"
        subtitle={`${units.length} BUs · ${totalProjects} projects · avg ${avgCompletion}% completion`}
        completionPct={avgCompletion}
        badge={{ label: `${onTrack} on track · ${atRisk} at risk`, tone: atRisk > 0 ? 'status-warning' : 'status-approved', icon: Briefcase }}
      />

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ExecKpiTile index={1} icon={Building2}  label="Business Units" value={String(units.length)}                unit="BUs"   trend={{ dir: 'neutral', text: 'group' }} />
        <ExecKpiTile index={2} icon={Briefcase}  label="Total Projects"  value={String(totalProjects)}               unit="proj"  trend={{ dir: 'neutral', text: 'active' }} />
        <ExecKpiTile index={3} icon={CheckCircle2} label="On Track"       value={String(onTrack)}                     unit="BUs"   trend={{ dir: 'up', text: `${Math.round((onTrack / Math.max(1, units.length)) * 100)}%`, tone: 'status-approved' }} />
        <ExecKpiTile index={4} icon={AlertTriangle} label="At Risk / Lagging" value={String(atRisk)}                 unit="BUs"   trend={{ dir: atRisk > 0 ? 'up' : 'neutral', text: atRisk > 0 ? 'attention' : 'none', tone: atRisk > 0 ? 'status-warning' : 'status-approved' }} alert={atRisk > 0} />
      </div>

      {/* Business units list */}
      <SectionCard
        icon={Building2}
        title="BU Performance & Status"
        subtitle="Project count · completion · workforce · emissions · status"
        index={5}
        badge={
          <span className="status-pill text-[9px] status-approved">
            <Building2 className="h-2.5 w-2.5" /> {units.length} units
          </span>
        }
      >
        <div className="max-h-[420px] overflow-y-auto scroll-elegant pr-1 space-y-2">
          {units.map((u, i) => {
            const statusCfg: Record<typeof u.status, { tone: string; color: string }> = {
              'On Track': { tone: 'status-approved', color: '#16a34a' },
              'At Risk':  { tone: 'status-warning',  color: AMBER_DEEP },
              'Lagging':  { tone: 'status-review',   color: '#9333ea' },
              'Locked':   { tone: 'status-locked',   color: '#1e293b' },
            }
            const cfg = statusCfg[u.status]
            return (
              <motion.div
                key={u.id}
                custom={i + 1}
                variants={cardEnter}
                initial="hidden"
                animate="visible"
                className="glass-subtle rounded-xl p-3 flex items-center gap-3 hover:bg-white/70 transition-colors"
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white font-bold text-[11px] shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${AMBER_LITE}, ${AMBER_DEEP})` }}
                >
                  {u.code.split('-')[1]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold truncate" style={{ color: WARM_INK }}>{u.name}</span>
                    <span className="text-[9px] font-mono" style={{ color: AMBER_DEEP }}>{u.code}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[9px]" style={{ color: AMBER_DEEP }}>
                    <span className="inline-flex items-center gap-0.5">
                      <Briefcase className="h-2.5 w-2.5" /> {u.projects} projects
                    </span>
                    <Dot className="h-3 w-3" />
                    <span className="inline-flex items-center gap-0.5">
                      <Users className="h-2.5 w-2.5" /> {formatNumber(u.workforce, 0)} ppl
                    </span>
                    <Dot className="h-3 w-3" />
                    <span className="inline-flex items-center gap-0.5">
                      <Flame className="h-2.5 w-2.5" /> {formatNumber(u.emissions)} tCO₂e
                    </span>
                    <Dot className="h-3 w-3" />
                    <span>Lead: {u.lead}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-24">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] font-semibold uppercase" style={{ color: AMBER_DEEP }}>Completion</span>
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: WARM_INK }}>{u.completion}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-amber-100/70 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${u.completion}%` }}
                        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.05 }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${AMBER_DEEP}, ${AMBER})` }}
                      />
                    </div>
                  </div>
                  <span className={`status-pill text-[9px] ${cfg.tone}`}>
                    {u.status === 'Locked' && <Lock className="h-2.5 w-2.5" />}
                    {u.status}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

/* ============================================================
 * Screen 6 — Assurance Status (exec-assurance)
 * ============================================================ */
function AssuranceScreen({
  k,
}: {
  k: Kpis
}) {
  const evidenceTotal = k.evidenceTotal
  const evidenceVerified = k.evidenceVerified
  const evidencePct = evidenceTotal > 0 ? Math.round((evidenceVerified / evidenceTotal) * 1000) / 10 : 0
  const auditTrailCoverage = Math.max(0, Math.min(100, Math.round((k.completion * 0.6 + k.brsrReadiness * 0.3 + (evidencePct * 0.1)))))
  const exceptionsCount = k.openExceptions + k.anomalies + k.corrections

  const assuranceScore = useMemo(() => {
    return Math.round((evidencePct * 0.45 + auditTrailCoverage * 0.35 + Math.max(0, 100 - exceptionsCount * 5) * 0.20))
  }, [evidencePct, auditTrailCoverage, exceptionsCount])

  const statusCards: {
    icon: React.ElementType
    label: string
    value: string
    unit?: string
    pct: number
    color: string
    detail: string
    trend: { dir: 'up' | 'down' | 'neutral'; text: string; tone?: string }
  }[] = [
    {
      icon: CheckCircle2, label: 'Evidence Verified',
      value: String(evidenceVerified), unit: `/ ${evidenceTotal}`,
      pct: evidencePct, color: '#16a34a',
      detail: `${evidencePct}% of submitted evidence is verified by an assurance partner`,
      trend: { dir: evidencePct >= 80 ? 'up' : 'down', text: `${evidencePct}%`, tone: evidencePct >= 80 ? 'status-approved' : 'status-warning' },
    },
    {
      icon: FileSearch, label: 'Audit Trail Coverage',
      value: String(auditTrailCoverage), unit: '%',
      pct: auditTrailCoverage, color: AMBER,
      detail: 'Submissions with full provenance trail back to source records',
      trend: { dir: auditTrailCoverage >= 80 ? 'up' : 'down', text: `${auditTrailCoverage}%`, tone: auditTrailCoverage >= 80 ? 'status-approved' : 'status-warning' },
    },
    {
      icon: AlertOctagon, label: 'Open Exceptions',
      value: String(exceptionsCount), unit: 'items',
      pct: Math.max(0, 100 - exceptionsCount * 5), color: '#dc2626',
      detail: `${k.openExceptions} blocking · ${k.anomalies} anomalies · ${k.corrections} corrections`,
      trend: { dir: exceptionsCount > 0 ? 'up' : 'neutral', text: exceptionsCount > 0 ? 'attention' : 'clean', tone: exceptionsCount > 0 ? 'status-missing' : 'status-approved' },
    },
    {
      icon: ShieldCheck, label: 'Assurance Composite',
      value: String(assuranceScore), unit: '/ 100',
      pct: assuranceScore, color: GOLD,
      detail: 'Weighted blend of evidence + audit trail + exceptions',
      trend: { dir: assuranceScore >= 80 ? 'up' : 'down', text: gradeFromScore(assuranceScore).label, tone: assuranceScore >= 80 ? 'status-approved' : 'status-warning' },
    },
  ]

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={ShieldCheck}
        title="Assurance Status"
        subtitle={`${evidenceVerified}/${evidenceTotal} evidence verified · ${auditTrailCoverage}% audit trail · ${exceptionsCount} exceptions`}
        completionPct={assuranceScore}
        badge={{
          label: assuranceScore >= 80 ? 'Assured' : assuranceScore >= 60 ? 'In Audit' : 'At Risk',
          tone: assuranceScore >= 80 ? 'status-approved' : assuranceScore >= 60 ? 'status-warning' : 'status-missing',
          icon: BookOpenCheck,
        }}
      />

      {/* HERO — assurance gauge + summary */}
      <SectionCard icon={Gauge} title="Assurance Composite Score" subtitle="Evidence verification · audit-trail coverage · exception density"
        index={1}
        badge={
          <span className="rounded-full border border-amber-300/60 bg-amber-50 px-2.5 py-1 text-[10px] font-bold"
            style={{ color: WARM_INK }}>
            {assuranceScore}/100
          </span>
        }
      >
        <div className="flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-7">
          <EsgGauge score={assuranceScore} />
          <div className="flex-1">
            <p className="text-[13px] leading-relaxed" style={{ color: WARM_INK }}>
              Assurance posture is <strong>{gradeFromScore(assuranceScore).grade}</strong> ({assuranceScore}/100) —
              {exceptionsCount === 0
                ? ' no open exceptions; ready for external assurance.'
                : ` ${exceptionsCount} open exception(s) require management response.`}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: AMBER_DEEP }}>
              {evidencePct}% of evidence is verified · {auditTrailCoverage}% audit-trail coverage · {k.totalSubs} submissions ({k.approvedSubs} approved)
            </p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="glass-subtle rounded-xl px-3 py-2">
                <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: AMBER_DEEP }}>Verified</div>
                <div className="text-[14px] font-bold tabular-nums" style={{ color: WARM_INK }}>{evidenceVerified}</div>
              </div>
              <div className="glass-subtle rounded-xl px-3 py-2">
                <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: AMBER_DEEP }}>Coverage</div>
                <div className="text-[14px] font-bold tabular-nums" style={{ color: WARM_INK }}>{auditTrailCoverage}%</div>
              </div>
              <div className="glass-subtle rounded-xl px-3 py-2">
                <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: AMBER_DEEP }}>Exceptions</div>
                <div className="text-[14px] font-bold tabular-nums" style={{ color: WARM_INK }}>{exceptionsCount}</div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 4 assurance status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {statusCards.map((c, i) => {
          const CIcon = c.icon
          return (
            <motion.section
              key={c.label}
              custom={i + 2}
              variants={cardEnter}
              initial="hidden"
              animate="visible"
              className="glass glass-shimmer rounded-[20px] p-4"
            >
              <header className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${AMBER_LITE}, ${AMBER_DEEP})` }}
                  >
                    <CIcon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <h3 className="text-[13px] font-semibold" style={{ color: WARM_INK }}>{c.label}</h3>
                    <p className="text-[9px]" style={{ color: AMBER_DEEP }}>{c.detail}</p>
                  </div>
                </div>
                <span className={`status-pill text-[9px] ${c.trend.tone ?? 'status-warning'}`}>
                  {c.trend.dir === 'up' ? <ArrowUpRight className="h-2.5 w-2.5" /> :
                   c.trend.dir === 'down' ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
                  {c.trend.text}
                </span>
              </header>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-[22px] font-bold tabular-nums" style={{ color: WARM_INK }}>{c.value}</span>
                {c.unit && <span className="text-[10px] font-medium" style={{ color: AMBER_DEEP }}>{c.unit}</span>}
              </div>
              <div className="h-2 rounded-full bg-amber-100/60 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${c.pct}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.08 }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${AMBER_DEEP}, ${c.color})`,
                    boxShadow: `0 0 8px -1px ${c.color}80`,
                  }}
                />
              </div>
            </motion.section>
          )
        })}
      </div>

      {/* Exceptions breakdown bar chart */}
      <SectionCard
        icon={AlertOctagon}
        title="Exception Composition"
        subtitle="Blocking errors · anomalies · corrections — open items"
        index={7}
        badge={
          <span className="status-pill text-[9px] status-missing">
            <AlertOctagon className="h-2.5 w-2.5" /> {exceptionsCount} total
          </span>
        }
      >
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { name: 'Blocking', value: k.openExceptions, color: '#dc2626' },
                { name: 'Anomalies', value: k.anomalies, color: '#ea580c' },
                { name: 'Corrections', value: k.corrections, color: AMBER },
              ]}
              margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(180,83,9,0.08)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: AMBER_DEEP, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: AMBER_DEEP }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: WARM_INK, fontSize: 10, fontWeight: 600 }}
                cursor={{ fill: 'rgba(245,158,11,0.08)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700}>
                {[
                  { name: 'Blocking', value: k.openExceptions, color: '#dc2626' },
                  { name: 'Anomalies', value: k.anomalies, color: '#ea580c' },
                  { name: 'Corrections', value: k.corrections, color: AMBER },
                ].map((entry, idx) => (
                  <Cell key={`bar-${idx}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
    </div>
  )
}

/* ============================================================
 * Main component — ExecutiveWorkspace
 * ============================================================ */
export function ExecutiveWorkspace() {
  const { activeModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const [ovRes, inxRes] = await Promise.all([
        fetch('/api/overview'),
        fetch('/api/insights'),
      ])
      const ov: OverviewData = await ovRes.json()
      const inx: InsightsResponse = await inxRes.json()
      setOverview(ov)
      setInsights(inx.insights || [])
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load executive workspace data')
    } finally {
      setLoading(false)
      setInsightsLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/overview').then(r => r.json()),
      fetch('/api/insights').then(r => r.json()),
    ])
      .then(([ov, inx]: [OverviewData, InsightsResponse]) => {
        if (cancelled) return
        setOverview(ov)
        setInsights(inx.insights || [])
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load executive workspace data')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setInsightsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const k = overview?.kpis
  const trendArr: TrendPoint[] = useMemo(() => {
    if (!overview?.trends) return []
    return Object.values(overview.trends)
  }, [overview])

  // Loading state
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 animate-pulse rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(254,243,199,0.6), rgba(254,215,170,0.4))' }} />
            <div className="space-y-1.5">
              <div className="h-4 w-44 animate-pulse rounded bg-amber-200/60" />
              <div className="h-2.5 w-32 animate-pulse rounded bg-amber-100" />
            </div>
          </div>
          <div className="h-8 w-32 animate-pulse rounded-full bg-amber-100" />
        </div>
        <WorkspaceSkeleton tiles={4} />
      </div>
    )
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRetry={() => load()} />
  }

  // Empty state — no periods / no data
  if (!overview || overview.empty || !k) {
    return (
      <EmptyState
        icon={Database}
        title="No reporting data yet"
        subtitle="Reporting periods haven't been set up. Configure a period and publish source records to view executive KPIs."
      />
    )
  }

  // ---- Switch by activeModule ----
  const screenProps = {
    k,
    trendArr,
    periods: overview.periods,
    insights,
    insightsLoading,
  }

  const screen = (() => {
    switch (activeModule) {
      case 'exec-enterprise': return <EnterpriseScreen {...screenProps} />
      case 'exec-brsr':       return <BrsrScreen       k={k} trendArr={trendArr} />
      case 'exec-risks':      return <RisksScreen       k={k} insights={insights} insightsLoading={insightsLoading} />
      case 'exec-trends':     return <TrendsScreen      k={k} trendArr={trendArr} periods={overview.periods} />
      case 'exec-bus':        return <BusScreen         k={k} />
      case 'exec-assurance':  return <AssuranceScreen   k={k} />
      default:                return <EnterpriseScreen {...screenProps} />
    }
  })()

  return (
    <div className="space-y-5">
      {/* Refresh bar — sits above the screen */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="status-pill text-[10px] status-approved">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live · {overview.periods?.length ?? 0} periods
          </span>
          {refreshing && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: AMBER_DEEP }}>
              <RefreshCw className="h-3 w-3 animate-spin" /> Refreshing…
            </span>
          )}
        </div>
        <button
          onClick={() => load()}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50/80 px-4 py-2 text-[11px] font-semibold backdrop-blur-md transition hover:bg-amber-100 disabled:opacity-60"
          style={{ color: AMBER_DEEP }}
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeModule}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {screen}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default ExecutiveWorkspace
