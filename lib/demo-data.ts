import { coaches as examples, requirements } from './mock-data'
import { applicableRequirements, computeExpiry, needsEmploymentClearances, TODAY } from './compliance'
import type { Submission } from './types'

export { requirements }
export const coaches = ['c1', 'c3', 'c4', 'c6', 'c7'].map(id => examples.find(coach => coach.id === id)!)
const shiftDays = (days: number) => new Date(Date.parse(`${TODAY}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
export const submissions: Submission[] = coaches.flatMap(coach => applicableRequirements(requirements, coach).flatMap(req => {
  if (coach.id === 'c3' && ['fbi-fingerprint', 'contract'].includes(req.id)) return []
  const pending = coach.id === 'c7' && req.id === 'handbook'
  const expiresOn = coach.id === 'c4' && req.id === 'usal-membership' ? shiftDays(30)
    : coach.id === 'c6' && req.id === 'usal-membership' ? shiftDays(-5)
    : computeExpiry(req.validity, TODAY, shiftDays(365))
  return [{
    id: `demo-${coach.id}-${req.id}`, coachId: coach.id, requirementId: req.id,
    completedOn: req.id === 'usal-membership' ? shiftDays(-30) : TODAY,
    uploadedOn: TODAY, expiresOn, status: pending ? 'pending' : 'approved',
    reviewedOn: pending ? undefined : TODAY,
    obtainedAs: req.tracksObtainedAs ? needsEmploymentClearances(coach) ? 'Employment' : 'Volunteer' : undefined,
    fbiMethod: req.allowsVolunteerAffidavit ? 'fingerprint' : undefined,
    signedName: req.type === 'Signature' ? coach.name : undefined,
    membershipNumber: req.type === 'Membership' ? `DEMO-${coach.id}` : undefined,
    fileName: req.type === 'File' || req.type === 'Training' ? 'Sample record — no real certificate' : undefined,
  } satisfies Submission]
}))
