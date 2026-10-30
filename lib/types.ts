export const TEAMS = ['8U', '10U', '12U', '14U', 'HS-JV', 'HS-Varsity', 'Board', 'Youth Volunteer', 'HS Volunteer', 'Youth/HS Volunteer'] as const
export type Team = (typeof TEAMS)[number]

/** The two requirement tracks. Every team rolls up to one or both of them. */
export const PROGRAMS = ['youth', 'high-school'] as const
export type Program = (typeof PROGRAMS)[number]
export const PROGRAM_LABELS: Record<Program, string> = { youth: 'Youth', 'high-school': 'High School' }

/** Which program(s) a team belongs to. Board and the combined volunteer team are in both. */
export const TEAM_PROGRAMS: Record<Team, readonly Program[]> = {
  '8U': ['youth'], '10U': ['youth'], '12U': ['youth'], '14U': ['youth'],
  'HS-JV': ['high-school'], 'HS-Varsity': ['high-school'],
  Board: ['youth', 'high-school'],
  'Youth Volunteer': ['youth'], 'HS Volunteer': ['high-school'], 'Youth/HS Volunteer': ['youth', 'high-school'],
}

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
  youth: 'Youth',
  'high-school': 'High School',
  both: 'Youth and High School',
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
  /** When false, new submissions are approved automatically and skip the board review queue. Missing means true. */
  requiresReview?: boolean
  help: string
  helpUrl: string
  helpLinkLabel: string
  /** Youth, high school or both. Missing means both. This alone decides which coaches get the requirement. */
  level?: Level
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
  /** High school coach who is also assigned to the youth program, so the youth requirements apply to them too. */
  alsoCoachesYouth?: boolean
  /** Board approval state. Missing means approved (demo data). */
  status?: CoachStatus
  /** Set when the board archived the record. Archived coaches keep all history but are inactive. */
  archivedAt?: string | null
}

/** Sign-in account state for a roster coach, as reported to the board. */
export interface LoginInfo { email: string; has_account: boolean; last_sign_in_at: string | null; invited_at: string | null }
export type LoginState = 'none' | 'invited' | 'active'
export function loginStateOf(info?: LoginInfo): LoginState {
  if (info?.has_account) return 'active'
  return info?.invited_at ? 'invited' : 'none'
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
  /** Board corrections to the dates, oldest first. */
  editLog?: EditLogEntry[]
}

export interface EditLogEntry {
  at: string
  by: string
  fromCompletedOn: string | null
  toCompletedOn: string
  fromExpiresOn: string | null
  toExpiresOn: string | null
  note?: string
}

/** A requirement the coach has started (for example applied for, waiting on a certificate). Never counts as cleared. */
export interface Progress {
  coachId: string
  requirementId: string
  startedOn: string
  followUpOn?: string | null
  note?: string | null
}

/** What the signed-in person may see beyond their own record. Board members get every view at 'manage'. */
export type AccessLevel = 'none' | 'view' | 'manage'
export interface AccessInfo {
  isBoard: boolean
  role: string | null
  roleLabel: string | null
  /** Teams a limited role is scoped to. Null for the board (all teams). */
  teams: Team[] | null
  views: Record<string, AccessLevel>
}
export const NO_ACCESS: AccessInfo = { isBoard: false, role: null, roleLabel: null, teams: [], views: {} }

/** One roster row for a limited role. email, phone and pay are null unless that view is granted. */
export interface StaffRosterRow { coach_id: string; name: string; team: Team; role: Role; email: string | null; phone: string | null; pay: PayStatus | null }

export type StaffState = 'complete' | 'expired' | 'pending_review' | 'in_progress' | 'rejected' | 'missing'
/** Status only. Never carries files, certificate numbers, review comments or notes. */
export interface StaffStatusRow {
  coach_id: string; coach_name: string; team: Team; coach_role: Role
  requirement_id: string; requirement_name: string; state: StaffState
  expires_on: string | null; days_to_expiry: number | null; follow_up_on: string | null
}
export interface StaffData { roster: StaffRosterRow[]; status: StaffStatusRow[] }

/** Board-only configuration for the access matrix. */
export interface AccessConfig {
  roles: { key: string; label: string; description: string }[]
  views: { key: string; label: string; description: string; maxLevel: AccessLevel }[]
  matrix: { role: string; view: string; level: AccessLevel }[]
  staff: { email: string; role: string; teams: Team[]; name: string | null; coachTeam: Team | null; lastSignInAt: string | null }[]
  teams: Team[]
}

export type ItemStatus =
  | 'not-started'
  | 'in-progress'
  | 'pending'
  | 'approved'
  | 'expiring'
  | 'expired'
  | 'rejected'
  | 'invalid'

export type ComplianceStatus = 'cleared' | 'incomplete' | 'expiring' | 'expired'
