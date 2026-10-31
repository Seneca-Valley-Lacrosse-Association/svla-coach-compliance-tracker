// Builds the board report for one survey round. The same data feeds the dashboard, the Excel export and the PDF.
import {
  answerText, describeTally, fillLabel, headline, isVisible, programOf, rosterOrder, tally, teamLabel,
  type Glance, type SurveyAssignment, type SurveyCycle, type SurveyQuestion,
} from './surveys'

/** Short names for well-known questions in tables and coach cards. Board-added questions fall back to their label. */
const TOPIC_LABELS: Record<string, string> = {
  teams_coached: 'Team(s) coached',
  years_experience: 'Years coaching',
  cert_above_bronze: 'Certification above Bronze',
  cert_level: 'Certification (as reported)',
  returning: 'Coaching next season',
  next_teams: 'Preferred team(s)',
  not_returning_note: 'About their decision',
  fall_ball: 'Fall Ball coaching',
  outside_experience: 'Outside experience',
  clinics: 'Clinics attended',
  did_well: 'Did well',
  improve: 'Could improve',
  successes: 'Successes',
  disappointments: 'Disappointments',
  support: 'Support requested',
  mentor: 'Willing to mentor',
  clinic_interest: 'Would attend a clinic',
  anything_else: 'Comments',
}
const GLANCE_LABELS: Record<string, string> = {
  returning: 'Interested in coaching {next_season}',
  fall_ball: 'Interested in Fall Ball coaching',
  next_teams: 'Preferred teams next season',
  mentor: 'Willing to mentor a newer coach',
  clinic_interest: 'Would attend an SVLA coaches’ clinic',
  cert_above_bronze: 'Certification above Bronze',
}
/** Shown in the coach card's one-line summary rather than as their own rows. */
const META_KEYS = new Set(['teams_coached', 'years_experience', 'returning', 'fall_ball', 'cert_level'])

export function topicLabel(q: SurveyQuestion, cycle: SurveyCycle) {
  return TOPIC_LABELS[q.key] ?? fillLabel(q.label, cycle)
}

export interface RosterRow {
  name: string
  team: string
  program: string
  returning: string
  fallBall: string
  years: string
  certification: string
  email: string
  notes: string
}
export interface CoachCard { name: string; meta: string; rows: [string, string][] }
export interface SurveyReport {
  cycle: SurveyCycle
  questions: SurveyQuestion[]
  responded: SurveyAssignment[]
  outstanding: SurveyAssignment[]
  firstSubmitted: string | null
  lastSubmitted: string | null
  glance: Glance[]
  roster: RosterRow[]
  cards: CoachCard[]
}

function yearsSummary(values: string[]) {
  const nums = values.map(v => parseFloat(v)).filter(n => !Number.isNaN(n))
  if (!nums.length) return null
  const low = nums.filter(n => n <= 2).length
  const high = nums.filter(n => n >= 10).length
  const median = [...nums].sort((a, b) => a - b)[Math.floor(nums.length / 2)]
  return `${low} of ${nums.length} have two years or less; ${high} have 10+ years (median ${median})`
}

function certificationOf(a: SurveyAssignment) {
  return answerText(a.answers.cert_level) || a.profile.certification || '—'
}

