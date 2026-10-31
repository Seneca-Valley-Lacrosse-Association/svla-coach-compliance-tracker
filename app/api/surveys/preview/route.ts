import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assignmentFromRow, cycleFromRow, todayET } from '@/lib/surveys'

export const dynamic = 'force-dynamic'
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })

// Board only: the surveys another person would see (open ones and their own past answers), for "Preview as".
// Mirrors my_open_surveys() and my_past_surveys(). Read-only; nothing here changes any record.
export async function GET(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return respond({ error: 'Request not allowed.' }, 403)
  try {
    const email = (new URL(request.url).searchParams.get('email') ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[",()\\]/.test(email) || email.length > 254) return respond({ error: 'Enter a valid email.' }, 400)
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return respond({ error: 'Please sign in again.' }, 401)
    const board = await db.from('board_members').select('email').eq('email', user.email?.toLowerCase() ?? '').maybeSingle()
    if (board.error || !board.data) return respond({ error: 'Board access is required.' }, 403)

    const coaches = await db.from('coaches').select('id').eq('email', email)
    if (coaches.error) throw coaches.error
    const ids = (coaches.data ?? []).map(c => c.id)
    let query = db.from('survey_assignments').select('*')
    query = ids.length ? query.or(`coach_email.eq."${email}",coach_id.in.(${ids.join(',')})`) : query.eq('coach_email', email)
    const rows = await query
    if (rows.error) throw rows.error
    const assignments = (rows.data ?? []).map(assignmentFromRow)
    const cycleIds = [...new Set(assignments.map(a => a.cycleId))]
    const cyclesRes = cycleIds.length ? await db.from('survey_cycles').select('*').in('id', cycleIds) : { data: [], error: null }
    if (cyclesRes.error) throw cyclesRes.error
    const cycles = new Map((cyclesRes.data ?? []).map(r => [r.id, cycleFromRow(r)]))
    const today = todayET()

    const mine = assignments.flatMap(a => {
      const c = cycles.get(a.cycleId)
      if (!c || a.coachEmail !== email || c.status !== 'open' || (c.closeOn && c.closeOn < today)) return []
      return [{ assignmentId: a.id, cycleId: c.id, title: c.title, seasonLabel: c.seasonLabel, nextSeasonLabel: c.nextSeasonLabel, intro: c.intro, dueOn: c.dueOn, closeOn: c.closeOn, questions: c.questions ?? [], answers: a.answers, profile: a.profile, team: a.team, coachName: a.coachName, submittedAt: a.submittedAt, updatedAt: '' }]
    }).sort((x, y) => x.dueOn.localeCompare(y.dueOn))
    const past = assignments.flatMap(a => {
      const c = cycles.get(a.cycleId)
      if (!c || !a.submittedAt || c.testEmails || !(c.status === 'closed' || c.isHistorical)) return []
      return [{ assignmentId: a.id, title: c.title, seasonLabel: c.seasonLabel, nextSeasonLabel: c.nextSeasonLabel, questions: c.questions ?? [], answers: a.answers, team: a.team, submittedAt: a.submittedAt, sendOn: c.sendOn }]
    }).sort((x, y) => y.sendOn.localeCompare(x.sendOn)).map(({ sendOn: _s, ...p }) => p)
    return respond({ role: 'coach', mine, past })
  } catch {
    return respond({ error: 'Unable to load surveys for this preview.' }, 500)
  }
}
