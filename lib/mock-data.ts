/**
 * FAKE DATA ONLY. Every person, phone number, email, and document here is invented.
 * Swap these exports for database queries when wiring up a real backend.
 */
import { computeExpiry } from './compliance'
import { ROLES, type Coach, type Requirement, type Submission } from './types'

const ALL_ROLES = [...ROLES]

export const requirements: Requirement[] = [
  {
    id: 'pa-child-abuse',
    order: 1,
    name: 'PA Child Abuse History Clearance',
    type: 'File',
    appliesToRoles: ALL_ROLES,
    appliesToPay: ['Paid', 'Volunteer'],
    validity: { kind: 'years', years: 5 },
    required: true,
    active: true,
    tracksObtainedAs: true,
    help: 'Apply online through the PA Department of Human Services. It is free for volunteers. Results usually arrive by email within 14 days. Upload the PDF certificate.',
    helpUrl: 'https://www.compass.state.pa.us/cwis/public/home',
    helpLinkLabel: 'PA Child Welfare Portal',
  },
  {
    id: 'pa-state-police',
    order: 2,
    name: 'PA State Police Criminal Record Check',
    type: 'File',
    appliesToRoles: ALL_ROLES,
    appliesToPay: ['Paid', 'Volunteer'],
    validity: { kind: 'years', years: 5 },
    required: true,
    active: true,
    tracksObtainedAs: true,
    help: 'Request a check online through PATCH. Results are often instant. Save the certificate as a PDF and upload it here.',
    helpUrl: 'https://epatch.pa.gov/',
    helpLinkLabel: 'PA State Police PATCH',
  },
  {
    id: 'fbi-fingerprint',
    order: 3,
    name: 'FBI Fingerprint Check',
    type: 'File',
    appliesToRoles: ALL_ROLES,
    appliesToPay: ['Paid', 'Volunteer'],
    validity: { kind: 'years', years: 5 },
    required: true,
    active: true,
    tracksObtainedAs: true,
    allowsVolunteerAffidavit: true,
    help: 'Register with IdentoGO and get fingerprinted at a local site. Volunteers who have lived in PA for the past 10 years may sign a Volunteer Disclosure Statement instead. Paid coaches must get fingerprinted.',
    helpUrl: 'https://uenroll.identogo.com/',
    helpLinkLabel: 'IdentoGO fingerprinting',
  },
  {
    id: 'usal-membership',
    order: 4,
    name: 'USA Lacrosse Coach-Level Membership',
    type: 'Membership',
    appliesToRoles: ALL_ROLES,
    appliesToPay: ['Paid', 'Volunteer'],
    validity: { kind: 'membership' },
    required: true,
    active: true,
    help: 'Join or renew at the Coach level on the USA Lacrosse website. Enter your membership number and expiration date exactly as shown on your membership card.',
    helpUrl: 'https://www.usalacrosse.com/membership',
    helpLinkLabel: 'USA Lacrosse membership',
  },
  {
    id: 'usal-background',
    order: 5,
    name: 'USA Lacrosse Background Screen',
    type: 'File',
    appliesToRoles: ALL_ROLES,
    appliesToPay: ['Paid', 'Volunteer'],
    validity: { kind: 'years', years: 2 },
    required: true,
    active: true,
    dateOnlyAllowed: true,
    help: 'Log in to your USA Lacrosse account and complete the background screen. It must be renewed every 2 years. Upload the confirmation or enter the completion date.',
    helpUrl: 'https://www.usalacrosse.com/coaches',
    helpLinkLabel: 'USA Lacrosse coaching',
  },
  {
    id: 'usal-bronze',
    order: 6,
    name: 'USA Lacrosse Bronze Certification',
    type: 'File',
    appliesToRoles: ALL_ROLES,
    appliesToPay: ['Paid', 'Volunteer'],
    validity: { kind: 'one-time' },
    required: true,
    active: true,
    dateOnlyAllowed: true,
    help: 'Log in to your USA Lacrosse account and complete the free Bronze level online course. Bronze does not expire, so you only do it once. Upload the certificate or enter the completion date.',
    helpUrl: 'https://www.usalacrosse.com/coaches',
    helpLinkLabel: 'USA Lacrosse coaching',
  },
  {
    id: 'concussion',
    order: 7,
    name: 'Annual Concussion Training',
    type: 'Training',
    appliesToRoles: ALL_ROLES,
    appliesToPay: ['Paid', 'Volunteer'],
    validity: { kind: 'school-year' },
    required: true,
    active: true,
    help: 'Take the free CDC HEADS UP online course (about 30 minutes). It must be retaken every school year. Upload the completion certificate.',
    helpUrl: 'https://www.cdc.gov/heads-up/',
    helpLinkLabel: 'CDC HEADS UP training',
  },
  {
    id: 'sudden-cardiac',
    order: 8,
    name: 'Annual Sudden Cardiac Arrest Training',
    type: 'Training',
    appliesToRoles: ALL_ROLES,
    appliesToPay: ['Paid', 'Volunteer'],
    validity: { kind: 'school-year' },
    required: true,
    active: true,
    help: 'Complete a free sudden cardiac arrest awareness course online. It must be retaken every school year. Upload the completion certificate.',
    helpUrl: 'https://www.nfhslearn.com/courses/sudden-cardiac-arrest',
    helpLinkLabel: 'NFHS Learn course',
  },
  {
    id: 'handbook',
    order: 9,
    name: 'Coach Handbook Acknowledgment',
    type: 'Signature',
    appliesToRoles: ALL_ROLES,
    appliesToPay: ['Paid', 'Volunteer'],
    validity: { kind: 'one-time' },
    required: true,
    active: true,
    help: 'Read the SVLA Coach Handbook, then type your full name to sign that you have read and agree to follow it.',
    helpUrl: 'https://example.org/svla-coach-handbook',
    helpLinkLabel: 'SVLA Coach Handbook (sample)',
  },
  {
    id: 'contract',
    order: 10,
    name: 'Signed Coaching Contract',
    type: 'File',
    appliesToRoles: ALL_ROLES,
    appliesToPay: ['Paid'],
    validity: { kind: 'years', years: 1 },
    required: true,
    active: true,
    help: 'The board treasurer emails your contract each season. Sign it and upload the signed copy here.',
    helpUrl: 'mailto:treasurer@example.org',
    helpLinkLabel: 'Email the treasurer (sample)',
  },
  {
    id: 'cpr-first-aid',
    order: 11,
    name: 'CPR / First Aid Certification',
    type: 'Training',
    appliesToRoles: ['Head Coach'],
    appliesToPay: ['Paid', 'Volunteer'],
    validity: { kind: 'years', years: 2 },
    required: false,
    active: false,
    help: 'Optional. Take an in-person or blended CPR and First Aid course from a recognized provider.',
    helpUrl: 'https://www.redcross.org/take-a-class',
    helpLinkLabel: 'Red Cross classes',
  },
]

