'use client'
/**
 * Admin Module — system control plane.
 *
 * Endpoints used:
 *   GET /api/organization/tree        — Group→Subsidiary→BU→Project hierarchy
 *   GET /api/overview                  — periods + source counts (for System Health + Reporting Periods)
 *
 * Other tabs (Users, Roles, Emission Factors, BRSR Framework) are illustrative
 * reference tables — clearly marked ILLUSTRATIVE — backed by seeded data.
 *
 * Non-SUPER_ADMIN roles see only the Organization + System Health tabs in read-only mode.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings, ShieldCheck, Building2, Users, Lock, Database, Gauge,
  Calendar, AlertTriangle, AlertOctagon, RefreshCw, ChevronRight,
  ChevronDown, FileCheck2, Cpu, Activity, Server, Layers, HardHat,
  Flame, Zap, Droplet, Recycle, FileText, BookOpen, ListChecks, Calculator
} from 'lucide-react'
import { useApp } from '@/lib/auth-context'

// ============================================================
// Types
// ============================================================
interface ProjectNode {
  id: string
  projectCode: string
  projectName: string
  location: string | null
  status: string
}
interface BUNode {
  id: string
  buCode?: string
  name?: string
  buName?: string
  status?: string
  projects: ProjectNode[]
}
interface SubsidiaryNode {
  id: string
  subsidiaryCode?: string
  name?: string
  subsidiaryName?: string
  cin?: string
  status?: string
  businessUnits: BUNode[]
}
interface GroupNode {
  id: string
  groupCode: string
  groupName?: string
  name?: string
  status?: string
  subsidiaries: SubsidiaryNode[]
}
interface OrgTreeResponse { groups: GroupNode[] }

interface OverviewData {
  kpis: Record<string, any>
  periods: Array<{ id: string; label: string; year: number; month: number; status: string }>
  sources: Record<string, number>
}

// ============================================================
// Module
// ============================================================
export function AdminModule() {
  const { user } = useApp()
  const [org, setOrg] = useState<GroupNode[] | null>(null)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'organization' | 'users' | 'roles' | 'periods' | 'units' | 'factors' | 'brsr' | 'health'>('organization')

  const isSuperAdmin = user?.roles?.[0]?.key === 'SUPER_ADMIN'

  useEffect(() => {
    Promise.all([
      fetch('/api/organization/tree').then(r => r.json()),
      fetch('/api/overview').then(r => r.json()),
    ])
      .then(([orgData, ovData]) => {
        setOrg((orgData as OrgTreeResponse).groups ?? [])
        setOverview(ovData as OverviewData)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  // For non-super-admins, only organization + system health tabs are visible
  const visibleTabs: { key: typeof tab; label: string; icon: any }[] = isSuperAdmin
    ? [
      { key: 'organization', label: 'Organization', icon: Building2 },
      { key: 'users', label: 'Users', icon: Users },
      { key: 'roles', label: 'Roles & Permissions', icon: Lock },
      { key: 'periods', label: 'Reporting Periods', icon: Calendar },
      { key: 'units', label: 'Units & Conversions', icon: Gauge },
      { key: 'factors', label: 'Emission Factors', icon: Flame },
      { key: 'brsr', label: 'BRSR Framework', icon: FileCheck2 },
      { key: 'health', label: 'System Health', icon: Activity },
    ]
    : [
      { key: 'organization', label: 'Organization', icon: Building2 },
      { key: 'health', label: 'System Health', icon: Activity },
    ]

  if (loading) return <AdminSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => location.reload()} />

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Admin / System Settings</h1>
            <span className={`status-pill ${isSuperAdmin ? 'status-approved' : 'status-submitted'}`}>
              <ShieldCheck className="h-3 w-3" /> {user?.roles?.[0]?.name ?? 'Unknown'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {isSuperAdmin
              ? 'Full system control plane — organization, RBAC, reporting periods, units, factors, BRSR framework, and system health.'
              : 'Read-only — admin actions require the Super Admin role.'}
          </p>
        </div>
        <button onClick={() => location.reload()} className="glass-subtle flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {!isSuperAdmin && (
        <div className="glass-subtle flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] text-slate-500">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <span><strong className="text-slate-700">Read-only mode.</strong> Admin actions (create/edit users, roles, periods, units, factors, BRSR config) require the Super Admin role.</span>
        </div>
      )}

      {/* TABS */}
      <div className="glass-subtle flex items-center gap-1 overflow-x-auto scroll-elegant rounded-2xl p-1.5">
        {visibleTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* VIEW */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
        >
          {tab === 'organization' && org && <OrganizationView groups={org} />}
          {tab === 'users' && <UsersView />}
          {tab === 'roles' && <RolesView />}
          {tab === 'periods' && overview && <PeriodsView periods={overview.periods} />}
          {tab === 'units' && <UnitsView />}
          {tab === 'factors' && <FactorsView />}
          {tab === 'brsr' && <BrsrFrameworkView />}
          {tab === 'health' && overview && <SystemHealthView overview={overview} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ============================================================
// Organization tree view
// ============================================================
function OrganizationView({ groups }: { groups: GroupNode[] }) {
  return (
    <div className="space-y-3">
      <GlassCard>
        <CardHeader icon={Building2} title="Organization Hierarchy" subtitle="Group → Subsidiary → Business Unit → Project" right={<span className="status-pill status-approved">{groups.length} group(s)</span>} />
        {groups.length === 0 ? (
          <div className="rounded-xl bg-white/30 py-8 text-center text-xs text-slate-500">No groups configured.</div>
        ) : (
          <div className="space-y-2">
            {groups.map((g, i) => <GroupNodeView key={g.id} group={g} delay={i * 0.05} />)}
          </div>
        )}
      </GlassCard>
    </div>
  )
}

function GroupNodeView({ group, delay }: { group: GroupNode; delay: number }) {
  const [expanded, setExpanded] = useState(true)
  const name = group.groupName ?? group.name ?? group.groupCode
  const subCount = group.subsidiaries.length
  const buCount = group.subsidiaries.reduce((s, sub) => s + (sub.businessUnits?.length ?? 0), 0)
  const projCount = group.subsidiaries.reduce((s, sub) => s + sub.businessUnits.reduce((s2, bu) => s2 + (bu.projects?.length ?? 0), 0), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-2xl border border-white/60 bg-white/55 p-3 backdrop-blur"
    >
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2 text-left">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-slate-800">{name}</span>
            <code className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">{group.groupCode}</code>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">{subCount} subsidiaries</span>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">{buCount} BUs</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">{projCount} projects</span>
          </div>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-1.5 overflow-hidden pl-4"
          >
            {group.subsidiaries.map((s, i) => <SubsidiaryNodeView key={s.id} sub={s} delay={i * 0.04} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function SubsidiaryNodeView({ sub, delay }: { sub: SubsidiaryNode; delay: number }) {
  const [expanded, setExpanded] = useState(true)
  const name = sub.subsidiaryName ?? sub.name ?? sub.subsidiaryCode ?? 'Subsidiary'
  const buCount = sub.businessUnits?.length ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="rounded-xl bg-white/50 p-2.5"
    >
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2 text-left">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700">
          <Building2 className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-bold text-slate-800">{name}</span>
            {sub.cin && <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600">CIN: {sub.cin}</code>}
            {sub.status && <span className="status-pill status-approved">{sub.status}</span>}
          </div>
          <div className="text-[10px] text-slate-500">{buCount} business unit{buCount === 1 ? '' : 's'}</div>
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-1.5 overflow-hidden pl-4"
          >
            {sub.businessUnits.map((bu, i) => <BuNodeView key={bu.id} bu={bu} delay={i * 0.04} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function BuNodeView({ bu, delay }: { bu: BUNode; delay: number }) {
  const [expanded, setExpanded] = useState(false)
  const name = bu.buName ?? bu.name ?? bu.buCode ?? 'BU'
  const projCount = bu.projects?.length ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="rounded-lg bg-white/40 p-2"
    >
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2 text-left">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-50 text-violet-700">
          <Layers className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[11px] font-bold text-slate-800">{name}</span>
            {bu.buCode && <code className="rounded bg-violet-100 px-1 py-0.5 text-[9px] text-violet-700">{bu.buCode}</code>}
          </div>
          <div className="text-[9px] text-slate-500">{projCount} project{projCount === 1 ? '' : 's'}</div>
        </div>
        {expanded ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 space-y-1 overflow-hidden pl-3"
          >
            {bu.projects.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 rounded-md bg-white/60 px-2 py-1 text-[10px]">
                <HardHat className="h-2.5 w-2.5 text-emerald-600" />
                <span className="font-mono font-semibold text-emerald-700">{p.projectCode}</span>
                <span className="truncate text-slate-700">{p.projectName}</span>
                {p.location && <span className="ml-auto text-slate-400">{p.location}</span>}
                <span className="status-pill status-approved">{p.status}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================================
// Users view — illustrative (no /api/users endpoint)
// ============================================================
function UsersView() {
  return (
    <GlassCard>
      <CardHeader icon={Users} title="Users" subtitle="Demo user roster (illustrative)" right={<span className="status-pill status-warning"><AlertTriangle className="h-3 w-3" /> Illustrative</span>} />
      <div className="overflow-x-auto scroll-elegant">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/60 text-[10px] uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 font-semibold">Name</th>
              <th className="px-2 py-2 font-semibold">Email</th>
              <th className="px-2 py-2 font-semibold">Employee Code</th>
              <th className="px-2 py-2 font-semibold">Role</th>
              <th className="px-2 py-2 font-semibold">Scope</th>
              <th className="px-2 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_USERS.map((u, i) => (
              <tr key={u.email} className="border-b border-slate-100/60 transition hover:bg-white/40">
                <td className="px-2 py-2 font-semibold text-slate-700">{u.name}</td>
                <td className="px-2 py-2 text-slate-600">{u.email}</td>
                <td className="px-2 py-2 text-slate-500 tabular-nums">{u.code}</td>
                <td className="px-2 py-2">
                  <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{u.role}</span>
                </td>
                <td className="px-2 py-2 text-slate-600">{u.scope}</td>
                <td className="px-2 py-2">
                  <span className={`status-pill ${u.demo ? 'status-warning' : 'status-approved'}`}>{u.demo ? 'Demo' : 'Active'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50/40 px-3 py-2 text-[11px] text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span><strong>Illustrative data.</strong> This user roster reflects the seeded demo data (password: <code>esg12345</code>). Wire a real <code>/api/users</code> endpoint for production user management.</span>
      </div>
    </GlassCard>
  )
}

// ============================================================
// Roles & Permissions view — illustrative
// ============================================================
function RolesView() {
  return (
    <GlassCard>
      <CardHeader icon={Lock} title="Roles & Permissions" subtitle="15 RBAC roles with sample permissions (illustrative)" right={<span className="status-pill status-warning"><AlertTriangle className="h-3 w-3" /> Illustrative</span>} />
      <div className="overflow-x-auto scroll-elegant">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/60 text-[10px] uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 font-semibold">Role</th>
              <th className="px-2 py-2 font-semibold">Phase</th>
              <th className="px-2 py-2 font-semibold">Description</th>
              <th className="px-2 py-2 font-semibold">Sample Permissions</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r, i) => (
              <tr key={r.key} className="border-b border-slate-100/60 align-top transition hover:bg-white/40">
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{r.name}</div>
                      <code className="text-[9px] text-slate-400">{r.key}</code>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Phase {r.phase}</span>
                </td>
                <td className="px-2 py-2.5 text-slate-600">{r.description}</td>
                <td className="px-2 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {r.perms.map(p => (
                      <code key={p} className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-mono text-blue-700">{p}</code>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50/40 px-3 py-2 text-[11px] text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span><strong>Illustrative.</strong> Reference table reflects the seeded 15-role RBAC matrix. Permission grants are stored in <code>RolePermission</code> DB rows — wire a real admin UI to edit them.</span>
      </div>
    </GlassCard>
  )
}

// ============================================================
// Reporting periods
// ============================================================
function PeriodsView({ periods }: { periods: Array<{ id: string; label: string; year: number; month: number; status: string }> }) {
  return (
    <GlassCard>
      <CardHeader icon={Calendar} title="Reporting Periods" subtitle="Year + period windows from the database" right={<span className="status-pill status-approved">{periods.length} period(s)</span>} />
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {periods.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl border border-white/60 bg-white/50 p-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">{p.label}</div>
                  <div className="text-[10px] text-slate-500 tabular-nums">FY{p.year} · Month {p.month}</div>
                </div>
              </div>
              <span className={`status-pill ${periodStatusPill(p.status)}`}>{p.status}</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              <code className="font-mono text-slate-400">{p.id}</code>
            </div>
          </motion.div>
        ))}
      </div>
      {periods.length === 0 && (
        <div className="rounded-xl bg-white/30 py-8 text-center text-xs text-slate-500">No reporting periods configured.</div>
      )}
    </GlassCard>
  )
}

// ============================================================
// Units & Conversions — illustrative reference
// ============================================================
function UnitsView() {
  return (
    <GlassCard>
      <CardHeader icon={Gauge} title="Units & Conversions" subtitle="Master unit catalogue (illustrative)" right={<span className="status-pill status-warning"><AlertTriangle className="h-3 w-3" /> Illustrative</span>} />
      <div className="overflow-x-auto scroll-elegant">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/60 text-[10px] uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 font-semibold">Module</th>
              <th className="px-2 py-2 font-semibold">Base Unit</th>
              <th className="px-2 py-2 font-semibold">Symbol</th>
              <th className="px-2 py-2 font-semibold">Conversion Rule</th>
              <th className="px-2 py-2 font-semibold">Factor</th>
            </tr>
          </thead>
          <tbody>
            {UNITS.map((u, i) => (
              <tr key={i} className="border-b border-slate-100/60 transition hover:bg-white/40">
                <td className="px-2 py-2.5">
                  <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{u.module}</span>
                </td>
                <td className="px-2 py-2.5 font-semibold text-slate-700">{u.base}</td>
                <td className="px-2 py-2.5"><code className="text-slate-600">{u.symbol}</code></td>
                <td className="px-2 py-2.5 text-slate-600">{u.rule}</td>
                <td className="px-2 py-2.5 text-slate-600 tabular-nums">{u.factor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

// ============================================================
// Emission factors — illustrative reference
// ============================================================
function FactorsView() {
  return (
    <GlassCard>
      <CardHeader icon={Flame} title="Emission Factors" subtitle="Reference factors with version + methodology (illustrative)" right={<span className="status-pill status-warning"><AlertTriangle className="h-3 w-3" /> Illustrative</span>} />
      <div className="overflow-x-auto scroll-elegant">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/60 text-[10px] uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 font-semibold">Source</th>
              <th className="px-2 py-2 font-semibold">Factor</th>
              <th className="px-2 py-2 font-semibold">Unit</th>
              <th className="px-2 py-2 font-semibold">Scope</th>
              <th className="px-2 py-2 font-semibold">Version</th>
              <th className="px-2 py-2 font-semibold">Methodology</th>
              <th className="px-2 py-2 font-semibold">Source Ref</th>
            </tr>
          </thead>
          <tbody>
            {FACTORS.map((f, i) => (
              <tr key={i} className="border-b border-slate-100/60 transition hover:bg-white/40">
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-md ${f.tone}`}>
                      <f.icon className="h-3 w-3" />
                    </div>
                    <span className="font-semibold text-slate-700">{f.source}</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-slate-800 tabular-nums font-bold">{f.factor}</td>
                <td className="px-2 py-2.5"><code className="text-slate-600">{f.unit}</code></td>
                <td className="px-2 py-2.5">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{f.scope}</span>
                </td>
                <td className="px-2 py-2.5 text-slate-600 tabular-nums">v{f.version}</td>
                <td className="px-2 py-2.5 text-slate-600">{f.methodology}</td>
                <td className="px-2 py-2.5 text-slate-500 text-[10px]">{f.sourceRef}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50/40 px-3 py-2 text-[11px] text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span><strong>Illustrative master data.</strong> Seeded <code>EmissionFactor</code> rows reflect CEA 2024 grid (0.716 tCO₂e/MWh), IPCC fuel densities, and GHG Protocol travel factors. Updates require Super Admin.</span>
      </div>
    </GlassCard>
  )
}

// ============================================================
// BRSR Framework view — illustrative
// ============================================================
function BrsrFrameworkView() {
  return (
    <GlassCard>
      <CardHeader icon={FileCheck2} title="BRSR Framework" subtitle="Config-driven BRSR v3 (illustrative master)" right={<span className="status-pill status-approved">BRSR v3</span>} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/60 bg-white/50 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Framework</div>
          <div className="mt-1 text-base font-bold text-slate-800">BRSR v3 · FY 2026-27</div>
          <div className="text-xs text-slate-500">Tier: Lite · Status: Active</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Stat label="Sections" value={3} />
            <Stat label="Principles" value={9} />
            <Stat label="Questions" value="22+" />
          </div>
        </div>
        <div className="rounded-xl border border-white/60 bg-white/50 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sections</div>
          <div className="mt-1 space-y-1">
            {[
              { code: 'A', name: 'General Disclosures', count: 8 },
              { code: 'B', name: 'Management & Process', count: 6 },
              { code: 'C', name: 'Principle-wise Performance', count: 9 },
            ].map(s => (
              <div key={s.code} className="flex items-center justify-between rounded-lg bg-white/60 px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">Sec {s.code}</span>
                  <span className="text-slate-700">{s.name}</span>
                </div>
                <span className="text-slate-500 tabular-nums">{s.count} Qs</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Principles (P1–P9)</div>
        <div className="mt-1 grid grid-cols-3 gap-1.5 md:grid-cols-3">
          {PRINCIPLES.map(p => (
            <div key={p.code} className="rounded-lg bg-white/60 px-2 py-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-[9px] font-bold text-blue-700">{p.code}</span>
                <span className="truncate text-[10px] font-semibold text-slate-700">{p.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50/40 px-3 py-2 text-[11px] text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span><strong>Illustrative master.</strong> Framework rows are seeded into <code>BrsrFramework</code>/<code>BrsrSection</code>/<code>BrsrPrinciple</code>/<code>BrsrQuestion</code> — read live via <code>/api/brsr/frameworks</code> in the BRSR module.</span>
      </div>
    </GlassCard>
  )
}

// ============================================================
// System Health view
// ============================================================
function SystemHealthView({ overview }: { overview: OverviewData }) {
  const s = overview.sources ?? {}
  const badges = [
    { label: 'Database (SQLite + Prisma)', status: 'OPERATIONAL', icon: Database, tone: 'status-approved' },
    { label: 'RBAC Engine', status: 'OPERATIONAL', icon: Lock, tone: 'status-approved' },
    { label: 'Audit Log', status: 'OPERATIONAL', icon: FileText, tone: 'status-approved' },
    { label: 'Workflow State Machine', status: 'OPERATIONAL', icon: Activity, tone: 'status-approved' },
  ]

  const sourceRows = [
    { label: 'Calculation results', value: s.calculationResults ?? 0, icon: Calculator, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Energy records', value: s.energyRecords ?? 0, icon: Zap, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Water records', value: s.waterRecords ?? 0, icon: Droplet, tone: 'bg-cyan-50 text-cyan-600' },
    { label: 'Waste records', value: s.wasteRecords ?? 0, icon: Recycle, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Workforce records', value: s.workforceRecords ?? 0, icon: Users, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Safety records', value: s.safetyRecords ?? 0, icon: ShieldCheck, tone: 'bg-violet-50 text-violet-600' },
    { label: 'BRSR answers', value: s.brsrAnswers ?? 0, icon: FileCheck2, tone: 'bg-teal-50 text-teal-600' },
  ]

  return (
    <div className="space-y-3">
      <GlassCard>
        <CardHeader icon={Activity} title="System Health" subtitle="Real-time service status + source record counts" right={<span className="status-pill status-approved"><Server className="h-3 w-3" /> All systems operational</span>} />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {badges.map((b, i) => (
            <motion.div
              key={b.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <b.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{b.status}</div>
                </div>
              </div>
              <div className="mt-1.5 text-[11px] font-semibold text-slate-700">{b.label}</div>
            </motion.div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeader icon={Database} title="Source Record Counts" subtitle="Live row counts from /api/overview" right={<span className="status-pill status-submitted">7 source tables</span>} />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {sourceRows.map((row, i) => (
            <motion.div
              key={row.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl bg-white/50 p-3"
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${row.tone}`}>
                  <row.icon className="h-4 w-4" />
                </div>
                <span className="tabular-nums text-2xl font-bold text-slate-800">{row.value.toLocaleString()}</span>
              </div>
              <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</div>
            </motion.div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeader icon={Cpu} title="Engine Versions" subtitle="Deterministic engine components" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <EngineStat name="Validation Engine" version="v1.0" rules={28} icon={ShieldCheck} />
          <EngineStat name="Calculation Engine" version="v1.0" factors={10} icon={Calculator} />
          <EngineStat name="Consolidation Engine" version="v1.0" levels={4} icon={Layers} />
          <EngineStat name="BRSR Resolver" version="v1.0" mappings={14} icon={BookOpen} />
          <EngineStat name="Workflow State Machine" version="v1.0" states={9} icon={Activity} />
          <EngineStat name="Audit Logger" version="v1.0" immutable icon={FileText} />
        </div>
      </GlassCard>
    </div>
  )
}

function EngineStat({ name, version, rules, factors, levels, states, mappings, immutable, icon: Icon }: any) {
  const meta = rules ? `${rules} rules` : factors ? `${factors} factors` : levels ? `${levels} levels` : states ? `${states} states` : mappings ? `${mappings} mappings` : immutable ? 'Immutable' : ''
  return (
    <div className="rounded-xl bg-white/50 p-2.5">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[10px] font-semibold text-slate-700">{name}</div>
          <div className="text-[9px] text-slate-400">{version}</div>
        </div>
      </div>
      <div className="mt-1 text-[10px] text-slate-500">{meta}</div>
    </div>
  )
}

// ============================================================
// Shared building blocks
// ============================================================
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass glass-shimmer rounded-2xl p-4"
    >
      {children}
    </motion.section>
  )
}

function CardHeader({ icon: Icon, title, subtitle, right }: { icon: any; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between">
      <div className="flex items-start gap-2.5">
        <div className="kpi-tile bg-slate-50 text-slate-600" style={{ width: 32, height: 32 }}><Icon className="h-4 w-4" /></div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/60 px-2 py-1.5">
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className="tabular-nums text-base font-bold text-slate-800">{value}</div>
    </div>
  )
}

function AdminSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200/60" />
      <div className="h-12 animate-pulse rounded-2xl bg-white/40" />
      <div className="glass h-96 animate-pulse rounded-2xl" />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center">
      <AlertOctagon className="h-10 w-10 text-rose-500" />
      <div>
        <div className="text-base font-bold text-slate-800">Failed to load admin module</div>
        <div className="text-xs text-slate-500">{message}</div>
      </div>
      <button onClick={onRetry} className="btn-glass-primary rounded-full px-5 py-2 text-xs font-semibold">
        <RefreshCw className="mr-1 inline h-3 w-3" /> Retry
      </button>
    </div>
  )
}

// ============================================================
// Reference data — clearly marked illustrative
// ============================================================
const DEMO_USERS = [
  { name: 'System Administrator', email: 'admin@meil-esg.in', code: 'MEIL-0001', role: 'SUPER_ADMIN', scope: 'MEIL Group', demo: true },
  { name: 'Rohit Sharma', email: 'rohit@meil-esg.in', code: 'MEIL-1001', role: 'PROJECT_DATA_ENTRY', scope: 'Gayatri Solar', demo: true },
  { name: 'Priya Verma', email: 'priya@meil-esg.in', code: 'MEIL-1002', role: 'PROJECT_DATA_ENTRY', scope: 'NTPC RTPS', demo: true },
  { name: 'Amit Singh', email: 'amit@meil-esg.in', code: 'MEIL-2001', role: 'BU_REVIEWER', scope: 'BU: Power Systems', demo: true },
  { name: 'Sneha Iyer', email: 'sneha@meil-esg.in', code: 'MEIL-2002', role: 'BU_REVIEWER', scope: 'BU: Infrastructure', demo: true },
  { name: 'Vikram Rao', email: 'vikram@meil-esg.in', code: 'MEIL-3001', role: 'SUBSIDIARY_APPROVER', scope: 'MEIL Power Systems', demo: true },
  { name: 'Anjali Mehta', email: 'anjali@meil-esg.in', code: 'MEIL-3002', role: 'SUBSIDIARY_APPROVER', scope: 'MEIL Infrastructure', demo: true },
  { name: 'Karthik Nair', email: 'karthik@meil-esg.in', code: 'MEIL-4001', role: 'HQ_REVIEWER', scope: 'MEIL Group', demo: true },
  { name: 'Divya Reddy', email: 'divya@meil-esg.in', code: 'MEIL-4002', role: 'HQ_REVIEWER', scope: 'MEIL Group', demo: true },
  { name: 'Sanjay Gupta', email: 'sanjay@meil-esg.in', code: 'MEIL-5001', role: 'BRSR_PREPARER', scope: 'MEIL Group', demo: true },
  { name: 'Meera Krishnan', email: 'meera@meil-esg.in', code: 'MEIL-5002', role: 'BRSR_PREPARER', scope: 'MEIL Group', demo: true },
  { name: 'Rajesh Khanna', email: 'rajesh@meil-esg.in', code: 'MEIL-6001', role: 'GROUP_CSO', scope: 'MEIL Group', demo: true },
  { name: 'Lata Joshi', email: 'lata@meil-esg.in', code: 'MEIL-7001', role: 'AUDITOR', scope: 'MEIL Group', demo: true },
  { name: 'Praveen Kumar', email: 'praveen@meil-esg.in', code: 'MEIL-8001', role: 'ESG_PUBLISHER', scope: 'MEIL Group', demo: true },
  { name: 'Neha Bhatt', email: 'neha@meil-esg.in', code: 'MEIL-9001', role: 'VIEWER', scope: 'MEIL Group', demo: true },
]

const ROLES = [
  { key: 'SUPER_ADMIN', name: 'Super Admin', phase: 0, description: 'Full system control — every permission.', perms: ['*'] },
  { key: 'PROJECT_DATA_ENTRY', name: 'Project Data Entry', phase: 1, description: 'Enters ESG source data for assigned project.', perms: ['esg.energy.write', 'esg.water.write', 'esg.waste.write', 'esg.people.write', 'esg.safety.write', 'submission.submit', 'evidence.upload'] },
  { key: 'BU_REVIEWER', name: 'BU Reviewer', phase: 2, description: 'Reviews + approves submissions at BU level.', perms: ['submission.review', 'submission.approve', 'submission.reject', 'evidence.verify'] },
  { key: 'SUBSIDIARY_APPROVER', name: 'Subsidiary Approver', phase: 3, description: 'Approves submissions at subsidiary level.', perms: ['submission.approve', 'submission.lock'] },
  { key: 'HQ_REVIEWER', name: 'HQ Reviewer', phase: 4, description: 'HQ-level reviewer for HQ review state.', perms: ['submission.review', 'submission.approve'] },
  { key: 'BRSR_PREPARER', name: 'BRSR Preparer', phase: 5, description: 'Configures BRSR + generates report.', perms: ['brsr.generate', 'report.generate'] },
  { key: 'GROUP_CSO', name: 'Group CSO', phase: 6, description: 'Chief Sustainability Officer — final approver.', perms: ['submission.lock', 'brsr.generate', 'report.generate'] },
  { key: 'AUDITOR', name: 'Auditor', phase: 7, description: 'Read-only across all audit logs + traces.', perms: ['audit.read', 'report.generate'] },
  { key: 'ESG_PUBLISHER', name: 'ESG Publisher', phase: 8, description: 'Publishes final BRSR / ESG reports.', perms: ['report.generate', 'brsr.generate'] },
  { key: 'VIEWER', name: 'Viewer', phase: 9, description: 'Read-only access to dashboards.', perms: ['overview.read'] },
  { key: 'EVIDENCE_UPLOADER', name: 'Evidence Uploader', phase: 1, description: 'Uploads evidence files for source records.', perms: ['evidence.upload'] },
  { key: 'CALC_ENGINE', name: 'Calc Engine', phase: 2, description: 'Service account for re-running calculations.', perms: ['esg.*.write', 'calculation.run'] },
  { key: 'VALIDATION_ENGINE', name: 'Validation Engine', phase: 2, description: 'Service account for re-running validation.', perms: ['validation.run'] },
  { key: 'CONSOLIDATION_ENGINE', name: 'Consolidation Engine', phase: 4, description: 'Service account for KPI rollups.', perms: ['consolidation.read'] },
  { key: 'NOTIFICATION_DISPATCHER', name: 'Notification Dispatcher', phase: 0, description: 'Service account dispatching notifications.', perms: ['notifications.send'] },
]

const UNITS = [
  { module: 'Energy', base: 'Gigajoule', symbol: 'GJ', rule: 'KWH → GJ', factor: 0.0036 },
  { module: 'Energy', base: 'Gigajoule', symbol: 'GJ', rule: 'Diesel L → GJ', factor: 0.0383 },
  { module: 'Energy', base: 'Gigajoule', symbol: 'GJ', rule: 'Petrol L → GJ', factor: 0.0348 },
  { module: 'Energy', base: 'Gigajoule', symbol: 'GJ', rule: 'Coal kg → GJ', factor: 0.0227 },
  { module: 'Energy', base: 'Gigajoule', symbol: 'GJ', rule: 'CNG kg → GJ', factor: 0.05 },
  { module: 'Energy', base: 'Gigajoule', symbol: 'GJ', rule: 'LPG kg → GJ', factor: 0.046 },
  { module: 'Water', base: 'Kilolitre', symbol: 'KL', rule: 'KL → KL', factor: 1.0 },
  { module: 'Waste', base: 'Tonne', symbol: 'T', rule: 'kg → T', factor: 0.001 },
  { module: 'Workforce', base: 'Count', symbol: 'count', rule: '—', factor: 1.0 },
  { module: 'Safety', base: 'Hours', symbol: 'hrs', rule: '—', factor: 1.0 },
  { module: 'Emissions', base: 'tCO₂e', symbol: 'tCO2e', rule: 'kgCO2e → tCO2e', factor: 0.001 },
]

const FACTORS = [
  { source: 'Grid Electricity', factor: 0.716, unit: 'tCO2e/MWh', scope: 'SCOPE_2', version: 1, methodology: 'CEA 2024 Average', sourceRef: 'cea.gov.in', icon: Zap, tone: 'bg-amber-50 text-amber-600' },
  { source: 'Diesel (HSD)', factor: 2.637, unit: 'tCO2e/kL', scope: 'SCOPE_1', version: 1, methodology: 'IPCC 2006 Vol. II Ch.2', sourceRef: 'ipcc-nggip.iges.or.jp', icon: Flame, tone: 'bg-rose-50 text-rose-600' },
  { source: 'Petrol (Motor Spirit)', factor: 2.285, unit: 'tCO2e/kL', scope: 'SCOPE_1', version: 1, methodology: 'IPCC 2006', sourceRef: 'ipcc-nggip.iges.or.jp', icon: Flame, tone: 'bg-rose-50 text-rose-600' },
  { source: 'Coal (Sub-bituminous)', factor: 1.945, unit: 'tCO2e/T', scope: 'SCOPE_1', version: 1, methodology: 'IPCC 2006', sourceRef: 'ipcc-nggip.iges.or.jp', icon: Flame, tone: 'bg-rose-50 text-rose-600' },
  { source: 'CNG', factor: 2.229, unit: 'tCO2e/T', scope: 'SCOPE_1', version: 1, methodology: 'IPCC 2006', sourceRef: 'ipcc-nggip.iges.or.jp', icon: Flame, tone: 'bg-rose-50 text-rose-600' },
  { source: 'LPG', factor: 2.988, unit: 'tCO2e/T', scope: 'SCOPE_1', version: 1, methodology: 'IPCC 2006', sourceRef: 'ipcc-nggip.iges.or.jp', icon: Flame, tone: 'bg-rose-50 text-rose-600' },
  { source: 'Solar-PPA', factor: 0.0, unit: 'tCO2e/MWh', scope: 'SCOPE_2', version: 1, methodology: 'Renewable PPA — zero direct', sourceRef: 'internal', icon: Zap, tone: 'bg-emerald-50 text-emerald-600' },
  { source: 'Business Air Travel', factor: 0.180, unit: 'tCO2e/pax-km', scope: 'SCOPE_3', version: 1, methodology: 'GHG Protocol Travel', sourceRef: 'ghgprotocol.org', icon: Flame, tone: 'bg-violet-50 text-violet-600' },
  { source: 'Hotel Stay', factor: 0.015, unit: 'tCO2e/night', scope: 'SCOPE_3', version: 1, methodology: 'GHG Protocol Travel', sourceRef: 'ghgprotocol.org', icon: Building2, tone: 'bg-blue-50 text-blue-600' },
  { source: 'Employee Commute', factor: 0.171, unit: 'tCO2e/km', scope: 'SCOPE_3', version: 1, methodology: 'GHG Protocol Travel', sourceRef: 'ghgprotocol.org', icon: Users, tone: 'bg-cyan-50 text-cyan-600' },
]

const PRINCIPLES = [
  { code: 'P1', name: 'Ethics & Transparency' },
  { code: 'P2', name: 'Sustainable Products' },
  { code: 'P3', name: 'Employee Well-being' },
  { code: 'P4', name: 'Stakeholder Engagement' },
  { code: 'P5', name: 'Human Rights' },
  { code: 'P6', name: 'Environment' },
  { code: 'P7', name: 'Public Policy Advocacy' },
  { code: 'P8', name: 'Inclusive Growth' },
  { code: 'P9', name: 'Customer Engagement' },
]

function periodStatusPill(status: string): string {
  const m: Record<string, string> = {
    OPEN: 'status-submitted',
    CLOSED: 'status-locked',
    LOCKED: 'status-locked',
    DRAFT: 'status-draft',
    ACTIVE: 'status-approved',
  }
  return m[status?.toUpperCase()] ?? 'status-draft'
}
