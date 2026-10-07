'use client'
/**
 * BrsrManagerDashboard — BRSR Compliance Manager console.
 *
 * DISTINCTLY DIFFERENT — Green/Teal-deep palette (#059669 / #0d9488 / #115e59)
 * and a TOP readiness banner + 2-column (60/40) layout purpose-built for
 * BRSR compliance + reporting (Section A/B/C + principles P1-P9).
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  TOP BANNER: BRSR Readiness % big + Section A/B/C bars + P1-P9 dots │
 *  ├────────────────────────────────────┬────────────────────────────────┤
 *  │  LEFT (60%)                        │  RIGHT (40%)                   │
 *  │  • Section A questions list        │  • Indicator Explorer table    │
 *  │  • Section C P1-P9 principle cards │  • Report Generation + list    │
 *  │    with readiness % drill-down     │  • Missing items list          │
 *  └────────────────────────────────────┴────────────────────────────────┘
 *
 * Data sources:
 *   - GET /api/overview                → kpis.brsrReadiness, kpis.brsrMissing
 *   - GET /api/brsr/frameworks          → framework list (for frameworkId)
 *   - GET /api/brsr/readiness?frameworkId=  → bySection / byPrinciple /
 *                                              missingItems (best-effort)
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, ShieldCheck, Award, RefreshCw, ChevronRight,
  AlertOctagon, AlertTriangle, Sparkles, Download, FileCheck2,
  CheckCircle2, XCircle, Clock, PenLine, FileDown, BookOpen,
  Layers, ListChecks, ArrowRight, FilePlus2, Building2, Scale,
  Hash, Activity as ActivityIcon,
} from 'lucide-react'
import { useApp, type ModuleKey } from '@/lib/auth-context'

/* ============================================================
 * Types
 * ============================================================ */
interface Kpis {
  brsrReadiness: number; brsrMissing: number
  totalEmissions: number; energyGJ: number; waterWithdrawalKL: number
  totalWorkforce: number; projects: number; orgs: number
  completion: number; totalSubs: number; approvedSubs: number
}
interface OverviewData {
  kpis: Kpis
  activities?: ActivityItem[]
}
interface ActivityItem {
  id: string; actorName: string; action: string; title: string
  module?: string | null; createdAt: string
  project?: { projectName: string; projectCode: string } | null
}
interface Framework {
  id: string; name: string; version: string
  reportingYear: number; tier: string; status: string
  counts: { sections: number; principles: number; questions: number; answers: number }
}
interface FrameworksResponse { items?: Framework[]; frameworks?: Framework[] }
interface BrsrReadiness {
  overall: number
  bySection: Record<string, { total: number; ready: number; pct: number }>
  byPrinciple: Record<string, { total: number; ready: number; pct: number }>
  missingItems: Array<{ questionId: string; questionCode: string; questionText: string; section: string | null; principle: string | null; status: string }>
  pendingEvidence: number
  pendingApprovals: number
}
interface BrsrQuestion {
  id: string; code: string; text: string; section: { code: string; name?: string } | null
  principle: { code: string; name?: string } | null
  answers?: Array<{ id: string; status: string; value?: string | null; source?: string | null }>
}
interface QuestionsResponse { items?: BrsrQuestion[] }

/* ============================================================
 * Constants — Green / Teal-deep compliance palette
 * ============================================================ */
const GREEN = '#059669'
const GREEN_DEEP = '#047857'
const TEAL_DEEP = '#0d9488'
const TEAL_DARK = '#115e59'

const SECTION_LABELS: Record<string, string> = {
  A: 'Section A — General',
  B: 'Section B — Management & Process',
  C: 'Section C — Principle-wise Performance',
}
const PRINCIPLES_P1_P9 = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']
const PRINCIPLE_NAMES: Record<string, string> = {
  P1: 'Ethics & Transparency',
  P2: 'Sustainable & Safe Products',
  P3: 'Employee Well-being',
  P4: 'Stakeholder Engagement',
  P5: 'Human Rights',
  P6: 'Environment',
  P7: 'Public Policy',
  P8: 'Inclusive Growth',
  P9: 'Engagement',
}

/* ============================================================
 * Helpers
 * ============================================================ */
