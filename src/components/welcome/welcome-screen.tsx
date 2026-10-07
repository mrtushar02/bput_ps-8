'use client'
/**
 * MEIL ESG — Premium Liquid Glass Welcome Screen
 * Flow: WELCOME → CHOOSE ROLE → LOGIN (morph)
 * Glassmorphism, floating orbs, ESG concept diagram, role-card fan interaction.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Building2, Leaf, Users, ShieldCheck, Package, HeartHandshake, Scale, FileCheck, Briefcase, BarChart3, Gavel, Eye, Crown, Settings2, ChevronDown, Check, Sparkles } from 'lucide-react'
import { useApp } from '@/lib/auth-context'

type Stage = 'welcome' | 'role' | 'login'

interface RoleCardDef {
  key: string
  name: string
  email: string
  role: string
  phase: 1 | 2 | 3
  icon: typeof Building2
  tint: string
  blurb: string
}

const ROLES: RoleCardDef[] = [
  { key: 'SUPER_ADMIN', name: 'Arjun Mehta', email: 'admin@meil-esg.in', role: 'Super Admin', phase: 3, icon: Settings2, tint: 'from-slate-500 to-slate-700', blurb: 'Full system & master data control' },
  { key: 'PROJECT_USER', name: 'Rohit Kumar', email: 'rohit@meil-esg.in', role: 'Project / Site User', phase: 1, icon: Building2, tint: 'from-sky-500 to-blue-600', blurb: 'Site-level source data entry' },
  { key: 'HR_USER', name: 'Sunita Rao', email: 'sunita@meil-esg.in', role: 'HR User', phase: 1, icon: Users, tint: 'from-cyan-500 to-teal-600', blurb: 'Workforce & HR data' },
  { key: 'EHS_USER', name: 'K. Venkat', email: 'kvenkat@meil-esg.in', role: 'EHS / Safety User', phase: 1, icon: ShieldCheck, tint: 'from-amber-500 to-orange-600', blurb: 'Safety & environmental incidents' },
  { key: 'PROCUREMENT_USER', name: 'Priya Nair', email: 'priya@meil-esg.in', role: 'Procurement User', phase: 1, icon: Package, tint: 'from-violet-500 to-purple-600', blurb: 'Supplier & value chain' },
  { key: 'CSR_USER', name: 'Imran Sheikh', email: 'imran@meil-esg.in', role: 'CSR / Community User', phase: 1, icon: HeartHandshake, tint: 'from-rose-500 to-pink-600', blurb: 'CSR & community impact' },
  { key: 'COMPLIANCE_USER', name: 'Deepika Joshi', email: 'deepika@meil-esg.in', role: 'Compliance / Governance', phase: 1, icon: Scale, tint: 'from-emerald-500 to-green-600', blurb: 'Governance & ethics' },
  { key: 'BU_REVIEWER', name: 'Rakesh Verma', email: 'rakesh@meil-esg.in', role: 'BU Reviewer', phase: 2, icon: FileCheck, tint: 'from-blue-500 to-indigo-600', blurb: 'BU review & approval' },
  { key: 'SUBSIDIARY_REVIEWER', name: 'Nisha Pillai', email: 'nisha@meil-esg.in', role: 'Subsidiary Reviewer', phase: 2, icon: Briefcase, tint: 'from-indigo-500 to-blue-700', blurb: 'Subsidiary consolidation review' },
  { key: 'GROUP_REVIEWER', name: 'Vikram Shah', email: 'vikram@meil-esg.in', role: 'Group / HQ Reviewer', phase: 2, icon: Gavel, tint: 'from-blue-600 to-cyan-700', blurb: 'Group final review & lock' },
  { key: 'ESG_MANAGER', name: 'Anita Desai', email: 'anita@meil-esg.in', role: 'ESG Manager', phase: 3, icon: BarChart3, tint: 'from-teal-500 to-emerald-600', blurb: 'ESG data quality & methodology' },
  { key: 'BRSR_MANAGER', name: 'Meena Iyer', email: 'meena@meil-esg.in', role: 'BRSR Manager', phase: 3, icon: FileCheck, tint: 'from-emerald-600 to-teal-700', blurb: 'BRSR reporting workflow' },
  { key: 'AUDITOR', name: 'Karthik S.', email: 'karthik@meil-esg.in', role: 'Auditor / Assurance', phase: 3, icon: Eye, tint: 'from-slate-600 to-gray-700', blurb: 'Assurance read-only scope' },
  { key: 'EXECUTIVE', name: 'Rajesh Khanna', email: 'rajesh@meil-esg.in', role: 'Executive', phase: 3, icon: Crown, tint: 'from-amber-600 to-yellow-700', blurb: 'Executive reporting access' },
]

const PHASE_LABELS = { 1: 'Phase 1 — Data Entry', 2: 'Phase 2 — Review & Consolidation', 3: 'Phase 3 — Analysis & Reporting' }

export function WelcomeScreen() {
  const { login } = useApp()
  const [stage, setStage] = useState<Stage>('welcome')
  const [selected, setSelected] = useState<RoleCardDef | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('esg12345')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function pickRole(r: RoleCardDef) {
    setSelected(r)
    setEmail(r.email)
    setStage('login')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await login(email, password)
    setBusy(false)
    if (!res.ok) setError(res.error || 'Invalid credentials')
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <Background />

      <header className="relative z-20 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-lg shadow-rose-600/30">
            <span className="text-lg font-black">M</span>
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight text-slate-800">meil<span className="text-rose-600">ESG</span></div>
            <div className="text-[11px] font-medium text-slate-500">ESG & BRSR Reporting Platform</div>
          </div>
        </div>
        <div className="hidden text-right md:block">
          <div className="text-xs font-semibold tracking-wide text-slate-600">ENGINEERING A SUSTAINABLE TOMORROW</div>
          <div className="text-[10px] text-slate-400">BRSR-aligned • GHG Protocol • ISO 14064</div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-7xl items-center px-4 pb-10 md:px-12">
        <div className="grid w-full items-center gap-8 lg:grid-cols-2">
          <AnimatePresence>
            {stage !== 'login' && (
              <motion.div
                key="concept"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40, transition: { duration: 0.3 } }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative hidden h-[520px] lg:block"
              >
                <EsgConceptDiagram />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {stage === 'welcome' && (
              <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20, transition: { duration: 0.25 } }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                <WelcomePanel onContinue={() => setStage('role')} />
              </motion.div>
            )}
            {stage === 'role' && (
              <motion.div key="role" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20, transition: { duration: 0.25 } }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                <RolePicker roles={ROLES} hovered={hovered} setHovered={setHovered} onPick={pickRole} onBack={() => setStage('welcome')} />
              </motion.div>
            )}
            {stage === 'login' && selected && (
              <motion.div key="login" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                <LoginMorph role={selected} email={email} setEmail={setEmail} password={password} setPassword={setPassword} remember={remember} setRemember={setRemember} error={error} busy={busy} onSubmit={submit} onBack={() => { setStage('role'); setSelected(null) }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

function Background() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="orb animate-orb" style={{ width: 420, height: 420, top: -120, left: -80, background: 'radial-gradient(circle, rgba(125,181,255,0.6), transparent 70%)' }} />
      <div className="orb animate-orb" style={{ width: 360, height: 360, top: '40%', right: -60, background: 'radial-gradient(circle, rgba(170,210,255,0.55), transparent 70%)', animationDelay: '3s' }} />
      <div className="orb animate-orb" style={{ width: 300, height: 300, bottom: -80, left: '30%', background: 'radial-gradient(circle, rgba(200,230,255,0.5), transparent 70%)', animationDelay: '6s' }} />
      <div className="orb animate-orb" style={{ width: 180, height: 180, top: '20%', left: '45%', background: 'radial-gradient(circle, rgba(150,200,255,0.4), transparent 70%)', animationDelay: '4.5s' }} />
      {[...Array(6)].map((_, i) => (
        <motion.div key={i}
          className="glass-subtle absolute rounded-2xl"
          style={{ width: 44 + (i % 3) * 18, height: 44 + (i % 3) * 18, top: `${15 + i * 14}%`, left: `${8 + i * 15}%`, opacity: 0.35 }}
          animate={{ y: [0, -16, 0], rotate: [0, i % 2 ? 8 : -8, 0] }}
          transition={{ duration: 8 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.7 }}
        />
      ))}
    </div>
  )
}

function WelcomePanel({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="glass-strong rounded-[28px] p-8 md:p-10">
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Welcome to MEIL ESG</span>
      </div>
      <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-800 md:text-4xl">
        Corporate sustainability tracking & <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">BRSR compliance</span>, end to end.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-base">
        A controlled chain from <span className="font-semibold text-slate-700">source data</span> collected at the project/site, through evidence, validation, calculation, approval, consolidation and BRSR mapping — to a final report with full audit traceability.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { icon: Building2, label: 'Collect', desc: 'Project-level source data' },
          { icon: FileCheck, label: 'Validate', desc: 'Server-side checks & calc' },
          { icon: BarChart3, label: 'Report', desc: 'BRSR-ready + audit trace' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }}
            className="glass-subtle rounded-xl p-3">
            <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 text-blue-600"><s.icon className="h-4 w-4" /></div>
            <div className="text-xs font-bold text-slate-700">{s.label}</div>
            <div className="text-[10px] leading-tight text-slate-500">{s.desc}</div>
          </motion.div>
        ))}
      </div>
      <div className="mt-7 flex items-center gap-3">
        <button onClick={onContinue} className="btn-glass-primary group flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-[0.99]">
          Choose Role to Continue
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
        <button onClick={onContinue} className="glass rounded-full px-5 py-3.5 text-sm font-semibold text-slate-600 hover:text-blue-600">
          Demo
        </button>
      </div>
      <p className="mt-4 text-[11px] text-slate-400">Demo accounts are explicitly marked ILLUSTRATIVE. Password: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">esg12345</code></p>
    </div>
  )
}

function RolePicker({ roles, hovered, setHovered, onPick, onBack }: { roles: RoleCardDef[]; hovered: string | null; setHovered: (s: string | null) => void; onPick: (r: RoleCardDef) => void; onBack: () => void }) {
  const phases = [1, 2, 3] as const
  return (
    <div className="glass-strong rounded-[28px] p-6 md:p-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Choose your role</h2>
          <p className="text-xs text-slate-500">Role-based access with backend-enforced permissions.</p>
        </div>
        <button onClick={onBack} className="glass-subtle rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Back</button>
      </div>
      <div className="max-h-[56vh] space-y-5 overflow-y-auto scroll-elegant pr-1">
        {phases.map(ph => (
          <div key={ph}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{PHASE_LABELS[ph]}</span>
              <div className="h-px flex-1 bg-slate-200/60" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
              {roles.filter(r => r.phase === ph).map((r, idx) => {
                const Icon = r.icon
                const isHover = hovered === r.key
                return (
                  <motion.button
                    key={r.key}
                    onMouseEnter={() => setHovered(r.key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onPick(r)}
                    initial={{ opacity: 0, y: 14, rotate: (idx % 3 - 1) * 1.5 }}
                    animate={{ opacity: 1, y: 0, rotate: isHover ? 0 : (idx % 3 - 1) * 1.5, scale: isHover ? 1.04 : 1, zIndex: isHover ? 10 : 1 }}
                    whileHover={{ y: -6 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1], delay: idx * 0.03 }}
                    className={`glass glass-shimmer relative overflow-hidden rounded-2xl p-3 text-left transition-shadow ${isHover ? 'shadow-xl shadow-blue-500/10' : ''}`}
                  >
                    <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${r.tint} text-white shadow-md`}>
                      <Icon style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="text-xs font-bold leading-tight text-slate-800">{r.role}</div>
                    <div className="mt-0.5 text-[10px] font-medium text-slate-500">{r.name}</div>
                    <div className="mt-1 text-[10px] leading-tight text-slate-400">{r.blurb}</div>
                  </motion.button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoginMorph({ role, email, setEmail, password, setPassword, remember, setRemember, error, busy, onSubmit, onBack }: any) {
  const Icon = role.icon
  return (
    <div className="glass-strong overflow-hidden rounded-[28px]">
      <div className="grid md:grid-cols-2">
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-blue-50/80 to-cyan-50/80 p-8 md:flex">
          <button onClick={onBack} className="glass-subtle mb-4 flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">
            <ChevronDown className="h-3 w-3 rotate-90" /> Change role
          </button>
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col items-center text-center">
            <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${role.tint} text-white shadow-xl shadow-blue-500/20`}>
              <Icon className="h-9 w-9" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Phase {role.phase}</div>
            <h3 className="mt-1 text-2xl font-bold text-slate-800">{role.role}</h3>
            <p className="mt-2 max-w-xs text-sm text-slate-600">{role.blurb}</p>
            <div className="mt-4 flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-[10px] font-bold text-white">{role.name.split(' ').map((n: string) => n[0]).join('')}</div>
              <span className="text-xs font-semibold text-slate-700">{role.name}</span>
            </div>
          </motion.div>
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Backend-enforced RBAC + org scope
          </div>
        </div>

        <div className="p-7 md:p-9">
          <div className="mb-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sign in as</div>
            <div className="mt-1 flex items-center gap-2">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${role.tint} text-white`}><Icon className="h-4 w-4" /></div>
              <div>
                <div className="text-base font-bold text-slate-800">{role.role}</div>
                <div className="text-[11px] text-slate-500">{role.name}</div>
              </div>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="you@meil-esg.in" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="••••••••" />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />
                Remember session
              </label>
              <button type="button" className="text-xs font-medium text-blue-600 hover:underline">Forgot password?</button>
            </div>
            {error && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                <span>{error}</span>
              </motion.div>
            )}
            <button type="submit" disabled={busy}
              className="btn-glass-primary group flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60">
              {busy ? 'Signing in…' : <>Sign In <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>}
            </button>
          </form>
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-blue-50/60 px-3 py-2 text-[11px] text-slate-500">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            Demo credentials pre-filled. Password: <code className="rounded bg-white px-1 py-0.5 font-mono text-slate-600">esg12345</code>
          </div>
        </div>
      </div>
    </div>
  )
}

function EsgConceptDiagram() {
  const satellites = [
    { label: 'Environment', icon: Leaf, color: 'from-emerald-400 to-green-600', angle: -90, key: 'ENV' },
    { label: 'Social', icon: Users, color: 'from-amber-400 to-orange-600', angle: 30, key: 'SOC' },
    { label: 'Governance', icon: Scale, color: 'from-blue-400 to-indigo-600', angle: 150, key: 'GOV' },
  ]
  const cx = 260, cy = 260, r = 150
  return (
    <div className="relative h-full w-full">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 520" fill="none">
        {satellites.map((s) => {
          const rad = (s.angle * Math.PI) / 180
          const x = cx + r * Math.cos(rad)
          const y = cy + r * Math.sin(rad)
          return (
            <g key={s.key}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(59,130,246,0.25)" strokeWidth="2" strokeDasharray="4 6">
                <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="3s" repeatCount="indefinite" />
              </line>
              <circle cx={x} cy={y} r="3" fill="rgba(59,130,246,0.4)">
                <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
              </circle>
            </g>
          )
        })}
      </svg>
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-3xl">
        <div className="text-lg font-black text-slate-800">ESG</div>
        <div className="text-[9px] font-semibold uppercase tracking-wider text-blue-600">Sustainable</div>
        <div className="text-[9px] font-semibold uppercase tracking-wider text-blue-600">Growth</div>
      </motion.div>
      {satellites.map((s, i) => {
        const rad = (s.angle * Math.PI) / 180
        const x = cx + r * Math.cos(rad) - 60
        const y = cy + r * Math.sin(rad) - 60
        const Icon = s.icon
        return (
          <motion.div key={s.key}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.08, y: -4 }}
            className="glass glass-shimmer absolute flex h-28 w-28 flex-col items-center justify-center rounded-3xl"
            style={{ left: x, top: y }}
          >
            <div className={`mb-1.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${s.color} text-white shadow-lg`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">{s.label}</div>
          </motion.div>
        )
      })}
      <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-2">
        {['Measure', 'Manage', 'Report'].map((s, i) => (
          <motion.div key={s} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.1 }}
            className="glass-subtle rounded-full px-3 py-1 text-[10px] font-semibold text-slate-600">{s}</motion.div>
        ))}
      </div>
    </div>
  )
}
