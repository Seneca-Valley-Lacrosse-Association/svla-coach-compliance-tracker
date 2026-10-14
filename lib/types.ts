export const TEAMS = ['8U', '10U', '12U', '14U', 'HS-JV', 'HS-Varsity'] as const
export type Team = (typeof TEAMS)[number]

export const ROLES = [
  'Head Coach',
  'Coordinator',
  'Assistant Coach',
  'Volunteer Assistant',
] as const
export type Role = (typeof ROLES)[number]

export const PAY_STATUSES = ['Paid', 'Volunteer'] as const
export type PayStatus = (typeof PAY_STATUSES)[number]

export type RequirementType = 'File' | 'Training' | 'Membership' | 'Signature'

export type Validity =
  | { kind: 'years'; years: number }
  | { kind: 'school-year' }
  | { kind: 'one-time' }
  | { kind: 'membership' }

/** Which SVLA programs a requirement comes from. */
export const LEVELS = ['youth', 'high-school', 'both'] as const
export type Level = (typeof LEVELS)[number]
export const LEVEL_LABELS: Record<Level, string> = {
  youth: 'Youth programs',
  'high-school': 'High school programs',
  both: 'Youth and high school',
}

export interface Requirement {
  id: string
  order: number
  name: string
  type: RequirementType
  appliesToRoles: Role[]
  appliesToPay: PayStatus[]
  validity: Validity
  required: boolean
  active: boolean
  help: string
  helpUrl: string
  helpLinkLabel: string
  /** Youth, high school or both. Missing means both. */
  level?: Level
  /** Limit the requirement to specific teams. Missing or empty means every team. */
  appliesToTeams?: Team[]
  /** Plain-language reason shown in the "Why we require this" dropdown. */
  why?: string
  /** Where the requirement comes from, for example "PA law" or "PIAA". */
  source?: string
  /** Optional link to the rule or policy behind the requirement. */
  sourceUrl?: string
  /** PA clearances record whether they were obtained for volunteer or employment purposes. */
  tracksObtainedAs?: boolean
  /** FBI check: eligible volunteers may submit a Volunteer Disclosure Statement instead. */
  allowsVolunteerAffidavit?: boolean
  /** Accepts either a file upload or just a completion date. */
  dateOnlyAllowed?: boolean
}

export type CoachStatus = 'pending' | 'approved' | 'declined'

export interface Coach {
  id: string
  name: string
  team: Team
  role: Role
  pay: PayStatus
  phone: string
  email: string
  /** Has lived in Pennsylvania for the last 10 consecutive years. */
  paResident10Years: boolean
  /** Board approval state. Missing means approved (demo data). */
  status?: CoachStatus
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'
export type ObtainedAs = 'Volunteer' | 'Employment'
export type FbiMethod = 'fingerprint' | 'affidavit'

export interface Submission {
  id: string
  coachId: string
  requirementId: string
  status: SubmissionStatus
  uploadedOn: string
  completedOn: string
  expiresOn: string | null
  fileName?: string
  filePath?: string
  obtainedAs?: ObtainedAs
  fbiMethod?: FbiMethod
  membershipNumber?: string
  signedName?: string
  reviewComment?: string
  reviewedOn?: string
}

export type ItemStatus =
  | 'not-started'
  | 'pending'
  | 'approved'
  | 'expiring'
  | 'expired'
  | 'rejected'
  | 'invalid'

export type ComplianceStatus = 'cleared' | 'incomplete' | 'expiring' | 'expired'
