import { Readable } from 'node:stream'
import JSZip from 'jszip'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })
const safe = (s: string) => s.replace(/[^\w.\- ]+/g, '_').slice(0, 80) || 'file'

// Board-only backup of one coach: every uploaded document plus a records.json of the submissions, as a ZIP.
// The ZIP is streamed so large backups are not limited by the serverless response size.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return fail('Request not allowed.', 403)
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return fail('Coach not found.', 404)
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return fail('Please sign in again.', 401)
    const board = await db.from('board_members').select('email').eq('email', user.email?.toLowerCase() ?? '').maybeSingle()
    if (board.error || !board.data) return fail('Board access is required.', 403)
    const coach = await db.from('coaches').select('id,name,email,phone,team,role,pay,pa_resident_10_years,status,archived_at').eq('id', id).maybeSingle()
    if (coach.error || !coach.data) return fail('Coach not found.', 404)
    const subs = await db.from('submissions').select('id,requirement_id,status,uploaded_at,completed_on,expires_on,file_path,file_name,details,review_comment,reviewed_on,edit_log').eq('coach_id', id).order('uploaded_at')
    if (subs.error) throw subs.error

    const zip = new JSZip()
    const missing: string[] = []
    for (const s of subs.data ?? []) {
      if (!s.file_path) continue
      const file = await db.storage.from('certificates').download(s.file_path)
      if (file.error || !file.data) { missing.push(s.file_name ?? s.file_path); continue }
      zip.file(`documents/${safe(s.requirement_id)}_${s.completed_on}_${safe(s.file_name ?? 'file')}`, Buffer.from(await file.data.arrayBuffer()))
    }
    zip.file('records.json', JSON.stringify({ exportedAt: new Date().toISOString(), exportedBy: user.email, coach: coach.data, submissions: subs.data, filesNotFound: missing }, null, 2))
    const stream = Readable.toWeb(zip.generateNodeStream({ streamFiles: true, compression: 'DEFLATE' }) as unknown as Readable) as unknown as ReadableStream
    return new NextResponse(stream, {
      headers: { ...headers, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="svla-${safe(coach.data.name).replace(/ /g, '-')}-backup.zip"` },
    })
  } catch {
    return fail('Unable to build the backup. Please try again.', 500)
  }
}
