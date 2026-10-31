const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  module._compile(outputText, filename)
}
const { coaches, requirements, submissions } = require('../lib/demo-data.ts')
const { summarizeCoach, applicableRequirements, canUseAffidavit, computeExpiry } = require('../lib/compliance.ts')
const { mutationSchema } = require('../lib/validation.ts')

test('board demo contains exactly five coaches in five distinct stages', () => {
  const summaries = coaches.map(coach => summarizeCoach(coach, requirements, submissions))
  assert.equal(summaries.length, 5)
  assert.deepEqual(summaries.map(s => s.hasPending ? 'awaiting-review' : s.status), ['cleared', 'incomplete', 'expiring', 'expired', 'awaiting-review'])
  assert.ok(coaches.every(c => c.email.endsWith('@example.org')))
  assert.ok(submissions.every(s => !s.filePath))
})
test('paid coaches need contracts and cannot use volunteer affidavits', () => {
  const paid = coaches.find(c => c.pay === 'Paid')
  const volunteer = coaches.find(c => c.pay === 'Volunteer')
  assert.ok(applicableRequirements(requirements, paid).some(r => r.id === 'contract'))
  assert.ok(!applicableRequirements(requirements, volunteer).some(r => r.id === 'contract'))
  assert.equal(canUseAffidavit(paid).allowed, false)
})
test('pending evidence does not clear an unapproved requirement', () => {
  const pending = summarizeCoach(coaches.find(c => c.id === 'c7'), requirements, submissions)
  assert.equal(pending.cleared, false)
  assert.equal(pending.items.find(i => i.requirement.id === 'handbook').satisfied, false)
})
test('school-year training expires on the correct June 30', () => {
  assert.equal(computeExpiry({ kind: 'school-year' }, '2026-06-30'), '2026-06-30')
  assert.equal(computeExpiry({ kind: 'school-year' }, '2026-07-01'), '2027-06-30')
})
test('mutations reject untrusted URLs and invalid coach fields', () => {
  assert.equal(mutationSchema.safeParse({ action: 'updateResource', id: 'handbook', input: { help: 'Read this', helpUrl: 'javascript:alert(1)', helpLinkLabel: 'Document' } }).success, false)
  assert.equal(mutationSchema.safeParse({ action: 'addCoach', input: { ...coaches[0], email: 'bad-email' } }).success, false)
})
test('level tags hide requirements that do not apply to a coach\'s program', () => {
  const youthCoach = { ...coaches[0], team: '10U', role: 'Head Coach', pay: 'Volunteer' }
  const hsCoach = { ...youthCoach, team: 'HS-Varsity' }
  const base = requirements.find(r => r.id === 'handbook')
  const youthOnly = { ...base, id: 'youth-only', level: 'youth' }
  const hsOnly = { ...base, id: 'hs-only', level: 'high-school' }
  const both = { ...base, id: 'both-level', level: 'both' }
  const ids = coach => applicableRequirements([youthOnly, hsOnly, both, base], coach).map(r => r.id)
  assert.deepEqual(ids(youthCoach).sort(), ['both-level', 'handbook', 'youth-only'])
  assert.deepEqual(ids(hsCoach).sort(), ['both-level', 'handbook', 'hs-only'])
})
test('FBI: the affidavit is youth-only for 10-year resident volunteers', () => {
  const { eligibilityIssue } = require('../lib/compliance.ts')
  const hsVolunteer = { ...coaches[0], team: 'HS-JV', role: 'Assistant Coach', pay: 'Volunteer', paResident10Years: true }
  const youthVolunteer = { ...hsVolunteer, team: '12U' }
  const req = requirements.find(r => r.id === 'fbi-fingerprint')
  assert.equal(canUseAffidavit(hsVolunteer).allowed, false)
  assert.equal(canUseAffidavit(youthVolunteer).allowed, true)
  assert.equal(canUseAffidavit({ ...youthVolunteer, paResident10Years: false }).allowed, false)
  assert.equal(canUseAffidavit({ ...youthVolunteer, pay: 'Paid' }).allowed, false)
  assert.equal(eligibilityIssue(youthVolunteer, req, { fbiCheck: 'affidavit' }), null)
  assert.ok(eligibilityIssue(hsVolunteer, req, { fbiCheck: 'affidavit' }))
  // High school accepts only the district check, paid or volunteer.
  assert.equal(eligibilityIssue(hsVolunteer, req, { fbiCheck: 'school-employee' }), null)
  assert.ok(eligibilityIssue(hsVolunteer, req, { fbiCheck: 'dhs-volunteer' }))
  // Older uploads without a check type: a volunteer fingerprint is read as the DHS volunteer check.
  assert.equal(eligibilityIssue(youthVolunteer, req, { obtainedAs: 'Volunteer', fbiMethod: 'fingerprint' }), null)
})
test('FBI: which check counts for each pay status and program', () => {
  const { acceptedFbiChecks } = require('../lib/compliance.ts')
  const v = { ...coaches[0], pay: 'Volunteer', paResident10Years: false }
  const p = { ...v, pay: 'Paid' }
  assert.deepEqual(acceptedFbiChecks(v, 'youth'), ['dhs-volunteer', 'dhs-employee'])
  assert.deepEqual(acceptedFbiChecks({ ...v, paResident10Years: true }, 'youth'), ['dhs-volunteer', 'dhs-employee', 'affidavit'])
  assert.deepEqual(acceptedFbiChecks(v, 'high-school'), ['school-employee'])
  assert.deepEqual(acceptedFbiChecks(p, 'youth'), ['dhs-employee'])
  assert.deepEqual(acceptedFbiChecks(p, 'high-school'), ['school-employee'])
})
test('FBI: a volunteer in both programs needs the school check plus a youth DHS check or the affidavit', () => {
  const req = requirements.filter(r => r.id === 'fbi-fingerprint')
  const coach = { ...coaches[0], id: 'x1', team: 'Volunteer-Youth/HS', role: 'Volunteer Assistant', pay: 'Volunteer', paResident10Years: true }
  const mk = (fbiCheck, id = 'f1') => ({ id, coachId: 'x1', requirementId: 'fbi-fingerprint', status: 'approved', uploadedOn: '2026-10-01', completedOn: '2026-10-01', expiresOn: '2031-10-01', fbiCheck })
  assert.deepEqual(summarizeCoach(coach, req, [mk('dhs-volunteer')]).programs.map(p => p.cleared), [true, false])
  const school = summarizeCoach(coach, req, [mk('school-employee')])
  assert.deepEqual(school.programs.map(p => p.cleared), [false, true])
  assert.match(school.items[0].issue, /^Youth: /)
  const both = summarizeCoach(coach, req, [mk('affidavit', 'a'), mk('school-employee', 'b')])
  assert.deepEqual(both.programs.map(p => p.cleared), [true, true])
  assert.equal(both.cleared, true)
})
test('FBI: a paid coach in both programs needs both the DHS employee and the school employee checks', () => {
  const req = requirements.filter(r => r.id === 'fbi-fingerprint')
  const coach = { ...coaches[0], id: 'x2', team: 'Board-Youth/HS', role: 'Coordinator', pay: 'Paid', paResident10Years: true }
  const mk = (fbiCheck, id) => ({ id, coachId: 'x2', requirementId: 'fbi-fingerprint', status: 'approved', uploadedOn: '2026-10-01', completedOn: '2026-10-01', expiresOn: '2031-10-01', fbiCheck })
  const youthOnly = summarizeCoach(coach, req, [mk('dhs-employee', 'a')])
  assert.deepEqual(youthOnly.programs.map(p => p.cleared), [true, false])
  assert.equal(youthOnly.items[0].status, 'invalid')
  const schoolOnly = summarizeCoach(coach, req, [mk('school-employee', 'b')])
  assert.deepEqual(schoolOnly.programs.map(p => p.cleared), [false, true])
  assert.match(schoolOnly.items[0].issue, /^Youth: /)
  const both = summarizeCoach(coach, req, [mk('dhs-employee', 'a'), mk('school-employee', 'b')])
  assert.deepEqual(both.programs.map(p => p.cleared), [true, true])
  assert.equal(both.items[0].satisfied, true)
  // A DHS volunteer check never counts for a paid coach.
  assert.deepEqual(summarizeCoach(coach, req, [mk('dhs-volunteer', 'c')]).programs.map(p => p.cleared), [false, false])
})
test('teams roll up to youth, high school or both', () => {
  const { coachPrograms } = require('../lib/compliance.ts')
  const on = (team, extra = {}) => ({ ...coaches[0], team, ...extra })
  assert.deepEqual(coachPrograms(on('12U')), ['youth'])
  assert.deepEqual(coachPrograms(on('HS-JV')), ['high-school'])
  assert.deepEqual(coachPrograms(on('Board-Youth/HS')), ['youth', 'high-school'])
  assert.deepEqual(coachPrograms(on('Board-Youth')), ['youth'])
  assert.deepEqual(coachPrograms(on('Board-HS')), ['high-school'])
  assert.deepEqual(coachPrograms(on('Volunteer-Youth/HS')), ['youth', 'high-school'])
  assert.deepEqual(coachPrograms(on('Volunteer-Youth')), ['youth'])
  assert.deepEqual(coachPrograms(on('Volunteer-HS')), ['high-school'])
  assert.deepEqual(coachPrograms(on('HS-Varsity', { alsoCoachesYouth: true })), ['youth', 'high-school'])
})
test('a program level decides which coaches get a requirement', () => {
  const base = requirements.find(r => r.id === 'handbook')
  const hsOnly = { ...base, id: 'hs-only', level: 'high-school' }
  const coachOn = (team, extra = {}) => ({ ...coaches[0], team, role: 'Head Coach', pay: 'Volunteer', ...extra })
  const ids = c => applicableRequirements([hsOnly], c).map(r => r.id)
  assert.deepEqual(ids(coachOn('Board-Youth/HS')), ['hs-only'])
  assert.deepEqual(ids(coachOn('Volunteer-HS')), ['hs-only'])
  assert.deepEqual(ids(coachOn('10U')), [])
  assert.deepEqual(ids(coachOn('10U', { alsoCoachesYouth: true })), [])
})
test('each coach gets a YES/NO box per program and unassigned programs are never cleared', () => {
  const { scopeSummary, readyToFloat } = require('../lib/compliance.ts')
  const youthCoach = { ...coaches[0], team: '10U' }
  const s = summarizeCoach(youthCoach, requirements, submissions)
  assert.deepEqual(s.programs.map(p => p.program), ['youth', 'high-school'])
  assert.equal(s.programs[1].assigned, false)
  assert.equal(s.programs[1].cleared, false)
  assert.equal(scopeSummary(s, 'high-school'), null)
  assert.ok(scopeSummary(s, 'youth'))
  assert.equal(s.programs[0].cleared, s.programs[0].assigned && s.programs[0].meetsRequirements)
  const hs = summarizeCoach({ ...coaches[0], team: 'HS-JV' }, requirements, submissions)
  const youth = hs.programs[0]
  assert.equal(readyToFloat([hs]).length, youth.meetsRequirements ? 1 : 0)
})

