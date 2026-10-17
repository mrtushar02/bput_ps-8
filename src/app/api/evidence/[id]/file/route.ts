import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import * as fs from 'fs'
import * as path from 'path'

export const runtime = 'nodejs'

// GET /api/evidence/[id]/file — stream the actual uploaded file for inline preview or download.
// Query param: ?download=true → Content-Disposition: attachment (download)
//              (default)      → Content-Disposition: inline (preview in browser)
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const u = await getCurrentUser()
    if (!u) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { id } = await ctx.params

  try {
    const evidence = await db.evidence.findUnique({
      where: { id },
      select: { id: true, fileName: true, filePath: true, mimeType: true, fileSize: true },
    })
    if (!evidence) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
    }

    // filePath is stored as /evidence-uploads/<uniqueName>
    // Resolve to absolute path under public/
    let absolutePath: string
    if (path.isAbsolute(evidence.filePath)) {
      absolutePath = evidence.filePath
    } else {
      // strip leading slash
      const rel = evidence.filePath.startsWith('/') ? evidence.filePath.slice(1) : evidence.filePath
      absolutePath = path.join(process.cwd(), 'public', rel)
    }

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
    }

    const buffer = fs.readFileSync(absolutePath)
    const isDownload = req.nextUrl.searchParams.get('download') === 'true'
    const disposition = isDownload
      ? `attachment; filename="${evidence.fileName}"; filename*=UTF-8''${encodeURIComponent(evidence.fileName)}`
      : `inline; filename="${evidence.fileName}"`

    const headers = new Headers()
    headers.set('Content-Type', evidence.mimeType || 'application/octet-stream')
    headers.set('Content-Disposition', disposition)
    headers.set('Content-Length', String(buffer.byteLength))
    headers.set('Cache-Control', 'private, max-age=3600')

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers })
  } catch (e: any) {
    console.error('GET /api/evidence/[id]/file error', e)
    return NextResponse.json({ error: 'Failed to serve file', detail: String(e?.message ?? e) }, { status: 500 })
  }
}
