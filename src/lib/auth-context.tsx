'use client'
/**
 * Auth + app-state context. Client-side mirror of the server session.
 * The server remains the security boundary; this only mirrors who is logged in
 * and which app module is active (single-route SPA).
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

export interface SessionUser {
  id: string
  email: string
  name: string
  employeeCode: string | null
  groupId: string | null
  demo: boolean
  roles: { key: string; name: string; phase: number }[]
  scopes: { scopeType: string; scopeId: string }[]
}

export type ModuleKey =
  | 'overview' | 'my-project' | 'data-entry' | 'evidence'
  | 'submissions' | 'reports' | 'analytics' | 'audit' | 'brsr' | 'admin' | 'team'
  | 'hr-workforce' | 'hr-training' | 'hr-wellbeing' | 'hr-rights'

interface AppState {
  user: SessionUser | null
  loading: boolean
  activeModule: ModuleKey
  dataEntrySubModule: string
  setActiveModule: (m: ModuleKey) => void
  setDataEntrySubModule: (s: string) => void
  refreshUser: () => Promise<void>
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeModule, setActiveModule] = useState<ModuleKey>('overview')
  const [dataEntrySubModule, setDataEntrySubModule] = useState('energy')

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshUser() }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return { ok: false, error: d.error || 'Login failed' }
    }
    await refreshUser()
    return { ok: true }
  }, [refreshUser])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setActiveModule('overview')
  }, [])

  return (
    <Ctx.Provider value={{ user, loading, activeModule, dataEntrySubModule, setActiveModule, setDataEntrySubModule, refreshUser, login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