export const coaches: Coach[] = [
  { id: 'c1', name: 'Alex Rivera', team: '14U', role: 'Head Coach', pay: 'Paid', phone: '(555) 010-0101', email: 'alex.rivera@example.org', paResident10Years: true },
  { id: 'c2', name: 'Morgan Chen', team: '10U', role: 'Head Coach', pay: 'Volunteer', phone: '(555) 010-0102', email: 'morgan.chen@example.org', paResident10Years: true },
  { id: 'c3', name: 'Jordan Lee', team: 'HS-Varsity', role: 'Head Coach', pay: 'Paid', phone: '(555) 010-0103', email: 'jordan.lee@example.org', paResident10Years: true },
  { id: 'c4', name: 'Taylor Brooks', team: '12U', role: 'Assistant Coach', pay: 'Volunteer', phone: '(555) 010-0104', email: 'taylor.brooks@example.org', paResident10Years: false },
  { id: 'c5', name: 'Casey Nguyen', team: 'HS-JV', role: 'Coordinator', pay: 'Paid', phone: '(555) 010-0105', email: 'casey.nguyen@example.org', paResident10Years: false },
  { id: 'c6', name: 'Riley Patel', team: '8U', role: 'Head Coach', pay: 'Volunteer', phone: '(555) 010-0106', email: 'riley.patel@example.org', paResident10Years: true },
  { id: 'c7', name: 'Sam Okafor', team: '8U', role: 'Volunteer Assistant', pay: 'Volunteer', phone: '(555) 010-0107', email: 'sam.okafor@example.org', paResident10Years: true },
  { id: 'c8', name: 'Jamie Torres', team: '12U', role: 'Head Coach', pay: 'Paid', phone: '(555) 010-0108', email: 'jamie.torres@example.org', paResident10Years: true },
  { id: 'c9', name: 'Drew Kowalski', team: 'HS-Varsity', role: 'Assistant Coach', pay: 'Volunteer', phone: '(555) 010-0109', email: 'drew.kowalski@example.org', paResident10Years: false },
  { id: 'c10', name: 'Avery Johnson', team: '10U', role: 'Assistant Coach', pay: 'Volunteer', phone: '(555) 010-0110', email: 'avery.johnson@example.org', paResident10Years: false },
  { id: 'c11', name: 'Quinn Martinez', team: '14U', role: 'Assistant Coach', pay: 'Paid', phone: '(555) 010-0111', email: 'quinn.martinez@example.org', paResident10Years: true },
  { id: 'c12', name: 'Parker Williams', team: 'HS-JV', role: 'Volunteer Assistant', pay: 'Volunteer', phone: '(555) 010-0112', email: 'parker.williams@example.org', paResident10Years: true },
]

const reqById = Object.fromEntries(requirements.map((r) => [r.id, r]))
let seq = 0

