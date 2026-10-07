'use client'
/**
 * Sustainability Targets vs Actuals — comparing current period actuals
 * against configured reduction/improvement targets derived from baseline.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Flame, Zap, Droplet, Recycle, Sun, Users, Shield, CheckCircle2, Target, TrendingDown, TrendingUp } from 'lucide-react'

interface TargetItem {
  label: string; key: string; icon: string;
  actual: number; target: number; baseline: number;
  gap: number; onTrack: boolean; pctOfTarget: number;
  goodDirection: 'down' | 'up'; unit: string; reductionPct: number
}
interface TargetsData {
  currentPeriod: string; baselinePeriod: string; targets: TargetItem[]
}

const ICON_MAP: Record<string, any> = { flame: Flame, zap: Zap, droplet: Droplet, recycle: Recycle, sun: Sun, users: Users, shield: Shield, check: CheckCircle2 }

export function TargetsWidget() {
  const [data, setData] = useState<TargetsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/targets').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5">
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200/60" />
      <div className="mt-4 grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200/40" />)}</div>
    </motion.section>
  )
  if (!data || !data.targets?.length) return null

  const onTrackCount = data.targets.filter(t => t.onTrack).length
  const totalCount = data.targets.length

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-shimmer rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="kpi-tile bg-teal-50 text-teal-600" style={{ width: 32, height: 32 }}><Target className="h-4 w-4" /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Sustainability Targets</h3>
            <p className="text-[11px] text-slate-500">{data.currentPeriod} vs target (baseline: {data.baselinePeriod})</p>
          </div>
        </div>
        <span className={`status-pill ${onTrackCount >= totalCount / 2 ? 'status-approved' : 'status-warning'}`}>
          {onTrackCount}/{totalCount} on track
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {data.targets.map((t, i) => {
          const Icon = ICON_MAP[t.icon] ?? Target
          const isDown = t.goodDirection === 'down'
          const GapIcon = isDown ? TrendingDown : TrendingUp
          const gapPositive = t.onTrack
          const pct = Math.min(t.pctOfTarget, 100)
          // Progress bar color: green if on track, amber if close, rose if far off
          const barColor = t.onTrack ? 'from-emerald-400 to-green-500' : pct >= 80 ? 'from-amber-400 to-orange-500' : 'from-rose-400 to-red-500'
          return (
            <motion.div key={t.key} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-slate-200/50 bg-white/50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isDown ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-700">{t.label}</div>
                    <div className="text-[9px] text-slate-400">Target: {t.reductionPct}% {isDown ? 'reduction' : 'improvement'}</div>
                  </div>
                </div>
                {t.onTrack
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : <span className="text-[9px] font-bold text-rose-500">OFF</span>}
              </div>

              {/* Progress bar */}
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-200/60">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
                  className={`h-full rounded-full bg-gradient-to-r ${barColor}`} />
              </div>

              {/* Values */}
              <div className="mt-2 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="tabular-nums text-lg font-bold text-slate-800">{t.actual.toLocaleString()}</span>
                  <span className="text-[10px] font-medium text-slate-400">{t.unit}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-slate-400">target {t.target.toLocaleString()}</span>
                  <span className={`flex items-center gap-0.5 font-bold ${gapPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
                    <GapIcon className="h-2.5 w-2.5" />
                    {Math.abs(t.gap).toLocaleString()}
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.section>
  )
}
