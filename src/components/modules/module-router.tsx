'use client'
import { useApp } from '@/lib/auth-context'
import { MyProjectModule } from '@/components/modules/my-project'
import { DataEntryModule } from '@/components/modules/data-entry'
import { EvidenceModule } from '@/components/modules/evidence'
import { SubmissionsModule } from '@/components/modules/submissions'
import { BrsrModule } from '@/components/modules/brsr'
import { ReportsModule } from '@/components/modules/reports'
import { AnalyticsModule } from '@/components/modules/analytics'
import { AuditModule } from '@/components/modules/audit'
import { AdminModule } from '@/components/modules/admin'
import { TeamModule } from '@/components/modules/team'
import { HrWorkspace } from '@/components/modules/hr-workspace'
import { EhsWorkspace } from '@/components/modules/ehs-workspace'
import { ProcurementWorkspace } from '@/components/modules/procurement-workspace'
import { CsrWorkspace } from '@/components/modules/csr-workspace'
import { ComplianceWorkspace } from '@/components/modules/compliance-workspace'

export function ModuleRouter() {
  const { activeModule, dataEntrySubModule } = useApp()
  const m = activeModule
  switch (m) {
    case 'my-project': return <MyProjectModule />
    case 'data-entry': return <DataEntryModule subModule={dataEntrySubModule} />
    case 'evidence': return <EvidenceModule />
    case 'submissions': return <SubmissionsModule />
    case 'brsr': return <BrsrModule />
    case 'reports': return <ReportsModule />
    case 'analytics': return <AnalyticsModule />
    case 'audit': return <AuditModule />
    case 'admin': return <AdminModule />
    case 'team': return <TeamModule />
    // HR workspace
    case 'hr-workforce':
    case 'hr-training':
    case 'hr-wellbeing':
    case 'hr-rights':
      return <HrWorkspace />
    // EHS workspace
    case 'ehs-ops':
    case 'ehs-incidents':
    case 'ehs-inspections':
    case 'ehs-corrective':
    case 'ehs-environmental':
    case 'ehs-training':
      return <EhsWorkspace />
    // Procurement workspace
    case 'proc-suppliers':
    case 'proc-assessments':
    case 'proc-sourcing':
    case 'proc-transactions':
    case 'proc-valuechain':
      return <ProcurementWorkspace />
    // CSR workspace
    case 'csr-projects':
    case 'csr-budgets':
    case 'csr-beneficiaries':
    case 'csr-impact':
    case 'csr-community':
    case 'csr-local':
      return <CsrWorkspace />
    // Compliance workspace
    case 'comp-policies':
    case 'comp-obligations':
    case 'comp-controls':
    case 'comp-cases':
    case 'comp-ethics':
    case 'comp-calendar':
      return <ComplianceWorkspace />
    default: return <MyProjectModule />
  }
}
