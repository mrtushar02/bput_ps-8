'use client'
/**
 * ESG Pipeline Tracker — visual horizontal pipeline showing where data sits
 * in the control chain: Collect → Validate → Calculate → Approve → Consolidate → BRSR → Report → Audit
 * with live counts at each stage from real DB data.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Database, CheckCircle2, Calculator, ShieldCheck, GitBranch, FileCheck2, FileBarChart, History, ArrowRight, AlertTriangle } from 'lucide-react'

interface PipelineData {
  sources: { calculationResults: number; energyRecords: number; waterRecords: number; wasteRecords: number; workforceRecords: number; safetyRecords: number }
  kpis: { openExceptions: number; approvedSubs: number; totalSubs: number; brsrReadiness: number; evidenceVerified: number; evidenceTotal: number; completion: number }
}

const STAGES = [
  { key: 'collect', label: 'Collect', icon: Database, desc: 'Source records', color: 'from-sky-400 to-blue-500' },
  { key: 'validate', label: 'Validate', icon: CheckCircle2, desc: 'Passed checks', color: 'from-cyan-400 to-teal-500' },
  { key: 'calculate', label: 'Calculate', icon: Calculator, desc: 'Emission results', color: 'from-violet-400 to-purple-500' },
  { key: 'approve', label: 'Approve', icon: ShieldCheck, desc: 'Approved subs', color: 'from-blue-400 to-indigo-500' },
  { key: 'consolidate', label: 'Consolidate', icon: GitBranch, desc: 'Group rollup', color: 'from-teal-400 to-emerald-500' },
  { key: 'brsr', label: 'BRSR Map', icon: FileCheck2, desc: 'Readiness %', color: 'from-emerald-400 to-green-500' },
  { key: 'report', label: 'Report', icon: FileBarChart, desc: 'Completion %', color: 'from-amber-400 to-orange-500' },
  { key: 'audit', label: 'Audit', icon: History, desc: 'Traceable', color: 'from-slate-400 to-slate-600' },
]

export function PipelineTracker({ data }: { data: PipelineData | null }) {
  if (!data) return null
  const totalSources = data.sources.energyRecords + data.sources.waterRecords + data.sources.wasteRecords + data.sources.workforceRecords + data.sources.safetyRecords
  const counts: Record<string, number> = {
    collect: totalSources,
    validate: totalSources - data.kpis.openExceptions,
    calculate: data.sources.calculationResults,
    approve: data.kpis.approvedSubs,
    consolidate: data.kpis.approvedSubs,
    brsr: Math.round(data.kpis.brsrReadiness),
    report: Math.round(data.kpis.completion),
    audit: data.kpis.evidenceVerified,
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-shimmer rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="kpi-tile bg-blue-50 text-blue-600" style={{ width: 32, height: 32 }}><GitBranch className="h-4 w-4" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">ESG Data Control Chain</h3>
            <p className="text-[11px] text-slate-500">Live pipeline status · {totalSources} source records flowing through {STAGES.length} stages</p>
          </div>
        </div>
        <span className="status-pill status-approved"><CheckCircle2 className="h-3 w-3" /> Operational</span>
      </div>

      {/* Horizontal pipeline */}
      <div className="flex items-stretch gap-1 overflow-x-auto scroll-elegant pb-2">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon
          const count = counts[stage.key] ?? 0
          const isLast = i === STAGES.length - 1
          return (
            <motion.div key={stage.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex flex-shrink-0 items-center gap-1">
              <div className="group relative w-[88px] rounded-xl border border-slate-200/60 bg-white/50 p-2.5 text-center transition hover:bg-white/80 hover:shadow-md">
                <div className={`mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stage.color} text-white shadow-sm`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-700">{stage.label}</div>
                <div className="tabular-nums text-base font-bold text-slate-800">{count.toLocaleString()}</div>
                <div className="text-[9px] leading-tight text-slate-400">{stage.desc}</div>
                {/* connector arrow */}
              </div>
              {!isLast && <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-300" />}
            </motion.div>
          )
        })}
      </div>

      {/* Status summary bar */}
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/40 px-3 py-2 text-[11px]">
        <span className="flex items-center gap-1.5 font-medium text-slate-600"><Database className="h-3.5 w-3.5 text-blue-500" /> {totalSources} records collected</span>
        <span className="text-slate-300">|</span>
        <span className="flex items-center gap-1.5 font-medium text-slate-600"><Calculator className="h-3.5 w-3.5 text-violet-500" /> {counts.calculate} calculations</span>
        <span className="text-slate-300">|</span>
        <span className="flex items-center gap-1.5 font-medium text-slate-600"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {data.kpis.approvedSubs} approved</span>
        {data.kpis.openExceptions > 0 && (
          <>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1.5 font-medium text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> {data.kpis.openExceptions} exceptions</span>
          </>
        )}
        <span className="ml-auto flex items-center gap-1.5 font-medium text-blue-600"><FileCheck2 className="h-3.5 w-3.5" /> BRSR {counts.brsr}% ready</span>
      </div>
    </motion.section>
  )
}
