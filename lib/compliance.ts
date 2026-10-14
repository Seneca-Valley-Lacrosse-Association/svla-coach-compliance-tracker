import type {
  Coach,
  ComplianceStatus,
  ItemStatus,
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

/** HS-JV and HS-Varsity are high school programs. Every other team, including Board and Volunteer, counts as youth (SVLA is a youth organization). */
export function coachLevel(coach: Coach): 'youth' | 'high-school' {
  return coach.team.startsWith('HS-') ? 'high-school' : 'youth'
}

/** A requirement with no level set applies to both youth and high school. */
export function appliesToLevel(req: Requirement, coach: Coach) {
  const level = req.level ?? 'both'
  return level === 'both' || level === coachLevel(coach)
}

/** A requirement with no teams listed applies to every team. */
export function appliesToTeam(req: Requirement, coach: Coach) {
  return !req.appliesToTeams?.length || req.appliesToTeams.includes(coach.team)
}

export function appliesTo(req: Requirement, coach: Coach) {
  return (
    req.appliesToRoles.includes(coach.role) &&
    req.appliesToPay.includes(coach.pay) &&
    appliesToLevel(req, coach) &&
    appliesToTeam(req, coach)
  )
}

export function applicableRequirements(requirements: Requirement[], coach: Coach) {
  return requirements
    .filter((r) => r.active && r.required && appliesTo(r, coach))
    .sort((a, b) => a.order - b.order)
}

/**
 * Paid coaches and all high school coaches (Seneca Valley treats them as employees under
 * the Public School Code) need clearances obtained for employment, plus the FBI fingerprint check.
 */
export function needsEmploymentClearances(coach: Coach) {
  return coach.pay === 'Paid' || coachLevel(coach) === 'high-school'
}

/** Returns a reason the submission cannot count for this coach, or null if it is acceptable. */
export function eligibilityIssue(coach: Coach, req: Requirement, sub: Submission) {
  if (req.tracksObtainedAs && needsEmploymentClearances(coach) && sub.obtainedAs === 'Volunteer') {
    return coach.pay === 'Paid'
      ? 'Obtained as a volunteer. Paid coaches need a clearance obtained for employment.'
      : 'Obtained as a volunteer. High school coaches need clearances obtained for employment (Seneca Valley employee application).'
  }
  if (req.allowsVolunteerAffidavit && sub.fbiMethod === 'affidavit') {
    if (needsEmploymentClearances(coach)) {
      return 'Paid and high school coaches must submit an FBI fingerprint check. The affidavit is for youth volunteers only.'
    }
    if (!coach.paResident10Years) {
      return 'The affidavit is only for volunteers who have lived in PA for the past 10 years.'
    }
  }
  return null
}

export function canUseAffidavit(coach: Coach) {
  if (needsEmploymentClearances(coach)) {
    return { allowed: false, reason: 'Not available for paid or high school coaches.' }
  }
  if (!coach.paResident10Years) {
    return {
      allowed: false,
      reason: 'Only for volunteers who have lived in PA for the past 10 years.',
    }
  }
  return { allowed: true, reason: null }
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

function approvedState(coach: Coach, req: Requirement, sub: Submission) {
  const issue = eligibilityIssue(coach, req, sub)
  if (issue) return { status: 'invalid' as const, satisfied: false, issue, days: null }
  if (!sub.expiresOn) return { status: 'approved' as const, satisfied: true, issue: null, days: null }
  const days = daysBetween(TODAY, sub.expiresOn)
  if (days < 0) return { status: 'expired' as const, satisfied: false, issue: null, days }
  if (days <= EXPIRING_WINDOW_DAYS)
    return { status: 'expiring' as const, satisfied: true, issue: null, days }
  return { status: 'approved' as const, satisfied: true, issue: null, days }
}

export function checklistItem(
  coach: Coach,
  req: Requirement,
  submissions: Submission[],
  progressRows: Progress[] = [],
): ChecklistItem {
  const progress = progressRows.find((p) => p.coachId === coach.id && p.requirementId === req.id) ?? null
  const subs = submissions
    .filter((s) => s.coachId === coach.id && s.requirementId === req.id)
    .sort((a, b) => (a.uploadedOn === b.uploadedOn ? b.id.localeCompare(a.id) : b.uploadedOn.localeCompare(a.uploadedOn)))
  const latest = subs[0] ?? null
  const approved = subs.find((s) => s.status === 'approved') ?? null
  const approvedResult = approved ? approvedState(coach, req, approved) : null

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

export interface CoachSummary {
  coach: Coach
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
