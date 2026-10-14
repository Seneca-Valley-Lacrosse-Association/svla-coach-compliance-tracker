import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendApprovalEmail, sendBoardInviteEmail, sendInviteEmail } from '@/lib/email'
import { createAccessLink } from '@/lib/invite'
import { mutationSchema } from '@/lib/validation'
import type { Coach, LoginInfo, Requirement, Submission } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function GET() {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return respond({ user: null, coaches: [], requirements: [], submissions: [], boardMembers: [], pendingAccounts: [] })
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
      allRows('coaches', 'id,name,email,phone,team,role,pay,pa_resident_10_years,status', 'id'),
      allRows('requirements', 'id,sort_order,definition', 'sort_order'),
      allRows('submissions', 'id,coach_id,requirement_id,status,uploaded_at,completed_on,expires_on,file_path,file_name,details,review_comment,reviewed_on', 'id'),
    ])
    const coaches = coachRows.map(r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, team: r.team, role: r.role, pay: r.pay, paResident10Years: r.pa_resident_10_years, status: r.status })) as Coach[]
    const requirements = requirementRows.map(r => ({ ...r.definition, id: r.id, order: r.sort_order })) as Requirement[]
    const submissions = submissionRows.map(r => ({ ...r.details, id: r.id, coachId: r.coach_id, requirementId: r.requirement_id, status: r.status, uploadedOn: r.uploaded_at, completedOn: r.completed_on, expiresOn: r.expires_on, filePath: r.file_path ?? undefined, fileName: r.file_name ?? undefined, reviewComment: r.review_comment ?? undefined, reviewedOn: r.reviewed_on ?? undefined })) as Submission[]
    let boardMembers: { email: string; lastSignInAt?: string | null }[] = []
    if (board.data) {
      const members = await db.from('board_members').select('email').order('email')
      if (members.error) throw members.error
      boardMembers = members.data ?? []
      // Last sign-in is a nice-to-have: if the lookup fails, still show the list.
      const activity = await db.rpc('board_member_activity')
      if (!activity.error) {
        const seen = new Map<string, string | null>((activity.data ?? []).map((a: { email: string; last_sign_in_at: string | null }) => [a.email.toLowerCase(), a.last_sign_in_at] as [string, string | null]))
        boardMembers = boardMembers.map(m => ({ ...m, lastSignInAt: seen.get(m.email.toLowerCase()) ?? null }))
      }
    }
    let pendingAccounts: { email: string; created_at: string }[] = []
    if (board.data) {
      const pending = await db.rpc('pending_accounts')
      if (pending.error) throw pending.error
      pendingAccounts = (pending.data ?? []) as { email: string; created_at: string }[]
    }
    // Which roster coaches have a sign-in account. Nice-to-have: if the lookup fails, the rest still loads.
    let loginStatus: LoginInfo[] = []
    if (board.data) {
      const status = await db.rpc('coach_login_status')
      if (!status.error) loginStatus = (status.data ?? []) as LoginInfo[]
    }
    return respond({ user: { id: user.id, email: user.email, role: board.data ? 'board' : 'coach' }, coaches, requirements, submissions, boardMembers, pendingAccounts, loginStatus })
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
    if (command.action !== 'submitUpload' && command.action !== 'registerSelf') {
      const board = await db.from('board_members').select('email').eq('email', user.email?.toLowerCase() ?? '').maybeSingle()
      if (board.error || !board.data) return respond({ error: 'Board access is required.' }, 403)
    }
    let result
    let extra: Record<string, unknown> = {}
    switch (command.action) {
      case 'addCoach': {
        const { paResident10Years, ...coach } = command.input
        result = await db.from('coaches').insert({ ...coach, pa_resident_10_years: paResident10Years }).select('id').single()
        break
      }
      case 'deleteCoach': {
        const owner = await db.from('coaches').select('email').eq('id', command.id).single()
        if (owner.error) throw owner.error
        const files = await db.from('submissions').select('file_path').eq('coach_id', command.id).not('file_path', 'is', null)
        if (files.error) throw files.error
        result = await db.from('coaches').delete().eq('id', command.id).select('id').single()
        if (!result.error && files.data?.length) await db.storage.from('certificates').remove(files.data.map(f => f.file_path as string))
        if (!result.error) await db.rpc('delete_account', { p_email: owner.data.email })
        break
      }
      case 'inviteCoach': {
        // Board-only (checked above). The coach must already be on the roster; the link goes only to that email.
        const coach = await db.from('coaches').select('id,name,email').eq('id', command.id).maybeSingle()
        if (coach.error || !coach.data) return respond({ error: 'Coach not found.' }, 404)
        const access = await createAccessLink(coach.data.email)
        if ('error' in access) return respond({ error: access.error }, 500)
        const emailSent = command.deliver === 'email' ? await sendInviteEmail(coach.data.email, coach.data.name, access.link) : false
        await db.from('coaches').update({ invited_at: new Date().toISOString() }).eq('id', command.id)
        // The link is returned only when the board member must hand it over themselves (copy-link, or the email did not go out).
        return respond({ ok: true, emailSent, ...(emailSent ? {} : { link: access.link }) })
      }
      case 'inviteBoardMember': {
        // Board-only (checked above). The link goes only to an address that is already on the board list.
        const member = await db.from('board_members').select('email').eq('email', command.email).maybeSingle()
        if (member.error || !member.data) return respond({ error: 'That email is not a board member.' }, 404)
        const access = await createAccessLink(member.data.email)
        if ('error' in access) return respond({ error: access.error }, 500)
        const emailSent = command.deliver === 'email' ? await sendBoardInviteEmail(member.data.email, access.link) : false
        // The link is returned only when the sender must hand it over themselves (copy-link, or the email did not go out).
        return respond({ ok: true, emailSent, ...(emailSent ? {} : { link: access.link }) })
      }
      case 'inviteCoaches': {
        const rows = await db.from('coaches').select('id,name,email').in('id', command.ids)
        if (rows.error) throw rows.error
        const failed: string[] = []
        let sent = 0
        for (const coach of rows.data ?? []) {
          const access = await createAccessLink(coach.email)
          const ok = !('error' in access) && await sendInviteEmail(coach.email, coach.name, access.link)
          if (ok) { sent++; await db.from('coaches').update({ invited_at: new Date().toISOString() }).eq('id', coach.id) }
          else failed.push(coach.name)
          await sleep(600) // Resend allows about 2 emails per second.
        }
        return respond({ ok: true, sent, failed })
      }
      case 'reviewCoach': {
        result = await db.from('coaches').update({ status: command.decision, pay: command.pay }).eq('id', command.id).neq('status', command.decision).select('id,email,name').single()
        if (!result.error && command.decision === 'approved') extra = { emailSent: await sendApprovalEmail(result.data.email, result.data.name) }
        break
      }
      case 'removeAccount': {
        const rpc = await db.rpc('delete_account', { p_email: command.email })
        result = { data: rpc.data, error: rpc.error }
        break
      }
      case 'registerSelf': {
        const i = command.input
        const rpc = await db.rpc('register_self', { p_name: i.name, p_phone: i.phone, p_team: i.team, p_role: i.role, p_pa_resident: i.paResident10Years })
        result = { data: rpc.data, error: rpc.error }
        break
      }
      case 'editCoach': {
        const { paResident10Years, ...coach } = command.input
        result = await db.from('coaches').update({ ...coach, pa_resident_10_years: paResident10Years }).eq('id', command.id).select('id').single()
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
      case 'addBoardMember':
        result = await db.from('board_members').insert({ email: command.email }).select('email').single()
        break
      case 'removeBoardMember':
        if (command.email === (user.email?.toLowerCase() ?? '')) return respond({ error: 'You cannot remove your own board access. Ask another board member to do it.' }, 400)
        result = await db.from('board_members').delete().eq('email', command.email).select('email').single()
        break
      case 'reviewSubmission':
        if (command.decision === 'rejected' && !command.comment?.trim()) return respond({ error: 'A rejection reason is required.' }, 400)
        result = await db.from('submissions').update({ status: command.decision, review_comment: command.comment ?? null, reviewed_by: user.id }).eq('id', command.id).eq('status', 'pending').select('id').single()
        break
    }
    if (result.error) {
      const message = result.error.code === '23505' ? (command.action === 'addBoardMember' ? 'That email already has board access.' : 'This email is already on the roster.') : result.error.code === 'P0001' ? result.error.message : 'Could not save. Check your permissions and refresh before trying again.'
      return respond({ error: message }, 400)
    }
    return respond({ ok: true, ...extra })
  } catch {
    return respond({ error: 'Unable to process the request. Please try again.' }, 500)
  }
}