export function buildReport(cycle: SurveyCycle, assignments: SurveyAssignment[]): SurveyReport {
  const questions = cycle.questions ?? []
  const mine = assignments.filter(a => a.cycleId === cycle.id)
  const responded = mine.filter(a => a.submittedAt).sort(rosterOrder)
  const outstanding = mine.filter(a => !a.submittedAt).sort(rosterOrder)
  const dates = responded.map(a => a.submittedAt!.slice(0, 10)).sort()
  const answers = responded.map(a => a.answers)

  const youth = responded.filter(a => programOf(a.team) === 'youth').length
  const hs = responded.filter(a => programOf(a.team) === 'high-school').length
  const other = responded.length - youth - hs
  const glance: Glance[] = [{
    label: 'Submissions',
    value: `${responded.length}${cycle.isHistorical ? '' : ` of ${mine.length} sent`} (${youth} youth, ${hs} high school${other ? `, ${other} other` : ''})`,
  }]
  for (const q of questions) {
    if (!['yes_no', 'single_choice', 'multi_choice'].includes(q.kind)) continue
    const relevant = answers.filter(a => isVisible(q, a))
    if (!relevant.length) continue
    let value = describeTally(tally(q, relevant))
    if (q.key === 'returning') {
      const no = responded.filter(a => answerText(a.answers.returning) === 'No').map(a => a.coachName)
      if (no.length) value += ` (not returning: ${no.join(', ')})`
    }
    glance.push({ label: fillLabel(GLANCE_LABELS[q.key] ?? q.label, cycle), value })
  }
  const years = yearsSummary(responded.map(a => answerText(a.answers.years_experience)))
  if (years) glance.push({ label: 'Coaching experience', value: years })
  const certs = new Map<string, number>()
  for (const a of responded) certs.set(certificationOf(a), (certs.get(certificationOf(a)) ?? 0) + 1)
  if (responded.length) glance.push({ label: cycle.isHistorical ? 'USA Lacrosse certification (as reported)' : 'USA Lacrosse Bronze (from the tracker)', value: [...certs.entries()].sort((x, y) => y[1] - x[1]).map(([k, n]) => `${n} ${k}`).join(', ') })
  if (!cycle.isHistorical && outstanding.length) glance.push({ label: 'Not yet responded', value: outstanding.map(a => a.coachName).join(', ') })

  const roster: RosterRow[] = responded.map(a => {
    const h = headline(a.answers)
    const notes = [h.nextTeams && `Prefers: ${h.nextTeams}.`, h.note].filter(Boolean).join(' ')
    return {
      name: a.coachName,
      team: answerText(a.answers.teams_coached) || teamLabel(a.team),
      program: programOf(a.team),
      returning: h.returning,
      fallBall: h.fallBall,
      years: h.years,
      certification: certificationOf(a),
      email: a.coachEmail,
      notes,
    }
  })

  const cards: CoachCard[] = responded.map(a => {
    const h = headline(a.answers)
    const meta = [answerText(a.answers.teams_coached) || teamLabel(a.team), h.years !== '—' ? `${h.years} ${h.years === '1' ? 'year' : 'years'}` : '', certificationOf(a), h.returning !== '—' ? h.returning : '', h.fallBall !== '—' ? `Fall Ball: ${h.fallBall}` : '']
      .filter(Boolean).join(' · ')
    const rows: [string, string][] = questions
      .filter(q => !META_KEYS.has(q.key) && isVisible(q, a.answers))
      .map(q => [topicLabel(q, cycle), answerText(a.answers[q.key])] as [string, string])
      .filter(([, v]) => v)
    return { name: a.coachName, meta, rows }
  })

  return { cycle, questions, responded, outstanding, firstSubmitted: dates[0] ?? null, lastSubmitted: dates.at(-1) ?? null, glance, roster, cards }
}

/** Splits the board's summary text into paragraphs and bullets. "- " or "* " starts a bullet; **text** is bold. */
export function parseSummary(text: string): { type: 'bullet' | 'para'; parts: { text: string; bold: boolean }[] }[] {
  const blocks: { type: 'bullet' | 'para'; lines: string[] }[] = []
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) { blocks.push({ type: 'para', lines: [] }); continue }
    const bullet = /^[-*•]\s+/.test(line)
    const body = line.replace(/^[-*•]\s+/, '')
    const last = blocks.at(-1)
    if (!bullet && last && last.lines.length) last.lines.push(body)
    else blocks.push({ type: bullet ? 'bullet' : 'para', lines: [body] })
  }
  return blocks.filter(b => b.lines.length).map(b => ({
    type: b.type,
    parts: b.lines.join(' ').split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(t => t.startsWith('**') && t.endsWith('**') ? { text: t.slice(2, -2), bold: true } : { text: t, bold: false }),
  }))
}
