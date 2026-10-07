'use client'
import { AppProvider, useApp } from '@/lib/auth-context'
import { WelcomeScreen } from '@/components/welcome/welcome-screen'
import { AppShell } from '@/components/shell/app-shell'
import { OverviewDashboard } from '@/components/dashboard/overview-dashboard'
import { SiteUserOverview } from '@/components/dashboard/site-user-overview'
import { ReviewerDashboard } from '@/components/dashboard/reviewer-dashboard'
import { ExecutiveDashboard } from '@/components/dashboard/executive-dashboard'
import { AuditorDashboard } from '@/components/dashboard/auditor-dashboard'
import { ModuleRouter } from '@/components/modules/module-router'
import { ErrorBoundary } from '@/components/error-boundary'

// Role → dashboard mapping. Each role group gets a UNIQUE dashboard with a
// distinct color theme, layout, and information density.
function getDashboardForRole(roleKey: string) {
  // Site users (data entry) — sky-blue 3-column operational dashboard
  const siteUserRoles = ['PROJECT_USER', 'HR_USER', 'EHS_USER', 'PROCUREMENT_USER', 'CSR_USER', 'COMPLIANCE_USER']
  // Reviewers — indigo/violet review-queue dashboard
  const reviewerRoles = ['BU_REVIEWER', 'SUBSIDIARY_REVIEWER', 'GROUP_REVIEWER']
  // Executives + Super Admin — amber/gold executive briefing
  const executiveRoles = ['EXECUTIVE', 'SUPER_ADMIN']
  // Auditors — slate/steel assurance dashboard
  const auditorRoles = ['AUDITOR']
  // ESG managers/analysts + BRSR manager — keep the command center (emerald/teal)
  const managerRoles = ['ESG_MANAGER', 'ESG_ANALYST', 'BRSR_MANAGER']

  if (siteUserRoles.includes(roleKey)) return <SiteUserOverview />
  if (reviewerRoles.includes(roleKey)) return <ReviewerDashboard />
  if (executiveRoles.includes(roleKey)) return <ExecutiveDashboard />
  if (auditorRoles.includes(roleKey)) return <AuditorDashboard />
  if (managerRoles.includes(roleKey)) return <OverviewDashboard />
  // Fallback for unknown roles
  return <OverviewDashboard />
}

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

  const roleKey = user?.roles?.[0]?.key ?? ''

  return (
    <AppShell>
      <ErrorBoundary label={activeModule}>
        {activeModule === 'overview' ? getDashboardForRole(roleKey) : <ModuleRouter />}
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
