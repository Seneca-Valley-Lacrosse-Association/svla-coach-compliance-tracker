'use client'

import { useMemo, useState } from 'react'
import { useApp } from '@/lib/app-store'
import { LEVEL_LABELS, PROGRAMS, PROGRAM_LABELS, TEAMS, type ItemStatus, type Program, type StaffStatusRow } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ComplianceStatusPill, ItemStatusPill, PayBadge } from '@/components/status-pill'
import { PageHeader } from '@/components/page-header'
import { TeamPicker } from './team-picker'

const EXPIRING_DAYS = 60

function itemStatus(row: StaffStatusRow): ItemStatus {
  switch (row.state) {
    case 'complete': return row.days_to_expiry !== null && row.days_to_expiry <= EXPIRING_DAYS ? 'expiring' : 'approved'
    case 'expired': return 'expired'
    case 'pending_review': return 'pending'
    case 'in_progress': return 'in-progress'
    case 'rejected': return 'rejected'
    default: return 'not-started'
  }
}

function overall(rows: StaffStatusRow[]) {
  const statuses = rows.map(itemStatus)
  if (statuses.includes('expired')) return 'expired' as const
  if (statuses.some((s) => s !== 'approved' && s !== 'expiring')) return 'incomplete' as const
  if (statuses.includes('expiring')) return 'expiring' as const
  return 'cleared' as const
}

type PersonProgram = { program: Program; done: number; total: number; cleared: boolean }

/**
 * Per-program clearance for one person, mirroring the board dashboard.
 * Returns null when the database has not been updated to send program details yet.
 */
function programsFor(rows: StaffStatusRow[]): PersonProgram[] | null {
  if (rows.length === 0 || !Array.isArray(rows[0].coach_programs)) return null
  const assigned = rows[0].coach_programs!
  return PROGRAMS.filter((p) => assigned.includes(p)).map((program) => {
    const subset = rows.filter((r) => (r.requirement_level ?? 'both') === 'both' || r.requirement_level === program)
    const done = subset.filter((r) => { const s = itemStatus(r); return s === 'approved' || s === 'expiring' }).length
    return { program, done, total: subset.length, cleared: subset.length > 0 && done === subset.length }
  })
}

function ProgramChip({ p }: { p: PersonProgram }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-xs font-semibold',
        p.cleared ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-red-600 bg-red-50 text-red-800',
      )}
    >
      {PROGRAM_LABELS[p.program]}: {p.cleared ? 'YES' : 'NO'} <span className="font-normal">({p.done}/{p.total})</span>
    </span>
  )
}


function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { dateStyle: 'medium' })
}

