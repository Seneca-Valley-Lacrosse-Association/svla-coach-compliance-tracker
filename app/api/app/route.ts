import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mutationSchema } from '@/lib/validation'
import type { Coach, Requirement, Submission } from '@/lib/types'

export const dynamic = 'force-dynamic'
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function GET() {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return respond({ user: null, coaches: [], requirements: [], submissions: [] })
    const board = await db.from('board_members').select('email').eq('email', user.email?.toLowerCase() ?? '').maybeSingle()
    if (board.error) throw board.error
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
    return respond({ user: { id: user.id, email: user.email, role: board.data ? 'board' : 'coach' }, coaches, requirements, submissions })
  } catch {
    return respond({ error: 'Unable to load your records. Please try again.' }, 500)
  }
}

export async function POST(request: Request) {
  if (request.headers.get('x-svla-request') !== '1' || request.headers.get('sec-fetch-site') === 'cross-site') return respond({ error: 'Request not allowed.' }, 403)
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return respond({ error: 'Please sign in again.' }, 401)
    const parsed = mutationSchema.safeParse(await request.json())
    if (!parsed.success) return respond({ error: parsed.error.issues[0]?.message ?? 'Check the form values.' }, 400)
    const command = parsed.data
    if (command.action !== 'submitUpload') {
      const board = await db.from('board_members').select('email').eq('email', user.email?.toLowerCase() ?? '').maybeSingle()
      if (board.error || !board.data) return respond({ error: 'Board access is required.' }, 403)
    }
    let result
    switch (command.action) {
      case 'addCoach': {
        const { paResident10Years, ...coach } = command.input
        result = await db.from('coaches').insert({ ...coach, pa_resident_10_years: paResident10Years }).select('id').single()
        break
      }
      case 'addRequirement':
        result = await db.from('requirements').insert({ definition: command.input }).select('id').single()
        break
      case 'setRequirementActive':
      case 'updateResource': {
        const existing = await db.from('requirements').select('definition').eq('id', command.id).single()
        if (existing.error) return respond({ error: 'Requirement not found.' }, 404)
        const changes = command.action === 'setRequirementActive' ? { active: command.active } : command.input
        result = await db.from('requirements').update({ definition: { ...existing.data.definition, ...changes } }).eq('id', command.id).eq('definition', JSON.stringify(existing.data.definition)).select('id').single()
        break
      }
      case 'submitUpload': {
        const { coachId, requirementId, completedOn, filePath, fileName, ...details } = command.input
        const req = await db.from('requirements').select('definition').eq('id', requirementId).single()
        if (req.error) return respond({ error: 'Requirement not found.' }, 404)
        if (req.data.definition.type === 'Signature' && !req.data.definition.helpUrl) return respond({ error: 'The board must configure the document link before you can sign.' }, 400)
        result = await db.from('submissions').insert({ coach_id: coachId, requirement_id: requirementId, completed_on: completedOn, file_path: filePath ?? null, file_name: fileName ?? null, details: { ...details, ...(req.data.definition.type === 'Signature' ? { documentUrl: req.data.definition.helpUrl } : {}) }, submitted_by: user.id }).select('id').single()
        break
      }
      case 'reviewSubmission':
        if (command.decision === 'rejected' && !command.comment?.trim()) return respond({ error: 'A rejection reason is required.' }, 400)
        result = await db.from('submissions').update({ status: command.decision, review_comment: command.comment ?? null, reviewed_by: user.id }).eq('id', command.id).eq('status', 'pending').select('id').single()
        break
    }
    if (result.error) {
      const message = result.error.code === '23505' ? 'This email is already on the roster.' : result.error.code === 'P0001' ? result.error.message : 'Could not save. Check your permissions and refresh before trying again.'
      return respond({ error: message }, 400)
    }
    return respond({ ok: true })
  } catch {
    return respond({ error: 'Unable to process the request. Please try again.' }, 500)
  }
}