test('a requirement can be renamed through updateResource', () => {
  const input = { help: 'Read this', helpUrl: '', helpLinkLabel: '', name: 'New name' }
  assert.equal(mutationSchema.safeParse({ action: 'updateResource', id: 'handbook', input }).success, true)
  assert.equal(mutationSchema.safeParse({ action: 'updateResource', id: 'handbook', input: { ...input, name: '  ' } }).success, false)
})

test('a started requirement shows as in progress but never counts toward clearance', () => {
  const { progress } = require('../lib/demo-data.ts')
  const withProgress = summarizeCoach(coaches.find(c => c.id === 'c3'), requirements, submissions, progress)
  const without = summarizeCoach(coaches.find(c => c.id === 'c3'), requirements, submissions)
  const item = withProgress.items.find(i => i.requirement.id === 'fbi-fingerprint')
  assert.equal(item.status, 'in-progress')
  assert.equal(item.satisfied, false)
  assert.equal(withProgress.cleared, false)
  assert.equal(withProgress.satisfiedCount, without.satisfiedCount)
  assert.equal(withProgress.hasInProgress, true)
  assert.equal(without.hasInProgress, false)
  assert.equal(without.items.find(i => i.requirement.id === 'fbi-fingerprint').status, 'not-started')
})
test('started markers do not override pending, approved or rejected states', () => {
  const coach = coaches.find(c => c.id === 'c7')
  const marker = [{ coachId: 'c7', requirementId: 'handbook', startedOn: '2026-01-01' }, { coachId: 'c7', requirementId: 'concussion', startedOn: '2026-01-01' }]
  const summary = summarizeCoach(coach, requirements, submissions, marker)
  assert.equal(summary.items.find(i => i.requirement.id === 'handbook').status, 'pending')
  assert.equal(summary.items.find(i => i.requirement.id === 'concussion').status, 'approved')
  assert.equal(summary.hasInProgress, false)
})
test('days in progress and overdue follow-ups are computed from the start and follow-up dates', () => {
  const { daysInProgress, followUpOverdue, TODAY } = require('../lib/compliance.ts')
  const shift = d => new Date(Date.parse(`${TODAY}T12:00:00Z`) + d * 86400000).toISOString().slice(0, 10)
  assert.equal(daysInProgress({ startedOn: shift(-12) }), 12)
  assert.equal(daysInProgress({ startedOn: TODAY }), 0)
  assert.equal(followUpOverdue({ startedOn: shift(-12), followUpOn: shift(-1) }), true)
  assert.equal(followUpOverdue({ startedOn: shift(-12), followUpOn: shift(5) }), false)
  assert.equal(followUpOverdue({ startedOn: shift(-12) }), false)
})
test('in-progress mutations validate ids, dates and note length', () => {
  const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
  const ok = { action: 'markInProgress', input: { coachId: id, requirementId: 'pa-child-abuse', startedOn: '2026-10-14', followUpOn: '2026-11-01', note: 'Applied online' } }
  assert.equal(mutationSchema.safeParse(ok).success, true)
  assert.equal(mutationSchema.safeParse({ ...ok, input: { ...ok.input, coachId: 'nope' } }).success, false)
  assert.equal(mutationSchema.safeParse({ ...ok, input: { ...ok.input, startedOn: 'yesterday' } }).success, false)
  assert.equal(mutationSchema.safeParse({ ...ok, input: { ...ok.input, note: 'x'.repeat(301) } }).success, false)
  assert.equal(mutationSchema.safeParse({ action: 'clearInProgress', coachId: id, requirementId: 'pa-child-abuse' }).success, true)
})

