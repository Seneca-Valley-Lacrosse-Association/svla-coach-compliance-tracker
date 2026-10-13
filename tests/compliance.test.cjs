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
