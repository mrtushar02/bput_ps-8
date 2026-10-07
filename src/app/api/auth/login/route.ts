import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSessionCookie, verifyPassword } from '@/lib/session'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }
    const user = await db.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: { userRoles: { include: { role: true } }, userScopes: true },
    })
    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const cookie = await createSessionCookie(user.id)
    const res = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      employeeCode: user.employeeCode,
      groupId: user.groupId,
      demo: user.demo,
      roles: user.userRoles.map(ur => ({ key: ur.role.key, name: ur.role.name, phase: ur.role.phase })),
      scopes: user.userScopes.map(us => ({ scopeType: us.scopeType, scopeId: us.scopeId })),
    })
    res.headers.set('Set-Cookie', cookie)
    return res
  } catch (e: any) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
