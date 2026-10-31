import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendSurveyEmail } from './email'
import {
  assignmentFromRow, cycleFromRow, emailDueToday, longDate, questionFromRow, questionToSnapshot, todayET,
  type EmailKind, type SurveyCycle, type SurveyProfile,
} from './surveys'

const BRONZE_ID = 'usal-bronze'
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Bronze status straight from the tracker, so coaches never retype it. */
async function certificationByCoach(db: SupabaseClient, coachIds: string[], today: string) {
  const result = new Map<string, Pick<SurveyProfile, 'certification' | 'certificationVerified'>>()
  if (!coachIds.length) return result
  const { data, error } = await db.from('submissions').select('coach_id,status,expires_on').eq('requirement_id', BRONZE_ID).in('coach_id', coachIds)
  if (error) throw error
  for (const id of coachIds) {
    const rows = (data ?? []).filter(r => r.coach_id === id)
    const current = rows.filter(r => !r.expires_on || r.expires_on >= today)
    if (current.some(r => r.status === 'approved')) result.set(id, { certification: 'Bronze', certificationVerified: true })
    else if (current.some(r => r.status === 'pending')) result.set(id, { certification: 'Bronze (awaiting board review)', certificationVerified: false })
    else result.set(id, { certification: 'Not on file', certificationVerified: false })
  }
  return result
}

