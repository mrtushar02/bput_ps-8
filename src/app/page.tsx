'use client'
import { AppProvider, useApp } from '@/lib/auth-context'
import { WelcomeScreen } from '@/components/welcome/welcome-screen'
import { AppShell } from '@/components/shell/app-shell'
import { OverviewDashboard } from '@/components/dashboard/overview-dashboard'
import { ModuleRouter } from '@/components/modules/module-router'
import { ErrorBoundary } from '@/components/error-boundary'

function Root() {
  const { user, loading, activeModule } = useApp()

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          <div className="orb animate-orb" style={{ width: 360, height: 360, top: '20%', left: '30%', background: 'radial-gradient(circle, rgba(125,181,255,0.5), transparent 70%)' }} />
        </div>
        <div className="glass-strong relative z-10 flex items-center gap-3 rounded-2xl px-6 py-4">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
          <span className="text-sm font-medium text-slate-600">Loading MEIL ESG…</span>
        </div>
      </div>
    )
  }

  if (!user) return <WelcomeScreen />

  return (
    <AppShell>
      <ErrorBoundary label={activeModule}>
        {activeModule === 'overview' ? <OverviewDashboard /> : <ModuleRouter />}
      </ErrorBoundary>
    </AppShell>
  )
}

export default function Page() {
  return (
    <AppProvider>
      <ErrorBoundary label="root">
        <Root />
      </ErrorBoundary>
    </AppProvider>
  )
}
