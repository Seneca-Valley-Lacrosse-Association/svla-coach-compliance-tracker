// Annual coaching survey: shared types and pure helpers used by the API routes, the daily job and the UI.
import { z } from 'zod'
import { TEAMS, TEAM_PROGRAMS, type Program, type Team } from './types'

export const QUESTION_KINDS = ['short_text', 'long_text', 'yes_no', 'single_choice', 'multi_choice', 'number'] as const
export type QuestionKind = (typeof QUESTION_KINDS)[number]
export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  short_text: 'Short answer',
  long_text: 'Paragraph',
  yes_no: 'Yes / No',
  single_choice: 'Choose one',
  multi_choice: 'Checkboxes (choose any)',
  number: 'Number',
}
export const CHOICE_KINDS: QuestionKind[] = ['single_choice', 'multi_choice']

export interface SurveyQuestion {
  id?: string
  key: string
  label: string
  help: string
  kind: QuestionKind
  options: string[]
  required: boolean
  showIf: { key: string; values: string[] } | null
  prefill: 'team' | null
  active?: boolean
  order?: number
}

export type CycleStatus = 'scheduled' | 'open' | 'closed'
export interface ReminderSettings {
  reminderEveryDays: number
  remindDayBeforeDue: boolean
  remindAfterDue: boolean
  afterDueDays: number
  maxReminders: number
}
export interface SurveyCycle extends ReminderSettings {
  id: string
  title: string
  seasonLabel: string
  nextSeasonLabel: string
  intro: string
  sendOn: string
  dueOn: string
  closeOn: string | null
  audienceTeams: Team[]
  /** Test run: sent only to these addresses instead of the teams. Null for a real survey. */
  testEmails: string[] | null
  status: CycleStatus
  questions: SurveyQuestion[] | null
  summaryThemes: string
  summaryFollowUp: string
  summaryUpdatedAt: string | null
  summaryUpdatedBy: string | null
  isHistorical: boolean
  openedAt: string | null
  closedAt: string | null
}
export type Answer = string | number | string[]
export type Answers = Record<string, Answer>
export interface SurveyProfile { role?: string; pay?: string; certification?: string; certificationVerified?: boolean }
export interface SurveyAssignment {
  id: string
  cycleId: string
  coachId: string | null
  coachName: string
  coachEmail: string
  team: string
  profile: SurveyProfile
  answers: Answers
  invitedAt: string | null
  inviteFailed: boolean
  remindersSent: number
  lastEmailedOn: string | null
  startedAt: string | null
  submittedAt: string | null
}

/** Teams that get the survey by default: every coaching team. Board and volunteer teams can be added per round. */
export const COACHING_TEAMS: Team[] = ['8U', '10U', '12U', '14U', 'HS-JV', 'HS-Varsity']
export const DEFAULT_REMINDERS: ReminderSettings = { reminderEveryDays: 4, remindDayBeforeDue: true, remindAfterDue: true, afterDueDays: 7, maxReminders: 4 }

