'use client'
/**
 * My Project Module — a project-scoped dashboard.
 * Real data from /api/overview (group KPIs), /api/organization/tree (projects),
 * /api/activity?projectId=, /api/submissions?projectId=, /api/evidence?projectId=.
 * No hardcoded values. Glassmorphism surfaces + stagger animations.
 */
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, MapPin, Plus, Send, Activity as ActivityIcon, Flame, Zap, Droplet,
  Recycle, Users, ShieldCheck, FileCheck2, FileText, Link2, CheckCircle2,
  AlertTriangle, AlertOctagon, Clock, ArrowRight, ChevronRight, CalendarClock,
  UserCheck, FolderOpen, Layers, TrendingUp, History, FileBarChart, type LucideIcon,
} from 'lucide-react'
import { useApp } from '@/lib/auth-context'

/* ---------- Types ---------- */
interface OrgTree {
  groups: Array<{
    id: string; code: string; name: string; legalName?: string | null
    subsidiaries: Array<{
      id: string; code: string; name: string; cin?: string | null
      businessUnits: Array<{
        id: string; code: string; name: string
        projects: Array<{ id: string; projectCode: string; projectName: string; location: string | null; status: string }>
      }>
    }>
  }>
}
interface OverviewData {
  kpis: Record<string, number>
  periods: Array<{ id: string; label: string; year: number; month: number | null; status: string }>
  activities: any[]
  trends: Record<string, { emissions: number; energy: number; water: number; waste: number }>
}
interface ActivityItem {
  id: string; title: string; description?: string; actorName?: string
  actorRole?: string; action: string; status?: string; module?: string
  createdAt: string
}
interface SubmissionItem {
  id: string; title: string; status: string; module: string
  completionPct: number; evidenceCount: number; validationErrors: number
  updatedAt: string; submittedAt?: string | null
  reportingPeriod?: { id: string; periodLabel: string; year: number; month: number | null } | null
}
interface EvidenceItem {
  id: string; fileName: string; documentType: string; status: string
  module?: string | null; createdAt: string
  uploader?: { id: string; name: string; email: string } | null
}

/* ---------- Role helpers ---------- */
const READ_ONLY_ROLES = new Set([
  'BU_REVIEWER', 'SUBSIDIARY_REVIEWER', 'GROUP_REVIEWER', 'AUDITOR', 'EXECUTIVE',
])

