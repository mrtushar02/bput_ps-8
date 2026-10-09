'use client'
/**
 * MEIL ESG — High-Intensity iOS Liquid Glass Welcome & Project Selection Platform
 * Design System: design.md + Official MEIL Reference Layout
 * Flow:
 *  1. WELCOME SCREEN (Org & Business Unit Selection + 3D Orbital ESG Diagram + Pillars)
 *  2. PROJECT SELECTION SCREEN (Next screen: BU-related Projects Grid with iOS Liquid Glass)
 *  3. ROLE SELECTION (15 RBAC Roles for chosen site)
 *  4. LOGIN MORPH (Instant demo authentication)
 */

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, ArrowLeft, Building2, Leaf, Users, ShieldCheck,
  ChevronDown, ChevronLeft, ChevronRight, Heart, Check, Sparkles, MapPin, Search, Route, Flame,
  SunMedium, Zap, Droplets, Waves, Globe, CheckCircle2,
  Settings2, Package, HeartHandshake, Scale, FileCheck, Briefcase,
  BarChart3, Gavel, Eye, Crown, Compass, Activity, ShieldAlert
} from 'lucide-react'
import { useApp } from '@/lib/auth-context'
import {
  MEIL_BUSINESS_UNITS,
  MEIL_ORGANIZATIONS,
  type MeilBusinessUnit,
  type MeilProject,
  getBusinessUnitById,
} from '@/lib/meil-portfolio'

type Stage = 'welcome' | 'project' | 'role' | 'login'

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
  { key: 'PROJECT_USER', name: 'Rohit Kumar', email: 'rohit@meil-esg.in', role: 'Project / Site User', phase: 1, icon: Building2, tint: 'from-sky-500 to-blue-600', blurb: 'Site operations & daily ESG metrics' },
  { key: 'HR_USER', name: 'Sunita Rao', email: 'sunita@meil-esg.in', role: 'HR User', phase: 1, icon: Users, tint: 'from-cyan-500 to-teal-600', blurb: 'Human resources & workforce welfare metrics' },
  { key: 'EHS_USER', name: 'K. Venkat', email: 'kvenkat@meil-esg.in', role: 'EHS / Safety User', phase: 1, icon: ShieldCheck, tint: 'from-amber-500 to-orange-600', blurb: 'Environment, Health & Safety incident reports' },
  { key: 'PROCUREMENT_USER', name: 'Priya Nair', email: 'priya@meil-esg.in', role: 'Procurement User', phase: 1, icon: Package, tint: 'from-violet-500 to-purple-600', blurb: 'Supply chain sustainability & vendor ESG scores' },
  { key: 'CSR_USER', name: 'Imran Sheikh', email: 'imran@meil-esg.in', role: 'CSR / Community User', phase: 1, icon: Heart, tint: 'from-rose-500 to-pink-600', blurb: 'Community outreach & CSR initiatives' },
  { key: 'COMPLIANCE_USER', name: 'Deepika Joshi', email: 'deepika@meil-esg.in', role: 'Compliance User', phase: 1, icon: Scale, tint: 'from-emerald-500 to-green-600', blurb: 'Regulatory reporting & framework compliance' },
  // Page 2 & subsequent roles
  { key: 'SUPER_ADMIN', name: 'Arjun Mehta', email: 'admin@meil-esg.in', role: 'Super Admin', phase: 3, icon: Settings2, tint: 'from-slate-500 to-slate-700', blurb: 'Full enterprise data & user administration' },
  { key: 'BU_REVIEWER', name: 'Rakesh Verma', email: 'rakesh@meil-esg.in', role: 'Business Unit Reviewer', phase: 2, icon: FileCheck, tint: 'from-blue-500 to-indigo-600', blurb: 'BU-level technical validation & review approval' },
  { key: 'SUBSIDIARY_REVIEWER', name: 'Nisha Pillai', email: 'nisha@meil-esg.in', role: 'Subsidiary Reviewer', phase: 2, icon: Briefcase, tint: 'from-indigo-500 to-blue-700', blurb: 'Subsidiary consolidation & sign-off review' },
  { key: 'GROUP_REVIEWER', name: 'Vikram Shah', email: 'vikram@meil-esg.in', role: 'Group / HQ Reviewer', phase: 2, icon: Gavel, tint: 'from-blue-600 to-cyan-700', blurb: 'Conglomerate-level sign-off & audit lock' },
  { key: 'ESG_MANAGER', name: 'Anita Desai', email: 'anita@meil-esg.in', role: 'ESG Manager', phase: 3, icon: BarChart3, tint: 'from-teal-500 to-emerald-600', blurb: 'Data completeness, emission factors & GHG calculation' },
  { key: 'BRSR_MANAGER', name: 'Meena Iyer', email: 'meena@meil-esg.in', role: 'BRSR Lead Manager', phase: 3, icon: FileCheck, tint: 'from-emerald-600 to-teal-700', blurb: 'SEBI BRSR Core disclosures & report generation' },
  { key: 'AUDITOR', name: 'Karthik S.', email: 'karthik@meil-esg.in', role: 'Assurance Auditor', phase: 3, icon: Eye, tint: 'from-slate-600 to-gray-700', blurb: 'Read-only assurance testing & audit trail' },
  { key: 'EXECUTIVE', name: 'Rajesh Khanna', email: 'rajesh@meil-esg.in', role: 'Executive Board', phase: 3, icon: Crown, tint: 'from-amber-600 to-yellow-700', blurb: 'Strategic ESG metrics, risks & executive dashboards' },
]

