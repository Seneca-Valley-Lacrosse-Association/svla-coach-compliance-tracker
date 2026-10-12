import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildWorkbook } from '@/lib/export-workbook'
import { TODAY } from '@/lib/compliance'
import type { Coach, Requirement, Submission } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

// Board-only full export (Excel). Row Level Security still applies to every query below.
export async function GET(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return fail('Request not allowed.', 403)
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return fail('Please sign in again.', 401)
    const board = await db.from('board_members').select('email').eq('email', user.email?.toLowerCase() ?? '').maybeSingle()
    if (board.error || !board.data) return fail('Board access is required.', 403)

    async function allRows<const Columns extends string>(table: string, columns: Columns, order: string) {
      const rows = []
      for (let start = 0; ; start += 1000) {
        const result = await db.from(table).select(columns).order(order).range(start, start + 999)
        if (result.error) throw result.error
        rows.push(...(result.data ?? []))
        if ((result.data?.length ?? 0) < 1000) return rows
      }
    }
    const [coachRows, requirementRows, submissionRows] = await Promise.all([
      allRows('coaches', 'id,name,email,phone,team,role,pay,pa_resident_10_years', 'id'),
      allRows('requirements', 'id,sort_order,definition', 'sort_order'),
      allRows('submissions', 'id,coach_id,requirement_id,status,uploaded_at,completed_on,expires_on,file_path,file_name,details,review_comment,reviewed_on', 'id'),
    ])
    const coaches = coachRows.map(r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, team: r.team, role: r.role, pay: r.pay, paResident10Years: r.pa_resident_10_years })) as Coach[]
    const requirements = requirementRows.map(r => ({ ...r.definition, id: r.id, order: r.sort_order })) as Requirement[]
    const submissions = submissionRows.map(r => ({ ...r.details, id: r.id, coachId: r.coach_id, requirementId: r.requirement_id, status: r.status, uploadedOn: r.uploaded_at, completedOn: r.completed_on, expiresOn: r.expires_on, filePath: r.file_path ?? undefined, fileName: r.file_name ?? undefined, reviewComment: r.review_comment ?? undefined, reviewedOn: r.reviewed_on ?? undefined })) as Submission[]

    const workbook = await buildWorkbook({ coaches, requirements, submissions, origin: new URL(request.url).origin, generatedBy: user.email ?? undefined })
    const buffer = await workbook.xlsx.writeBuffer()
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="svla-coach-compliance-full-export-${TODAY}.xlsx"`,
      },
    })
  } catch {
    return fail('Unable to build the export. Please try again.', 500)
  }
}
