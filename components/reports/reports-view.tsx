'use client'

import type { ReactNode } from 'react'
import Link from '@/components/app-link'
import { CheckCircle2, CircleDashed, Clock, Download, Inbox } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { appliesTo, daysBetween, formatDate, offSeasonClearedLabel, programClearedLabel, requirementInOffSeason, TODAY, type CoachSummary } from '@/lib/compliance'
import { LEVEL_LABELS, OFF_SEASON_SHORT, PROGRAMS, PROGRAM_LABELS, SPRING_LABELS, TEAMS, TEAM_PROGRAMS, type Program } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { ProgramProgress } from '@/components/program-progress'
import { cn } from '@/lib/utils'

const EXPIRING_SOON_DAYS = 60

function csvEscape(value: string | number) {
  const raw = String(value)
  const s = /^[\s]*[=+@-]|^[\t\r\n]/.test(raw) ? `'${raw}` : raw
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const programOf = (s: CoachSummary, program: Program) => s.programs.find((p) => p.program === program)

/** Green when everyone is there, amber at half or better, red below half. Grey when nobody is assigned. */
function barTone(done: number, total: number) {
  if (total === 0) return 'bg-slate-300'
  if (done === total) return 'bg-emerald-600'
  return done / total >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
}

function Bar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={label}
      className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className={cn('h-full rounded-full transition-all', barTone(done, total))} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Kpi({
  icon: Icon,
  accent,
  value,
  label,
  detail,
}: {
  icon: typeof CheckCircle2
  accent: string
  value: string | number
  label: string
  detail?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs">
      <span className={cn('flex size-9 items-center justify-center rounded-lg', accent)}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="text-3xl font-semibold tabular-nums text-navy">{value}</span>
      <span className="font-medium text-foreground">{label}</span>
      {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
    </div>
  )
}

export function ReportsView() {
  const { summaries, requirements, isDemo } = useApp()

  // Per program: only coaches assigned to that program count.
  const programStats = PROGRAMS.map((program) => {
    const assigned = summaries.filter((s) => programOf(s, program)?.assigned)
    const cleared = assigned.filter((s) => programOf(s, program)?.cleared).length
    return { program, assigned: assigned.length, cleared, incomplete: assigned.length - cleared }
  })

  // Camps, clinics and off-season: every active coach counts.
  const offCleared = summaries.filter((s) => s.offSeason.cleared).length

  const dualAssigned = summaries
    .filter((s) => PROGRAMS.every((p) => programOf(s, p)?.assigned))
    .sort((a, b) => a.coach.name.localeCompare(b.coach.name))

  const upcoming = summaries
    .flatMap((s) =>
      s.items
        .filter((i) => i.approved?.expiresOn && i.satisfied)
        .map((i) => ({ coach: s.coach, req: i.requirement, expiresOn: i.approved!.expiresOn! })),
    )
    .map((x) => ({ ...x, days: daysBetween(TODAY, x.expiresOn) }))
    .filter((x) => x.days >= 0 && x.days <= 90)
    .sort((a, b) => a.days - b.days)
  const expiringSoon = upcoming.filter((x) => x.days <= EXPIRING_SOON_DAYS).length
  const awaitingReview = summaries.filter((s) => s.hasPending).length

  const completion = requirements
    .filter((r) => r.active && r.required)
    .sort((a, b) => a.order - b.order)
    .map((r) => {
      const applicable = summaries.filter((s) => appliesTo(r, s.coach))
      const done = applicable.filter((s) => s.items.find((i) => i.requirement.id === r.id)?.satisfied).length
      return { req: r, done, total: applicable.length }
    })

  function exportCsv() {
    const header = [
      'Name', 'Team', 'Role', 'Pay Status', 'Compliance',
      'Cleared: Youth Spring Season', 'Cleared: High School Spring Season', 'Cleared: Camps, Clinics & Off-Season',
      'Completed', 'Required', 'Missing',
    ]
    const rows = summaries.map((s) => [
      isDemo ? `[DEMO] ${s.coach.name}` : s.coach.name,
      s.coach.team,
      s.coach.role,
      s.coach.pay,
      s.status,
      programClearedLabel(s, 'youth'),
      programClearedLabel(s, 'high-school'),
      offSeasonClearedLabel(s),
      s.satisfiedCount,
      s.total,
      s.missing.map((m) => m.requirement.name).join('; '),
    ])
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `svla-${isDemo ? 'DEMO-' : ''}coach-compliance-${TODAY}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Compliance as of ${formatDate(TODAY)}. Coaches count in the spring program(s) they are assigned to; every coach counts for camps and off-season.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {!isDemo && (
              <Button variant="default" className="h-10 px-4" render={<a href="/api/export" download />}>
                <Download aria-hidden="true" />
                Download full export (Excel)
              </Button>
            )}
            <Button variant="outline" className="h-10 bg-card px-4" onClick={exportCsv}>
              <Download aria-hidden="true" />
              Summary CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        {/* Headline numbers */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          {programStats.map(({ program, assigned, cleared, incomplete }) => (
            <Kpi
              key={program}
              icon={assigned > 0 && cleared === assigned ? CheckCircle2 : CircleDashed}
              accent={assigned > 0 && cleared === assigned ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700 bg-slate-100'}
              value={`${cleared}/${assigned}`}
              label={`Cleared to Coach: ${SPRING_LABELS[program]}`}
              detail={assigned === 0 ? 'No one assigned yet' : `${Math.round((cleared / assigned) * 100)}% cleared · ${incomplete} incomplete`}
            />
          ))}
          <Kpi
            icon={summaries.length > 0 && offCleared === summaries.length ? CheckCircle2 : CircleDashed}
            accent={summaries.length > 0 && offCleared === summaries.length ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700 bg-slate-100'}
            value={`${offCleared}/${summaries.length}`}
            label={`Cleared: ${OFF_SEASON_SHORT}`}
            detail={summaries.length === 0 ? 'No coaches yet' : `${Math.round((offCleared / summaries.length) * 100)}% cleared · every coach counts`}
          />
          <Kpi
            icon={Clock}
            accent="text-amber-800 bg-amber-50"
            value={expiringSoon}
            label={`Expiring in ${EXPIRING_SOON_DAYS} days`}
            detail="Items to renew soon"
          />
          <Kpi
            icon={Inbox}
            accent="text-brand bg-sky-50"
            value={awaitingReview}
            label="Awaiting review"
            detail={awaitingReview > 0 ? <Link href="/review" className="text-brand hover:underline">Open Review Queue</Link> : 'Nothing waiting'}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {/* Cleared by team: one row per team, Youth and High School side by side */}
          <section aria-labelledby="by-team" className="rounded-xl border bg-card p-5 shadow-xs">
            <h2 id="by-team" className="text-lg font-semibold text-navy">Cleared to coach by team</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Counted separately for each spring program and for camps and off-season. A dash means the team is not part of that program.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Team</th>
                    {PROGRAMS.map((program) => (
                      <th key={program} scope="col" className="w-[27%] px-2 py-2 font-medium">
                        {PROGRAM_LABELS[program]} Spring
                      </th>
                    ))}
                    <th scope="col" className="w-[27%] px-2 py-2 font-medium">{OFF_SEASON_SHORT}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {TEAMS.map((t) => {
                    const staff = summaries.filter((s) => s.coach.team === t)
                    return (
                      <tr key={t}>
                        <th scope="row" className={cn('py-2.5 pr-3 text-left font-medium', staff.length === 0 && 'text-muted-foreground')}>{t}</th>
                        {PROGRAMS.map((program) => {
                          if (!TEAM_PROGRAMS[t].includes(program)) {
                            return <td key={program} className="px-2 py-2.5 text-muted-foreground">—</td>
                          }
                          const cleared = staff.filter((s) => programOf(s, program)?.cleared).length
                          return (
                            <td key={program} className="px-2 py-2.5">
                              <div className="flex items-center gap-2">
                                <Bar done={cleared} total={staff.length} label={`${t}: ${cleared} of ${staff.length} cleared for ${PROGRAM_LABELS[program]}`} />
                                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                                  {staff.length === 0 ? '0/0' : `${cleared}/${staff.length}`}
                                </span>
                              </div>
                            </td>
                          )
                        })}
                        {(() => {
                          const cleared = staff.filter((s) => s.offSeason.cleared).length
                          return (
                            <td className="px-2 py-2.5">
                              <div className="flex items-center gap-2">
                                <Bar done={cleared} total={staff.length} label={`${t}: ${cleared} of ${staff.length} cleared for ${OFF_SEASON_SHORT}`} />
                                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                                  {staff.length === 0 ? '0/0' : `${cleared}/${staff.length}`}
                                </span>
                              </div>
                            </td>
                          )
                        })()}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Completion by requirement */}
          <section aria-labelledby="by-req" className="rounded-xl border bg-card p-5 shadow-xs">
            <h2 id="by-req" className="text-lg font-semibold text-navy">Completion by requirement</h2>
            <p className="mb-4 text-sm text-muted-foreground">Out of the coaches each requirement applies to.</p>
            <ul className="flex flex-col gap-4">
              {completion.map(({ req, done, total }) => (
                <li key={req.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{req.name}</span>
                      <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        {LEVEL_LABELS[req.level ?? 'both']}
                      </span>
                      {requirementInOffSeason(req) && (
                        <span className="rounded-full border border-emerald-600/40 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                          + {OFF_SEASON_SHORT}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {done}/{total}
                    </span>
                  </div>
                  <Bar done={done} total={total} label={`${req.name}: ${done} of ${total} complete`} />
                </li>
              ))}
            </ul>
          </section>

          {/* People assigned to both programs: which side each one is cleared for */}
          {dualAssigned.length > 0 && (
            <section aria-labelledby="dual" className="rounded-xl border bg-card p-5 shadow-xs xl:col-span-2">
              <h2 id="dual" className="text-lg font-semibold text-navy">
                Assigned to both Youth and High School <span className="font-normal text-muted-foreground">({dualAssigned.length})</span>
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">Board members and volunteers who float between programs need every clearance on both sides.</p>
              <ul className="divide-y">
                {dualAssigned.map((s) => (
                  <li key={s.coach.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <Link href={`/coaches/${s.coach.id}`} className="font-medium text-brand hover:underline">{s.coach.name}</Link>
                    <span className="text-sm text-muted-foreground">{s.coach.team}</span>
                    <ProgramProgress summary={s} showVerdict includeOffSeason className="ml-auto w-full sm:w-80" />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {/* Expiring soon */}
          <section aria-labelledby="upcoming" className="rounded-xl border bg-card p-5 shadow-xs xl:col-span-2">
            <h2 id="upcoming" className="mb-4 text-lg font-semibold text-navy">
              Expiring in the next 90 days <span className="font-normal text-muted-foreground">({upcoming.length})</span>
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground">Nothing expires in the next 90 days.</p>
            ) : (
              <ul className="divide-y">
                {upcoming.map((x) => (
                  <li key={`${x.coach.id}-${x.req.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <Link href={`/coaches/${x.coach.id}`} className="font-medium text-brand hover:underline">
                      {x.coach.name}
                    </Link>
                    <span className="text-sm text-muted-foreground">{x.coach.team}</span>
                    <span className="text-muted-foreground">{x.req.name}</span>
                    <span className="ml-auto flex items-center gap-2 text-sm">
                      {formatDate(x.expiresOn)}
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          x.days <= 30 ? 'bg-red-100 text-red-800' : x.days <= EXPIRING_SOON_DAYS ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        in {x.days} {x.days === 1 ? 'day' : 'days'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