function fmt(n: number, d = 0): string { return n.toLocaleString('en-IN', { maximumFractionDigits: d }) }
function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
function answerStatusPill(status: string | undefined): { cls: string; label: string } {
  const u = (status || '').toUpperCase()
  if (u === 'APPROVED' || u === 'LOCKED') return { cls: 'status-approved', label: 'Answered' }
  if (u === 'MISSING' || u === '') return { cls: 'status-missing', label: 'Missing' }
  if (u === 'EVIDENCE_VERIFIED' || u === 'VERIFIED') return { cls: 'status-verified', label: 'Verified' }
  if (u === 'SUBMITTED') return { cls: 'status-submitted', label: 'Submitted' }
  if (u === 'DRAFT') return { cls: 'status-draft', label: 'Draft' }
  return { cls: 'status-review', label: u ? u[0] + u.slice(1).toLowerCase() : '—' }
}

/* ============================================================
 * Main component
 * ============================================================ */
export function BrsrManagerDashboard() {
  const { setActiveModule } = useApp()
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [readiness, setReadiness] = useState<BrsrReadiness | null>(null)
  const [sectionAQuestions, setSectionAQuestions] = useState<BrsrQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const mountedRef = useRef(true)

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/overview', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as OverviewData
      if (!mountedRef.current) return
      setOverview(data); setError('')
    } catch (e) {
      if (!mountedRef.current) return
      if (!overview) setError(e instanceof Error ? e.message : 'Failed to load BRSR overview')
    }
  }, [overview])

  const fetchFrameworks = useCallback(async () => {
    try {
      const res = await fetch('/api/brsr/frameworks', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as FrameworksResponse
      const list = data.items || data.frameworks || []
      if (!mountedRef.current) return
      setFrameworks(Array.isArray(list) ? list : [])
    } catch { /* silent */ }
  }, [])

  // after frameworks load, pick the latest ACTIVE (or first) and fetch readiness + section-A questions
  const activeFrameworkId = useMemo(() => {
    if (frameworks.length === 0) return null
    const active = frameworks.find(f => (f.status || '').toUpperCase() === 'ACTIVE')
    return (active || frameworks[0]).id
  }, [frameworks])

  const fetchReadiness = useCallback(async () => {
    if (!activeFrameworkId) return
    try {
      const res = await fetch(`/api/brsr/readiness?frameworkId=${activeFrameworkId}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as BrsrReadiness
      if (!mountedRef.current) return
      setReadiness(data)
    } catch { /* silent — overview fallback will keep the page usable */ }
  }, [activeFrameworkId])

  const fetchSectionAQuestions = useCallback(async () => {
    if (!activeFrameworkId) return
    try {
      const res = await fetch(`/api/brsr/questions?frameworkId=${activeFrameworkId}&section=A`, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as QuestionsResponse
      if (!mountedRef.current) return
      setSectionAQuestions(Array.isArray(data.items) ? data.items.slice(0, 8) : [])
    } catch { /* silent */ }
  }, [activeFrameworkId])

  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      setLoading(true)
      await Promise.all([fetchOverview(), fetchFrameworks()])
      if (mountedRef.current) setLoading(false)
    })()
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (activeFrameworkId) {
      Promise.all([fetchReadiness(), fetchSectionAQuestions()])
    }
  }, [activeFrameworkId, fetchReadiness, fetchSectionAQuestions])

  /* Section readiness — use readiness.bySection OR fallback */
  const sections = useMemo(() => {
    if (readiness?.bySection) {
      return ['A', 'B', 'C'].map(s => {
        const d = readiness.bySection[s] || { total: 0, ready: 0, pct: 0 }
        return { code: s, label: SECTION_LABELS[s] || s, total: d.total, ready: d.ready, pct: d.pct }
      }).filter(s => s.total > 0)
    }
    // fallback from overview.kpis
    if (overview) {
      const r = Math.round(overview.kpis.brsrReadiness)
      return [
        { code: 'A', label: SECTION_LABELS.A, total: 0, ready: 0, pct: r },
        { code: 'B', label: SECTION_LABELS.B, total: 0, ready: 0, pct: r },
        { code: 'C', label: SECTION_LABELS.C, total: 0, ready: 0, pct: r },
      ]
    }
    return []
  }, [readiness, overview])

  /* Principle readiness — use readiness.byPrinciple OR fallback */
  const principles = useMemo(() => {
    if (readiness?.byPrinciple) {
      return PRINCIPLES_P1_P9.map(code => {
        const d = readiness.byPrinciple[code] || { total: 0, ready: 0, pct: 0 }
        return { code, name: PRINCIPLE_NAMES[code] || code, total: d.total, ready: d.ready, pct: d.pct }
      })
    }
    if (overview) {
      const r = Math.round(overview.kpis.brsrReadiness)
      return PRINCIPLES_P1_P9.map(code => ({ code, name: PRINCIPLE_NAMES[code] || code, total: 0, ready: 0, pct: r }))
    }
    return []
  }, [readiness, overview])

  /* overall readiness */
  const overallReady = useMemo(() => {
    if (readiness?.overall != null) return readiness.overall
    if (overview) return Math.round(overview.kpis.brsrReadiness)
    return 0
  }, [readiness, overview])

  /* missing items */
  const missingItems = useMemo(() => readiness?.missingItems || [], [readiness])
  const missingCount = missingItems.length || overview?.kpis.brsrMissing || 0

  /* indicator explorer rows — derive from sectionA + missingItems */
  const indicatorRows = useMemo(() => {
    const rows: { code: string; question: string; source: string; status: string; value: string }[] = []
    for (const q of sectionAQuestions) {
      const ans = q.answers && q.answers[0]
      rows.push({
        code: q.code,
        question: (q.text || '').slice(0, 60) + ((q.text || '').length > 60 ? '…' : ''),
        source: ans?.source || 'System',
        status: ans?.status || 'MISSING',
        value: ans?.value || '—',
      })
    }
    // also surface missing items from readiness
    for (const m of missingItems.slice(0, 6)) {
      rows.push({
        code: m.questionCode,
        question: (m.questionText || '').slice(0, 60) + ((m.questionText || '').length > 60 ? '…' : ''),
        source: 'Missing',
        status: m.status || 'MISSING',
        value: '—',
      })
    }
    return rows.slice(0, 10)
  }, [sectionAQuestions, missingItems])

  /* recent reports (mock list — generated from missing readiness data) */
  const recentReports = useMemo(() => ([
    { id: 'RPT-FY24-Q4', name: 'BRSR FY24 Q4 Consolidated', framework: 'BRSR v3.0', generatedAt: new Date(Date.now() - 86400000 * 2).toISOString(), size: '1.8 MB', status: 'LOCKED' },
    { id: 'RPT-FY24-Q3', name: 'BRSR FY24 Q3 Draft', framework: 'BRSR v3.0', generatedAt: new Date(Date.now() - 86400000 * 14).toISOString(), size: '1.6 MB', status: 'DRAFT' },
    { id: 'RPT-FY23', name: 'BRSR FY23 Annual (archived)', framework: 'BRSR v2.0', generatedAt: new Date(Date.now() - 86400000 * 60).toISOString(), size: '2.1 MB', status: 'LOCKED' },
  ]), [])

  const onGenerate = useCallback(() => {
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      setActiveModule('reports')
    }, 800)
  }, [setActiveModule])

  /* ---- render states ---- */
  if (loading) return <BrsrSkeleton />
  if (error && !overview) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!overview) return <EmptyState />
  const k = overview.kpis
  const activeFramework = frameworks.find(f => f.id === activeFrameworkId)

  return (
    <div className="space-y-5">
      {/* ============================
          HEADER
         ============================ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-600 to-teal-800 text-white shadow-lg shadow-green-600/40">
              <FileText className="h-5 w-5" />
            </span>
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900">BRSR Compliance Console</h1>
            <span className="status-pill status-verified">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-600" /> Live
            </span>
          </div>
          <p className="mt-1 text-[12px] text-slate-600">
            Framework {activeFramework?.version || 'BRSR v3.0'} · Reporting year {activeFramework?.reportingYear || new Date().getFullYear()} · {k.orgs} group(s) · {k.projects} projects
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-slate-700">
            <Award className="h-3.5 w-3.5 text-green-700" />
            {overallReady}% ready
          </span>
          <button
            onClick={() => setActiveModule('brsr')}
            className="rounded-full bg-gradient-to-br from-green-600 to-teal-800 px-4 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-green-600/30 transition-transform hover:scale-[1.03]"
          >
            Open BRSR module
          </button>
        </div>
      </motion.div>

      {/* ============================
          TOP BANNER — BRSR readiness + section bars + principle dots
         ============================ */}
      <ReadinessBanner
        overallReady={overallReady}
        sections={sections}
        principles={principles}
        missingCount={missingCount}
        onOpenModule={() => setActiveModule('brsr')}
      />

      {/* ============================
          2-COLUMN GRID (60/40)
         ============================ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* ---- LEFT 60% ---- */}
        <div className="space-y-5">
          {/* Section A questions list */}
          <SectionACard questions={sectionAQuestions} onOpen={() => setActiveModule('brsr')} />

          {/* Section C P1-P9 principle cards */}
          <SectionCCard principles={principles} onOpen={() => setActiveModule('brsr')} />
        </div>

        {/* ---- RIGHT 40% ---- */}
        <div className="space-y-5">
          {/* Indicator Explorer */}
          <IndicatorExplorerCard rows={indicatorRows} onOpen={() => setActiveModule('brsr')} />

          {/* Report Generation */}
          <ReportGenerationCard
            onGenerate={onGenerate}
            generating={generating}
            recentReports={recentReports}
            frameworkVersion={activeFramework?.version || 'BRSR v3.0'}
          />

          {/* Missing items list */}
          <MissingItemsCard items={missingItems} fallbackCount={missingCount} onOpen={() => setActiveModule('audit')} />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
 * Sub-components
 * ============================================================ */

/* ---------- Readiness top banner ---------- */
function ReadinessBanner({
  overallReady, sections, principles, missingCount, onOpenModule,
}: {
  overallReady: number
  sections: { code: string; label: string; total: number; ready: number; pct: number }[]
  principles: { code: string; name: string; total: number; ready: number; pct: number }[]
  missingCount: number
  onOpenModule: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.45 }}
      className="glass-strong relative overflow-hidden rounded-2xl p-5 shadow-xl shadow-green-900/10"
    >
      <div className="orb -right-12 -top-16 h-48 w-48 bg-teal-400/25" />
      <div className="orb -left-8 -bottom-12 h-36 w-36 bg-emerald-400/20" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* big readiness % */}
        <div className="flex items-center gap-4">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-green-600 via-teal-700 to-teal-900 text-white shadow-lg shadow-green-700/40">
            <div className="text-center">
              <div className="text-[24px] font-extrabold leading-none tabular-nums">{overallReady}%</div>
              <div className="text-[8px] font-semibold uppercase tracking-wider opacity-90">Ready</div>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-green-700">BRSR Readiness</div>
            <h2 className="mt-0.5 text-[18px] font-bold tracking-tight text-slate-900">Group-wide compliance</h2>
            <p className="mt-0.5 text-[12px] text-slate-600">{missingCount} indicator(s) missing</p>
          </div>
        </div>

        {/* section bars */}
        <div className="flex-1 lg:px-6">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Section readiness</div>
          <div className="mt-2 space-y-2">
            {sections.map(s => (
              <div key={s.code} className="flex items-center gap-2">
                <span className="w-3 text-[11px] font-bold text-green-700">{s.code}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gradient-to-r from-green-100 to-teal-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, s.pct)}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-gradient-to-r from-green-500 via-emerald-600 to-teal-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                  />
                </div>
                <span className="w-12 text-right text-[11px] font-semibold tabular-nums text-slate-700">{Math.round(s.pct)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* principle dots */}
        <div className="lg:max-w-[260px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Principle readiness</div>
          <div className="mt-2 grid grid-cols-9 gap-1">
            {principles.map(p => {
              const tone =
                p.pct >= 75 ? 'bg-gradient-to-br from-green-500 to-emerald-700' :
                p.pct >= 50 ? 'bg-gradient-to-br from-teal-500 to-green-700' :
                p.pct >= 25 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                'bg-gradient-to-br from-rose-400 to-red-500'
              return (
                <div key={p.code} className="group relative flex flex-col items-center" title={`${p.code}: ${p.name} — ${Math.round(p.pct)}%`}>
                  <div className={`h-7 w-7 rounded-full ${tone} flex items-center justify-center text-[10px] font-bold text-white shadow-md transition-transform group-hover:scale-110`}>
                    {p.code.replace('P', '')}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-1.5 text-right text-[9px] text-slate-500">P1-P9 · green ≥ 75% · amber 25-50% · red &lt; 25%</div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onOpenModule}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-br from-green-600 to-teal-800 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md transition-transform hover:scale-[1.03]"
        >
          Open framework <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

/* ---------- Section A questions list ---------- */
function SectionACard({
  questions, onOpen,
}: {
  questions: BrsrQuestion[]
  onOpen: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-green-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-green-700" />
          <h2 className="text-[13px] font-semibold text-slate-900">Section A — General Disclosures</h2>
          <span className="status-pill status-submitted">{questions.length}</span>
        </div>
        <button onClick={onOpen} className="flex items-center gap-1 text-[11px] font-semibold text-green-700 hover:text-green-800">
          All questions <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      {questions.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-slate-500">No Section A questions available.</div>
      ) : (
        <ul className="scroll-elegant max-h-80 space-y-2 overflow-y-auto pr-1">
          {questions.map((q, i) => {
            const ans = q.answers && q.answers[0]
            const pill = answerStatusPill(ans?.status)
            return (
              <motion.li
                key={q.id || i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + i * 0.04 }}
                className="flex items-start gap-2.5 rounded-xl border border-green-50/70 bg-white/55 p-2.5 transition-colors hover:bg-green-50/40"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-teal-700 text-white shadow">
                  <Hash className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[10px] font-bold text-green-700">{q.code}</span>
                    <span className={`status-pill ${pill.cls}`}>{pill.label}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-700">{q.text || '—'}</p>
                  {ans?.value && <p className="mt-0.5 truncate text-[10px] text-slate-500">→ {ans.value}</p>}
                </div>
              </motion.li>
            )
          })}
        </ul>
      )}
    </motion.div>
  )
}

/* ---------- Section C principle cards (P1-P9) ---------- */
function SectionCCard({
  principles, onOpen,
}: {
  principles: { code: string; name: string; total: number; ready: number; pct: number }[]
  onOpen: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-green-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-green-700" />
          <h2 className="text-[13px] font-semibold text-slate-900">Section C — Principle-wise Performance</h2>
        </div>
        <button onClick={onOpen} className="text-[11px] font-semibold text-green-700 hover:text-green-800">Drill-down →</button>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {principles.map((p, i) => {
          const tone =
            p.pct >= 75 ? 'border-emerald-200 bg-emerald-50/40' :
            p.pct >= 50 ? 'border-teal-200 bg-teal-50/40' :
            p.pct >= 25 ? 'border-amber-200 bg-amber-50/40' :
            'border-rose-200 bg-rose-50/40'
          const bar =
            p.pct >= 75 ? 'from-green-500 to-emerald-700' :
            p.pct >= 50 ? 'from-teal-500 to-green-700' :
            p.pct >= 25 ? 'from-amber-400 to-orange-500' :
            'from-rose-400 to-red-500'
          return (
            <motion.button
              key={p.code}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.22 + i * 0.03 }}
              onClick={onOpen}
              className={`rounded-xl border p-2.5 text-left transition-all hover:scale-[1.02] ${tone}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-green-700">{p.code}</span>
                <span className="text-[10px] font-semibold tabular-nums text-slate-700">{Math.round(p.pct)}%</span>
              </div>
              <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-800">{p.name}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/60">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, p.pct)}%` }}
                  transition={{ duration: 0.8, delay: 0.25 + i * 0.03 }}
                  className={`h-full rounded-full bg-gradient-to-r ${bar}`}
                />
              </div>
              <div className="mt-1 text-[9px] text-slate-500">{p.ready}/{p.total} ready</div>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ---------- Indicator explorer table ---------- */
function IndicatorExplorerCard({
  rows, onOpen,
}: {
  rows: { code: string; question: string; source: string; status: string; value: string }[]
  onOpen: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.21, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-green-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-green-700" />
          <h2 className="text-[13px] font-semibold text-slate-900">Indicator Explorer</h2>
        </div>
        <button onClick={onOpen} className="text-[11px] font-semibold text-green-700 hover:text-green-800">Open →</button>
      </div>
      <div className="overflow-hidden rounded-xl border border-green-100/60 bg-white/60">
        <table className="w-full text-left text-[10px]">
          <thead className="border-b border-green-100/70 bg-green-50/50 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-2 py-1.5">Code</th>
              <th className="px-2 py-1.5">Question</th>
              <th className="px-2 py-1.5">Source</th>
              <th className="px-2 py-1.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-2 py-5 text-center text-slate-500">No indicators loaded.</td></tr>
            ) : rows.map((r, i) => {
              const pill = answerStatusPill(r.status)
              return (
                <tr key={i} className="border-b border-green-50/60 transition-colors hover:bg-green-50/40">
                  <td className="px-2 py-1.5 font-mono font-bold text-green-700">{r.code}</td>
                  <td className="px-2 py-1.5 text-slate-700">{r.question}</td>
                  <td className="px-2 py-1.5 text-slate-600">{r.source}</td>
                  <td className="px-2 py-1.5 text-right"><span className={`status-pill ${pill.cls}`}>{pill.label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

/* ---------- Report generation card ---------- */
function ReportGenerationCard({
  onGenerate, generating, recentReports, frameworkVersion,
}: {
  onGenerate: () => void; generating: boolean
  recentReports: { id: string; name: string; framework: string; generatedAt: string; size: string; status: string }[]
  frameworkVersion: string
}) {
  const statusPill = (s: string) => s === 'LOCKED' ? 'status-approved' : 'status-draft'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-green-900/5"
    >
      <div className="mb-3 flex items-center gap-2">
        <FileDown className="h-4 w-4 text-green-700" />
        <h2 className="text-[13px] font-semibold text-slate-900">Report Generation</h2>
      </div>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-green-600 via-emerald-700 to-teal-800 px-4 py-2.5 text-[12px] font-bold text-white shadow-md shadow-green-700/30 transition-all hover:scale-[1.01] disabled:opacity-60"
      >
        {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
        Generate BRSR Report
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold">{frameworkVersion}</span>
      </button>
      <div className="mt-3">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recent reports</div>
        <ul className="scroll-elegant max-h-44 space-y-1.5 overflow-y-auto pr-1">
          {recentReports.map((r, i) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.28 + i * 0.04 }}
              className="flex items-center justify-between gap-2 rounded-lg border border-green-50/60 bg-white/55 px-2.5 py-2 transition-colors hover:bg-green-50/40"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-slate-800">{r.name}</div>
                <div className="text-[10px] text-slate-500">{r.framework} · {r.size} · {timeAgo(r.generatedAt)}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`status-pill ${statusPill(r.status)}`}>{r.status}</span>
                <Download className="h-3 w-3 text-green-700" />
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

/* ---------- Missing items list ---------- */
function MissingItemsCard({
  items, fallbackCount, onOpen,
}: {
  items: BrsrReadiness['missingItems']
  fallbackCount: number
  onOpen: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.27, duration: 0.45 }}
      className="glass glass-shimmer rounded-2xl p-4 shadow-lg shadow-green-900/5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-rose-600" />
          <h2 className="text-[13px] font-semibold text-slate-900">Missing BRSR Items</h2>
          <span className="status-pill status-error">{items.length || fallbackCount}</span>
        </div>
        <button onClick={onOpen} className="text-[11px] font-semibold text-rose-600 hover:text-rose-700">Resolve →</button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3 text-center text-[11px] text-emerald-700">
          <CheckCircle2 className="mx-auto mb-1 h-5 w-5" />
          {fallbackCount > 0
            ? `${fallbackCount} indicator(s) reported missing — drill into the BRSR module for the live list.`
            : 'No missing indicators detected. BRSR is fully ready!'}
        </div>
      ) : (
        <ul className="scroll-elegant max-h-60 space-y-1.5 overflow-y-auto pr-1">
          {items.slice(0, 10).map((m, i) => (
            <motion.li
              key={m.questionId || i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.04 }}
              className="flex items-start gap-2 rounded-lg border border-rose-100/60 bg-rose-50/30 p-2 transition-colors hover:bg-rose-50/60"
            >
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold text-rose-700">{m.questionCode}</span>
                  <span className="text-[9px] text-slate-500">{m.section || '—'} · {m.principle || '—'}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-700">{m.questionText}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}

/* ============================================================
 * Loading / Error / Empty states
 * ============================================================ */
function BrsrSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-12 animate-pulse rounded-2xl bg-green-100/60" />
      <div className="h-32 animate-pulse rounded-2xl bg-green-100/40" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="h-72 animate-pulse rounded-2xl bg-green-100/40" />
          <div className="h-56 animate-pulse rounded-2xl bg-green-100/40" />
        </div>
        <div className="space-y-5">
          <div className="h-48 animate-pulse rounded-2xl bg-green-100/40" />
          <div className="h-44 animate-pulse rounded-2xl bg-green-100/40" />
          <div className="h-44 animate-pulse rounded-2xl bg-green-100/40" />
        </div>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center shadow-lg">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <AlertOctagon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">BRSR console unavailable</h3>
      <p className="mt-1 text-[12px] text-slate-600">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-full bg-gradient-to-br from-green-600 to-teal-800 px-4 py-2 text-[11px] font-semibold text-white shadow-md">
        <RefreshCw className="mr-1 inline h-3 w-3" /> Retry
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl p-10 text-center shadow-lg">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
        <FileText className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">No BRSR framework loaded</h3>
      <p className="mt-1 text-[12px] text-slate-600">Once a BRSR framework is configured, the compliance console will populate here.</p>
    </div>
  )
}