test('employment clearances follow SVLA-wide pay only: Seneca Valley treats high school volunteers as volunteers', () => {
  const { needsEmploymentClearances } = require('../lib/compliance.ts')
  const on = team => ({ ...coaches[0], team, pay: 'Volunteer' })
  for (const team of ['HS-JV', 'HS-Varsity', 'Volunteer-HS', 'Board-HS', 'Board-Youth/HS', 'Volunteer-Youth/HS', 'Volunteer-Youth', '10U'])
    assert.equal(needsEmploymentClearances(on(team)), false)
  assert.equal(needsEmploymentClearances({ ...on('10U'), pay: 'Paid' }), true)
  assert.equal(needsEmploymentClearances({ ...on('HS-JV'), pay: 'Paid' }), true)
})

test('badge role shows only Head Coach or Coach', () => {
  const { badgeRole } = require('../lib/compliance.ts')
  assert.equal(badgeRole({ ...coaches[0], role: 'Head Coach' }), 'Head Coach')
  for (const role of ['Coordinator', 'Assistant Coach', 'Volunteer Assistant']) assert.equal(badgeRole({ ...coaches[0], role }), 'Coach')
})
test('badge valid-through is the soonest expiry among cleared programs, and none when not cleared', () => {
  const { badgeValidThrough } = require('../lib/compliance.ts')
  const mk = (expiries, cleared = true) => ({ programs: [{ cleared, items: expiries.map(d => ({ approved: d ? { expiresOn: d } : null })) }, { cleared: false, items: [{ approved: { expiresOn: '2020-01-01' } }] }] })
  assert.equal(badgeValidThrough(mk(['2028-05-01', '2027-06-30', null])), '2027-06-30')
  assert.equal(badgeValidThrough(mk(['2027-06-30'], false)), null)
  assert.match(badgeValidThrough(mk([null])), /^\d{4}-06-30$/)
})

