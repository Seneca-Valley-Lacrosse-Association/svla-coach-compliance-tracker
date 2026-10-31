import { OFF_SEASON_DEFAULT_IDS, PROGRAMS, PROGRAM_LABELS, TEAM_PROGRAMS } from './types'
import type {
  Coach,
  ComplianceStatus,
  FbiCheck,
  ItemStatus,
  Program,
  Progress,
  Requirement,
  Submission,
  Validity,
} from './types'

export const TODAY = new Date().toISOString().slice(0, 10)
export const EXPIRING_WINDOW_DAYS = 60

function parse(date: string) {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function format(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string) {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000)
}

export function formatDate(date: string | null | undefined) {
  if (!date) return '—'
  return parse(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** School year runs July 1 – June 30; annual trainings expire at the end of it. */
export function endOfSchoolYear(completedOn: string) {
  const d = parse(completedOn)
  const year = d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()
  return `${year}-06-30`
}

export function computeExpiry(
  validity: Validity,
  completedOn: string,
  membershipExpiry?: string,
): string | null {
  switch (validity.kind) {
    case 'years': {
      const d = parse(completedOn)
      d.setUTCFullYear(d.getUTCFullYear() + validity.years)
      return format(d)
    }
    case 'school-year':
      return endOfSchoolYear(completedOn)
    case 'membership':
      return membershipExpiry ?? null
    case 'one-time':
      return null
  }
}

export function validityLabel(validity: Validity) {
  switch (validity.kind) {
    case 'years':
      return validity.years === 1 ? '1 year' : `${validity.years} years`
    case 'school-year':
      return '1 year (ends June 30)'
    case 'membership':
      return '1 year (membership term)'
    case 'one-time':
      return 'One-time'
  }
}

/**
 * The program(s) a coach is assigned to, derived from their team. Board and the combined volunteer team are in both.
 * A high school coach flagged "also coaches youth" is in both as well.
 */
export function coachPrograms(coach: Coach): Program[] {
  const assigned = new Set<Program>(TEAM_PROGRAMS[coach.team] ?? ['youth'])
  if (coach.alsoCoachesYouth) assigned.add('youth')
  return PROGRAMS.filter((p) => assigned.has(p))
}

export function isAssignedTo(coach: Coach, program: Program) {
  return coachPrograms(coach).includes(program)
}

/** A requirement with no level set applies to both programs. */
export function requirementInProgram(req: Requirement, program: Program) {
  const level = req.level ?? 'both'
  return level === 'both' || level === program
}

function matchesPeople(req: Requirement, coach: Coach) {
  return req.appliesToRoles.includes(coach.role) && req.appliesToPay.includes(coach.pay)
}

/** Does this requirement apply to the coach for the given program? Ignores whether the coach is assigned to it. */
export function appliesToInProgram(req: Requirement, coach: Coach, program: Program) {
  return req.active && req.required && matchesPeople(req, coach) && requirementInProgram(req, program)
}

/** Applies to the coach through at least one program they are assigned to. */
export function appliesTo(req: Requirement, coach: Coach) {
  return matchesPeople(req, coach) && coachPrograms(coach).some((p) => requirementInProgram(req, p))
}

export function applicableRequirements(requirements: Requirement[], coach: Coach) {
  return requirements
    .filter((r) => r.active && r.required && appliesTo(r, coach))
    .sort((a, b) => a.order - b.order)
}

/** Pay status is SVLA-wide: a paid coach is paid on every program they coach. */
export function needsEmploymentClearances(coach: Coach) {
  return coach.pay === 'Paid'
}

/** The FBI requirement is the one that offers the volunteer disclosure statement. */
export function isFbiRequirement(req: Requirement) {
  return !!req.allowsVolunteerAffidavit
}

/** Which FBI document a submission is. Uploads from before the check type existed are inferred where possible. */
export function fbiCheckOf(sub: Pick<Submission, 'fbiCheck' | 'fbiMethod' | 'obtainedAs'>): FbiCheck | null {
  if (sub.fbiCheck) return sub.fbiCheck
  if (sub.fbiMethod === 'affidavit') return 'affidavit'
  if (sub.obtainedAs === 'Volunteer') return 'dhs-volunteer'
  return null
}

/**
 * The FBI documents that count for a coach in one program.
 * Youth (PA Child Protective Services Law): volunteers need a PA DHS check, or the DHS disclosure statement
 * if they have lived in PA for 10 years; paid coaches need the DHS employee check.
 * High school (Seneca Valley School District): every coach, paid or volunteer, files as an Employee Governed by
 * the Public School Code and is fingerprinted under the district's code (athletic director's instructions, Oct 2026).
 * PA DHS does not accept an FBI check run for another department, so a school check never counts for youth.
 */
export function acceptedFbiChecks(coach: Coach, program: Program): FbiCheck[] {
  if (program === 'youth') {
    if (coach.pay === 'Paid') return ['dhs-employee']
    return coach.paResident10Years ? ['dhs-volunteer', 'dhs-employee', 'affidavit'] : ['dhs-volunteer', 'dhs-employee']
  }
  return ['school-employee']
}

/** Why an FBI document does not count for this coach in this program, or null if it does. */
export function fbiIssue(coach: Coach, program: Program, sub: Submission): string | null {
  const check = fbiCheckOf(sub)
  if (!check) return 'We cannot tell which FBI check this is. Upload it again and choose the check type.'
  if (acceptedFbiChecks(coach, program).includes(check)) return null
  if (program === 'youth') {
    if (check === 'school-employee') return 'A school district fingerprint check does not count for youth coaching. Youth needs a PA DHS check.'
    if (check === 'affidavit' && coach.pay === 'Paid') return 'Paid coaches must be fingerprinted. The disclosure statement is for volunteers only.'
    if (check === 'affidavit') return 'The disclosure statement is only for volunteers who have lived in PA for the past 10 years.'
    return 'Paid coaches need the PA DHS employee fingerprint check (code 1KG756).'
  }
  if (check === 'affidavit') return 'High school does not accept the disclosure statement. Seneca Valley requires the school employee fingerprint check (code 1KG6XN).'
  return 'Seneca Valley requires every high school coach, paid or volunteer, to use the school employee fingerprint check (code 1KG6XN). A PA DHS check does not count for high school.'
}

/** Programs an FBI document is judged against: the coach's assigned programs, or both if none. */
function fbiPrograms(coach: Coach): Program[] {
  const assigned = coachPrograms(coach)
  return assigned.length ? assigned : [...PROGRAMS]
}

/**
 * Returns a reason the submission cannot count for this coach, or null if it is acceptable.
 * With a program, the FBI check is judged for that program only. Without one, an FBI document is acceptable
 * when it counts for at least one program the coach is assigned to (a paid coach in both programs uploads two).
 */
export function eligibilityIssue(coach: Coach, req: Requirement, sub: Submission, program?: Program) {
  if (isFbiRequirement(req)) {
    const programs = program ? [program] : fbiPrograms(coach)
    const issues = programs.map((p) => fbiIssue(coach, p, sub))
    if (issues.some((i) => i === null)) return null
    return issues[0]
  }
  // Only paid coaches need clearances obtained for employment. High school volunteers use volunteer clearances.
  if (req.tracksObtainedAs && coach.pay === 'Paid' && sub.obtainedAs === 'Volunteer') {
    return 'Obtained as a volunteer. Paid coaches need a clearance obtained for employment.'
  }
  return null
}

/** The disclosure statement only counts for youth, and only for volunteers who have lived in PA for 10 years. */
export function canUseAffidavit(coach: Coach) {
  if (coach.pay === 'Paid') {
    return { allowed: false, reason: 'Not available for paid coaches. Paid coaches must be fingerprinted.' }
  }
  if (!isAssignedTo(coach, 'youth')) {
    return { allowed: false, reason: 'Youth only. High school does not accept the disclosure statement.' }
  }
  if (!coach.paResident10Years) {
    return {
      allowed: false,
      reason: 'Only for volunteers who have lived in PA for the past 10 years.',
    }
  }
  return { allowed: true, reason: null }
}

/** The FBI documents a fully cleared coach would have on file: one per program, deduplicated. Used for demo data. */
export function expectedFbiChecks(coach: Coach): FbiCheck[] {
  const picks = fbiPrograms(coach).map((p) => acceptedFbiChecks(coach, p)[0])
  return picks.filter((c, i) => picks.indexOf(c) === i)
}

/** Plain-language list of what FBI document each assigned program needs, for the upload dialog and checklist. */
export function fbiNeeds(coach: Coach): { program: Program; text: string }[] {
  return fbiPrograms(coach).map((program) => {
    let text: string
    if (program === 'youth') {
      text = coach.pay === 'Paid'
        ? 'PA DHS employee fingerprint check (code 1KG756).'
        : coach.paResident10Years
          ? 'PA DHS volunteer fingerprint check (code 1KG6ZJ), or the Volunteer Disclosure Statement.'
          : 'PA DHS volunteer fingerprint check (code 1KG6ZJ).'
    } else {
      text = 'Seneca Valley school employee fingerprint check (code 1KG6XN), paid or volunteer. No affidavit.'
    }
    return { program, text }
  })
}

export interface ChecklistItem {
  requirement: Requirement
  status: ItemStatus
  latest: Submission | null
  /** Most recent approved submission, which may differ from the latest when a renewal is pending. */
  approved: Submission | null
  satisfied: boolean
  issue: string | null
  daysUntilExpiry: number | null
  /** Coach-reported "I have started this" marker. Visibility only; it never makes an item satisfied. */
  progress: Progress | null
}

/** Whole days since the coach marked the item started (0 on the day itself). */
export function daysInProgress(progress: Progress) {
  return Math.max(0, daysBetween(progress.startedOn, TODAY))
}

export function followUpOverdue(progress: Progress) {
  return !!progress.followUpOn && progress.followUpOn < TODAY
}

function approvedState(coach: Coach, req: Requirement, sub: Submission, program?: Program) {
  const issue = eligibilityIssue(coach, req, sub, program)
  if (issue) return { status: 'invalid' as const, satisfied: false, issue, days: null }
  if (!sub.expiresOn) return { status: 'approved' as const, satisfied: true, issue: null, days: null }
  const days = daysBetween(TODAY, sub.expiresOn)
  if (days < 0) return { status: 'expired' as const, satisfied: false, issue: null, days }
  if (days <= EXPIRING_WINDOW_DAYS)
    return { status: 'expiring' as const, satisfied: true, issue: null, days }
  return { status: 'approved' as const, satisfied: true, issue: null, days }
}

function buildItem(
  coach: Coach,
  req: Requirement,
  subs: Submission[],
  progress: Progress | null,
  program?: Program,
): ChecklistItem {
  const latest = subs[0] ?? null
  const approvedSubs = subs.filter((s) => s.status === 'approved')
  // With a program, prefer the newest approved document that counts there (a paid coach in both programs has two FBI checks).
  const approved = (program && approvedSubs.find((s) => approvedState(coach, req, s, program).satisfied))
    ?? (program && approvedSubs.find((s) => !eligibilityIssue(coach, req, s, program)))
    ?? approvedSubs[0]
    ?? null
  const approvedResult = approved ? approvedState(coach, req, approved, program) : null

  let status: ItemStatus = 'not-started'
  if (latest?.status === 'pending') status = 'pending'
  else if (latest?.status === 'rejected') status = 'rejected'
  else if (approvedResult) status = approvedResult.status
  // Only an item with nothing on file shows as in progress; other states keep their own status.
  else if (progress) status = 'in-progress'

  return {
    requirement: req,
    status,
    latest,
    approved,
    satisfied: approvedResult?.satisfied ?? false,
    issue: approvedResult?.issue ?? null,
    daysUntilExpiry: approvedResult?.days ?? null,
    progress,
  }
}

/**
 * One requirement for one coach. Pass a program to judge it for that program only.
 * Without a program, the FBI requirement is met only when it is met for every program the coach is assigned to;
 * the first program still missing decides the status and its issue is labelled with the program name.
 */
export function checklistItem(
  coach: Coach,
  req: Requirement,
  submissions: Submission[],
  progressRows: Progress[] = [],
  program?: Program,
): ChecklistItem {
  const progress = progressRows.find((p) => p.coachId === coach.id && p.requirementId === req.id) ?? null
  const subs = submissions
    .filter((s) => s.coachId === coach.id && s.requirementId === req.id)
    .sort((a, b) => (a.uploadedOn === b.uploadedOn ? b.id.localeCompare(a.id) : b.uploadedOn.localeCompare(a.uploadedOn)))
  if (program || !isFbiRequirement(req)) return buildItem(coach, req, subs, progress, program)

  const programs = fbiPrograms(coach)
  const perProgram = programs.map((p) => ({ program: p, item: buildItem(coach, req, subs, progress, p) }))
  const unmet = perProgram.find((x) => !x.item.satisfied)
  if (unmet) {
    // Label the issue with the program when the coach is in both, so a paid coach sees which of the two checks is missing.
    const label = programs.length > 1 ? `${PROGRAM_LABELS[unmet.program]}: ` : ''
    return { ...unmet.item, issue: unmet.item.issue ? `${label}${unmet.item.issue}` : null }
  }
  // Every program is met: show the document that expires first.
  return perProgram
    .map((x) => x.item)
    .sort((a, b) => (a.daysUntilExpiry ?? Infinity) - (b.daysUntilExpiry ?? Infinity))[0]
}

/**
 * One program's view of a coach. Three states for the badge:
 * - assigned and every requirement met: YES (cleared)
 * - assigned with items missing: NO, with the missing list
 * - not assigned: NO, labelled "not assigned". It is never tracked on the dashboard.
 * `items` is always computed against that program's requirements, so an unassigned coach can see what they would still need.
 */
export interface ProgramSummary {
  program: Program
  assigned: boolean
  items: ChecklistItem[]
  satisfiedCount: number
  total: number
  /** Every requirement for this program is met, whether or not the coach is assigned to it. */
  meetsRequirements: boolean
  /** Assigned to the program and meets every requirement. This is the YES on the badge. */
  cleared: boolean
  missing: ChecklistItem[]
  hasExpiring: boolean
}

/**
 * The third box: cleared for SVLA camps, clinics and off-season tournaments. Applies to every coach (nobody is
 * "assigned" to it), uses only the requirements marked for it, and judges the FBI check by the state law that
 * governs SVLA's own programs, the same rule as youth.
 */
export interface OffSeasonSummary {
  items: ChecklistItem[]
  satisfiedCount: number
  total: number
  cleared: boolean
  missing: ChecklistItem[]
  hasExpiring: boolean
}

/** Does this requirement count toward the camps, clinics and off-season box? */
export function requirementInOffSeason(req: Requirement) {
  return req.offSeason ?? OFF_SEASON_DEFAULT_IDS.includes(req.id)
}

export interface CoachSummary {
  coach: Coach
  /** Youth and high school, always both, in that order. These are the spring-season boxes. */
  programs: ProgramSummary[]
  /** Camps, clinics and off-season tournaments. */
  offSeason: OffSeasonSummary
  items: ChecklistItem[]
  satisfiedCount: number
  total: number
  cleared: boolean
  status: ComplianceStatus
  hasExpiring: boolean
  hasExpired: boolean
  hasPending: boolean
  /** Items the coach has marked as started and that are still waiting on a document. */
  inProgress: ChecklistItem[]
  hasInProgress: boolean
  missing: ChecklistItem[]
}

export function summarizeCoach(
  coach: Coach,
  requirements: Requirement[],
  submissions: Submission[],
  progress: Progress[] = [],
): CoachSummary {
  const items = applicableRequirements(requirements, coach).map((r) =>
    checklistItem(coach, r, submissions, progress),
  )
  const byId = new Map(items.map((i) => [i.requirement.id, i]))
  const programs: ProgramSummary[] = PROGRAMS.map((program) => {
    const programItems = requirements
      .filter((r) => appliesToInProgram(r, coach, program))
      .sort((a, b) => a.order - b.order)
      .map((r) => isFbiRequirement(r)
        ? checklistItem(coach, r, submissions, progress, program)
        : byId.get(r.id) ?? checklistItem(coach, r, submissions, progress))
    const satisfied = programItems.filter((i) => i.satisfied).length
    const meets = programItems.length > 0 && satisfied === programItems.length
    const assigned = isAssignedTo(coach, program)
    return {
      program,
      assigned,
      items: programItems,
      satisfiedCount: satisfied,
      total: programItems.length,
      meetsRequirements: meets,
      cleared: assigned && meets,
      missing: programItems.filter((i) => !i.satisfied),
      hasExpiring: programItems.some((i) => i.satisfied && i.daysUntilExpiry !== null && i.daysUntilExpiry <= EXPIRING_WINDOW_DAYS),
    }
  })
  const offItems = requirements
    .filter((r) => r.active && matchesPeople(r, coach) && requirementInOffSeason(r))
    .sort((a, b) => a.order - b.order)
    .map((r) => isFbiRequirement(r)
      ? checklistItem(coach, r, submissions, progress, 'youth')
      : byId.get(r.id) ?? checklistItem(coach, r, submissions, progress))
  const offSatisfied = offItems.filter((i) => i.satisfied).length
  const offSeason: OffSeasonSummary = {
    items: offItems,
    satisfiedCount: offSatisfied,
    total: offItems.length,
    cleared: offItems.length > 0 && offSatisfied === offItems.length,
    missing: offItems.filter((i) => !i.satisfied),
    hasExpiring: offItems.some((i) => i.satisfied && i.daysUntilExpiry !== null && i.daysUntilExpiry <= EXPIRING_WINDOW_DAYS),
  }
  const satisfiedCount = items.filter((i) => i.satisfied).length
  const cleared = items.length > 0 && satisfiedCount === items.length
  const hasExpired = items.some(
    (i) => !i.satisfied && i.approved && i.approved.expiresOn && daysBetween(TODAY, i.approved.expiresOn) < 0,
  )
  const hasExpiring = items.some((i) => i.satisfied && i.daysUntilExpiry !== null && i.daysUntilExpiry <= EXPIRING_WINDOW_DAYS)
  const hasPending = items.some((i) => i.latest?.status === 'pending')
  const inProgress = items.filter((i) => i.progress && !i.satisfied && i.latest?.status !== 'pending')

  let status: ComplianceStatus = 'cleared'
  if (hasExpired) status = 'expired'
  else if (!cleared) status = 'incomplete'
  else if (hasExpiring) status = 'expiring'

  return {
    coach,
    programs,
    offSeason,
    items,
    satisfiedCount,
    total: items.length,
    cleared,
    status,
    hasExpiring,
    hasExpired,
    hasPending,
    inProgress,
    hasInProgress: inProgress.length > 0,
    missing: items.filter((i) => !i.satisfied),
  }
}

/**
 * View of a summary limited to one program, for the dashboard program filter.
 * Returns null when the coach is not assigned to that program, so they are not tracked there.
 */
export function scopeSummary(s: CoachSummary, program: Program): CoachSummary | null {
  const p = s.programs.find((x) => x.program === program)
  if (!p || !p.assigned) return null
  const hasExpired = p.items.some((i) => !i.satisfied && i.approved && i.approved.expiresOn && daysBetween(TODAY, i.approved.expiresOn) < 0)
  const inProgress = p.items.filter((i) => i.progress && !i.satisfied && i.latest?.status !== 'pending')
  const status: ComplianceStatus = hasExpired ? 'expired' : !p.meetsRequirements ? 'incomplete' : p.hasExpiring ? 'expiring' : 'cleared'
  return {
    ...s,
    items: p.items,
    satisfiedCount: p.satisfiedCount,
    total: p.total,
    cleared: p.meetsRequirements,
    status,
    hasExpiring: p.hasExpiring,
    hasExpired,
    hasPending: p.items.some((i) => i.latest?.status === 'pending'),
    inProgress,
    hasInProgress: inProgress.length > 0,
    missing: p.missing,
  }
}

/** High school coaches who are not assigned to youth but already meet every youth requirement. */
export function readyToFloat(summaries: CoachSummary[]): CoachSummary[] {
  return summaries.filter((s) => {
    const youth = s.programs.find((p) => p.program === 'youth')
    return !!youth && !youth.assigned && youth.meetsRequirements && isAssignedTo(s.coach, 'high-school')
  })
}

/** "Head Coach" or "Coach". Pay status and the finer roles never appear on a badge. */
export function badgeRole(coach: Coach) {
  return coach.role === 'Head Coach' ? 'Head Coach' : 'Coach'
}

/**
 * The date a printed badge is good through: the soonest expiry among the items behind every program the
 * coach is cleared for. Items that never expire are ignored. If nothing expires, the end of the school year.
 * Returns null when the coach is not cleared in any program (no badge can be printed).
 */
export function badgeValidThrough(summary: CoachSummary): string | null {
  const cleared: { items: ChecklistItem[] }[] = summary.programs.filter((p) => p.cleared)
  if (summary.offSeason?.cleared) cleared.push(summary.offSeason)
  if (cleared.length === 0) return null
  const dates = cleared
    .flatMap((p) => p.items)
    .map((i) => i.approved?.expiresOn)
    .filter((d): d is string => !!d)
    .sort()
  return dates[0] ?? endOfSchoolYear(TODAY)
}

/** Text for the camps, clinics and off-season cell in exports. Every coach is eligible, so it is Yes or No. */
export function offSeasonClearedLabel(s: CoachSummary): 'Yes' | 'No' {
  return s.offSeason.cleared ? 'Yes' : 'No'
}

/** Text for a per-program "cleared to coach" cell in exports. Never blank: unassigned reads as an explicit NO. */
export function programClearedLabel(s: CoachSummary, program: Program): 'Yes' | 'No' | 'No (not assigned)' {
  const p = s.programs.find((x) => x.program === program)
  if (!p || !p.assigned) return 'No (not assigned)'
  return p.cleared ? 'Yes' : 'No'
}
