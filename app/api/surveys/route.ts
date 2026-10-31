import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { dispatchSurveys } from '@/lib/survey-server'
import {
  assignmentFromRow, cycleFromRow, questionFromRow, questionSchema, todayET, validateAnswers,
  type Answers, type SurveyQuestion,
} from '@/lib/surveys'
import { TEAMS } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
const guard = (request: Request) => request.headers.get('x-svla-request') !== '1' || request.headers.get('sec-fetch-site') === 'cross-site'
const dbError = (error: { code?: string; message: string }) => error.code === 'P0001' ? error.message : 'Could not save. Please try again.'

const answerValue = z.union([z.string().max(6000), z.number(), z.array(z.string().max(200)).max(30)])
const cycleInput = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(150),
  seasonLabel: z.string().trim().min(1, 'Enter the season.').max(40),
  nextSeasonLabel: z.string().trim().min(1, 'Enter the next season.').max(40),
  intro: z.string().trim().max(2000).default(''),
  sendOn: z.iso.date(),
  dueOn: z.iso.date(),
  closeOn: z.iso.date().nullable(),
  audienceTeams: z.array(z.enum(TEAMS)),
  testEmails: z.array(z.string().trim().toLowerCase().email('Enter valid email addresses for the test run.').max(254)).min(1).max(10).nullable().default(null),
  reminderEveryDays: z.number().int().min(0).max(30),
  remindDayBeforeDue: z.boolean(),
  remindAfterDue: z.boolean(),
  afterDueDays: z.number().int().min(0).max(60),
  maxReminders: z.number().int().min(0).max(20),
}).refine(c => c.testEmails || c.audienceTeams.length > 0, { message: 'Choose at least one team.', path: ['audienceTeams'] })
  .refine(c => c.dueOn >= c.sendOn, { message: 'The due date must be on or after the send date.', path: ['dueOn'] })
  .refine(c => !c.closeOn || c.closeOn >= c.dueOn, { message: 'The close date must be on or after the due date.', path: ['closeOn'] })

const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('saveMine'), assignmentId: z.uuid(), answers: z.record(z.string().max(60), answerValue), submit: z.boolean() }),
  z.object({ action: z.literal('createCycle'), input: cycleInput }),
  z.object({ action: z.literal('updateCycle'), id: z.uuid(), input: cycleInput }),
  z.object({ action: z.literal('setCycleStatus'), id: z.uuid(), status: z.enum(['open', 'closed']) }),
  z.object({ action: z.literal('deleteCycle'), id: z.uuid() }),
  z.object({ action: z.literal('sendNow'), id: z.uuid() }),
  z.object({ action: z.literal('saveSummary'), id: z.uuid(), themes: z.string().max(20000), followUp: z.string().max(20000) }),
  z.object({ action: z.literal('removeAssignment'), id: z.uuid() }),
  z.object({ action: z.literal('addQuestion'), input: questionSchema }),
  z.object({ action: z.literal('updateQuestion'), id: z.uuid(), input: questionSchema }),
  z.object({ action: z.literal('deleteQuestion'), id: z.uuid() }),
  z.object({ action: z.literal('moveQuestion'), id: z.uuid(), direction: z.enum(['up', 'down']) }),
])

function cycleRow(c: z.infer<typeof cycleInput>) {
  return {
    title: c.title, season_label: c.seasonLabel, next_season_label: c.nextSeasonLabel, intro: c.intro,
    send_on: c.sendOn, due_on: c.dueOn, close_on: c.closeOn, audience_teams: c.testEmails ? [] : c.audienceTeams, test_emails: c.testEmails,
    reminder_every_days: c.reminderEveryDays, remind_day_before_due: c.remindDayBeforeDue, remind_after_due: c.remindAfterDue,
    after_due_days: c.afterDueDays, max_reminders: c.maxReminders, updated_at: new Date().toISOString(),
  }
}
function questionRow(q: z.infer<typeof questionSchema>) {
  const choice = q.kind === 'single_choice' || q.kind === 'multi_choice'
  return { key: q.key, label: q.label, help: q.help, kind: q.kind, options: choice ? q.options : [], required: q.required, show_if: q.showIf, prefill: q.prefill, active: q.active, updated_at: new Date().toISOString() }
}