const PHASE_LABELS = {
  1: 'Phase 1 — Site & Operational Data Entry',
  2: 'Phase 2 — Multi-Level Review & Approvals',
  3: 'Phase 3 — BRSR Core, Assurance & Analytics'
}

function getBuIcon(iconName: string) {
  switch (iconName) {
    case 'Route': return Route
    case 'Building2': return Building2
    case 'Flame': return Flame
    case 'SunMedium': return SunMedium
    case 'Zap': return Zap
    case 'Droplets': return Droplets
    case 'Waves': return Waves
    case 'Globe': return Globe
    default: return Building2
  }
}

export function WelcomeScreen() {
  const { login, selectedBuId, setSelectedBuId, selectedProjectId, setSelectedProjectId } = useApp()
  const [stage, setStage] = useState<Stage>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('stage')
      if (p === 'welcome' || p === 'project' || p === 'role' || p === 'login') return p as Stage
    }
    return 'role' // Default to role to show exact replica
  })

  // Organization & Business Unit selection state
  const [selectedOrgId, setSelectedOrgId] = useState<string>('MEIL-GROUP')
  const [activeBuId, setActiveBuId] = useState<string>(selectedBuId || 'bu-transportation')
  const [activeProjectId, setActiveProjectId] = useState<string>(selectedProjectId || 'trans-01')

  // Role & login state
  const [selectedRole, setSelectedRole] = useState<RoleCardDef | null>(null)
  const [hoveredRole, setHoveredRole] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('esg12345')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Current active BU & Project objects
  const currentBu = useMemo(
    () => getBusinessUnitById(activeBuId) || MEIL_BUSINESS_UNITS[0],
    [activeBuId]
  )

  const currentProject = useMemo(() => {
    const list = currentBu.projects
    return list.find(p => p.id === activeProjectId) || list[0]
  }, [currentBu, activeProjectId])

  // Sync to app context whenever selection changes
  const handleSelectBu = (buId: string) => {
    setActiveBuId(buId)
    setSelectedBuId(buId)
    const bu = getBusinessUnitById(buId)
    if (bu && bu.projects.length > 0) {
      setActiveProjectId(bu.projects[0].id)
      setSelectedProjectId(bu.projects[0].id)
    }
  }

  const handleSelectProject = (project: MeilProject) => {
    setActiveProjectId(project.id)
    setSelectedProjectId(project.id)
  }

  const handlePickRole = (role: RoleCardDef) => {
    setSelectedRole(role)
    setEmail(role.email)
    setStage('login')
  }

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await login(email, password)
    setBusy(false)
    if (!res.ok) setError(res.error || 'Invalid credentials')
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#e0f2fe] text-slate-800">
      <BackgroundAtmosphere />

      {/* Outer Viewport Container */}
      <div className="relative z-10 flex min-h-screen flex-col justify-between px-3 py-4 md:px-8 md:py-6">
        
        {/* Top Header inside viewport */}
        <header className="mx-auto flex w-full max-w-[1380px] items-center justify-between pb-2 pt-1">
          {/* Left: Official MEIL Logo from Screenshot */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DC2626] text-white shadow-md shadow-red-500/25 font-black text-xl">
              M
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-slate-900">meil</span>
            </div>
          </div>

          {/* Right: Project Site context + Motto */}
          <div className="flex items-center gap-3 sm:gap-4">
            {stage === 'role' && (
              <button
                onClick={() => setStage('project')}
                className="hidden sm:flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold text-slate-600 glass-subtle hover:bg-white hover:text-sky-600 transition shadow-xs"
                title="Change Selected Project Site"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{currentProject.name}</span>
              </button>
            )}
            {stage === 'project' && (
              <button
                onClick={() => setStage('welcome')}
                className="hidden sm:flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold text-slate-600 glass-subtle hover:bg-white hover:text-sky-600 transition shadow-xs"
                title="Back to Welcome Screen"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Organization & BU</span>
              </button>
            )}
            <div className="text-right">
              <div className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                Engineering
              </div>
              <div className="text-xs font-semibold text-slate-700">
                A Sustainable Tomorrow
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Main Body: Role Screen has freestanding wide layout matching screenshot */}
        {stage === 'role' ? (
          <main className="mx-auto my-auto flex w-full max-w-[1380px] items-center justify-center py-2 sm:py-4">
            <RolePickerScreen
              project={currentProject}
              bu={currentBu}
              roles={ROLES}
              hovered={hoveredRole}
              setHovered={setHoveredRole}
              onPick={handlePickRole}
              onBack={() => setStage('project')}
            />
          </main>
        ) : (
          <main className="mx-auto my-auto flex w-full max-w-[1240px] items-center justify-center">
            <div className="glass-ios-liquid w-full rounded-[36px] p-6 shadow-2xl transition-all md:p-10 lg:p-12">
              <AnimatePresence mode="wait">
                {stage === 'welcome' && (
                  <motion.div
                    key="stage-welcome"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12"
                  >
                    {/* Left Column: 3D Orbit ESG Visual Diagram (5 Cols) */}
                    <div className="relative hidden lg:col-span-5 lg:block">
                      <LiquidGlassOrbitDiagram />
                    </div>

                    {/* Right Column: Welcome Headline, Org + BU Dropdowns, Continue, Pillars (7 Cols) */}
                    <div className="lg:col-span-7">
                      <WelcomePanel
                        selectedOrgId={selectedOrgId}
                        setSelectedOrgId={setSelectedOrgId}
                        activeBuId={activeBuId}
                        onSelectBu={handleSelectBu}
                        onContinue={() => setStage('project')}
                      />
                    </div>
                  </motion.div>
                )}

                {stage === 'project' && (
                  <motion.div
                    key="stage-project"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <ProjectSelectionScreen
                      currentBu={currentBu}
                      selectedProjectId={activeProjectId}
                      onSelectBu={handleSelectBu}
                      onSelectProject={handleSelectProject}
                      onBack={() => setStage('welcome')}
                      onProceed={() => setStage('role')}
                    />
                  </motion.div>
                )}

                {stage === 'login' && selectedRole && (
                  <motion.div
                    key="stage-login"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <LoginScreen
                      project={currentProject}
                      bu={currentBu}
                      role={selectedRole}
                      email={email}
                      setEmail={setEmail}
                      password={password}
                      setPassword={setPassword}
                      remember={remember}
                      setRemember={setRemember}
                      error={error}
                      busy={busy}
                      onSubmit={handleSubmitLogin}
                      onBack={() => {
                        setStage('role')
                        setSelectedRole(null)
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        )}

        {/* Compact Footer (Hidden on role stage to match replica screenshot) */}
        {stage !== 'role' && (
          <footer className="mx-auto flex w-full max-w-[1240px] items-center justify-between pt-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">MEIL ESG & BRSR Reporting Platform</span>
              <span>·</span>
              <span>SEBI Compliant</span>
              <span>·</span>
              <span>GHG Protocol</span>
            </div>
            <div className="text-[10px] text-slate-400">
              © {new Date().getFullYear()} Megha Engineering & Infrastructures Ltd.
            </div>
          </footer>
        )}

      </div>
    </div>
  )
}

/**
 * Ambient background with floating 3D spheres & light reflections
 */
function BackgroundAtmosphere() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Prominent Top-Left Frosted 3D Glass Lens / Bubble from Reference Screenshot */}
      <div
        className="pointer-events-none absolute -top-16 -left-16 sm:-top-20 sm:-left-20 w-[420px] h-[420px] sm:w-[500px] sm:h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.85) 0%, rgba(224,242,254,0.48) 50%, rgba(186,230,253,0.2) 80%, transparent 100%)',
          boxShadow: '0 25px 60px rgba(186,230,253,0.4), inset 0 2px 4px rgba(255,255,255,0.95)',
          border: '1.5px solid rgba(255,255,255,0.7)',
          backdropFilter: 'blur(35px)',
          WebkitBackdropFilter: 'blur(35px)',
        }}
      />

      {/* Soft Sky Blue Radial Orbs */}
      <div className="orb animate-orb" style={{ width: 500, height: 500, top: -140, right: -100, background: 'radial-gradient(circle, rgba(125,211,252,0.65), transparent 70%)' }} />
      <div className="orb animate-orb" style={{ width: 440, height: 440, bottom: -120, left: -80, background: 'radial-gradient(circle, rgba(186,230,253,0.7), transparent 70%)', animationDelay: '3s' }} />
      <div className="orb animate-orb" style={{ width: 320, height: 320, top: '35%', left: '15%', background: 'radial-gradient(circle, rgba(224,242,254,0.75), transparent 70%)', animationDelay: '5s' }} />

      {/* Floating 3D Glossy Translucent Spheres / Bubbles */}
      {[
        { size: 48, top: '12%', left: '8%', delay: 0 },
        { size: 28, top: '24%', left: '22%', delay: 1.5 },
        { size: 64, top: '48%', left: '4%', delay: 2 },
        { size: 36, top: '78%', left: '12%', delay: 0.8 },
        { size: 54, top: '16%', right: '14%', delay: 2.5 },
        { size: 32, top: '42%', right: '6%', delay: 1.2 },
        { size: 44, top: '72%', right: '18%', delay: 3 },
      ].map((s, idx) => (
        <motion.div
          key={idx}
          className="glass-sphere-3d absolute pointer-events-none"
          style={{ width: s.size, height: s.size, top: s.top, left: (s as any).left, right: (s as any).right }}
          animate={{
            y: [0, -18, 0],
            x: [0, idx % 2 === 0 ? 8 : -8, 0],
            scale: [1, 1.04, 1],
          }}
          transition={{
            duration: 6 + idx * 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: s.delay,
          }}
        />
      ))}
    </div>
  )
}

