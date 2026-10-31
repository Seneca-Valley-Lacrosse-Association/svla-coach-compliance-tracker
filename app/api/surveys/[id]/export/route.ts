import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSurveyPdf } from '@/lib/survey-pdf'
import { buildSurveyWorkbook } from '@/lib/survey-workbook'
import { assignmentFromRow, cycleFromRow, todayET } from '@/lib/surveys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

// Board-only survey exports: the formatted PDF board report, or every answer in Excel.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return fail('Request not allowed.', 403)
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('Survey not found.', 404)
  const format = new URL(request.url).searchParams.get('format') === 'xlsx' ? 'xlsx' : 'pdf'
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return fail('Please sign in again.', 401)
    const board = await db.from('board_members').select('email').eq('email', user.email?.toLowerCase() ?? '').maybeSingle()
    if (board.error || !board.data) return fail('Board access is required.', 403)
    const [cycleRow, rows] = await Promise.all([
      db.from('survey_cycles').select('*').eq('id', id).maybeSingle(),
      db.from('survey_assignments').select('*').eq('cycle_id', id),
    ])
    if (cycleRow.error || rows.error) throw cycleRow.error ?? rows.error
    if (!cycleRow.data) return fail('Survey not found.', 404)
    const cycle = cycleFromRow(cycleRow.data)
    const assignments = (rows.data ?? []).map(assignmentFromRow)
    const base = `svla-${cycle.seasonLabel.replace(/[^a-z0-9]+/gi, '-')}-coaching-survey-${todayET()}`
    if (format === 'xlsx') {
      const workbook = await buildSurveyWorkbook(cycle, assignments, user.email ?? undefined)
      const buffer = await workbook.xlsx.writeBuffer()
      return new NextResponse(buffer as ArrayBuffer, { headers: { ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${base}.xlsx"` } })
    }
    const pdf = await buildSurveyPdf(cycle, assignments)
    return new NextResponse(new Uint8Array(pdf), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${base}-summary.pdf"` } })
  } catch {
    return fail('Unable to build the export. Please try again.', 500)
  }
}
