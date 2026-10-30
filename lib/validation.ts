import { z } from 'zod'
import { LEVELS, PAY_STATUSES, ROLES, TEAMS } from './types'

export const coachSchema = z.object({
  name: z.string().trim().min(1).max(120), email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(40), team: z.enum(TEAMS), role: z.enum(ROLES), pay: z.enum(PAY_STATUSES),
  paResident10Years: z.boolean(), alsoCoachesYouth: z.boolean().optional(),
})
export const selfRegisterSchema = coachSchema.omit({ email: true, pay: true, alsoCoachesYouth: true })
export const resourceSchema = z.object({
  help: z.string().trim().min(1).max(3000),
  helpUrl: z.string().trim().max(2000).refine(v => !v || /^https:\/\//.test(v) && URL.canParse(v), 'Use a valid HTTPS link.'),
  helpLinkLabel: z.string().trim().max(150),
})
const httpsUrl = z.string().trim().max(2000).refine(v => !v || /^https:\/\//.test(v) && URL.canParse(v), 'Use a valid HTTPS link.')
export const reasonSchema = z.object({
  level: z.enum(LEVELS), why: z.string().trim().max(1500),
  source: z.string().trim().max(300), sourceUrl: httpsUrl,
})
export const requirementSchema = resourceSchema.extend(reasonSchema.partial().shape).extend({
  name: z.string().trim().min(1).max(200), type: z.enum(['File', 'Training', 'Membership', 'Signature']),
  appliesToRoles: z.array(z.enum(ROLES)).min(1).max(4), appliesToPay: z.array(z.enum(PAY_STATUSES)).min(1).max(2),
  validity: z.discriminatedUnion('kind', [z.object({ kind: z.literal('years'), years: z.number().int().min(1).max(10) }), z.object({ kind: z.literal('school-year') }), z.object({ kind: z.literal('one-time') }), z.object({ kind: z.literal('membership') })]),
  required: z.boolean(), active: z.boolean(), requiresReview: z.boolean().optional(), tracksObtainedAs: z.boolean().optional(),
  allowsVolunteerAffidavit: z.boolean().optional(), dateOnlyAllowed: z.boolean().optional(),
}).refine(r => (r.type === 'Membership') === (r.validity.kind === 'membership'), 'Membership requirements must use membership-term validity.')
export const uploadSchema = z.object({
  coachId: z.uuid(), requirementId: z.string().min(1).max(100), completedOn: z.iso.date(),
  filePath: z.string().max(400).optional(), fileName: z.string().max(255).optional(),
  obtainedAs: z.enum(['Volunteer', 'Employment']).optional(), fbiMethod: z.enum(['fingerprint', 'affidavit']).optional(),
  membershipNumber: z.string().trim().max(150).optional(), membershipExpiry: z.iso.date().optional(),
  signedName: z.string().trim().max(120).optional(), agreed: z.boolean().optional(),
})
export const progressSchema = z.object({
  coachId: z.uuid(), requirementId: z.string().min(1).max(100), startedOn: z.iso.date(),
  followUpOn: z.iso.date().optional(), note: z.string().trim().max(300).optional(),
})
export const mutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('addCoach'), input: coachSchema }),
  z.object({ action: z.literal('addRequirement'), input: requirementSchema }),
  z.object({ action: z.literal('setRequirementActive'), id: z.string().max(100), active: z.boolean() }),
  z.object({ action: z.literal('setRequirementReview'), id: z.string().max(100), requiresReview: z.boolean() }),
  z.object({ action: z.literal('updateResource'), id: z.string().max(100), input: resourceSchema.extend(reasonSchema.partial().shape).extend({ name: z.string().trim().min(1).max(200).optional(), appliesToRoles: z.array(z.enum(ROLES)).min(1).max(4).optional(), appliesToPay: z.array(z.enum(PAY_STATUSES)).min(1).max(2).optional() }) }),
  z.object({ action: z.literal('submitUpload'), input: uploadSchema }),
  z.object({ action: z.literal('markInProgress'), input: progressSchema }),
  z.object({ action: z.literal('clearInProgress'), coachId: z.uuid(), requirementId: z.string().min(1).max(100) }),
  z.object({ action: z.literal('reviewCoach'), id: z.uuid(), decision: z.enum(['approved', 'declined']), pay: z.enum(PAY_STATUSES) }),
  z.object({ action: z.literal('removeAccount'), email: z.string().trim().toLowerCase().email().max(254) }),
  z.object({ action: z.literal('deleteCoach'), id: z.uuid() }),
  z.object({ action: z.literal('removeSubmission'), id: z.uuid() }),
  z.object({ action: z.literal('archiveCoach'), id: z.uuid() }),
  z.object({ action: z.literal('restoreCoach'), id: z.uuid() }),
  z.object({ action: z.literal('editSubmissionDates'), id: z.uuid(), completedOn: z.iso.date(), membershipExpiry: z.iso.date().optional(), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal('inviteCoach'), id: z.uuid(), deliver: z.enum(['email', 'link']) }),
  z.object({ action: z.literal('inviteBoardMember'), email: z.string().trim().toLowerCase().email().max(254), deliver: z.enum(['email', 'link']) }),
  z.object({ action: z.literal('inviteCoaches'), ids: z.array(z.uuid()).min(1).max(50) }),
  z.object({ action: z.literal('registerSelf'), input: selfRegisterSchema }),
  z.object({ action: z.literal('editCoach'), id: z.uuid(), input: coachSchema.omit({ email: true }) }),
  z.object({ action: z.literal('setViewAccess'), role: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/), view: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/), level: z.enum(['none', 'view', 'manage']) }),
  z.object({ action: z.literal('setStaffAccess'), email: z.string().trim().toLowerCase().email().max(254), role: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/).nullable(), teams: z.array(z.enum(TEAMS)).max(TEAMS.length) }),
  z.object({ action: z.literal('startPreview'), email: z.string().trim().toLowerCase().email().max(254) }),
  z.object({ action: z.literal('addBoardMember'), email: z.string().trim().toLowerCase().email().max(254) }),
  z.object({ action: z.literal('removeBoardMember'), email: z.string().trim().toLowerCase().email().max(254) }),
  z.object({ action: z.literal('reviewSubmission'), id: z.uuid(), decision: z.enum(['approved', 'rejected']), comment: z.string().trim().max(2000).optional() }),
])
