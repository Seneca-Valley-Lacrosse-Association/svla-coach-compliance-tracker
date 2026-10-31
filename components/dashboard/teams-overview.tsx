'use client'

import Link from '@/components/app-link'
import type { CoachSummary } from '@/lib/compliance'
import { OFF_SEASON_SHORT, PROGRAM_LABELS, TEAMS, TEAM_PROGRAMS, type ViewScope } from '@/lib/types'
import { ComplianceStatusPill } from '@/components/status-pill'
import { ProgramProgress } from '@/components/program-progress'
import { cn } from '@/lib/utils'

/**
 * One card per team. The header counts people cleared per program, so a Youth/HS team shows
 * a Youth bar and a High School bar. Each person shows requirements done per program.
 */
export function TeamsOverview({ summaries, program = 'all' }: { summaries: CoachSummary[]; program?: ViewScope }) {
  const teams = program === 'all' || program === 'off-season' ? TEAMS : TEAMS.filter((t) => TEAM_PROGRAMS[t].includes(program))
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {teams.map((team) => {
        const staff = summaries.filter((s) => s.coach.team === team)
        const springBars = program === 'off-season' ? [] : TEAM_PROGRAMS[team]
          .filter((p) => program === 'all' || p === program)
          .map((p) => ({ key: p, label: `${PROGRAM_LABELS[p]} Spring`, cleared: staff.filter((s) => s.programs.find((x) => x.program === p)?.cleared).length }))
        const bars = program === 'all' || program === 'off-season'
          ? [...springBars, { key: 'off-season', label: OFF_SEASON_SHORT, cleared: staff.filter((s) => s.offSeason.cleared).length }]
          : springBars
        return (
          <section
            key={team}
            aria-labelledby={`team-${team}`}
            className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs"
          >
            <h3 id={`team-${team}`} className="text-lg font-semibold text-navy">
              {team}
            </h3>
            <div className="flex flex-col gap-2">
              {bars.map(({ key, label, cleared }) => {
                const pct = staff.length === 0 ? 0 : Math.round((cleared / staff.length) * 100)
                const full = staff.length > 0 && cleared === staff.length
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <p className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">Cleared: {label}</span>
                      <span>
                        <span className="text-lg font-semibold tabular-nums text-navy">{cleared}</span>
                        <span className="text-muted-foreground"> of {staff.length}</span>
                      </span>
                    </p>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={staff.length}
                      aria-valuenow={cleared}
                      aria-label={`${team}: ${cleared} of ${staff.length} cleared for ${label}`}
                      className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                    >
                      <div className={cn('h-full rounded-full', full ? 'bg-emerald-600' : 'bg-brand')} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one assigned to this team yet.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {staff.map((s) => (
                  <li key={s.coach.id} className="flex flex-col gap-2 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/coaches/${s.coach.id}`} className="font-medium text-brand hover:underline">
                          {s.coach.name}
                        </Link>
                        <p className="text-sm text-muted-foreground">{s.coach.role}</p>
                      </div>
                      <ComplianceStatusPill status={s.status} />
                    </div>
                    <ProgramProgress
                      summary={s}
                      programs={program === 'all' || program === 'off-season' ? undefined : [program]}
                      includeOffSeason={program === 'all'}
                      offSeasonOnly={program === 'off-season'}
                      showVerdict
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
