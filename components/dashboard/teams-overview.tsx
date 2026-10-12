'use client'

import Link from '@/components/app-link'
import type { CoachSummary } from '@/lib/compliance'
import { TEAMS } from '@/lib/types'
import { ComplianceStatusPill } from '@/components/status-pill'
import { RequirementProgress } from '@/components/requirement-progress'

export function TeamsOverview({ summaries }: { summaries: CoachSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {TEAMS.map((team) => {
        const staff = summaries.filter((s) => s.coach.team === team)
        const cleared = staff.filter((s) => s.cleared).length
        return (
          <section
            key={team}
            aria-labelledby={`team-${team}`}
            className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 id={`team-${team}`} className="text-lg font-semibold text-navy">
                {team}
              </h3>
              <p className="text-right">
                <span className="text-2xl font-semibold tabular-nums text-navy">{cleared}</span>
                <span className="text-muted-foreground"> of {staff.length} cleared</span>
              </p>
            </div>
            <RequirementProgress done={cleared} total={staff.length} showLabel={false} />
            <ul className="flex flex-col divide-y">
              {staff.map((s) => (
                <li key={s.coach.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link href={`/coaches/${s.coach.id}`} className="font-medium text-brand hover:underline">
                      {s.coach.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{s.coach.role}</p>
                  </div>
                  <ComplianceStatusPill status={s.status} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