export function TeamComplianceView() {
  const app = useApp()
  // While a board member is previewing someone, show that person's data instead of the signed-in user's.
  const staff = app.preview ? app.preview.staff : app.staff
  const access = app.preview ? app.preview.access : app.access
  const hasTeamView = app.preview ? !!(access.views.clearance_status || access.views.staff_roster) : app.hasTeamView
  // null means every team is checked (the default), so it keeps following the list if the teams change.
  const [chosen, setChosen] = useState<string[] | null>(null)

  const coaches = useMemo(() => {
    const byCoach = new Map<string, StaffStatusRow[]>()
    for (const row of staff.status) byCoach.set(row.coach_id, [...(byCoach.get(row.coach_id) ?? []), row])
    // The roster is the source for who is on the team and for the optional contact and pay columns.
    const rosterIds = new Set(staff.roster.map((r) => r.coach_id))
    const fromStatus = [...byCoach.entries()]
      .filter(([id]) => !rosterIds.has(id))
      .map(([id, rows]) => ({ coach_id: id, name: rows[0].coach_name, team: rows[0].team, role: rows[0].coach_role, email: null, phone: null, pay: null }))
    return [...staff.roster, ...fromStatus].map((person) => ({ person, rows: byCoach.get(person.coach_id) ?? [] }))
  }, [staff])

  if (!hasTeamView) {
    return <PageHeader title="Team Compliance" description="Your account does not have access to this page." />
  }

  const order: readonly string[] = TEAMS
  const teams: string[] = [...new Set<string>(coaches.map((c) => c.person.team))].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  const selected = chosen === null ? teams : chosen.filter((t) => teams.includes(t))
  const visible = coaches.filter((c) => selected.includes(c.person.team))
  const showStatus = !!access.views.clearance_status
  const withStatus = visible.map((c) => ({ ...c, status: overall(c.rows), programs: programsFor(c.rows) }))
  const count = (s: ReturnType<typeof overall>) => withStatus.filter((c) => c.rows.length > 0 && c.status === s).length
  // Per-program counts only cover people assigned to that program.
  const hasPrograms = withStatus.some((c) => c.programs !== null)
  const programCount = (program: Program, cleared: boolean) =>
    withStatus.filter((c) => c.programs?.some((p) => p.program === program && p.cleared === cleared)).length
  const programsInView = PROGRAMS.filter((program) => withStatus.some((c) => c.programs?.some((p) => p.program === program)))
  const tiles: { key: string; value: number; label: string }[] = hasPrograms
    ? [
        ...programsInView.map((program) => ({ key: `c-${program}`, value: programCount(program, true), label: `Cleared to coach: ${PROGRAM_LABELS[program]}` })),
        ...programsInView.map((program) => ({ key: `i-${program}`, value: programCount(program, false), label: `Incomplete: ${PROGRAM_LABELS[program]}` })),
        { key: 'expiring', value: count('expiring'), label: `Expiring in ${EXPIRING_DAYS} days` },
        { key: 'expired', value: count('expired'), label: 'Expired' },
      ]
    : ([['cleared', 'Cleared to coach'], ['incomplete', 'Incomplete'], ['expiring', `Expiring in ${EXPIRING_DAYS} days`], ['expired', 'Expired']] as const).map(([key, label]) => ({ key, value: count(key), label }))

  return (
    <>
      <PageHeader
        title="Team Compliance"
        description={`${access.roleLabel ?? 'Your role'} view for ${(access.teams ?? []).join(', ') || 'your teams'}. Status and expiration dates only. Documents and certificate details stay with the board.`}
        actions={teams.length > 1 ? (
          <TeamPicker teams={teams} selected={selected} onChange={(next) => setChosen(next.length === teams.length ? null : next)} />
        ) : undefined}
      />

      {showStatus && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map(({ key, value, label }) => (
            <div key={key} className="rounded-xl border bg-card p-4 shadow-xs">
              <p className="text-3xl font-semibold text-navy">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {withStatus.length === 0 && (
        <p className="rounded-xl border bg-card p-5 text-muted-foreground">
          {coaches.length > 0 ? 'No teams are selected. Choose at least one team to see its coaches.' : 'No coaches are assigned to your teams yet.'}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {withStatus.map(({ person, rows, status, programs }) => (
          <li key={person.coach_id} className="rounded-xl border bg-card shadow-xs">
            <details open={showStatus && rows.length > 0 && status !== 'cleared'} className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-navy">{person.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {person.team} · {person.role}
                    {person.email && <> · <a href={`mailto:${person.email}`} className="text-primary underline underline-offset-4" onClick={(e) => e.stopPropagation()}>{person.email}</a></>}
                    {person.phone && <> · {person.phone}</>}
                  </span>
                </span>
                {person.pay && <PayBadge pay={person.pay} />}
                {showStatus && rows.length > 0 && <ComplianceStatusPill status={status} />}
                {showStatus && programs && programs.length > 0 && (
                  <span className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                    {programs.map((p) => <ProgramChip key={p.program} p={p} />)}
                  </span>
                )}
              </summary>
              {showStatus && rows.length > 0 && (
                <ul className="divide-y border-t">
                  {rows.map((row) => (
                    <li key={row.requirement_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span>{row.requirement_name}</span>
                        {programs && programs.length > 1 && row.requirement_level && (
                          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{LEVEL_LABELS[row.requirement_level]}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-3">
                        {row.expires_on && row.state !== 'missing' && (
                          <span className="text-sm text-muted-foreground">
                            {row.state === 'expired' ? 'Expired' : 'Expires'} {formatDate(row.expires_on)}
                          </span>
                        )}
                        {row.follow_up_on && row.state === 'in_progress' && (
                          <span className="text-sm text-muted-foreground">Follow up {formatDate(row.follow_up_on)}</span>
                        )}
                        <ItemStatusPill status={itemStatus(row)} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        This page is read-only and confidential. Please do not share it outside SVLA coaching staff. Questions about a coach&rsquo;s status go to the board.
      </p>
    </>
  )
}
