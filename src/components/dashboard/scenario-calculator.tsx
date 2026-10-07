'use client'
/**
 * ESG Scenario Calculator — "What-If" modeling tool.
 * Lets executives model how reduction targets affect the composite ESG score.
 * Uses the same 8-dimension scoring formula as the overview ESG Score gauge.
 */
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Calculator, TrendingDown, TrendingUp, RotateCcw, Sparkles, Zap, Droplet, Recycle, Users, ShieldCheck, FileCheck2, Gauge } from 'lucide-react'

interface ScenarioProps {
  currentScore: number
  currentKpis: {
    brsrReadiness: number; completion: number; waterRecycledShare: number
    wasteRecycledShare: number; renewableShare: number; femaleShare: number
    ltifr: number; openExceptions: number
  }
}

export function ScenarioCalculator({ currentScore, currentKpis }: ScenarioProps) {
  // Sliders: percentage reduction/improvement to apply (0 = no change, positive = improvement)
  const [energyReduction, setEnergyReduction] = useState(0)       // % reduction in energy → increases renewableShare
  const [waterRecyclingBoost, setWaterRecyclingBoost] = useState(0) // % increase in water recycling
  const [wasteRecoveryBoost, setWasteRecoveryBoost] = useState(0)   // % increase in waste recovery
  const [brsrCloseGap, setBrsrCloseGap] = useState(0)              // % of missing BRSR items to resolve
  const [femaleShareBoost, setFemaleShareBoost] = useState(0)      // % increase in female workforce share

  const projected = useMemo(() => {
    const k = currentKpis
    // Apply scenario adjustments
    const newRenewableShare = Math.min(100, k.renewableShare + energyReduction * 0.5)
    const newWaterRecycled = Math.min(100, k.waterRecycledShare + waterRecyclingBoost)
    const newWasteRecycled = Math.min(100, k.wasteRecycledShare + wasteRecoveryBoost)
    const newBrsrMissing = Math.round(k.brsrReadiness === 100 ? 0 : (100 - k.brsrReadiness) * (1 - brsrCloseGap / 100))
    const newBrsrReadiness = Math.min(100, k.brsrReadiness + (100 - k.brsrReadiness) * (brsrCloseGap / 100))
    const newFemaleShare = Math.min(100, k.femaleShare + femaleShareBoost)
    // LTIFR improvement: energy reduction implies fewer emissions but also fewer operations → slight LTIFR improvement
    const newLtifr = Math.max(0, k.ltifr * (1 - energyReduction / 200))
    const newExceptions = Math.max(0, k.openExceptions - Math.round(brsrCloseGap / 20))

    const dims = [
      newBrsrReadiness,
      k.completion,
      newWaterRecycled,
      newWasteRecycled,
      newRenewableShare,
      Math.min(newFemaleShare * 2, 100),
      Math.max(0, 100 - newLtifr * 20),
      Math.max(0, 100 - newExceptions * 5),
    ]
    return {
      score: Math.round(dims.reduce((s, v) => s + v, 0) / dims.length),
      newRenewableShare: Math.round(newRenewableShare * 10) / 10,
      newWaterRecycled: Math.round(newWaterRecycled * 10) / 10,
      newWasteRecycled: Math.round(newWasteRecycled * 10) / 10,
      newBrsrReadiness: Math.round(newBrsrReadiness * 10) / 10,
      newFemaleShare: Math.round(newFemaleShare * 10) / 10,
      newLtifr: Math.round(newLtifr * 100) / 100,
      newExceptions,
    }
  }, [currentKpis, energyReduction, waterRecyclingBoost, wasteRecoveryBoost, brsrCloseGap, femaleShareBoost])

  const scoreDelta = projected.score - currentScore
  const hasChanges = energyReduction > 0 || waterRecyclingBoost > 0 || wasteRecoveryBoost > 0 || brsrCloseGap > 0 || femaleShareBoost > 0

  const reset = () => {
    setEnergyReduction(0); setWaterRecyclingBoost(0); setWasteRecoveryBoost(0); setBrsrCloseGap(0); setFemaleShareBoost(0)
  }

  const sliders = [
    { label: 'Energy reduction', icon: Zap, unit: '%', value: energyReduction, set: setEnergyReduction, color: 'amber', desc: 'Reduce energy consumption → boosts renewable share' },
    { label: 'Water recycling boost', icon: Droplet, unit: '%', value: waterRecyclingBoost, set: setWaterRecyclingBoost, color: 'cyan', desc: 'Increase water recycling rate' },
    { label: 'Waste recovery boost', icon: Recycle, unit: '%', value: wasteRecoveryBoost, set: setWasteRecoveryBoost, color: 'emerald', desc: 'Improve waste recovery rate' },
    { label: 'BRSR gap closure', icon: FileCheck2, unit: '%', value: brsrCloseGap, set: setBrsrCloseGap, color: 'teal', desc: 'Resolve missing BRSR indicators' },
    { label: 'Gender diversity boost', icon: Users, unit: '%', value: femaleShareBoost, set: setFemaleShareBoost, color: 'blue', desc: 'Increase female workforce share' },
  ]

  const colorMap: Record<string, string> = {
    amber: 'accent-amber-500', cyan: 'accent-cyan-500', emerald: 'accent-emerald-500',
    teal: 'accent-teal-500', blue: 'accent-blue-500',
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-shimmer rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="kpi-tile bg-gradient-to-br from-violet-500 to-purple-600 text-white" style={{ width: 32, height: 32 }}><Calculator className="h-4 w-4" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Scenario Calculator</h3>
            <p className="text-[11px] text-slate-500">What-if analysis · model reduction targets on your ESG score</p>
          </div>
        </div>
        {hasChanges && (
          <button onClick={reset} className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:text-slate-700">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {/* Current vs Projected score */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/50 p-3 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Current Score</div>
          <div className="tabular-nums text-3xl font-bold text-slate-700">{currentScore}</div>
          <div className="text-[9px] text-slate-400">/ 100</div>
        </div>
        <div className={`rounded-xl p-3 text-center transition ${hasChanges ? 'bg-gradient-to-br from-blue-50/80 to-cyan-50/60' : 'bg-white/50'}`}>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Projected Score</div>
          <div className={`tabular-nums text-3xl font-bold ${hasChanges ? 'text-blue-600' : 'text-slate-700'}`}>{projected.score}</div>
          <div className="flex items-center justify-center gap-1 text-[9px]">
            {hasChanges ? (
              <span className={`flex items-center gap-0.5 font-bold ${scoreDelta > 0 ? 'text-emerald-600' : scoreDelta < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {scoreDelta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : scoreDelta < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                {scoreDelta > 0 ? '+' : ''}{scoreDelta} pts
              </span>
            ) : <span className="text-slate-400">adjust sliders →</span>}
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-3">
        {sliders.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div key={s.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-600">{s.label}</span>
                </div>
                <span className="tabular-nums text-xs font-bold text-slate-700">{s.value}{s.unit}</span>
              </div>
              <input
                type="range" min={0} max={50} value={s.value}
                onChange={(e) => s.set(Number(e.target.value))}
                className={`mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 ${colorMap[s.color]}`}
              />
              <p className="mt-0.5 text-[9px] leading-tight text-slate-400">{s.desc}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Projected KPI changes */}
      {hasChanges && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 rounded-xl border border-blue-200/50 bg-blue-50/40 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Projected impact</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <KpiChange label="Renewable share" from={currentKpis.renewableShare} to={projected.newRenewableShare} unit="%" goodDir="up" />
            <KpiChange label="Water recycled" from={currentKpis.waterRecycledShare} to={projected.newWaterRecycled} unit="%" goodDir="up" />
            <KpiChange label="Waste recovered" from={currentKpis.wasteRecycledShare} to={projected.newWasteRecycled} unit="%" goodDir="up" />
            <KpiChange label="BRSR readiness" from={currentKpis.brsrReadiness} to={projected.newBrsrReadiness} unit="%" goodDir="up" />
            <KpiChange label="Female share" from={currentKpis.femaleShare} to={projected.newFemaleShare} unit="%" goodDir="up" />
            <KpiChange label="LTIFR" from={currentKpis.ltifr} to={projected.newLtifr} unit="/M" goodDir="down" />
          </div>
        </motion.div>
      )}
    </motion.section>
  )
}

function KpiChange({ label, from, to, unit, goodDir }: { label: string; from: number; to: number; unit: string; goodDir: 'up' | 'down' }) {
  const delta = Math.round((to - from) * 10) / 10
  const isImprovement = goodDir === 'up' ? delta > 0 : delta < 0
  const noChange = delta === 0
  return (
    <div className="flex items-center justify-between rounded-md bg-white/60 px-2 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="flex items-center gap-1 tabular-nums">
        <span className="text-slate-400 line-through">{from}{unit}</span>
        <span className="text-slate-300">→</span>
        <span className={`font-bold ${noChange ? 'text-slate-500' : isImprovement ? 'text-emerald-600' : 'text-rose-600'}`}>{to}{unit}</span>
      </span>
    </div>
  )
}
