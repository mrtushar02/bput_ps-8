'use client'
/**
 * Executive Summary View — responsive prioritized feed for C-suite on tablet/phone.
 * Renders instead of the dense dashboard when viewport is < 768px (mobile/tablet).
 * Shows: one big ESG Score gauge, top 3 AI insights, pending action items, key KPIs.
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Award, AlertCircle, AlertTriangle, TrendingUp, TrendingDown,
  ChevronRight, Sparkles, ClipboardList, Activity, Flame, Zap, Droplet, Recycle, FileCheck2
} from 'lucide-react'
import { useApp, type ModuleKey } from '@/lib/auth-context'

interface MobileData {
  kpis: any
  activities: any[]
}

export function ExecutiveSummaryView({ data, esgScore }: { data: MobileData; esgScore: number }) {
  const { setActiveModule } = useApp()
  const [insights, setInsights] = useState<any[]>([])
  const [actionItems, setActionItems] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/insights').then(r => r.json()).then(d => setInsights(d.insights?.slice(0, 3) || [])).catch(() => {})
    fetch('/api/action-items').then(r => r.json()).then(d => setActionItems((d.tasks || []).slice(0, 3))).catch(() => {})
  }, [])

  const k = data.kpis
  const grade = esgScore >= 90 ? 'A+' : esgScore >= 80 ? 'A' : esgScore >= 70 ? 'B+' : esgScore >= 60 ? 'B' : esgScore >= 50 ? 'C' : 'D'
  const gradeColor = esgScore >= 80 ? '#10b981' : esgScore >= 70 ? '#3b82f6' : esgScore >= 50 ? '#f59e0b' : '#ef4444'

  const topKpis = [
    { label: 'Emissions', value: k.totalEmissions, unit: 'tCO₂e', icon: Flame, color: 'rose' },
    { label: 'Energy', value: k.energyGJ, unit: 'GJ', icon: Zap, color: 'amber' },
    { label: 'Water', value: k.waterWithdrawalKL, unit: 'KL', icon: Droplet, color: 'cyan' },
    { label: 'Waste', value: k.wasteRecycledShare, unit: '%', icon: Recycle, color: 'emerald' },
  ]

  return (
    <div className="space-y-4">
      {/* Big ESG Score */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-3xl p-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-1.5">
          <Award className="h-4 w-4 text-blue-600" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">ESG Score</span>
        </div>
        <div className="relative mx-auto h-40 w-40">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="10" />
            <circle cx="60" cy="60" r="52" fill="none" stroke={gradeColor} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 52 * esgScore / 100} ${2 * Math.PI * 52}`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="tabular-nums text-5xl font-bold text-slate-800">{esgScore}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">/ 100</span>
            <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full text-lg font-black" style={{ color: 'white', background: gradeColor }}>{grade}</span>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">{k.orgs} group · {k.projects} projects · {k.completion}% complete</div>
      </motion.div>

      {/* Top KPIs */}
      <div className="grid grid-cols-4 gap-2">
        {topKpis.map((kpi, i) => {
          const Icon = kpi.icon
          const colorMap: Record<string, string> = { rose: 'text-rose-600 bg-rose-50', amber: 'text-amber-600 bg-amber-50', cyan: 'text-cyan-600 bg-cyan-50', emerald: 'text-emerald-600 bg-emerald-50' }
          return (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-2.5 text-center">
              <div className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg ${colorMap[kpi.color]}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="tabular-nums text-sm font-bold text-slate-800">{Number(kpi.value).toLocaleString()}</div>
              <div className="text-[8px] uppercase tracking-wide text-slate-400">{kpi.unit}</div>
              <div className="text-[8px] text-slate-400">{kpi.label}</div>
            </motion.div>
          )
        })}
      </div>

      {/* Top 3 AI Insights */}
      {insights.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">AI Insights</span>
          </div>
          <div className="space-y-2">
            {insights.map((ins, i) => {
              const sev = ins.severity || 'warning'
              const cfg = sev === 'positive' ? { icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' }
                : sev === 'critical' ? { icon: AlertCircle, color: 'text-rose-600 bg-rose-50' }
                : { icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' }
              const SevIcon = cfg.icon
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${cfg.color}`}>
                    <SevIcon className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-700">{ins.title}</div>
                    <div className="text-[10px] leading-tight text-slate-500">{ins.insight}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Pending Action Items */}
      {actionItems.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Action Items</span>
            </div>
            <span className="status-pill status-submitted">{actionItems.length} pending</span>
          </div>
          <div className="space-y-1.5">
            {actionItems.map((t, i) => (
              <button key={t.id} onClick={() => setActiveModule(t.module as ModuleKey)}
                className="flex w-full items-center gap-2 rounded-lg bg-white/50 px-3 py-2 text-left transition hover:bg-white/80">
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${t.severity === 'critical' ? 'bg-rose-500' : t.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-slate-700">{t.title}</div>
                  <div className="truncate text-[9px] text-slate-400">{t.description}</div>
                </div>
                <ChevronRight className="h-3 w-3 flex-shrink-0 text-slate-300" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Activity */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Recent Activity</span>
        </div>
        <div className="space-y-1.5">
          {data.activities.slice(0, 3).map((a: any, i) => (
            <div key={a.id || i} className="flex items-start gap-2 rounded-lg px-2 py-1.5">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <Activity className="h-3 w-3" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-slate-700">{a.title}</div>
                <div className="text-[9px] text-slate-400">{a.actorName} · {a.actorRole}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