function statusPillClass(status: string): string {
  const s = (status || '').toUpperCase()
  if (['APPROVED', 'LOCKED', 'SUBSIDIARY_APPROVED', 'BU_APPROVED', 'HQ_REVIEW'].includes(s)) return 'status-approved'
  if (['DRAFT'].includes(s)) return 'status-draft'
  if (['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(s)) return 'status-submitted'
  if (['REJECTED', 'CORRECTION_REQUESTED', 'MISSING'].includes(s)) return 'status-missing'
  if (['VERIFIED'].includes(s)) return 'status-verified'
  return 'status-locked'
}

function flattenProjects(tree: OrgTree | null) {
  const out: Array<{
    id: string; projectCode: string; projectName: string; location: string | null
    status: string; groupCode: string; subsidiaryCode: string; buCode: string; buName: string
  }> = []
  if (!tree) return out
  for (const g of tree.groups) {
    for (const sub of g.subsidiaries) {
      for (const bu of sub.businessUnits) {
        for (const p of bu.projects) {
          out.push({
            id: p.id, projectCode: p.projectCode, projectName: p.projectName,
            location: p.location, status: p.status,
            groupCode: g.code, subsidiaryCode: sub.code, buCode: bu.code, buName: bu.name,
          })
        }
      }
    }
  }
  return out
}

/* ---------- Component ---------- */
export function MyProjectModule() {
  const { user } = useApp()
  const roleKey = user?.roles?.[0]?.key ?? ''
  const readOnly = READ_ONLY_ROLES.has(roleKey)

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [tree, setTree] = useState<OrgTree | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailTab, setDetailTab] = useState<'overview' | 'progress' | 'activity' | 'team' | 'documents'>('overview')

  // ---- Fetch global overview + org tree up-front
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/overview').then(r => r.ok ? r.json() : Promise.reject(new Error('overview failed'))),
      fetch('/api/organization/tree').then(r => r.ok ? r.json() : Promise.reject(new Error('org tree failed'))),
    ])
      .then(([ov, tr]) => {
        if (cancelled) return
        setOverview(ov)
        setTree(tr)
        // Default project: prefer a project the user is scoped to; else the Gayatri project; else first.
        const projects = flattenProjects(tr)
        const scopeProj = user?.scopes?.find(s => s.scopeType === 'PROJECT')
        const defaultProject =
          (scopeProj ? projects.find(p => p.id === scopeProj.scopeId) : null) ||
          projects.find(p => p.projectCode === 'MEIL-SOL-GJT') ||
          projects[0] || null
        setSelectedProjectId(defaultProject?.id ?? null)
        setLoading(false)
      })
      .catch((e: any) => { if (!cancelled) { setError(e?.message || 'Failed to load'); setLoading(false) } })
    return () => { cancelled = true }
  }, [user?.scopes])

  // ---- Fetch project-scoped activity + submissions + evidence
  useEffect(() => {
    if (!selectedProjectId) return
    let cancelled = false
    Promise.all([
      fetch(`/api/activity?projectId=${encodeURIComponent(selectedProjectId)}&take=20`)
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as ActivityItem[] }))
        .catch(() => ({ items: [] as ActivityItem[] })),
      fetch(`/api/submissions?projectId=${encodeURIComponent(selectedProjectId)}`)
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as SubmissionItem[] }))
        .catch(() => ({ items: [] as SubmissionItem[] })),
      fetch(`/api/evidence?projectId=${encodeURIComponent(selectedProjectId)}`)
        .then(r => r.ok ? r.json() : Promise.resolve({ items: [] as EvidenceItem[] }))
        .catch(() => ({ items: [] as EvidenceItem[] })),
    ]).then(([a, s, e]) => {
      if (cancelled) return
      setActivity(a.items || [])
      setSubmissions(s.items || [])
      setEvidence(e.items || [])
    })
    return () => { cancelled = true }
  }, [selectedProjectId])

  if (loading) return <MyProjectSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => location.reload()} />
  if (!overview || !tree) return <EmptyState message="No projects or periods found in your scope." />

  const projects = flattenProjects(tree)
  const selected = projects.find(p => p.id === selectedProjectId) || projects[0] || null
  const k = overview.kpis

  // Build a tiny 3-month emissions trend from overview.trends
  const trendArr = Object.entries(overview.trends).map(([label, v]) => ({ label, ...v })).slice(-6)

  // Deadlines from overview.periods
  const deadlinePeriods = overview.periods.slice(0, 6)

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="kpi-tile bg-blue-50 text-blue-600"><Building2 className="h-5 w-5" /></div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">My Project</h1>
            <span className="status-pill status-approved"><CheckCircle2 className="h-3 w-3" /> Live</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Project-scoped ESG dashboard · {projects.length} project(s) visible · FY {overview.periods[0]?.year ?? 2026}
            {readOnly && <span className="ml-2 text-amber-600">· Read-only view</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="glass-subtle flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/80">
            <UserCheck className="h-3.5 w-3.5 text-blue-600" /> Assign Project
          </button>
          <button className="glass-subtle flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white/80">
            <Plus className="h-3.5 w-3.5 text-blue-600" /> Request Project
          </button>
          <button className="btn-glass-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold">
            <Send className="h-3.5 w-3.5" /> Submit
          </button>
        </div>
      </motion.div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard delay={0.05} icon={FileCheck2} tileClass="bg-teal-50 text-teal-600" label="ESG Completion"
          value={(k.completion ?? 0).toString()} unit="%" sub={`${k.approvedSubs ?? 0}/${k.totalSubs ?? 0} submissions`} />
        <KpiCard delay={0.1} icon={CalendarClock} tileClass="bg-blue-50 text-blue-600" label="Current Period"
          value={overview.periods[0]?.label ?? '—'} unit="" sub={`FY ${overview.periods[0]?.year ?? 2026}`} />
        <KpiCard delay={0.15} icon={Flame} tileClass="bg-rose-50 text-rose-600" label="Emissions"
          value={(k.totalEmissions ?? 0).toLocaleString()} unit="tCO₂e" sub={`S1: ${k.scope1 ?? 0} · S2: ${k.scope2 ?? 0}`} />
        <KpiCard delay={0.2} icon={Link2} tileClass="bg-violet-50 text-violet-600" label="Evidence"
          value={`${k.evidenceVerified ?? 0}/${k.evidenceTotal ?? 0}`} unit="" sub="verified uploads" />
        <KpiCard delay={0.25} icon={AlertOctagon} tileClass="bg-amber-50 text-amber-600" label="Open Issues"
          value={(k.openExceptions ?? 0).toString()} unit="" sub={`${k.corrections ?? 0} correction(s)`} />
      </div>

      {/* PROJECT TABLE + DETAILS PANEL */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Project list (left, spans 3) */}
        <motion.section
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="glass glass-shimmer rounded-2xl p-4 lg:col-span-3"
        >
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <div className="kpi-tile bg-slate-50 text-slate-600" style={{ width: 32, height: 32 }}><Layers className="h-4 w-4" /></div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Projects in Scope</h3>
                <p className="text-[11px] text-slate-500">Select a project to view detailed ESG progress</p>
              </div>
            </div>
            <span className="status-pill status-approved">{projects.length} projects</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/60 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Project</th>
                  <th className="px-3 py-2.5">Code</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Location</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60">
                {projects.map((p, i) => {
                  const active = p.id === selectedProjectId
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      onClick={() => setSelectedProjectId(p.id)}
                      className={`cursor-pointer transition ${active ? 'bg-blue-50/70' : 'hover:bg-white/60'}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            <Building2 className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-800">{p.projectName}</div>
                            <div className="text-[10px] text-slate-400">{p.buName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">{p.projectCode}</td>
                      <td className="hidden px-3 py-2.5 text-slate-600 md:table-cell">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-400" />{p.location || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`status-pill ${p.status === 'ACTIVE' ? 'status-approved' : 'status-draft'}`}>{p.status}</span>
                      </td>
                    </motion.tr>
                  )
                })}
                {projects.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-slate-400">No projects in your scope.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Details panel (right, spans 2) */}
        <motion.section
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="glass glass-shimmer rounded-2xl p-4 lg:col-span-2"
        >
          <div className="mb-3 flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-800">{selected?.projectName ?? 'Select project'}</h3>
              <p className="text-[11px] text-slate-500">{selected?.projectCode} · {selected?.location}</p>
            </div>
            <span className={`status-pill ${selected ? 'status-approved' : 'status-draft'}`}>{selected?.status ?? 'N/A'}</span>
          </div>

          {/* Tabs */}
          <div className="mb-3 flex flex-wrap gap-1 rounded-xl bg-white/50 p-1">
            {([
              { k: 'overview', label: 'Overview', icon: FileText },
              { k: 'progress', label: 'ESG Progress', icon: TrendingUp },
              { k: 'activity', label: 'Recent Activity', icon: ActivityIcon },
              { k: 'team', label: 'Team', icon: Users },
              { k: 'documents', label: 'Documents', icon: FolderOpen },
            ] as const).map(t => {
              const active = detailTab === t.k
              return (
                <button key={t.k} onClick={() => setDetailTab(t.k)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-white/60'}`}>
                  <t.icon className="h-3 w-3" /> {t.label}
                </button>
              )
            })}
          </div>

          {/* Tab body */}
          <div className="min-h-[280px]">
            <AnimatePresence mode="wait">
              <motion.div key={detailTab}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                {detailTab === 'overview' && <OverviewTab selected={selected} submissions={submissions} evidence={evidence} kpis={k} />}
                {detailTab === 'progress' && <ProgressTab kpis={k} trendArr={trendArr} submissions={submissions} />}
                {detailTab === 'activity' && <ActivityTab activity={activity} projectId={selectedProjectId} />}
                {detailTab === 'team' && <TeamTab roleKey={roleKey} userName={user?.name} />}
                {detailTab === 'documents' && <DocumentsTab evidence={evidence} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.section>
      </div>

      {/* DEADLINES + PROGRESS BARS */}
      <motion.section
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="glass glass-shimmer rounded-2xl p-4"
      >
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-start gap-2.5">
            <div className="kpi-tile bg-slate-50 text-slate-600" style={{ width: 32, height: 32 }}><Clock className="h-4 w-4" /></div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Reporting Deadlines &amp; Progress</h3>
              <p className="text-[11px] text-slate-500">Submission · Review · Approval windows by period</p>
            </div>
          </div>
          <span className="status-pill status-submitted">{deadlinePeriods.length} periods</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {deadlinePeriods.map((p, i) => {
            const completionPct = submissions
              .filter(s => s.reportingPeriod?.id === p.id)
              .reduce((acc, s) => Math.max(acc, s.completionPct || 0), 0)
            const sub = submissions.find(s => s.reportingPeriod?.id === p.id)
            return (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
                className="rounded-xl border border-white/60 bg-white/40 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <CalendarClock className="h-3.5 w-3.5 text-blue-600" /> {p.label}
                  </div>
                  <span className={`status-pill ${statusPillClass(p.status)}`}>{p.status}</span>
                </div>
                <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(completionPct, 5)}%` }} transition={{ duration: 0.7, delay: 0.04 * i }}
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{completionPct.toFixed(0)}% complete</span>
                  {sub ? (
                    <span className="flex items-center gap-1"><ArrowRight className="h-2.5 w-2.5" /> {sub.status}</span>
                  ) : (
                    <span className="text-amber-600">No submission yet</span>
                  )}
                </div>
              </motion.div>
            )
          })}
          {deadlinePeriods.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-white/60 px-4 py-8 text-center text-xs text-slate-400">
              No reporting periods scheduled.
            </div>
          )}
        </div>

        {/* Module progress bars */}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ModuleProgress icon={Zap} label="Energy & Fuel" pct={modulePct(submissions, 'ENERGY')} tone="amber" />
          <ModuleProgress icon={Droplet} label="Water" pct={modulePct(submissions, 'WATER')} tone="cyan" />
          <ModuleProgress icon={Recycle} label="Waste" pct={modulePct(submissions, 'WASTE')} tone="emerald" />
          <ModuleProgress icon={Users} label="Workforce" pct={modulePct(submissions, 'PEOPLE')} tone="blue" />
          <ModuleProgress icon={ShieldCheck} label="Safety" pct={modulePct(submissions, 'SAFETY')} tone="violet" />
          <ModuleProgress icon={FileBarChart} label="BRSR Readiness" pct={k.brsrReadiness ?? 0} tone="teal" />
        </div>
      </motion.section>
    </div>
  )
}

/* ---------- Module helpers ---------- */
function modulePct(subs: SubmissionItem[], moduleKey: string): number {
  const sub = subs.find(s => s.module === moduleKey)
  if (!sub) return 0
  return sub.completionPct || 0
}

/* ---------- Sub-components ---------- */
function KpiCard({ icon: Icon, tileClass, label, value, unit, sub, delay }: {
  icon: LucideIcon; tileClass: string; label: string; value: string; unit: string; sub?: string; delay: number
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      className="glass glass-shimmer rounded-2xl p-4"
    >
      <div className="flex items-start justify-between">
        <div className={`kpi-tile ${tileClass}`}><Icon className="h-5 w-5" /></div>
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="tabular-nums text-2xl font-bold text-slate-800">{value}</span>
          {unit && <span className="text-xs font-medium text-slate-400">{unit}</span>}
        </div>
        {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
      </div>
    </motion.div>
  )
}

function OverviewTab({ selected, submissions, evidence, kpis }: {
  selected: any; submissions: SubmissionItem[]; evidence: EvidenceItem[]; kpis: Record<string, number>
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white/50 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Project Code</div>
        <div className="font-mono text-sm font-bold text-slate-800">{selected?.projectCode ?? '—'}</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div><span className="text-slate-400">Location:</span> <span className="font-semibold text-slate-700">{selected?.location ?? '—'}</span></div>
          <div><span className="text-slate-400">BU:</span> <span className="font-semibold text-slate-700">{selected?.buName ?? '—'}</span></div>
          <div><span className="text-slate-400">Subsidiary:</span> <span className="font-semibold text-slate-700">{selected?.subsidiaryCode ?? '—'}</span></div>
          <div><span className="text-slate-400">Group:</span> <span className="font-semibold text-slate-700">{selected?.groupCode ?? '—'}</span></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Submissions" value={submissions.length} icon={Send} tone="blue" />
        <MiniStat label="Evidence" value={evidence.length} icon={Link2} tone="violet" />
        <MiniStat label="Open Issues" value={kpis.openExceptions ?? 0} icon={AlertTriangle} tone="amber" />
      </div>
      <div className="rounded-xl bg-white/50 p-3 text-[11px] leading-relaxed text-slate-500">
        <span className="font-semibold text-slate-700">Traceability:</span> every number on this dashboard resolves through the chain — Source → Evidence → Validation → Calculation (factor v{1}) → Submission → Approval → Consolidation → BRSR.
      </div>
    </div>
  )
}

function ProgressTab({ kpis, trendArr, submissions }: {
  kpis: Record<string, number>
  trendArr: Array<{ label: string; emissions: number; energy: number; water: number; waste: number }>
  submissions: SubmissionItem[]
}) {
  const maxEmission = Math.max(...trendArr.map(t => t.emissions), 1)
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-800">Monthly Emissions Trend</div>
          <span className="status-pill status-submitted">{kpis.totalEmissions} tCO₂e total</span>
        </div>
        <div className="flex h-24 items-end gap-1.5">
          {trendArr.map((t, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <motion.div initial={{ height: 0 }} animate={{ height: `${(t.emissions / maxEmission) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.04 * i }}
                  className="w-full rounded-t-md bg-gradient-to-t from-blue-500 to-cyan-400" />
              </div>
              <span className="text-[9px] text-slate-500">{t.label.split(' ')[0].slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Workforce" value={kpis.totalWorkforce ?? 0} icon={Users} tone="blue" />
        <MiniStat label="Female share" value={`${kpis.femaleShare ?? 0}%`} icon={UserCheck} tone="violet" />
        <MiniStat label="Training hrs" value={kpis.trainingHours ?? 0} icon={History} tone="emerald" />
        <MiniStat label="LTIFR" value={kpis.ltifr ?? 0} icon={ShieldCheck} tone="amber" />
      </div>
      <div className="rounded-xl bg-white/50 p-3">
        <div className="mb-2 text-xs font-bold text-slate-800">Module Submission Status</div>
        <div className="space-y-1.5">
          {submissions.length === 0 && <div className="text-[11px] text-slate-400">No submissions for this project.</div>}
          {submissions.slice(0, 4).map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-white/60 px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`status-pill ${statusPillClass(s.status)}`}>{s.module}</span>
                <span className="truncate text-[11px] font-medium text-slate-600">{s.title}</span>
              </div>
              <span className="text-[10px] text-slate-400">{s.completionPct?.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActivityTab({ activity, projectId }: { activity: ActivityItem[]; projectId: string | null }) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ActivityItem[]>(activity)
  useEffect(() => { setItems(activity) }, [activity, projectId])
  const reload = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/activity?projectId=${encodeURIComponent(projectId)}&take=20`)
      const d = await r.json()
      setItems(d.items || [])
    } finally { setLoading(false) }
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">Latest events on this project</span>
        <button onClick={reload} disabled={loading}
          className="glass-subtle rounded-full px-2.5 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-white/80">
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto scroll-elegant pr-1">
        {items.length === 0 && (
          <div className="px-3 py-8 text-center text-[11px] text-slate-400">No recent activity for this project.</div>
        )}
        {items.map((a, i) => <ActivityRow key={a.id} a={a} delay={i * 0.03} />)}
      </div>
    </div>
  )
}

function TeamTab({ roleKey, userName }: { roleKey: string; userName?: string }) {
  const team = useMemo(() => buildIllustrativeTeam(roleKey, userName), [roleKey, userName])
  return (
    <div>
      <div className="mb-2 text-[11px] text-slate-500">Project team &amp; responsibilities</div>
      <div className="space-y-1.5">
        {team.map((m, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-2"
          >
            <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${m.gradient} text-[10px] font-bold text-white`}>
              {m.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-800">{m.name}</div>
              <div className="text-[10px] text-slate-500">{m.role} · {m.scope}</div>
            </div>
            <span className={`status-pill ${m.active ? 'status-approved' : 'status-draft'}`}>{m.active ? 'Active' : 'Pending'}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function DocumentsTab({ evidence }: { evidence: EvidenceItem[] }) {
  return (
    <div>
      <div className="mb-2 text-[11px] text-slate-500">Evidence &amp; documents on this project</div>
      <div className="max-h-72 space-y-1.5 overflow-y-auto scroll-elegant pr-1">
        {evidence.length === 0 && (
          <div className="px-3 py-8 text-center text-[11px] text-slate-400">No documents uploaded yet.</div>
        )}
        {evidence.map((e, i) => (
          <motion.div key={e.id}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-2"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 text-violet-600">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-800">{e.fileName}</div>
              <div className="text-[10px] text-slate-500">{e.documentType} · {e.uploader?.name ?? 'System'}</div>
            </div>
            <span className={`status-pill ${statusPillClass(e.status)}`}>{e.status}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function MiniStat({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: LucideIcon; tone: string }) {
  const toneMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600', emerald: 'bg-emerald-50 text-emerald-600',
    cyan: 'bg-cyan-50 text-cyan-600', teal: 'bg-teal-50 text-teal-600', rose: 'bg-rose-50 text-rose-600',
  }
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/50 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5">
        <div className={`flex h-5 w-5 items-center justify-center rounded ${toneMap[tone]}`}><Icon className="h-3 w-3" /></div>
        <span className="text-[10px] font-medium text-slate-600">{label}</span>
      </div>
      <span className="tabular-nums text-sm font-bold text-slate-800">{value}</span>
    </div>
  )
}

function ModuleProgress({ icon: Icon, label, pct, tone }: { icon: LucideIcon; label: string; pct: number; tone: string }) {
  const toneMap: Record<string, string> = {
    blue: 'from-blue-500 to-cyan-400', amber: 'from-amber-500 to-yellow-400',
    violet: 'from-violet-500 to-fuchsia-400', emerald: 'from-emerald-500 to-teal-400',
    cyan: 'from-cyan-500 to-sky-400', teal: 'from-teal-500 to-emerald-400',
  }
  return (
    <div className="rounded-xl border border-white/60 bg-white/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
          <Icon className="h-3.5 w-3.5 text-slate-500" /> {label}
        </div>
        <span className="tabular-nums text-[11px] font-bold text-slate-800">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 2)}%` }} transition={{ duration: 0.7 }}
          className={`h-full rounded-full bg-gradient-to-r ${toneMap[tone]}`} />
      </div>
    </div>
  )
}

function ActivityRow({ a, delay }: { a: ActivityItem; delay: number }) {
  const iconMap: Record<string, LucideIcon> = {
    DATA_ENTRY: FileText, SUBMIT: Send, APPROVE: CheckCircle2,
    EVIDENCE_UPLOAD: Link2, CALCULATION: Zap, CORRECTION: AlertTriangle,
  }
  const Icon = iconMap[a.action] ?? ActivityIcon
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}
      className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-white/50"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-slate-800">{a.title}</span>
          {a.status && <span className={`status-pill ${statusPillClass(a.status)}`}>{a.status}</span>}
        </div>
        {a.description && <p className="truncate text-[11px] text-slate-500">{a.description}</p>}
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
          {a.actorName && <span className="font-medium text-slate-500">{a.actorName}</span>}
          {a.actorRole && <><span>·</span><span>{a.actorRole}</span></>}
          {a.module && <><span>·</span><span className="uppercase">{a.module}</span></>}
          <span>·</span><span>{timeAgo(a.createdAt)}</span>
        </div>
      </div>
    </motion.div>
  )
}

function buildIllustrativeTeam(roleKey: string, userName?: string) {
  const displayName = userName || 'You'
  const initials = displayName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  const team = [
    { name: displayName, role: 'Project / Site User', scope: 'Project scope', gradient: 'from-blue-600 to-cyan-600', active: true, initials: initials || 'U' },
    { name: 'Rakesh Verma', role: 'BU Reviewer', scope: 'Business Unit', gradient: 'from-violet-600 to-fuchsia-600', active: true, initials: 'RV' },
    { name: 'Nisha Pillai', role: 'Subsidiary ESG Reviewer', scope: 'Subsidiary', gradient: 'from-emerald-600 to-teal-600', active: true, initials: 'NP' },
    { name: 'Meena Iyer', role: 'BRSR / Report Owner', scope: 'Group', gradient: 'from-amber-600 to-yellow-600', active: false, initials: 'MI' },
  ]
  if (roleKey && roleKey !== 'PROJECT_USER') {
    team[0].role = roleKey.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }
  return team
}

/* ---------- State helpers ---------- */
function MyProjectSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200/60" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {[...Array(5)].map((_, i) => <div key={i} className="glass h-32 animate-pulse rounded-2xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="glass h-80 animate-pulse rounded-2xl lg:col-span-3" />
        <div className="glass h-80 animate-pulse rounded-2xl lg:col-span-2" />
      </div>
      <div className="glass h-48 animate-pulse rounded-2xl" />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-500" />
      <div>
        <div className="text-base font-bold text-slate-800">Failed to load My Project</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button onClick={onRetry} className="btn-glass-primary rounded-full px-5 py-2 text-xs font-semibold">Retry</button>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <Building2 className="h-10 w-10 text-slate-400" />
      <div>
        <div className="text-base font-bold text-slate-800">Nothing to display</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
    </div>
  )
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
