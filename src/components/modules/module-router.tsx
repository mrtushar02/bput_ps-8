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

export function ModuleRouter() {
  const { activeModule, dataEntrySubModule } = useApp()
  switch (activeModule) {
    case 'my-project': return <MyProjectModule />
    case 'data-entry': return <DataEntryModule subModule={dataEntrySubModule} />
    case 'evidence': return <EvidenceModule />
    case 'submissions': return <SubmissionsModule />
    case 'brsr': return <BrsrModule />
    case 'reports': return <ReportsModule />
    case 'analytics': return <AnalyticsModule />
    case 'audit': return <AuditModule />
    case 'admin': return <AdminModule />
    default: return <MyProjectModule />
  }
}
