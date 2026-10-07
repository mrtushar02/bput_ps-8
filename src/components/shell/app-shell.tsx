'use client'
/**
 * MEIL ESG Application Shell — one enterprise shell, role-aware content.
 * Header (branding, search, year, notifications, profile) + Primary Nav + Sticky Footer.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Building2, FileText, Link2, Send, FileBarChart, TrendingUp, History, FileCheck2, Bell, Search, HelpCircle, ChevronDown, LogOut, Settings, ShieldCheck, Flame, Zap, Droplet, Recycle, Users, HardHat, Plane, Calendar, Database, GitBranch, Activity, X, Check
} from 'lucide-react'
import { useApp, type ModuleKey } from '@/lib/auth-context'
import { CommandPalette } from '@/components/shell/command-palette'

const NAV: { key: ModuleKey; label: string; icon: any; badge?: { count: number; tone: string } }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'my-project', label: 'My Project', icon: Building2 },
  { key: 'data-entry', label: 'Data Entry', icon: FileText, badge: { count: 0, tone: 'green' } },
  { key: 'evidence', label: 'Evidence', icon: Link2, badge: { count: 12, tone: 'blue' } },
  { key: 'submissions', label: 'Submissions', icon: Send, badge: { count: 3, tone: 'amber' } },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
  { key: 'analytics', label: 'Analytics', icon: TrendingUp },
  { key: 'audit', label: 'Audit & Trace', icon: History },
  { key: 'brsr', label: 'BRSR', icon: FileCheck2 },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, activeModule, setActiveModule, logout } = useApp()
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notifications, setNotifications] = useState<any[]>([])
  const [year, setYear] = useState('FY 2026-27')

  useEffect(() => {
    fetch('/api/notifications').then(r => r.json()).then(d => setNotifications(Array.isArray(d) ? d : (d.items ?? d.notifications ?? []))).catch(() => setNotifications([]))
  }, [])
  const unread = notifications.filter((n: any) => !n.read).length

  const roleKey = user?.roles?.[0]?.key ?? ''
  const roleName = user?.roles?.[0]?.name ?? ''

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="orb animate-orb" style={{ width: 380, height: 380, top: -120, right: -60, background: 'radial-gradient(circle, rgba(125,181,255,0.35), transparent 70%)' }} />
        <div className="orb animate-orb" style={{ width: 300, height: 300, bottom: -80, left: -40, background: 'radial-gradient(circle, rgba(170,210,255,0.3), transparent 70%)', animationDelay: '5s' }} />
      </div>

      {/* HEADER */}
      <header className="glass-nav sticky top-0 z-40 border-b border-white/40">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 md:px-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-md shadow-rose-600/30">
              <span className="text-sm font-black">M</span>
            </div>
            <div className="hidden leading-none md:block">
              <div className="text-sm font-bold text-slate-800">meil<span className="text-rose-600">ESG</span></div>
              <div className="text-[9px] font-medium text-slate-500">ESG & BRSR Platform</div>
            </div>
          </div>

          {/* Search */}
          <div className="relative hidden flex-1 max-w-md md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects, submissions, evidence…"
              className="glass-subtle w-full rounded-full py-2 pl-9 pr-14 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-100"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">⌘K</kbd>
          </div>

          <div className="flex-1 md:hidden" />

          {/* Reporting year */}
          <div className="glass-subtle hidden items-center gap-1.5 rounded-full px-3 py-1.5 lg:flex">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-transparent text-xs font-semibold text-slate-700 outline-none">
              <option>FY 2026-27</option>
              <option>FY 2025-26</option>
            </select>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => { setNotifOpen(v => !v); setProfileOpen(false) }} className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/60 hover:text-blue-600">
              <Bell className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{unread}</span>}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="glass-strong absolute right-0 top-12 z-50 w-80 rounded-2xl p-2">
                  <div className="mb-1 flex items-center justify-between px-2 py-1">
                    <span className="text-xs font-bold text-slate-700">Notifications</span>
                    <button onClick={() => setNotifOpen(false)}><X className="h-3.5 w-3.5 text-slate-400" /></button>
                  </div>
                  <div className="max-h-80 space-y-1 overflow-y-auto scroll-elegant">
                    {notifications.length === 0 && <div className="px-3 py-6 text-center text-xs text-slate-400">No notifications</div>}
                    {notifications.map((n: any) => (
                      <div key={n.id} className={`rounded-xl px-3 py-2 ${n.read ? '' : 'bg-blue-50/60'}`}>
                        <div className="flex items-start gap-2">
                          <div className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${n.severity === 'WARNING' ? 'bg-amber-500' : n.severity === 'ERROR' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-700">{n.title}</div>
                            <div className="text-[11px] leading-tight text-slate-500">{n.message}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Help */}
          <button className="hidden h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/60 hover:text-blue-600 md:flex">
            <HelpCircle className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          </button>

          {/* Profile */}
          <div className="relative">
            <button onClick={() => { setProfileOpen(v => !v); setNotifOpen(false) }} className="glass-subtle flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition hover:ring-2 hover:ring-blue-100">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 text-[10px] font-bold text-white">
                {user?.name?.split(' ').map(n => n[0]).join('') ?? 'U'}
              </div>
              <div className="hidden text-left leading-tight lg:block">
                <div className="text-xs font-semibold text-slate-800">{user?.name}</div>
                <div className="text-[10px] text-slate-500">{roleName}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="glass-strong absolute right-0 top-12 z-50 w-64 rounded-2xl p-2">
                  <div className="border-b border-slate-200/60 px-3 py-2.5">
                    <div className="text-sm font-bold text-slate-800">{user?.name}</div>
                    <div className="text-[11px] text-slate-500">{user?.email}</div>
                    {user?.demo && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">Illustrative</span>}
                  </div>
                  <div className="py-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Role & Scope</div>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700"><ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> {roleName}</div>
                    {user?.scopes?.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1 text-[11px] text-slate-500"><GitBranch className="h-3 w-3" /> {s.scopeType}: {s.scopeId.slice(-6)}</div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200/60 py-1">
                    <button onClick={() => { setActiveModule('admin'); setProfileOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"><Settings className="h-3.5 w-3.5" /> Admin / Settings</button>
                    <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* PRIMARY NAV */}
        <div className="mx-auto max-w-[1600px] px-4 md:px-6">
          <nav className="glass-nav flex items-center gap-0.5 overflow-x-auto scroll-elegant rounded-2xl px-1.5 py-1.5">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = activeModule === item.key
              return (
                <button key={item.key} onClick={() => setActiveModule(item.key)}
                  className={`group relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                  {item.badge && item.badge.count > 0 && (
                    <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${item.badge.tone === 'green' ? 'bg-emerald-100 text-emerald-700' : item.badge.tone === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{item.badge.count}</span>
                  )}
                  {active && <motion.div layoutId="nav-underline" className="absolute -bottom-1 left-3 right-3 h-0.5 rounded-full bg-blue-500" />}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* CONTENT */}
      <main className="relative z-10 mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 md:px-6 md:py-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeModule} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* STICKY FOOTER */}
      <footer className="glass-nav relative z-10 mt-auto border-t border-white/40">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 px-4 py-3 text-[11px] text-slate-500 md:flex-row md:px-6">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-medium text-slate-600">MEIL ESG / BRSR Reporting Platform</span>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">Source → Evidence → Validate → Calculate → Approve → Consolidate → BRSR → Report → Audit</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Database className="h-3 w-3" /> DB-backed</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-blue-500" /> RBAC</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" /> Audit-traceable</span>
            <span className="text-slate-400">v3.0 · Illustrative</span>
          </div>
        </div>
      </footer>

      {/* Global Cmd+K command palette — always available while logged in */}
      <CommandPalette />
    </div>
  )
}

export { NAV }
