'use client'
/**
 * AI Insights Panel — LLM-generated narrative insights from real ESG data.
 * Provides the "So What?" factor for executives: automated annotations explaining
 * trends, risks, and improvement opportunities.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, AlertTriangle, AlertOctagon, RefreshCw, Lightbulb, Zap, Droplet, Recycle, Users, ShieldCheck, FileCheck2, Database } from 'lucide-react'

interface Insight {
  title: string
  severity: 'positive' | 'warning' | 'critical'
  category: string
  insight: string
  action: string
}

const SEVERITY_CONFIG = {
  positive: { icon: TrendingUp, tile: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200/60', pill: 'status-approved', label: 'Positive' },
  warning: { icon: AlertTriangle, tile: 'bg-amber-50 text-amber-600', border: 'border-amber-200/60', pill: 'status-warning', label: 'Warning' },
  critical: { icon: AlertOctagon, tile: 'bg-rose-50 text-rose-600', border: 'border-rose-200/60', pill: 'status-error', label: 'Critical' },
}

const CATEGORY_ICON: Record<string, any> = {
  emissions: Zap, energy: Zap, water: Droplet, waste: Recycle,
  social: Users, governance: ShieldCheck, data_quality: Database,
}

export function AiInsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)

  const fetchInsights = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/insights')
      const data = await res.json()
      setInsights(data.insights || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setGenerating(false)
    }
  }

  useEffect(() => { fetchInsights() }, [])

  if (loading) {
    return (
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="kpi-tile bg-gradient-to-br from-violet-500 to-purple-600 text-white" style={{ width: 32, height: 32 }}><Sparkles className="h-4 w-4" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">AI Insights</h3>
            <p className="text-[11px] text-slate-500">Generating narrative analysis from real KPI data…</p>
          </div>
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200/40" />)}
        </div>
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
          <div className="kpi-tile bg-gradient-to-br from-violet-500 to-purple-600 text-white" style={{ width: 32, height: 32 }}><Sparkles className="h-4 w-4" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">AI Insights</h3>
            <p className="text-[11px] text-slate-500">LLM-generated analysis from real ESG data · {insights.length} insights</p>
          </div>
        </div>
        <button onClick={fetchInsights} disabled={generating}
          className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:text-blue-600 disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Analyzing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-xl bg-rose-50/70 px-3 py-2 text-xs text-rose-700">Failed to generate insights: {error}</div>
      )}

      <div className="space-y-2.5">
        {insights.map((ins, i) => {
          const cfg = SEVERITY_CONFIG[ins.severity] || SEVERITY_CONFIG.warning
          const SevIcon = cfg.icon
          const CatIcon = CATEGORY_ICON[ins.category] || Lightbulb
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className={`rounded-xl border ${cfg.border} bg-white/50 p-3`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.tile}`}>
                  <SevIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CatIcon className="h-3 w-3 flex-shrink-0 text-slate-400" />
                    <span className="text-xs font-bold text-slate-800">{ins.title}</span>
                    <span className={`status-pill ${cfg.pill} !text-[9px] !px-1.5 !py-0`}>{cfg.label}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{ins.insight}</p>
                  <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-blue-50/50 px-2 py-1">
                    <Lightbulb className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 text-amber-500" />
                    <span className="text-[10px] font-medium text-slate-600">{ins.action}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
        {insights.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-xs text-slate-400">
            No insights available. Click Refresh to analyze.
          </div>
        )}
      </div>
    </motion.section>
  )
}
