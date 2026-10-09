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
import { ReviewerWorkspace } from '@/components/modules/reviewer-workspace'
import { SubsidiaryWorkspace } from '@/components/modules/subsidiary-workspace'
import { GroupWorkspace } from '@/components/modules/group-workspace'
import { EsgManagerWorkspace } from '@/components/modules/esg-manager-workspace'
import { EsgAnalystWorkspace } from '@/components/modules/esg-analyst-workspace'
import { BrsrWorkspace } from '@/components/modules/brsr-workspace'
import { AuditorWorkspace } from '@/components/modules/auditor-workspace'
import { ExecutiveWorkspace } from '@/components/modules/executive-workspace'
import { FinanceWorkspace } from '@/components/modules/finance-workspace'

export function ModuleRouter() {
  const { activeModule, dataEntrySubModule } = useApp()
  const m = activeModule
  switch (m) {
    // Finance & Resource Data Contributor workspace
    case 'fin-assignments':
    case 'fin-data':
    case 'fin-expenditure':
    case 'fin-evidence':
    case 'fin-submissions':
    case 'fin-reports':
    case 'fin-activity':
      return <FinanceWorkspace />
    // Shared modules
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
    case 'hr-workforce': case 'hr-training': case 'hr-wellbeing': case 'hr-rights':
      return <HrWorkspace />
    // EHS workspace
    case 'ehs-ops': case 'ehs-incidents': case 'ehs-inspections': case 'ehs-corrective': case 'ehs-environmental': case 'ehs-training':
      return <EhsWorkspace />
    // Procurement workspace
    case 'proc-suppliers': case 'proc-assessments': case 'proc-sourcing': case 'proc-transactions': case 'proc-valuechain':
      return <ProcurementWorkspace />
    // CSR workspace
    case 'csr-projects': case 'csr-budgets': case 'csr-beneficiaries': case 'csr-impact': case 'csr-community': case 'csr-local':
      return <CsrWorkspace />
    // Compliance workspace
    case 'comp-policies': case 'comp-obligations': case 'comp-controls': case 'comp-cases': case 'comp-ethics': case 'comp-calendar':
      return <ComplianceWorkspace />
    // BU Reviewer workspace
    case 'review-queue': case 'review-bu': case 'review-consolidation': case 'review-exceptions':
      return <ReviewerWorkspace />
    // Subsidiary Reviewer workspace
    case 'sub-bucenter': case 'sub-esg': case 'sub-brsr-impact': case 'sub-approvals':
      return <SubsidiaryWorkspace />
    // Group Reviewer workspace
    case 'grp-consolidation': case 'grp-enterprise': case 'grp-brsr': case 'grp-assurance': case 'grp-risk': case 'grp-lock':
      return <GroupWorkspace />
    // ESG Manager workspace
    case 'esg-kpi': case 'esg-performance': case 'esg-completeness': case 'esg-risks': case 'esg-targets': case 'esg-crossfunc':
      return <EsgManagerWorkspace />
    // ESG Analyst workspace
    case 'ana-explorer': case 'ana-metrics': case 'ana-emissions': case 'ana-energy': case 'ana-social': case 'ana-governance': case 'ana-variance': case 'ana-quality':
      return <EsgAnalystWorkspace />
    // BRSR Manager workspace
    case 'brsr-frameworks': case 'brsr-section-a': case 'brsr-section-b': case 'brsr-section-c': case 'brsr-core': case 'brsr-mapping': case 'brsr-sources': case 'brsr-validation': case 'brsr-readiness': case 'brsr-builder': case 'brsr-issuance':
      return <BrsrWorkspace />
    // Auditor workspace
    case 'aud-engagements': case 'aud-scope': case 'aud-evidence': case 'aud-testing': case 'aud-brsr-testing': case 'aud-findings': case 'aud-requests': case 'aud-responses': case 'aud-status': case 'aud-reports':
      return <AuditorWorkspace />
    // Executive workspace
    case 'exec-enterprise': case 'exec-brsr': case 'exec-risks': case 'exec-trends': case 'exec-bus': case 'exec-assurance':
      return <ExecutiveWorkspace />
    default: return <MyProjectModule />
  }
}