async function session() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const email = user.email?.toLowerCase() ?? ''
  const board = await db.from('board_members').select('email').eq('email', email).maybeSingle()
  return { db, email, isBoard: !board.error && !!board.data }
}

// Everyone gets their own open surveys. Board members also get every round, all answers and the question bank.
export async function GET() {
  try {
    const s = await session()
    if (!s) return respond({ error: 'Please sign in again.' }, 401)
    const mine = await s.db.rpc('my_open_surveys')
    if (mine.error) throw mine.error
    const open = (mine.data ?? []).map((r: Record<string, unknown>) => ({
      assignmentId: r.assignment_id, cycleId: r.cycle_id, title: r.title, seasonLabel: r.season_label, nextSeasonLabel: r.next_season_label,
      intro: r.intro, dueOn: r.due_on, closeOn: r.close_on, questions: r.questions, answers: r.answers, profile: r.profile,
      team: r.team, coachName: r.coach_name, submittedAt: r.submitted_at, updatedAt: r.updated_at,
    }))
    if (!s.isBoard) return respond({ role: 'coach', mine: open })
    const [questions, cycles, assignments] = await Promise.all([
      s.db.from('survey_questions').select('*').order('sort_order'),
      s.db.from('survey_cycles').select('*').order('send_on', { ascending: false }),
      s.db.from('survey_assignments').select('*').order('coach_name'),
    ])
    for (const r of [questions, cycles, assignments]) if (r.error) throw r.error
    return respond({
      role: 'board', mine: open, today: todayET(),
      questions: (questions.data ?? []).map(questionFromRow),
      cycles: (cycles.data ?? []).map(cycleFromRow),
      assignments: (assignments.data ?? []).map(assignmentFromRow),
    })
  } catch {
    return respond({ error: 'Unable to load surveys.' }, 500)
  }
}