// ---------------------------------------------------------------- dates (America/New_York)
export function todayET(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
function parseDay(date: string) {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
export function addDays(date: string, days: number) {
  return new Date(parseDay(date) + days * 86_400_000).toISOString().slice(0, 10)
}
export function dayDiff(from: string, to: string) {
  return Math.round((parseDay(to) - parseDay(from)) / 86_400_000)
}
export function longDate(date: string | null | undefined) {
  if (!date) return '—'
  return new Date(parseDay(date)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
export function shortDate(date: string | null | undefined) {
  if (!date) return '—'
  return new Date(parseDay(date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// ---------------------------------------------------------------- questions
/** Replaces {season} and {next_season} with the round's labels. */
export function fillLabel(text: string, cycle: Pick<SurveyCycle, 'seasonLabel' | 'nextSeasonLabel'>) {
  return text.replaceAll('{season}', cycle.seasonLabel).replaceAll('{next_season}', cycle.nextSeasonLabel)
}

export function answerText(value: Answer | undefined | null): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value).trim()
}

/** A question is shown when it has no condition, or the earlier answer matches one of the listed values. */
export function isVisible(question: SurveyQuestion, answers: Answers) {
  if (!question.showIf) return true
  const value = answers[question.showIf.key]
  const chosen = Array.isArray(value) ? value : value === undefined || value === null ? [] : [String(value)]
  return chosen.some(v => question.showIf!.values.includes(v))
}

/** Starting answers for a coach: their saved answers, plus tracker data for prefilled questions they have not touched. */
export function initialAnswers(questions: SurveyQuestion[], saved: Answers, team: string): Answers {
  const answers: Answers = { ...saved }
  for (const q of questions) {
    if (q.prefill === 'team' && answers[q.key] === undefined && team) answers[q.key] = teamLabel(team)
  }
  return answers
}

/** Checks answers against the round's questions. Returns cleaned answers (hidden questions dropped) and any problems. */
export function validateAnswers(questions: SurveyQuestion[], raw: Answers, requireComplete: boolean): { answers: Answers; errors: Record<string, string> } {
  const answers: Answers = {}
  const errors: Record<string, string> = {}
  // Visibility is decided on the cleaned answers so a hidden parent hides its children too.
  for (const q of questions) {
    if (!isVisible(q, answers)) continue
    const value = raw[q.key]
    let clean: Answer | undefined
    switch (q.kind) {
      case 'short_text':
      case 'long_text': {
        const text = typeof value === 'string' ? value.trim() : ''
        const max = q.kind === 'short_text' ? 300 : 5000
        if (text.length > max) errors[q.key] = `Keep this to ${max.toLocaleString()} characters or fewer.`
        if (text) clean = text.slice(0, max)
        break
      }
      case 'number': {
        const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
        if (!Number.isNaN(n)) {
          if (!Number.isFinite(n) || n < 0 || n > 100) errors[q.key] = 'Enter a number from 0 to 100.'
          else clean = Math.round(n * 10) / 10
        } else if (typeof value === 'string' && value.trim() !== '') errors[q.key] = 'Enter a number.'
        break
      }
      case 'yes_no':
      case 'single_choice': {
        const allowed = q.kind === 'yes_no' ? ['Yes', 'No'] : q.options
        if (typeof value === 'string' && value) {
          if (allowed.includes(value)) clean = value
          else errors[q.key] = 'Choose one of the listed options.'
        }
        break
      }
      case 'multi_choice': {
        const list = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
        const kept = q.options.filter(o => list.includes(o))
        if (kept.length) clean = kept
        break
      }
    }
    if (clean !== undefined) answers[q.key] = clean
    else if (requireComplete && q.required && !errors[q.key]) errors[q.key] = 'This question is required.'
  }
  return { answers, errors }
}

export const questionSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, 'Use lowercase letters, numbers and underscores.'),
  label: z.string().trim().min(1, 'Enter the question.').max(500),
  help: z.string().trim().max(1000).default(''),
  kind: z.enum(QUESTION_KINDS),
  options: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  required: z.boolean(),
  showIf: z.object({ key: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/), values: z.array(z.string().max(120)).min(1).max(30) }).nullable().default(null),
  prefill: z.enum(['team']).nullable().default(null),
  active: z.boolean().default(true),
}).refine(q => !CHOICE_KINDS.includes(q.kind) || q.options.length >= 2, { message: 'Add at least two options.', path: ['options'] })

// ---------------------------------------------------------------- reminders
export type EmailKind = 'invite' | 'reminder' | 'due_tomorrow' | 'overdue'

/**
 * Decides whether one coach gets an email today. Pure, so it can be tested.
 * - Never more than one email per coach per day, and never after they submit.
 * - Regular reminders every N days after the last email, up to the maximum.
 * - The "due tomorrow" reminder does not count toward the maximum.
 * - After the due date, reminders continue (same spacing) for the set number of days, if turned on.
 */
export function emailDueToday(
  settings: ReminderSettings & { dueOn: string; closeOn: string | null },
  a: Pick<SurveyAssignment, 'invitedAt' | 'remindersSent' | 'lastEmailedOn' | 'submittedAt'>,
  today: string,
): EmailKind | null {
  if (a.submittedAt) return null
  if (settings.closeOn && today > settings.closeOn) return null
  if (!a.invitedAt) return 'invite'
  if (a.lastEmailedOn === today) return null
  const last = a.lastEmailedOn ?? a.invitedAt.slice(0, 10)
  const gapMet = settings.reminderEveryDays > 0 && dayDiff(last, today) >= settings.reminderEveryDays
  const underMax = a.remindersSent < settings.maxReminders
  if (today <= settings.dueOn) {
    if (settings.remindDayBeforeDue && today === addDays(settings.dueOn, -1)) return 'due_tomorrow'
    return gapMet && underMax ? 'reminder' : null
  }
  if (!settings.remindAfterDue || dayDiff(settings.dueOn, today) > settings.afterDueDays) return null
  return gapMet && underMax ? 'overdue' : null
}

// ---------------------------------------------------------------- reporting
export const TEAM_LABELS: Partial<Record<string, string>> = { 'HS-JV': 'HS JV', 'HS-Varsity': 'HS Varsity' }
export function teamLabel(team: string) { return TEAM_LABELS[team] ?? team }
/** Imported paper surveys without an email get a placeholder address; show it as blank. */
export function displayEmail(email: string) { return email.endsWith('@import.invalid') ? '' : email }

export function programOf(team: string): Program | 'other' {
  const programs = (TEAMS as readonly string[]).includes(team) ? TEAM_PROGRAMS[team as Team] : null
  if (!programs) return /hs|high|varsity|jv/i.test(team) ? 'high-school' : 'youth'
  return programs.length === 1 ? programs[0] : 'other'
}

/** Sorts youth teams first (8U → 14U), then high school, then everything else, then by name. */
export function rosterOrder(a: Pick<SurveyAssignment, 'team' | 'coachName'>, b: Pick<SurveyAssignment, 'team' | 'coachName'>) {
  const rank = (t: string) => { const i = (TEAMS as readonly string[]).indexOf(t); return i === -1 ? 99 : i }
  return rank(a.team) - rank(b.team) || a.coachName.localeCompare(b.coachName)
}

export interface Glance { label: string; value: string }

/** Counts every answer to a choice-type question, in option order. */
export function tally(question: SurveyQuestion, responses: Answers[]) {
  const options = question.kind === 'yes_no' ? ['Yes', 'No'] : question.options
  const counts = new Map<string, number>(options.map(o => [o, 0]))
  for (const r of responses) {
    const v = r[question.key]
    for (const choice of Array.isArray(v) ? v : v === undefined ? [] : [String(v)]) counts.set(choice, (counts.get(choice) ?? 0) + 1)
  }
  return [...counts.entries()]
}

export function describeTally(entries: [string, number][]) {
  return entries.filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(', ') || 'No answers'
}

/** Short headline answers for the roster table, looked up by well-known question keys. */
export function headline(answers: Answers) {
  const returning = answerText(answers.returning)
  return {
    returning: returning === 'Yes' ? 'Interested' : returning === 'No' ? 'Not interested' : returning || '—',
    fallBall: answerText(answers.fall_ball) || '—',
    years: answerText(answers.years_experience) || '—',
    nextTeams: answerText(answers.next_teams),
    note: [answerText(answers.not_returning_note), answerText(answers.anything_else)].filter(Boolean).join(' '),
    mentor: answerText(answers.mentor),
  }
}

/** Mail-merge style progress counts for one round. */
export function cycleCounts(assignments: SurveyAssignment[]) {
  const submitted = assignments.filter(a => a.submittedAt).length
  return {
    total: assignments.length,
    submitted,
    started: assignments.filter(a => !a.submittedAt && a.startedAt).length,
    outstanding: assignments.length - submitted,
    notEmailed: assignments.filter(a => !a.invitedAt && !a.submittedAt).length,
    failed: assignments.filter(a => a.inviteFailed && !a.submittedAt).length,
  }
}

// ---------------------------------------------------------------- database mapping
/* eslint-disable @typescript-eslint/no-explicit-any */
export function questionFromRow(r: any): SurveyQuestion {
  return { id: r.id, key: r.key, label: r.label, help: r.help ?? '', kind: r.kind, options: r.options ?? [], required: !!r.required, showIf: r.show_if ?? null, prefill: r.prefill ?? null, active: r.active ?? true, order: r.sort_order }
}
export function questionToSnapshot(q: SurveyQuestion) {
  return { key: q.key, label: q.label, help: q.help, kind: q.kind, options: q.options, required: q.required, showIf: q.showIf, prefill: q.prefill }
}
export function cycleFromRow(r: any): SurveyCycle {
  return {
    id: r.id, title: r.title, seasonLabel: r.season_label, nextSeasonLabel: r.next_season_label, intro: r.intro ?? '',
    sendOn: r.send_on, dueOn: r.due_on, closeOn: r.close_on, audienceTeams: r.audience_teams ?? [], testEmails: r.test_emails ?? null, status: r.status,
    reminderEveryDays: r.reminder_every_days, remindDayBeforeDue: r.remind_day_before_due, remindAfterDue: r.remind_after_due,
    afterDueDays: r.after_due_days, maxReminders: r.max_reminders, questions: r.questions ?? null,
    summaryThemes: r.summary_themes ?? '', summaryFollowUp: r.summary_follow_up ?? '', summaryUpdatedAt: r.summary_updated_at, summaryUpdatedBy: r.summary_updated_by,
    isHistorical: !!r.is_historical, openedAt: r.opened_at, closedAt: r.closed_at,
  }
}
export function assignmentFromRow(r: any): SurveyAssignment {
  return {
    id: r.id, cycleId: r.cycle_id, coachId: r.coach_id, coachName: r.coach_name, coachEmail: r.coach_email, team: r.team ?? '',
    profile: r.profile ?? {}, answers: r.answers ?? {}, invitedAt: r.invited_at, inviteFailed: !!r.invite_failed, remindersSent: r.reminders_sent ?? 0,
    lastEmailedOn: r.last_emailed_on, startedAt: r.started_at, submittedAt: r.submitted_at,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