function sub(
  coachId: string,
  requirementId: string,
  completedOn: string,
  extra: Partial<Submission> & { membershipExpiry?: string } = {},
): Submission {
  const { membershipExpiry, ...rest } = extra
  const req = reqById[requirementId]
  const status = rest.status ?? 'approved'
  return {
    id: `s${++seq}`,
    coachId,
    requirementId,
    status,
    completedOn,
    uploadedOn: rest.uploadedOn ?? completedOn,
    expiresOn: computeExpiry(req.validity, completedOn, membershipExpiry),
    fileName: req.type === 'Signature' || req.type === 'Membership' ? undefined : `${requirementId}-${coachId}.pdf`,
    reviewedOn: status === 'pending' ? undefined : rest.uploadedOn ?? completedOn,
    ...rest,
  }
}

/** Builds a fully approved record for a coach, with per-requirement overrides. */
function fullyCleared(
  coach: Coach,
  overrides: Record<string, Submission[] | null> = {},
): Submission[] {
  const obtainedAs = coach.pay === 'Paid' ? 'Employment' : 'Volunteer'
  const defaults: Record<string, () => Submission[]> = {
    'pa-child-abuse': () => [sub(coach.id, 'pa-child-abuse', '2024-03-12', { obtainedAs })],
    'pa-state-police': () => [sub(coach.id, 'pa-state-police', '2024-03-14', { obtainedAs })],
    'fbi-fingerprint': () => [sub(coach.id, 'fbi-fingerprint', '2024-04-02', { obtainedAs, fbiMethod: 'fingerprint' })],
    'usal-membership': () => [sub(coach.id, 'usal-membership', '2026-08-15', { membershipNumber: `US-${coach.id.toUpperCase()}-4471`, membershipExpiry: '2027-08-31' })],
    'usal-background': () => [sub(coach.id, 'usal-background', '2025-09-05')],
    'usal-bronze': () => [sub(coach.id, 'usal-bronze', '2025-09-05')],
    concussion: () => [sub(coach.id, 'concussion', '2026-08-20')],
    'sudden-cardiac': () => [sub(coach.id, 'sudden-cardiac', '2026-08-21')],
    handbook: () => [sub(coach.id, 'handbook', '2025-08-30', { signedName: coach.name })],
    contract: () => (coach.pay === 'Paid' ? [sub(coach.id, 'contract', '2026-08-01')] : []),
  }
  return Object.entries(defaults).flatMap(([reqId, make]) => {
    if (reqId in overrides) return overrides[reqId] ?? []
    return make()
  })
}

const byId = (id: string) => coaches.find((c) => c.id === id)!

export const submissions: Submission[] = [
  // Fully cleared
  ...fullyCleared(byId('c1')),
  ...fullyCleared(byId('c2'), {
    'fbi-fingerprint': [sub('c2', 'fbi-fingerprint', '2024-04-10', { obtainedAs: 'Volunteer', fbiMethod: 'affidavit' })],
  }),
  ...fullyCleared(byId('c11')),
  ...fullyCleared(byId('c12')),

  // Paid head coach missing FBI and contract (used as the demo "Coach View" user)
  ...fullyCleared(byId('c3'), { 'fbi-fingerprint': null, contract: null }),

  // Expiring within 60 days
  ...fullyCleared(byId('c4'), {
    'pa-child-abuse': [sub('c4', 'pa-child-abuse', '2021-11-20', { obtainedAs: 'Volunteer' })],
  }),
  ...fullyCleared(byId('c5'), {
    'usal-membership': [sub('c5', 'usal-membership', '2025-11-30', { membershipNumber: 'US-C5-2093', membershipExpiry: '2026-11-30' })],
  }),

  // Expired: last season's concussion training was never renewed
  ...fullyCleared(byId('c6'), {
    concussion: [sub('c6', 'concussion', '2025-08-15')],
  }),

  // Awaiting review (3 uploads)
  ...fullyCleared(byId('c7'), {
    handbook: [sub('c7', 'handbook', '2026-10-08', { status: 'pending', uploadedOn: '2026-10-08', signedName: 'Sam Okafor' })],
  }),
  ...fullyCleared(byId('c8'), {
    'pa-child-abuse': [sub('c8', 'pa-child-abuse', '2024-02-01', { obtainedAs: 'Volunteer' })],
    'fbi-fingerprint': [sub('c8', 'fbi-fingerprint', '2026-10-06', { status: 'pending', uploadedOn: '2026-10-06', obtainedAs: 'Employment', fbiMethod: 'fingerprint' })],
  }),
  ...fullyCleared(byId('c9'), {
    concussion: [sub('c9', 'concussion', '2026-10-09', { status: 'pending', uploadedOn: '2026-10-09' })],
  }),

  // Brand-new coach with most items outstanding, including a rejected upload
  sub('c10', 'handbook', '2026-09-20', { signedName: 'Avery Johnson' }),
  sub('c10', 'pa-state-police', '2026-09-22', {
    status: 'rejected',
    uploadedOn: '2026-09-22',
    obtainedAs: 'Volunteer',
    reviewComment: 'The certificate is cut off at the bottom. Please upload the full page.',
  }),
]

/** The coach whose record is shown in "Viewing as: Coach" mode. */
export const DEMO_COACH_ID = 'c3'
