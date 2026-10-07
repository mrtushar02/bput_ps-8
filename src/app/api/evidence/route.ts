import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { authErrorToStatus } from '@/lib/workflow'

export const runtime = 'nodejs'

// GET /api/evidence?projectId=&periodId=&module=&status=
// Paginated list including uploader.
export async function GET(req: NextRequest) {
  let user
  try {
    const u = await getCurrentUser()
    if (!u) throw new Error('UNAUTHENTICATED')
    user = u
  } catch (e) {
    const code = authErrorToStatus(e)
    return NextResponse.json(
      { error: 'Unauthenticated' },
      { status: code ?? 500 },
    )
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || undefined
  const periodId = searchParams.get('periodId') || undefined
  const moduleFilter = searchParams.get('module') || undefined
  const status = searchParams.get('status') || undefined
  const take = Math.min(Number(searchParams.get('take') || 50), 200)

  const where: Record<string, unknown> = {}
  if (projectId) where.projectId = projectId
  if (periodId) where.reportingPeriodId = periodId
  if (moduleFilter) where.module = moduleFilter
  if (status) where.status = status

  try {
    const [evidence, total] = await Promise.all([
      db.evidence.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          uploader: {
            select: { id: true, name: true, email: true, employeeCode: true },
          },
        },
      }),
      db.evidence.count({ where }),
    ])

    return NextResponse.json({
      user: { id: user.id, name: user.name },
      total,
      count: evidence.length,
      items: evidence,
    })
  } catch (e) {
    console.error('GET /api/evidence error', e)
    return NextResponse.json(
      { error: 'Failed to fetch evidence' },
      { status: 500 },
    )
  }
}