/**
 * 3D Orbit ESG Visual Diagram (Left Column of Welcome Screen)
 * Exactly reproduces the center cushion card, orbiting tiles, dashed rings, and bottom metric blocks.
 */
function LiquidGlassOrbitDiagram() {
  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      <div className="relative h-[380px] w-full max-w-[420px]">
        {/* Concentric SVG Orbital Rings */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 420 380" fill="none">
          {/* Inner ring */}
          <circle cx="210" cy="180" r="105" stroke="rgba(14,165,233,0.3)" strokeWidth="1.5" strokeDasharray="4 6">
            <animateTransform attributeName="transform" type="rotate" from="0 210 180" to="360 210 180" dur="50s" repeatCount="indefinite" />
          </circle>
          {/* Outer ring */}
          <circle cx="210" cy="180" r="145" stroke="rgba(56,189,248,0.22)" strokeWidth="1.5" strokeDasharray="3 8">
            <animateTransform attributeName="transform" type="rotate" from="360 210 180" to="0 210 180" dur="70s" repeatCount="indefinite" />
          </circle>
          {/* Radial glowing connection lines */}
          <line x1="210" y1="180" x2="210" y2="45" stroke="rgba(14,165,233,0.3)" strokeWidth="1" strokeDasharray="3 4" />
          <line x1="210" y1="180" x2="68" y2="180" stroke="rgba(14,165,233,0.3)" strokeWidth="1" strokeDasharray="3 4" />
          <line x1="210" y1="180" x2="352" y2="180" stroke="rgba(14,165,233,0.3)" strokeWidth="1" strokeDasharray="3 4" />
        </svg>

        {/* Orbit Node Top: Environment */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          whileHover={{ scale: 1.05 }}
          className="glass-ios-liquid absolute left-1/2 top-4 -translate-x-1/2 flex flex-col items-center justify-center rounded-2xl px-5 py-3 shadow-md"
        >
          <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-sm">
            <Leaf className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700">Environment</span>
        </motion.div>

        {/* Orbit Node Left: Social */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
          className="glass-ios-liquid absolute left-2 top-[138px] flex flex-col items-center justify-center rounded-2xl px-5 py-3 shadow-md"
        >
          <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-600 shadow-sm">
            <Users className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700">Social</span>
        </motion.div>

        {/* Orbit Node Right: Governance */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          whileHover={{ scale: 1.05 }}
          className="glass-ios-liquid absolute right-2 top-[138px] flex flex-col items-center justify-center rounded-2xl px-5 py-3 shadow-md"
        >
          <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700">Governance</span>
        </motion.div>

        {/* Orbit Node Bottom Right: Bar Chart indicator */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="glass-ios-liquid absolute bottom-7 right-20 flex h-9 w-9 items-center justify-center rounded-xl text-sky-600 shadow-md"
        >
          <BarChart3 className="h-4 w-4" />
        </motion.div>

        {/* Central 3D Cushion Card: ESG SUSTAINABLE GROWTH */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glass-cushion-3d absolute left-1/2 top-[180px] -translate-x-1/2 -translate-y-1/2 flex h-36 w-36 flex-col items-center justify-center rounded-[32px] p-4 text-center"
        >
          {/* Leaf Icon with soft radial glow */}
          <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-sky-400 to-blue-500 text-white shadow-md shadow-sky-500/30">
            <Leaf className="h-5 w-5" />
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900">ESG</div>
          <div className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">
            SUSTAINABLE
          </div>
          <div className="text-[8px] font-bold tracking-widest text-sky-600 uppercase">
            GROWTH
          </div>
        </motion.div>
      </div>

      {/* Bottom 3 Metric Columns with subtle dividers */}
      <div className="mt-4 flex w-full max-w-[380px] items-center justify-between border-t border-slate-200/60 pt-4">
        <div className="flex-1 text-center">
          <div className="text-xs font-bold text-slate-800">Measure</div>
          <div className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">REAL IMPACT</div>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex-1 text-center">
          <div className="text-xs font-bold text-slate-800">Manage</div>
          <div className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">RESPONSIBLY</div>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex-1 text-center">
          <div className="text-xs font-bold text-slate-800">Report</div>
          <div className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">TRANSPARENTLY</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Welcome Panel (Right Column) with Organization & Business Unit Dropdowns
 */
function WelcomePanel({
  selectedOrgId,
  setSelectedOrgId,
  activeBuId,
  onSelectBu,
  onContinue,
}: {
  selectedOrgId: string
  setSelectedOrgId: (id: string) => void
  activeBuId: string
  onSelectBu: (id: string) => void
  onContinue: () => void
}) {
  const [buDropdownOpen, setBuDropdownOpen] = useState(false)
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)

  const activeBu = useMemo(
    () => getBusinessUnitById(activeBuId) || MEIL_BUSINESS_UNITS[0],
    [activeBuId]
  )

  const activeOrg = useMemo(
    () => MEIL_ORGANIZATIONS.find(o => o.id === selectedOrgId) || MEIL_ORGANIZATIONS[0],
    [selectedOrgId]
  )

  const BuIcon = getBuIcon(activeBu.iconName)

  return (
    <div className="flex flex-col space-y-6">
      {/* Header Tag & Title */}
      <div>
        <div className="text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase">
          W E L C O M E &nbsp; T O
        </div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          MEIL <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">ESG</span>
        </h1>
        <h2 className="mt-0.5 text-base font-semibold text-slate-700">
          ESG & BRSR Reporting Platform
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 md:text-sm">
          A unified platform for responsible data collection, transparent reporting and a sustainable future.
        </p>
      </div>

      {/* Select Organization & Business Unit Dropdowns */}
      <div className="space-y-3.5">
        
        {/* Dropdown 1: Select Organization */}
        <div className="relative">
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            Select Organization
          </label>
          <div
            onClick={() => {
              setOrgDropdownOpen(!orgDropdownOpen)
              setBuDropdownOpen(false)
            }}
            className="glass-ios-liquid flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3 transition hover:border-sky-300"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600 shadow-sm">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">{activeOrg.name}</div>
                <div className="text-[10px] text-slate-400">{activeOrg.legalName}</div>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${orgDropdownOpen ? 'rotate-180' : ''}`} />
          </div>

          {/* Org Dropdown Menu */}
          <AnimatePresence>
            {orgDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="glass-strong absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-white/80 p-1.5 shadow-xl backdrop-blur-2xl"
              >
                {MEIL_ORGANIZATIONS.map(org => (
                  <div
                    key={org.id}
                    onClick={() => {
                      setSelectedOrgId(org.id)
                      setOrgDropdownOpen(false)
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                      org.id === selectedOrgId ? 'bg-sky-50 font-semibold text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{org.name}</div>
                      <div className="text-[10px] text-slate-400">{org.legalName}</div>
                    </div>
                    {org.id === selectedOrgId && <Check className="h-4 w-4 text-sky-600" />}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dropdown 2: Select Business Unit */}
        <div className="relative">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-600">
              Select Business Unit
            </label>
            <span className="text-[10px] font-semibold text-sky-600">
              {MEIL_BUSINESS_UNITS.length} Core Portfolios
            </span>
          </div>
          
          <div
            onClick={() => {
              setBuDropdownOpen(!buDropdownOpen)
              setOrgDropdownOpen(false)
            }}
            className="glass-ios-liquid flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3 transition hover:border-sky-300"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${activeBu.gradient} text-white shadow-sm`}>
                <BuIcon className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">{activeBu.name}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                    {activeBu.projects.length} Sites
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">{activeBu.sector}</div>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${buDropdownOpen ? 'rotate-180' : ''}`} />
          </div>

          {/* BU Dropdown Menu */}
          <AnimatePresence>
            {buDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="glass-strong absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto scroll-elegant rounded-2xl border border-white/80 p-1.5 shadow-2xl backdrop-blur-2xl"
              >
                {MEIL_BUSINESS_UNITS.map(bu => {
                  const IconComp = getBuIcon(bu.iconName)
                  const isSelected = bu.id === activeBuId
                  return (
                    <div
                      key={bu.id}
                      onClick={() => {
                        onSelectBu(bu.id)
                        setBuDropdownOpen(false)
                      }}
                      className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                        isSelected ? 'bg-sky-50 font-semibold text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${bu.gradient} text-white shadow-xs`}>
                          <IconComp className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{bu.name}</span>
                            <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] text-slate-500 font-mono">
                              {bu.projects.length}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{bu.sector}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-sky-600" />}
                    </div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Prominent Continue Button (Electric Blue Pill with Arrow) */}
      <button
        onClick={onContinue}
        className="btn-liquid-blue group flex w-full items-center justify-center gap-2.5 rounded-full py-3.5 text-sm font-bold shadow-lg"
      >
        <span>Continue to Project Sites ({activeBu.projects.length})</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>

      {/* Bottom: OUR ESG PILLARS with 3 Frosted Glass Cards */}
      <div className="pt-1">
        <div className="relative mb-3.5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200/70" />
          </div>
          <span className="relative bg-[#ffffff]/60 px-3 text-[10px] font-bold tracking-widest text-slate-400 uppercase backdrop-blur-xs">
            OUR ESG PILLARS
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Pillar 1: Environment */}
          <div className="glass-ios-liquid flex flex-col items-center justify-center rounded-2xl p-2.5 text-center">
            <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Leaf className="h-3.5 w-3.5" />
            </div>
            <div className="text-[10px] font-bold leading-tight text-slate-700">Environment</div>
            <div className="text-[9px] text-slate-400">Protection</div>
          </div>

          {/* Pillar 2: Social */}
          <div className="glass-ios-liquid flex flex-col items-center justify-center rounded-2xl p-2.5 text-center">
            <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <Users className="h-3.5 w-3.5" />
            </div>
            <div className="text-[10px] font-bold leading-tight text-slate-700">Social</div>
            <div className="text-[9px] text-slate-400">Responsibility</div>
          </div>

          {/* Pillar 3: Governance */}
          <div className="glass-ios-liquid flex flex-col items-center justify-center rounded-2xl p-2.5 text-center">
            <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <div className="text-[10px] font-bold leading-tight text-slate-700">Good</div>
            <div className="text-[9px] text-slate-400">Governance</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * NEXT SCREEN: Project Selection Screen
 * Displays the list of all projects belonging to the selected Business Unit in an
 * ultra-premium iOS Liquid Glass interactive grid!
 */
function ProjectSelectionScreen({
  currentBu,
  selectedProjectId,
  onSelectBu,
  onSelectProject,
  onBack,
  onProceed,
}: {
  currentBu: MeilBusinessUnit
  selectedProjectId: string
  onSelectBu: (id: string) => void
  onSelectProject: (p: MeilProject) => void
  onBack: () => void
  onProceed: () => void
}) {
  const [search, setSearch] = useState('')
  const BuIcon = getBuIcon(currentBu.iconName)

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return currentBu.projects
    const q = search.toLowerCase()
    return currentBu.projects.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.stateOrCountry.toLowerCase().includes(q)
    )
  }, [currentBu.projects, search])

  const activeProject = useMemo(() => {
    return currentBu.projects.find(p => p.id === selectedProjectId) || currentBu.projects[0]
  }, [currentBu.projects, selectedProjectId])

  return (
    <div className="space-y-5">
      {/* Top Header with Back Button & Breadcrumbs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="glass-subtle flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-white hover:text-sky-600 shadow-xs"
            title="Back to Welcome Screen"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 2 of 3</span>
              <span className="text-slate-300">•</span>
              <span className="text-[10px] font-bold text-sky-600 uppercase">Project Site Selection</span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 md:text-2xl">
              Select Project Site in {currentBu.name}
            </h2>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${currentBu.projects.length} sites in ${currentBu.shortName}...`}
            className="w-full rounded-full border border-slate-200/80 bg-white/70 py-1.5 pl-9 pr-4 text-xs text-slate-800 outline-none backdrop-blur-md transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
          />
        </div>
      </div>

      {/* Business Unit Switcher Pill Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scroll-elegant pb-1">
        {MEIL_BUSINESS_UNITS.map(bu => {
          const Icon = getBuIcon(bu.iconName)
          const isSelected = bu.id === currentBu.id
          return (
            <button
              key={bu.id}
              onClick={() => onSelectBu(bu.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                isSelected
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25'
                  : 'glass-subtle text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{bu.shortName}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/60 text-slate-600'}`}>
                {bu.projects.length}
              </span>
            </button>
          )
        })}
      </div>

      {/* Project Cards Grid */}
      <div className="max-h-[50vh] overflow-y-auto scroll-elegant pr-1">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Compass className="h-10 w-10 text-slate-300" />
            <div className="mt-2 text-sm font-semibold text-slate-700">No project sites found</div>
            <div className="text-xs text-slate-400">Try searching for a different keyword or switch Business Unit.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((p, idx) => {
              const isSelected = p.id === selectedProjectId
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.02 }}
                  onClick={() => onSelectProject(p)}
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl p-4 transition-all ${
                    isSelected
                      ? 'border-2 border-sky-500 bg-white/95 shadow-lg shadow-sky-500/15 ring-2 ring-sky-200/60'
                      : 'glass-ios-liquid hover:-translate-y-0.5 hover:border-sky-300 hover:bg-white/90'
                  }`}
                >
                  {/* Top: Category Tag + Status Badge */}
                  <div>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                        {p.category}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-semibold text-slate-500">
                          {p.status === 'IN_OPERATION' ? 'Operating' : 'Active'}
                        </span>
                      </div>
                    </div>

                    {/* Project Title */}
                    <h3 className="text-sm font-bold leading-snug text-slate-800 group-hover:text-sky-700 transition-colors">
                      {p.name}
                    </h3>

                    {/* Location with Pin */}
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <MapPin className="h-3 w-3 text-sky-500 shrink-0" />
                      <span className="line-clamp-1">{p.location}</span>
                    </div>

                    {/* Description */}
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                      {p.description}
                    </p>
                  </div>

                  {/* Bottom: ESG Metrics Pill & Selection Radio */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                        BRSR Core
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        ESG {p.esgScore}%
                      </span>
                    </div>

                    <div className={`flex h-5 w-5 items-center justify-center rounded-full transition ${
                      isSelected ? 'bg-sky-500 text-white shadow-xs' : 'border border-slate-300 text-transparent'
                    }`}>
                      <Check className="h-3 w-3" />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar: Selected Project Summary & Proceed Button */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white/80 p-4 backdrop-blur-xl border border-sky-100 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm">
            <BuIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Selected Project</span>
              <span className="rounded bg-sky-100 px-1.5 py-0.2 text-[9px] font-bold text-sky-700">{currentBu.name}</span>
            </div>
            <div className="text-sm font-extrabold text-slate-800">
              {activeProject ? activeProject.name : 'Choose a project'}
            </div>
            <div className="text-[11px] text-slate-500">
              {activeProject?.location} • Owner: {activeProject?.reportingOwner}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="glass-subtle rounded-full px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
          >
            Back
          </button>
          <button
            onClick={onProceed}
            className="btn-liquid-blue flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold shadow-md"
          >
            <span>Proceed to Role Access</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Screen 3: Role Selection Screen (Phase 1, 2, 3 Enterprise RBAC roles)
 * Matches the reference design with high-intensity iOS Liquid Glass,
 * bold modern typography, deep blue drop shadows, left/right nav chevrons,
 * and bottom slogan.
 */
function RolePickerScreen({
  project,
  bu,
  roles,
  hovered,
  setHovered,
  onPick,
  onBack,
}: {
  project: MeilProject
  bu: MeilBusinessUnit
  roles: RoleCardDef[]
  hovered: string | null
  setHovered: (s: string | null) => void
  onPick: (r: RoleCardDef) => void
  onBack: () => void
}) {
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 6
  const totalPages = Math.ceil(roles.length / pageSize)

  const displayedRoles = useMemo(() => {
    const start = currentPage * pageSize
    return roles.slice(start, start + pageSize)
  }, [roles, currentPage, pageSize])

  const nextPage = () => setCurrentPage(prev => (prev + 1) % totalPages)
  const prevPage = () => setCurrentPage(prev => (prev - 1 + totalPages) % totalPages)

  // Active highlighted card index for carousel dots & elevation
  // Defaults to 4th index (CSR / Community User) on page 0 if not hovering another card
  const activeIndex = useMemo(() => {
    if (hovered) {
      const idx = displayedRoles.findIndex(r => r.key === hovered)
      if (idx !== -1) return idx
    }
    return currentPage === 0 ? 4 : 0
  }, [hovered, displayedRoles, currentPage])

  return (
    <div className="relative flex w-full flex-col items-center justify-between py-2 sm:py-3">
      {/* Top Header Pill Indicator from Screenshot */}
      <div className="flex items-center justify-center mb-1">
        <span className="rounded-full bg-white/80 px-4 py-1 text-[11px] font-bold tracking-[0.25em] text-slate-400 uppercase border border-slate-200/60 shadow-xs backdrop-blur-md">
          STEP 1 OF 2
        </span>
      </div>

      {/* Main Headline & Subtitle */}
      <div className="text-center my-2 sm:my-3">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[#0F172A]">
          Choose Your{' '}
          <span className="text-[#2563EB]">
            Role
          </span>
        </h1>
        <p className="mt-2 text-xs sm:text-sm font-medium text-slate-500">
          Select your role to continue to the MEIL ESG platform
        </p>
      </div>

      {/* Horizontal Carousel Track with Circular Chevrons */}
      <div className="relative w-full flex items-center justify-center gap-2 sm:gap-4 lg:gap-5 my-6 sm:my-8 px-2">
        {/* Left Circular Arrow Button */}
        <button
          onClick={prevPage}
          aria-label="Previous roles"
          className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-white/75 border border-white/90 shadow-sm backdrop-blur-md text-slate-400 hover:text-blue-600 hover:bg-white hover:scale-105 active:scale-95 transition-all"
        >
          <ChevronLeft className="h-5 w-5 stroke-[2]" />
        </button>

        {/* 6 Role Cards in Row */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-5 flex-wrap sm:flex-nowrap">
          {displayedRoles.map((r, idx) => {
            const Icon = r.icon
            const isHighlighted = idx === activeIndex

            return (
              <motion.div
                key={r.key}
                onMouseEnter={() => setHovered(r.key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onPick(r)}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.03 }}
                className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-[28px] p-5 text-center transition-all duration-300 ${
                  isHighlighted
                    ? 'w-[168px] sm:w-[178px] lg:w-[188px] h-[275px] sm:h-[285px] bg-white/95 border-2 border-[#60A5FA] -translate-y-4 z-10 shadow-[0_28px_60px_-10px_rgba(37,99,235,0.38),0_12px_24px_-6px_rgba(37,99,235,0.22)]'
                    : 'w-[168px] sm:w-[178px] lg:w-[188px] h-[275px] sm:h-[285px] bg-white/75 border border-white/90 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.03),0_2px_6px_-1px_rgba(0,0,0,0.02)] hover:-translate-y-2 hover:bg-white/90 hover:border-sky-300 hover:shadow-[0_20px_45px_-8px_rgba(37,99,235,0.22)]'
                }`}
              >
                {/* Top Squircle Icon */}
                <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] transition-transform duration-200 group-hover:scale-105 ${
                  isHighlighted ? 'bg-[#E0EFFE]' : 'bg-[#EBF4FE]'
                }`}>
                  <Icon className="h-7 w-7 stroke-[1.8] text-[#2563EB]" />
                </div>

                {/* Role Title */}
                <h3 className="text-sm sm:text-[15px] font-extrabold text-[#0F172A] leading-tight mb-2">
                  {r.role}
                </h3>

                {/* Description */}
                <p className="text-[11px] leading-relaxed text-slate-500 font-normal px-1 line-clamp-2">
                  {r.blurb}
                </p>
              </motion.div>
            )
          })}
        </div>

        {/* Right Circular Arrow Button */}
        <button
          onClick={nextPage}
          aria-label="Next roles"
          className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-white/75 border border-white/90 shadow-sm backdrop-blur-md text-slate-400 hover:text-blue-600 hover:bg-white hover:scale-105 active:scale-95 transition-all"
        >
          <ChevronRight className="h-5 w-5 stroke-[2]" />
        </button>
      </div>

      {/* Pagination Dots Matching Screenshot */}
      <div className="my-4 flex items-center justify-center gap-2">
        {displayedRoles.map((r, i) => {
          const isDotActive = i === activeIndex
          return (
            <button
              key={r.key}
              onClick={() => setHovered(r.key)}
              aria-label={`Highlight ${r.role}`}
              className={`transition-all duration-300 ${
                isDotActive
                  ? 'h-1.5 w-5 rounded-full bg-[#2563EB] shadow-xs shadow-blue-500/40'
                  : 'h-1.5 w-1.5 rounded-full bg-slate-300 hover:bg-slate-400'
              }`}
            />
          )
        })}
      </div>

      {/* Bottom Slogan Matching Screenshot */}
      <div className="mt-2 text-center text-xs font-medium tracking-wide text-slate-400">
        Together for a Cleaner, Safer and More Responsible Tomorrow
      </div>
    </div>
  )
}

/**
 * Screen 4: Login Morph (Pre-filled demo credentials)
 */
function LoginScreen({
  project,
  bu,
  role,
  email,
  setEmail,
  password,
  setPassword,
  remember,
  setRemember,
  error,
  busy,
  onSubmit,
  onBack,
}: any) {
  const Icon = role.icon
  return (
    <div className="glass-strong overflow-hidden rounded-[28px] border border-white/80 shadow-2xl">
      <div className="grid md:grid-cols-2">
        {/* Left Side: Role Profile Card */}
        <div className="relative flex flex-col justify-between bg-gradient-to-br from-blue-50/90 to-sky-50/80 p-8">
          <button
            onClick={onBack}
            className="glass-subtle mb-4 flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Roles
          </button>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center text-center"
          >
            <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${role.tint} text-white shadow-xl shadow-sky-500/20`}>
              <Icon className="h-9 w-9" />
            </div>

            <div className="rounded-full bg-white/70 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-700 shadow-xs">
              Phase {role.phase} Access
            </div>
            <h3 className="mt-2 text-2xl font-extrabold text-slate-900">{role.role}</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-xs">{role.blurb}</p>

            <div className="mt-4 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-xs">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-bold text-white">
                {role.name.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <span className="text-xs font-bold text-slate-700">{role.name}</span>
            </div>

            {/* Selected Project Pill */}
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-sky-100/70 px-2.5 py-1 text-[10px] font-semibold text-sky-800">
              <MapPin className="h-3 w-3 text-sky-600" />
              <span>{project.name} ({bu.shortName})</span>
            </div>
          </motion.div>

          <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Backend-enforced RBAC + scope access</span>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="p-7 md:p-9">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Sign in to platform</div>
            <div className="mt-1 text-base font-extrabold text-slate-800">{role.role}</div>
            <div className="text-[11px] text-slate-500">{role.email}</div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm text-slate-800 outline-none backdrop-blur-md transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="user@meil-esg.in"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm text-slate-800 outline-none backdrop-blur-md transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                />
                <span>Remember session</span>
              </label>
              <span className="text-xs font-semibold text-sky-600">Demo enabled</span>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                <ShieldAlert className="h-4 w-4" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-liquid-blue group flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold shadow-md disabled:opacity-60"
            >
              {busy ? (
                <span>Authenticating…</span>
              ) : (
                <>
                  <span>Enter Workspace as {role.name.split(' ')[0]}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-sky-50/80 px-3.5 py-2.5 text-[11px] text-slate-600">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Pre-filled demo login. Default password: <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-sky-700 shadow-2xs">esg12345</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
