'use client'

import { useMemo, useState } from 'react'
import { useApp } from '@/lib/app-store'
import type { ItemStatus, StaffStatusRow } from '@/lib/types'
import { ComplianceStatusPill, ItemStatusPill, PayBadge } from '@/components/status-pill'
import { PageHeader } from '@/components/page-header'

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

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { dateStyle: 'medium' })
}

export function TeamComplianceView() {
  const { staff, access, hasTeamView } = useApp()
  const [team, setTeam] = useState('all')

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

  const teams = [...new Set(coaches.map((c) => c.person.team))]
  const visible = coaches.filter((c) => team === 'all' || c.person.team === team)
  const showStatus = !!access.views.clearance_status
  const withStatus = visible.map((c) => ({ ...c, status: overall(c.rows) }))
  const count = (s: ReturnType<typeof overall>) => withStatus.filter((c) => c.rows.length > 0 && c.status === s).length

  return (
    <>
      <PageHeader
        title="Team Compliance"
        description={`${access.roleLabel ?? 'Your role'} view for ${(access.teams ?? []).join(', ') || 'your teams'}. Status and expiration dates only. Documents and certificate details stay with the board.`}
        actions={teams.length > 1 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Team</span>
            <select value={team} onChange={(e) => setTeam(e.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-base">
              <option value="all">All my teams</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        ) : undefined}
      />

      {showStatus && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([['cleared', 'Cleared to coach'], ['incomplete', 'Incomplete'], ['expiring', `Expiring in ${EXPIRING_DAYS} days`], ['expired', 'Expired']] as const).map(([key, label]) => (
            <div key={key} className="rounded-xl border bg-card p-4 shadow-xs">
              <p className="text-3xl font-semibold text-navy">{count(key)}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {withStatus.length === 0 && (
        <p className="rounded-xl border bg-card p-5 text-muted-foreground">No coaches are assigned to your teams yet.</p>
      )}

      <ul className="flex flex-col gap-3">
        {withStatus.map(({ person, rows, status }) => (
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
              </summary>
              {showStatus && rows.length > 0 && (
                <ul className="divide-y border-t">
                  {rows.map((row) => (
                    <li key={row.requirement_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <span>{row.requirement_name}</span>
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