test('off-season box: three PA clearances plus USA Lacrosse membership, for every coach', () => {
  const { requirementInOffSeason } = require('../lib/compliance.ts')
  assert.deepEqual(requirements.filter(requirementInOffSeason).map(r => r.id).sort(), ['fbi-fingerprint', 'pa-child-abuse', 'pa-state-police', 'usal-membership'])
  const coach = { ...coaches[0], id: 'x3', team: 'HS-JV', role: 'Assistant Coach', pay: 'Volunteer', paResident10Years: true }
  const mk = (requirementId, extra = {}, id = requirementId) => ({ id, coachId: 'x3', requirementId, status: 'approved', uploadedOn: '2026-10-01', completedOn: '2026-10-01', expiresOn: '2031-10-01', ...extra })
  const base = [mk('pa-child-abuse', { obtainedAs: 'Volunteer' }), mk('pa-state-police', { obtainedAs: 'Volunteer' }), mk('usal-membership', { membershipNumber: 'X' })]
  // A high school coach with only the school FBI check is not cleared for SVLA camps: the state law for SVLA's own programs needs a DHS check.
  assert.equal(summarizeCoach(coach, requirements, [...base, mk('fbi-fingerprint', { fbiCheck: 'school-employee' })]).offSeason.cleared, false)
  const ok = summarizeCoach(coach, requirements, [...base, mk('fbi-fingerprint', { fbiCheck: 'affidavit' })])
  assert.equal(ok.offSeason.cleared, true)
  assert.equal(ok.programs.find(p => p.program === 'high-school').cleared, false)
  // The board can opt a requirement out.
  const noMembership = requirements.map(r => r.id === 'usal-membership' ? { ...r, offSeason: false } : r)
  assert.equal(summarizeCoach(coach, noMembership, base.slice(0, 2).concat(mk('fbi-fingerprint', { fbiCheck: 'affidavit' }))).offSeason.cleared, true)
})
