'use client'
/**
 * My Action Items — role-aware task list showing pending submissions, corrections,
 * approvals, evidence gaps, and BRSR missing items for the current user.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckSquare, AlertOctagon, AlertTriangle, Info, ChevronRight, ClipboardList,
  FileText, ShieldCheck, Link2, FileCheck2, Zap, RefreshCw
} from 'lucide-react'
import { useApp, type ModuleKey } from '@/lib/auth-context'

interface Task {
  id: string; type: string; title: string; description: string
  severity: 'critical' | 'warning' | 'info'; module: string
  entityId?: string; status: string; dueDate?: string
}

const SEV_CONFIG = {
  critical: { icon: AlertOctagon, tile: 'bg-rose-100 text-rose-600', pill: 'status-error', label: 'Critical' },
  warning: { icon: AlertTriangle, tile: 'bg-amber-100 text-amber-600', pill: 'status-warning', label: 'Warning' },
  info: { icon: Info, tile: 'bg-blue-100 text-blue-600', pill: 'status-submitted', label: 'Info' },
}

const TYPE_ICON: Record<string, any> = {
  DRAFT_SUBMISSION: FileText, PENDING_REVIEW: ShieldCheck, CORRECTION: AlertTriangle,
  VALIDATION_ERROR: AlertOctagon, BRSR_GAP: FileCheck2, EVIDENCE_REVIEW: Link2,
}

export function ActionItemsWidget() {
  const { setActiveModule } = useApp()
  const [tasks, setTasks] = useState<Task[]>([])
  const [summary, setSummary] = useState({ critical: 0, warning: 0, info: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')

  useEffect(() => {
    fetch('/api/action-items').then(r => r.json()).then(d => {
      setTasks(d.tasks || [])
      setSummary(d.summary || { critical: 0, warning: 0, info: 0 })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.severity === filter)

  if (loading) {
    return (
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-200/60" />
        <div className="mt-3 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-200/40" />)}</div>
      </motion.section>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-shimmer rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="kpi-tile bg-gradient-to-br from-blue-500 to-cyan-600 text-white" style={{ width: 32, height: 32 }}><ClipboardList className="h-4 w-4" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">My Action Items</h3>
            <p className="text-[11px] text-slate-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''} pending for your role</p>
          </div>
        </div>
        <button onClick={() => { setLoading(true); fetch('/api/action-items').then(r => r.json()).then(d => { setTasks(d.tasks || []); setSummary(d.summary || summary); setLoading(false) }) }}
          className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:text-blue-600">
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* Severity summary chips */}
      <div className="mb-3 flex items-center gap-1.5">
        {(['all', 'critical', 'warning', 'info'] as const).map(f => {
          const cnt = f === 'all' ? tasks.length : summary[f]
          if (f !== 'all' && cnt === 0) return null
          const active = filter === f
          const pillClass = f === 'critical' ? 'status-error' : f === 'warning' ? 'status-warning' : f === 'info' ? 'status-submitted' : 'status-review'
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`status-pill ${active ? pillClass : 'bg-white/60 text-slate-400'} transition hover:scale-105`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="tabular-nums">{cnt}</span>
            </button>
          )
        })}
      </div>

      {/* Task list */}
      <div className="max-h-80 space-y-2 overflow-y-auto scroll-elegant pr-1">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
            <CheckSquare className="h-8 w-8 text-emerald-500" />
            <div className="text-sm font-bold text-slate-700">All caught up!</div>
            <div className="text-[11px] text-slate-400">No {filter !== 'all' ? filter : ''} tasks pending for your role.</div>
          </div>
        )}
        {filtered.map((t, i) => {
          const cfg = SEV_CONFIG[t.severity]
          const SevIcon = cfg.icon
          const TypeIcon = TYPE_ICON[t.type] || FileText
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setActiveModule(t.module as ModuleKey)}
              className="group flex w-full items-start gap-2.5 rounded-xl border border-slate-200/50 bg-white/50 p-3 text-left transition hover:border-blue-200 hover:bg-white/80 hover:shadow-md"
            >
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.tile}`}>
                <TypeIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-bold text-slate-800">{t.title}</span>
                  <span className={`status-pill ${cfg.pill} !text-[9px] !px-1.5 !py-0`}>{cfg.label}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{t.description}</p>
                {t.dueDate && (
                  <div className="mt-1 flex items-center gap-1 text-[9px] font-medium text-slate-400">
                    <Zap className="h-2.5 w-2.5 text-amber-500" /> Due: {new Date(t.dueDate).toLocaleDateString()}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
            </motion.button>
          )
        })}
      </div>
    </motion.section>
  )
}
