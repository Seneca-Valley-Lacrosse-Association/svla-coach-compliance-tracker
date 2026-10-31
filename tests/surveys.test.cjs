const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  module._compile(outputText, filename)
}
const { emailDueToday, validateAnswers, isVisible, initialAnswers, addDays } = require('../lib/surveys.ts')
const { buildReport, parseSummary } = require('../lib/survey-report.ts')

const settings = { dueOn: '2027-07-06', closeOn: null, reminderEveryDays: 4, remindDayBeforeDue: true, remindAfterDue: true, afterDueDays: 7, maxReminders: 4 }
const fresh = { invitedAt: null, remindersSent: 0, lastEmailedOn: null, submittedAt: null }

function simulate(s, start, end) {
  const coach = { ...fresh }
  const log = []
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const kind = emailDueToday(s, coach, day)
    if (!kind) continue
    log.push(`${day} ${kind}`)
    if (kind === 'invite') coach.invitedAt = `${day}T13:00:00Z`
    if (kind === 'reminder' || kind === 'overdue') coach.remindersSent++
    coach.lastEmailedOn = day
  }
  return log
}

test('a coach who never responds gets the invite, spaced reminders, due-tomorrow, then past-due reminders', () => {
  assert.deepEqual(simulate(settings, '2027-06-22', '2027-07-31'), [
    '2027-06-22 invite', '2027-06-26 reminder', '2027-06-30 reminder', '2027-07-04 reminder',
    '2027-07-05 due_tomorrow', '2027-07-09 overdue',
  ])
})
test('the maximum caps regular reminders but not the due-tomorrow reminder', () => {
  const log = simulate({ ...settings, maxReminders: 1 }, '2027-06-22', '2027-07-31')
  assert.deepEqual(log, ['2027-06-22 invite', '2027-06-26 reminder', '2027-07-05 due_tomorrow'])
})
test('reminders can be turned off entirely', () => {
  const log = simulate({ ...settings, reminderEveryDays: 0, remindDayBeforeDue: false, remindAfterDue: false }, '2027-06-22', '2027-07-31')
  assert.deepEqual(log, ['2027-06-22 invite'])
})
test('nobody is emailed after submitting, twice in a day, or after the close date', () => {
  assert.equal(emailDueToday(settings, { ...fresh, submittedAt: '2027-06-23T00:00:00Z' }, '2027-06-24'), null)
  assert.equal(emailDueToday(settings, { ...fresh, invitedAt: '2027-06-22T13:00:00Z', lastEmailedOn: '2027-07-05' }, '2027-07-05'), null)
  assert.equal(emailDueToday({ ...settings, closeOn: '2027-07-06' }, fresh, '2027-07-07'), null)
})

const questions = [
  { key: 'returning', label: 'Returning?', help: '', kind: 'single_choice', options: ['Yes', 'No', 'Unsure'], required: true, showIf: null, prefill: null },
  { key: 'next_teams', label: 'Which teams?', help: '', kind: 'multi_choice', options: ['8U', '10U'], required: true, showIf: { key: 'returning', values: ['Yes', 'Unsure'] }, prefill: null },
  { key: 'years', label: 'Years', help: '', kind: 'number', options: [], required: true, showIf: null, prefill: null },
  { key: 'team', label: 'Team', help: '', kind: 'short_text', options: [], required: false, showIf: null, prefill: 'team' },
]
test('required questions are enforced only when submitting, and hidden questions are dropped', () => {
  assert.deepEqual(validateAnswers(questions, {}, false).errors, {})
  const submit = validateAnswers(questions, { returning: 'Yes' }, true)
  assert.ok(submit.errors.next_teams && submit.errors.years)
  const hidden = validateAnswers(questions, { returning: 'No', next_teams: ['8U'], years: '3' }, true)
  assert.deepEqual(hidden.errors, {})
  assert.equal(hidden.answers.next_teams, undefined)
  assert.equal(hidden.answers.years, 3)
})
test('answers outside the listed options are rejected', () => {
  assert.ok(validateAnswers(questions, { returning: 'Maybe' }, false).errors.returning)
  assert.deepEqual(validateAnswers(questions, { returning: 'Yes', next_teams: ['8U', 'Varsity'] }, false).answers.next_teams, ['8U'])
  assert.ok(validateAnswers(questions, { years: 'lots' }, false).errors.years)
})
test('conditional questions and tracker prefill', () => {
  assert.equal(isVisible(questions[1], { returning: 'Unsure' }), true)
  assert.equal(isVisible(questions[1], { returning: 'No' }), false)
  assert.equal(initialAnswers(questions, {}, 'HS-JV').team, 'HS JV')
  assert.equal(initialAnswers(questions, { team: 'Edited' }, 'HS-JV').team, 'Edited')
})
test('the report counts submissions by program and lists outstanding coaches', () => {
  const cycle = { id: 'c', title: 'T', seasonLabel: '2027', nextSeasonLabel: '2027/2028', questions, isHistorical: false, summaryThemes: '', summaryFollowUp: '' }
  const base = { cycleId: 'c', coachId: null, profile: { certification: 'Bronze' }, invitedAt: 'x', inviteFailed: false, remindersSent: 0, lastEmailedOn: null, startedAt: null }
  const report = buildReport(cycle, [
    { ...base, id: '1', coachName: 'A', coachEmail: 'a@x.org', team: '10U', answers: { returning: 'Yes', next_teams: ['10U'], years: 2 }, submittedAt: '2027-06-25T00:00:00Z' },
    { ...base, id: '2', coachName: 'B', coachEmail: 'b@x.org', team: 'HS-JV', answers: { returning: 'No', years: 12 }, submittedAt: '2027-06-28T00:00:00Z' },
    { ...base, id: '3', coachName: 'C', coachEmail: 'c@x.org', team: '8U', answers: {}, submittedAt: null },
  ])
  assert.equal(report.glance[0].value, '2 of 3 sent (1 youth, 1 high school)')
  assert.match(report.glance.find(g => g.label.startsWith('Interested in coaching')).value, /1 Yes, 1 No .*not returning: B/)
  assert.deepEqual(report.outstanding.map(a => a.coachName), ['C'])
  assert.equal(report.roster[0].notes, 'Prefers: 10U.')
})
test('summary text supports bullets and bold', () => {
  const blocks = parseSummary('- **Bold lead.** rest\n- second\n\nPlain para')
  assert.equal(blocks.length, 3)
  assert.deepEqual(blocks[0].parts, [{ text: 'Bold lead.', bold: true }, { text: ' rest', bold: false }])
  assert.equal(blocks[2].type, 'para')
})
