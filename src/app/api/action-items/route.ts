import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export const runtime = 'nodejs'

// GET /api/action-items — role-aware task list for the current user.
// Returns pending submissions, corrections, approvals, evidence gaps, and
// BRSR missing items relevant to the user's role + scope.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const roleKey = user.roles[0]?.key ?? ''
  const tasks: {
    id: string; type: string; title: string; description: string
    severity: 'critical' | 'warning' | 'info'; module: string
    dueDate?: string; entityId?: string; status: string
  }[] = []

  // 1. Draft submissions (for PROJECT_USER / HR / EHS etc. — data entry roles)
  const dataEntryRoles = ['PROJECT_USER', 'HR_USER', 'EHS_USER', 'PROCUREMENT_USER', 'CSR_USER', 'COMPLIANCE_USER', 'SUPER_ADMIN']
  if (dataEntryRoles.includes(roleKey)) {
    const drafts = await db.submission.findMany({
      where: { status: 'DRAFT' },
      include: { project: true, reportingPeriod: true },
      take: 5,
    })
    for (const d of drafts) {
      tasks.push({
        id: `draft-${d.id}`, type: 'DRAFT_SUBMISSION', title: d.title,
        description: `Draft submission for ${d.reportingPeriod.periodLabel} — ${d.completionPct}% complete. Submit for review.`,
        severity: 'info', module: 'submissions', entityId: d.id, status: d.status,
        dueDate: d.reportingPeriod.submissionDeadline?.toISOString(),
      })
    }
  }

  // 2. Pending reviews (for reviewers)
  const reviewerRoles = ['BU_REVIEWER', 'SUBSIDIARY_REVIEWER', 'GROUP_REVIEWER', 'SUPER_ADMIN']
  if (reviewerRoles.includes(roleKey)) {
    const pending = await db.submission.findMany({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'BU_APPROVED', 'SUBSIDIARY_APPROVED'] } },
      include: { project: true, reportingPeriod: true },
      take: 5,
    })
    for (const p of pending) {
      const level = roleKey === 'BU_REVIEWER' ? 'BU' : roleKey === 'SUBSIDIARY_REVIEWER' ? 'subsidiary' : 'group'
      tasks.push({
        id: `review-${p.id}`, type: 'PENDING_REVIEW', title: p.title,
        description: `Awaiting ${level} review — ${p.reportingPeriod.periodLabel}. Evidence: ${p.evidenceCount}, validation: ${p.validationPassed} passed / ${p.validationErrors} errors.`,
        severity: p.validationErrors > 0 ? 'warning' : 'info', module: 'submissions', entityId: p.id, status: p.status,
        dueDate: p.reportingPeriod.reviewDeadline?.toISOString(),
      })
    }
  }

  // 3. Open corrections (for data entry roles)
  if (dataEntryRoles.includes(roleKey)) {
    const corrections = await db.correctionRequest.findMany({
      where: { status: 'OPEN' },
      include: { submission: { include: { project: true } } },
      take: 5,
    })
    for (const c of corrections) {
      tasks.push({
        id: `correction-${c.id}`, type: 'CORRECTION', title: `Correction: ${c.field}`,
        description: `${c.issue} — on ${c.submission?.title ?? 'a submission'}. Severity: ${c.severity}.`,
        severity: c.severity === 'BLOCKING' ? 'critical' : 'warning', module: 'submissions',
        entityId: c.submissionId, status: 'OPEN',
      })
    }
  }

  // 4. Open validation exceptions (for ESG_MANAGER, reviewers, admins)
  const exceptionRoles = ['ESG_MANAGER', 'BU_REVIEWER', 'SUBSIDIARY_REVIEWER', 'GROUP_REVIEWER', 'SUPER_ADMIN']
  if (exceptionRoles.includes(roleKey)) {
    const exceptions = await db.validationResult.findMany({
      where: { status: 'OPEN', severity: { in: ['ERROR', 'BLOCKING'] } },
      take: 5,
    })
    for (const e of exceptions) {
      tasks.push({
        id: `exception-${e.id}`, type: 'VALIDATION_ERROR', title: `${e.ruleCode}: ${e.field ?? 'field'}`,
        description: e.message + (e.suggestedAction ? ` → ${e.suggestedAction}` : ''),
        severity: e.severity === 'BLOCKING' ? 'critical' : 'warning', module: 'submissions',
        entityId: e.recordId, status: 'OPEN',
      })
    }
  }

  // 5. BRSR missing items (for BRSR_MANAGER, ESG_MANAGER, GROUP_REVIEWER, SUPER_ADMIN)
  const brsrRoles = ['BRSR_MANAGER', 'ESG_MANAGER', 'GROUP_REVIEWER', 'SUPER_ADMIN']
  if (brsrRoles.includes(roleKey)) {
    const fw = await db.brsrFramework.findFirst({ where: { status: 'ACTIVE' } })
    if (fw) {
      const missing = await db.brsrAnswer.findMany({
        where: { frameworkId: fw.id, status: 'MISSING' },
        include: { question: true },
        take: 5,
      })
      for (const m of missing) {
        tasks.push({
          id: `brsr-${m.id}`, type: 'BRSR_GAP', title: `${m.question.questionCode}: ${m.question.questionText.slice(0, 50)}…`,
          description: `BRSR indicator missing data. Source: ${m.question.mappingSource}. Required for compliance.`,
          severity: 'warning', module: 'brsr', entityId: m.questionId, status: 'MISSING',
        })
      }
    }
  }

  // 6. Evidence pending verification (for reviewers)
  if (reviewerRoles.includes(roleKey)) {
    const pendingEvidence = await db.evidence.findMany({
      where: { status: { in: ['UPLOADED', 'UNDER_REVIEW'] } },
      take: 5,
    })
    for (const e of pendingEvidence) {
      tasks.push({
        id: `evidence-${e.id}`, type: 'EVIDENCE_REVIEW', title: `Verify: ${e.fileName}`,
        description: `${e.documentType} uploaded, awaiting verification.`,
        severity: 'info', module: 'evidence', entityId: e.id, status: e.status,
      })
    }
  }

  // Sort by severity (critical first, then warning, then info)
  const sevOrder = { critical: 0, warning: 1, info: 2 }
  tasks.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity])

  return NextResponse.json({
    tasks,
    count: tasks.length,
    roleKey,
    summary: {
      critical: tasks.filter(t => t.severity === 'critical').length,
      warning: tasks.filter(t => t.severity === 'warning').length,
      info: tasks.filter(t => t.severity === 'info').length,
    },
  })
}