/** Copies the active question bank into the round and marks it open. Safe to call twice. */
export async function openCycle(db: SupabaseClient, cycle: SurveyCycle) {
  if (cycle.status !== 'scheduled') return
  const bank = await db.from('survey_questions').select('*').eq('active', true).order('sort_order')
  if (bank.error) throw bank.error
  const questions = (bank.data ?? []).map(questionFromRow).map(questionToSnapshot)
  if (!questions.length) throw new Error('The question bank has no active questions.')
  const { error } = await db.from('survey_cycles').update({ status: 'open', questions, opened_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', cycle.id).eq('status', 'scheduled')
  if (error) throw error
  cycle.status = 'open'
  cycle.questions = questions
}

/** Adds every active coach in the round's audience who does not have the survey yet (including coaches added after it opened). */
export async function syncAssignments(db: SupabaseClient, cycle: SurveyCycle, today: string) {
  if (cycle.testEmails?.length) return syncTestAssignments(db, cycle, today)
  const coaches = await db.from('coaches').select('id,name,email,team,role,pay,status,archived_at').in('team', cycle.audienceTeams).eq('status', 'approved').is('archived_at', null)
  if (coaches.error) throw coaches.error
  const existing = await db.from('survey_assignments').select('coach_email').eq('cycle_id', cycle.id)
  if (existing.error) throw existing.error
  const have = new Set((existing.data ?? []).map(r => r.coach_email))
  const fresh = (coaches.data ?? []).filter(c => !have.has(c.email.toLowerCase()))
  if (!fresh.length) return 0
  const certs = await certificationByCoach(db, fresh.map(c => c.id), today)
  const rows = fresh.map(c => ({
    cycle_id: cycle.id, coach_id: c.id, coach_name: c.name, coach_email: c.email.toLowerCase(), team: c.team,
    profile: { role: c.role, pay: c.pay, ...(certs.get(c.id) ?? {}) },
  }))
  const { error } = await db.from('survey_assignments').upsert(rows, { onConflict: 'cycle_id,coach_email', ignoreDuplicates: true })
  if (error) throw error
  return rows.length
}

/** Test run: one assignment per listed address. Uses the roster record when the address is a coach's. */
async function syncTestAssignments(db: SupabaseClient, cycle: SurveyCycle, today: string) {
  const emails = [...new Set(cycle.testEmails!.map(e => e.toLowerCase()))]
  const existing = await db.from('survey_assignments').select('coach_email').eq('cycle_id', cycle.id)
  if (existing.error) throw existing.error
  const have = new Set((existing.data ?? []).map(r => r.coach_email))
  const fresh = emails.filter(e => !have.has(e))
  if (!fresh.length) return 0
  const coaches = await db.from('coaches').select('id,name,email,team,role,pay').in('email', fresh)
  if (coaches.error) throw coaches.error
  const byEmail = new Map((coaches.data ?? []).map(c => [c.email.toLowerCase(), c]))
  const certs = await certificationByCoach(db, (coaches.data ?? []).map(c => c.id), today)
  // Addresses that are not on the roster get "Jane Doe" placeholder details, so the prefilled parts of the form
  // can still be tested. Nothing about them is written back to the roster.
  let dummies = 0
  const rows = fresh.map(email => {
    const c = byEmail.get(email)
    if (c) return {
      cycle_id: cycle.id, coach_id: c.id, coach_name: c.name, coach_email: email, team: c.team,
      profile: { role: c.role, pay: c.pay, ...(certs.get(c.id) ?? {}) },
    }
    dummies++
    return {
      cycle_id: cycle.id, coach_id: null, coach_name: dummies === 1 ? 'Jane Doe' : `Jane Doe ${dummies}`, coach_email: email, team: '12U',
      profile: { role: 'Head Coach', pay: 'Volunteer', certification: 'Bronze (test data)', certificationVerified: false, testDummy: true },
    }
  })
  const { error } = await db.from('survey_assignments').upsert(rows, { onConflict: 'cycle_id,coach_email', ignoreDuplicates: true })
  if (error) throw error
  return rows.length
}

export interface DispatchResult { opened: string[]; closed: string[]; added: number; sent: Record<EmailKind, number>; failed: number }

/**
 * The daily job, also used by the board's "Send now" buttons. For each round: open it on its send date, add new
 * coaches, send the invitation or reminder each coach is due today, and close it after its close date.
 * `force` sends one reminder now to everyone outstanding in that round (still at most one email per coach per day).
 */
export async function dispatchSurveys(db: SupabaseClient, options: { cycleId?: string; force?: boolean; limit?: number } = {}): Promise<DispatchResult> {
  const today = todayET()
  const result: DispatchResult = { opened: [], closed: [], added: 0, sent: { invite: 0, reminder: 0, due_tomorrow: 0, overdue: 0 }, failed: 0 }
  let query = db.from('survey_cycles').select('*').in('status', ['scheduled', 'open']).eq('is_historical', false)
  if (options.cycleId) query = query.eq('id', options.cycleId)
  const cycles = await query
  if (cycles.error) throw cycles.error
  let budget = options.limit ?? 200

  for (const cycle of (cycles.data ?? []).map(cycleFromRow)) {
    if (cycle.status === 'scheduled') {
      if (cycle.sendOn > today) continue
      await openCycle(db, cycle)
      result.opened.push(cycle.title)
    }
    if (cycle.closeOn && today > cycle.closeOn) {
      const { error } = await db.from('survey_cycles').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', cycle.id)
      if (error) throw error
      result.closed.push(cycle.title)
      continue
    }
    result.added += await syncAssignments(db, cycle, today)

    const rows = await db.from('survey_assignments').select('*').eq('cycle_id', cycle.id).is('submitted_at', null)
    if (rows.error) throw rows.error
    for (const a of (rows.data ?? []).map(assignmentFromRow)) {
      if (budget <= 0) return result
      let kind = emailDueToday(cycle, a, today)
      if (!kind && options.force && a.invitedAt && a.lastEmailedOn !== today) kind = today > cycle.dueOn ? 'overdue' : 'reminder'
      if (!kind) continue
      // Claim the row first so two runs can never email the same coach twice in one day.
      let claim = db.from('survey_assignments')
        .update({ last_emailed_on: today, invited_at: a.invitedAt ?? new Date().toISOString(), reminders_sent: a.remindersSent + (kind === 'reminder' || kind === 'overdue' ? 1 : 0), invite_failed: false })
        .eq('id', a.id).is('submitted_at', null)
      claim = a.invitedAt ? claim.eq('invited_at', a.invitedAt) : claim.is('invited_at', null)
      claim = a.lastEmailedOn ? claim.eq('last_emailed_on', a.lastEmailedOn) : claim.is('last_emailed_on', null)
      const claimed = await claim.select('id')
      if (claimed.error) throw claimed.error
      if (!claimed.data?.length) continue
      budget--
      const ok = await sendSurveyEmail(kind, a.coachEmail, a.coachName, { title: `${cycle.testEmails ? '[TEST] ' : ''}${cycle.title}`, dueOn: cycle.dueOn, dueLabel: longDate(cycle.dueOn), intro: cycle.intro })
      if (ok) result.sent[kind]++
      else {
        result.failed++
        // Put it back so the next run tries again; flag it for the board.
        await db.from('survey_assignments').update(
          kind === 'invite'
            ? { invited_at: null, last_emailed_on: a.lastEmailedOn, invite_failed: true }
            : { last_emailed_on: a.lastEmailedOn, reminders_sent: a.remindersSent },
        ).eq('id', a.id)
      }
      await sleep(600) // Resend allows about 2 emails per second.
    }
  }
  return result
}
