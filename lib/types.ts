export const TEAMS = ['8U', '10U', '12U', '14U', 'HS-JV', 'HS-Varsity', 'Board-Youth', 'Board-HS', 'Board-Youth/HS', 'Volunteer-Youth', 'Volunteer-HS', 'Volunteer-Youth/HS'] as const
export type Team = (typeof TEAMS)[number]

/** The two requirement tracks. Every team rolls up to one or both of them. */
export const PROGRAMS = ['youth', 'high-school'] as const
export type Program = (typeof PROGRAMS)[number]
export const PROGRAM_LABELS: Record<Program, string> = { youth: 'Youth', 'high-school': 'High School' }
/** Box titles: the youth and high school boxes cover the spring season. */
export const SPRING_LABELS: Record<Program, string> = { youth: 'Youth Spring Season', 'high-school': 'High School Spring Season' }
/** The third box: SVLA-run activities outside the spring season. Not a program a coach is assigned to. */
export const OFF_SEASON_LABEL = 'SVLA Camps, Clinics & Off-Season'
export const OFF_SEASON_SHORT = 'Camps & Off-Season'
/**
 * Requirements that count for camps, clinics and off-season tournaments when the board has not set it on the
 * requirement itself: the legal minimum (the three PA clearances) plus USA Lacrosse coach membership for insurance.
 */
export const OFF_SEASON_DEFAULT_IDS: readonly string[] = ['pa-child-abuse', 'pa-state-police', 'fbi-fingerprint', 'usal-membership']

/** Which program(s) a team belongs to. The Youth/HS Board and Volunteer teams are in both. */
export const TEAM_PROGRAMS: Record<Team, readonly Program[]> = {
  '8U': ['youth'], '10U': ['youth'], '12U': ['youth'], '14U': ['youth'],
  'HS-JV': ['high-school'], 'HS-Varsity': ['high-school'],
  'Board-Youth': ['youth'], 'Board-HS': ['high-school'], 'Board-Youth/HS': ['youth', 'high-school'],
  'Volunteer-Youth': ['youth'], 'Volunteer-HS': ['high-school'], 'Volunteer-Youth/HS': ['youth', 'high-school'],
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
  /** Optional link to the rule or policy behind the requirement. Kept for older records; new links go in `sources`. */
  sourceUrl?: string
  /** Extra source links. The board adds as many as it needs with the + button. */
  sources?: SourceLink[]
  /** PA clearances record whether they were obtained for volunteer or employment purposes. */
  tracksObtainedAs?: boolean
  /** FBI check: eligible volunteers may submit a Volunteer Disclosure Statement instead. */
  allowsVolunteerAffidavit?: boolean
  /** Accepts either a file upload or just a completion date. */
  dateOnlyAllowed?: boolean
  /** Counts toward "Cleared: Camps, Clinics & Off-Season". Missing means the built-in default list decides. */
  offSeason?: boolean
}

/** One labelled link to a rule, law or policy behind a requirement. */
export interface SourceLink { label: string; url: string }

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
  /** Private random code in the badge QR link. Only the board and the coach themselves can read it. */
  verifyToken?: string
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

/**
 * Which FBI document a coach uploaded. The agency that ran the check decides where it counts:
 * PA DHS will not accept an FBI check run for another department, so a school-district check does not
 * count for youth, and the DHS disclosure statement does not count for high school.
 */
export const FBI_CHECKS = ['dhs-volunteer', 'dhs-employee', 'school-employee', 'affidavit'] as const
export type FbiCheck = (typeof FBI_CHECKS)[number]
export const FBI_CHECK_LABELS: Record<FbiCheck, string> = {
  'dhs-volunteer': 'FBI fingerprint check, PA DHS volunteer (code 1KG6ZJ)',
  'dhs-employee': 'FBI fingerprint check, PA DHS employee (code 1KG756)',
  'school-employee': 'FBI fingerprint check, Seneca Valley school employee (code 1KG6XN)',
  affidavit: 'Volunteer Disclosure Statement (PA DHS affidavit)',
}
export const FBI_CHECK_SHORT: Record<FbiCheck, string> = {
  'dhs-volunteer': 'DHS volunteer fingerprint (1KG6ZJ)',
  'dhs-employee': 'DHS employee fingerprint (1KG756)',
  'school-employee': 'School employee fingerprint (1KG6XN)',
  affidavit: 'DHS Volunteer Disclosure Statement',
}

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
  /** FBI requirement only: which check this document is. Older uploads may not have it. */
  fbiCheck?: FbiCheck
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
  /** youth | high-school | both. Absent on databases from before the per-program migration. */
  requirement_level?: Level | null
  /** Programs the coach is assigned to. Absent on databases from before the per-program migration. */
  coach_programs?: Program[] | null
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