export async function POST(request: Request) {
  if (guard(request)) return respond({ error: 'Request not allowed.' }, 403)
  try {
    const s = await session()
    if (!s) return respond({ error: 'Please sign in again.' }, 401)
    const parsed = commandSchema.safeParse(await request.json())
    if (!parsed.success) return respond({ error: parsed.error.issues[0]?.message ?? 'Check the form values.' }, 400)
    const command = parsed.data
    const { db } = s

    if (command.action === 'saveMine') {
      const mine = await db.rpc('my_open_surveys')
      if (mine.error) throw mine.error
      const row = (mine.data ?? []).find((r: { assignment_id: string }) => r.assignment_id === command.assignmentId)
      if (!row) return respond({ error: 'This survey is closed or was not sent to you.' }, 404)
      const { answers, errors } = validateAnswers(row.questions as SurveyQuestion[], command.answers as Answers, command.submit)
      if (Object.keys(errors).length) return respond({ error: 'Please answer the highlighted questions.', fieldErrors: errors }, 400)
      const saved = await db.rpc('save_my_survey', { p_assignment: command.assignmentId, p_answers: answers, p_submit: command.submit })
      if (saved.error) return respond({ error: dbError(saved.error) }, 400)
      return respond({ ok: true, submittedAt: saved.data })
    }

    if (!s.isBoard) return respond({ error: 'Board access is required.' }, 403)
    const now = new Date().toISOString()
    switch (command.action) {
      case 'createCycle': {
        const r = await db.from('survey_cycles').insert({ ...cycleRow(command.input), created_by: s.email }).select('id').single()
        if (r.error) throw r.error
        return respond({ ok: true, id: r.data.id })
      }
      case 'updateCycle': {
        const current = await db.from('survey_cycles').select('status,send_on,is_historical').eq('id', command.id).single()
        if (current.error) throw current.error
        if (current.data.is_historical) return respond({ error: 'Imported surveys cannot be edited.' }, 400)
        const row = cycleRow(command.input)
        // Once a survey has gone out, its send date is history.
        if (current.data.status !== 'scheduled') row.send_on = current.data.send_on
        if (current.data.status === 'scheduled' && command.input.sendOn < todayET()) return respond({ error: 'Choose a send date of today or later. Use "Send now" to send it today.' }, 400)
        const r = await db.from('survey_cycles').update(row).eq('id', command.id)
        if (r.error) throw r.error
        return respond({ ok: true })
      }
      case 'setCycleStatus': {
        const current = await db.from('survey_cycles').select('status,close_on').eq('id', command.id).single()
        if (current.error) throw current.error
        if (current.data.status === 'scheduled') return respond({ error: 'This survey has not been sent yet.' }, 400)
        const reopen = command.status === 'open'
        // Reopening clears a close date that has already passed, so the daily job does not close it again.
        const patch = reopen
          ? { status: 'open', closed_at: null, ...(current.data.close_on && current.data.close_on < todayET() ? { close_on: null } : {}) }
          : { status: 'closed', closed_at: now }
        const r = await db.from('survey_cycles').update({ ...patch, updated_at: now }).eq('id', command.id)
        if (r.error) throw r.error
        return respond({ ok: true })
      }
      case 'deleteCycle': {
        const r = await db.from('survey_cycles').delete().eq('id', command.id)
        if (r.error) throw r.error
        return respond({ ok: true })
      }
      case 'sendNow': {
        const current = await db.from('survey_cycles').select('status,send_on,due_on,is_historical').eq('id', command.id).single()
        if (current.error) throw current.error
        if (current.data.is_historical || current.data.status === 'closed') return respond({ error: 'Reopen the survey before sending.' }, 400)
        if (current.data.status === 'scheduled') {
          const today = todayET()
          if (current.data.due_on < today) return respond({ error: 'Move the due date to today or later first.' }, 400)
          const r = await db.from('survey_cycles').update({ send_on: today, updated_at: now }).eq('id', command.id)
          if (r.error) throw r.error
        }
        const result = await dispatchSurveys(db, { cycleId: command.id, force: current.data.status === 'open' })
        return respond({ ok: true, result })
      }
      case 'saveSummary': {
        const r = await db.from('survey_cycles').update({ summary_themes: command.themes, summary_follow_up: command.followUp, summary_updated_at: now, summary_updated_by: s.email }).eq('id', command.id)
        if (r.error) throw r.error
        return respond({ ok: true })
      }
      case 'removeAssignment': {
        const r = await db.from('survey_assignments').delete().eq('id', command.id).is('submitted_at', null)
        if (r.error) throw r.error
        return respond({ ok: true })
      }
      case 'addQuestion': {
        const last = await db.from('survey_questions').select('sort_order').order('sort_order', { ascending: false }).limit(1)
        const r = await db.from('survey_questions').insert({ ...questionRow(command.input), sort_order: (last.data?.[0]?.sort_order ?? 0) + 10 })
        if (r.error) return respond({ error: r.error.code === '23505' ? 'Another question already uses that ID.' : 'Could not save the question.' }, 400)
        return respond({ ok: true })
      }
      case 'updateQuestion': {
        const r = await db.from('survey_questions').update(questionRow(command.input)).eq('id', command.id)
        if (r.error) return respond({ error: r.error.code === '23505' ? 'Another question already uses that ID.' : 'Could not save the question.' }, 400)
        return respond({ ok: true })
      }
      case 'deleteQuestion': {
        const r = await db.from('survey_questions').delete().eq('id', command.id)
        if (r.error) throw r.error
        return respond({ ok: true })
      }
      case 'moveQuestion': {
        const all = await db.from('survey_questions').select('id,sort_order').order('sort_order')
        if (all.error) throw all.error
        const list = all.data ?? []
        const i = list.findIndex(q => q.id === command.id)
        const j = command.direction === 'up' ? i - 1 : i + 1
        if (i === -1 || j < 0 || j >= list.length) return respond({ ok: true })
        ;[list[i], list[j]] = [list[j], list[i]]
        // Renumber in steps of 10 so order stays clean.
        for (const [index, q] of list.entries()) {
          const order = (index + 1) * 10
          if (q.sort_order !== order) {
            const r = await db.from('survey_questions').update({ sort_order: order }).eq('id', q.id)
            if (r.error) throw r.error
          }
        }
        return respond({ ok: true })
      }
    }
  } catch {
    return respond({ error: 'Could not save. Please try again.' }, 500)
  }
}
