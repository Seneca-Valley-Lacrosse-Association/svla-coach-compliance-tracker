import ExcelJS from 'exceljs'
import { buildReport, topicLabel } from './survey-report'
import { answerText, displayEmail, fillLabel, isVisible, QUESTION_KIND_LABELS, teamLabel, todayET, type SurveyAssignment, type SurveyCycle } from './surveys'

const HEADER_FILL = 'FF0F2A4A'
// Spreadsheet apps treat a leading = + - @ as a formula. Neutralise it in anything a coach typed.
const safe = (value: string) => /^[=+\-@\t\r]/.test(value) ? `'${value}` : value

function styleHeader(sheet: ExcelJS.Worksheet, freezeCol = 1) {
  const row = sheet.getRow(1)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.alignment = { vertical: 'middle', wrapText: true }
  row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } } })
  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: freezeCol }]
  if (sheet.columnCount > 0) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } }
}
function wrapAll(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row, n) => { if (n > 1) row.alignment = { vertical: 'top', wrapText: true } })
}

/** Every answer for one survey round, plus the roster summary and the board's write-up. */
export async function buildSurveyWorkbook(cycle: SurveyCycle, assignments: SurveyAssignment[], generatedBy?: string) {
  const report = buildReport(cycle, assignments)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SVLA Compliance Tracker'
  wb.created = new Date()

  const readme = wb.addWorksheet('Read Me')
  readme.columns = [{ width: 110 }]
  ;[
    `${cycle.title}: full export`,
    `Generated ${todayET()}${generatedBy ? ` by ${generatedBy}` : ''}. Internal to the SVLA Board. Contains coach contact details and candid feedback; store it in a restricted folder.`,
    '',
    'Responses: one row per person the survey went to, with every answer exactly as submitted.',
    'Roster & Intentions: respondents with their next-season plans, as in the board report.',
    'At a Glance: the summary counts from the board report.',
    'Board Summary: the "What coaches told us" and "Items for follow-up" sections the board wrote.',
    'Questions: the questions exactly as they were asked in this survey.',
  ].forEach((line, i) => { const row = readme.addRow([line]); if (i === 0) row.font = { bold: true, size: 14 }; row.alignment = { wrapText: true } })

  const responses = wb.addWorksheet('Responses')
  const qs = report.questions
  responses.columns = [
    { header: 'Name', width: 24 }, { header: 'Email', width: 30 }, { header: 'Roster team', width: 14 }, { header: 'Role', width: 16 },
    { header: 'USA Lacrosse (tracker)', width: 20 }, { header: 'Status', width: 14 }, { header: 'Submitted', width: 12 },
    ...qs.map((q) => ({ header: topicLabel(q, cycle), width: q.kind === 'long_text' ? 50 : 22 })),
  ]
  const everyone = [...report.responded, ...report.outstanding]
  for (const a of everyone) {
    responses.addRow([
      a.coachName, displayEmail(a.coachEmail), teamLabel(a.team), a.profile.role ?? '', a.profile.certification ?? '',
      a.submittedAt ? 'Submitted' : a.startedAt ? 'Started' : 'Not started', a.submittedAt ? a.submittedAt.slice(0, 10) : '',
      ...qs.map((q) => a.submittedAt || a.startedAt ? (isVisible(q, a.answers) ? safe(answerText(a.answers[q.key])) : 'n/a') : ''),
    ])
  }
  styleHeader(responses)
  wrapAll(responses)

  const roster = wb.addWorksheet('Roster & Intentions')
  roster.columns = [
    { header: 'Coach', width: 24 }, { header: `${cycle.seasonLabel} team(s)`, width: 22 }, { header: cycle.nextSeasonLabel, width: 16 },
    { header: 'Fall Ball', width: 10 }, { header: 'Years', width: 8 }, { header: 'USA Lacrosse', width: 18 }, { header: 'Email', width: 30 }, { header: 'Notes', width: 60 },
  ]
  for (const r of report.roster) roster.addRow([r.name, safe(r.team), r.returning, r.fallBall, r.years, r.certification, r.email, safe(r.notes)])
  styleHeader(roster)
  wrapAll(roster)

  const glance = wb.addWorksheet('At a Glance')
  glance.columns = [{ header: 'Measure', width: 40 }, { header: 'Result', width: 90 }]
  for (const g of report.glance) glance.addRow([g.label, g.value])
  styleHeader(glance, 0)
  wrapAll(glance)

  const summary = wb.addWorksheet('Board Summary')
  summary.columns = [{ width: 120 }]
  ;[['What coaches told us', cycle.summaryThemes], ['Items for follow-up', cycle.summaryFollowUp]].forEach(([title, body]) => {
    summary.addRow([title]).font = { bold: true, size: 13 }
    for (const line of (body || '(not written yet)').split('\n')) summary.addRow([safe(line)]).alignment = { wrapText: true }
    summary.addRow([''])
  })

  const questions = wb.addWorksheet('Questions')
  questions.columns = [{ header: '#', width: 5 }, { header: 'Question', width: 70 }, { header: 'Type', width: 22 }, { header: 'Required', width: 10 }, { header: 'Options', width: 40 }, { header: 'Shown when', width: 30 }]
  qs.forEach((q, i) => questions.addRow([i + 1, fillLabel(q.label, cycle), QUESTION_KIND_LABELS[q.kind] ?? q.kind, q.required ? 'Yes' : 'No', q.options.join('; '), q.showIf ? `${q.showIf.key} is ${q.showIf.values.join(' or ')}` : 'Always']))
  styleHeader(questions, 0)
  wrapAll(questions)
  return wb
}
