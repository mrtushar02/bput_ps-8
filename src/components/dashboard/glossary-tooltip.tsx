'use client'
/**
 * ESG Glossary Tooltip — hoverable help icon with concise definitions of
 * specialized ESG/BRSR terminology. Improves onboarding for new users.
 */
import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

const GLOSSARY: Record<string, string> = {
  BRSR: 'Business Responsibility & Sustainability Report — India\'s mandatory ESG disclosure framework (SEBI). Sections A (general), B (management), C (principles 1-9).',
  'BRSR Readiness': 'Percentage of BRSR indicators with approved source data. 100% = all indicators ready for final report generation.',
  LTIFR: 'Lost Time Injury Frequency Rate = (lost time incidents × 1,000,000) / hours worked. Measures safety performance per million hours.',
  'Scope 1': 'Direct GHG emissions from owned/controlled sources (e.g. diesel generators, company vehicles, on-site fuel combustion).',
  'Scope 2': 'Indirect GHG emissions from purchased electricity, heat, or steam. Calculated using grid emission factors (e.g. CEA v19 = 0.716 kgCO2e/kWh).',
  'Scope 3': 'Other indirect emissions in the value chain (business travel, purchased goods, waste disposal). Modular in this platform.',
  ZLD: 'Zero Liquid Discharge — a water management strategy where no untreated wastewater is released to the environment; all water is recycled/reused.',
  'tCO₂e': 'Tonnes of CO2 equivalent — standard unit for measuring GHG emissions across all greenhouse gases (CO2, CH4, N2O).',
  GJ: 'Gigajoule — unit of energy (1 GJ = 277.8 kWh). Used to normalize different energy sources (electricity, diesel, coal) for comparison.',
  'Emission Factor': 'Coefficient converting activity data (e.g. kWh, litres) into GHG emissions (kgCO2e). Versioned (e.g. CEA v19) for historical reproducibility.',
  'Renewable Share': 'Percentage of total energy from renewable sources (solar PPA, wind, hydro). Higher = lower Scope 2 emissions.',
  'Water Recycled': 'Percentage of withdrawn water that is recycled/reused. Higher = lower fresh water intake and better circularity.',
  'Waste Recovered': 'Percentage of generated waste that is recovered/recycled rather than disposed. Higher = better circular economy performance.',
  'ESG Score': 'Composite 0-100 index from 8 dimensions: BRSR readiness, completion, water/waste recycling, renewable share, diversity, safety, data quality.',
  'Data Confidence': 'Indicates data quality: Verified (green) = all source records approved; Review (amber) = open validation exceptions; Draft (slate) = not yet submitted.',
  'Reporting Period': 'A monthly/quarterly/annual window for ESG data collection. Each period has submission, review, and approval deadlines.',
  'Data Control Chain': 'The end-to-end pipeline: Source → Evidence → Validate → Calculate → Approve → Consolidate → BRSR Map → Report → Audit. Every KPI is traceable through this chain.',
}

export function GlossaryTooltip({ term, className = '' }: { term: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const definition = GLOSSARY[term]

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!definition) return null

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        onMouseEnter={() => setOpen(true)}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-slate-400 transition hover:text-blue-500"
        title={`What is ${term}?`}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className="glass-strong absolute left-1/2 top-full z-50 mt-1 w-64 -translate-x-1/2 rounded-xl p-3 text-left"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">{term}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">{definition}</p>
        </div>
      )}
    </div>
  )
}
