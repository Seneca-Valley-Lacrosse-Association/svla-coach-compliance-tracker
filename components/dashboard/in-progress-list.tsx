'use client'

import Link from '@/components/app-link'
import { Hourglass } from 'lucide-react'
import { daysInProgress, followUpOverdue, formatDate, type CoachSummary } from '@/lib/compliance'

// Board view of everything coaches have started but not yet submitted, longest-waiting first, so the board can
// see who has been stuck on a step the longest.
export function InProgressList({ summaries }: { summaries: CoachSummary[] }) {
  const rows = summaries
    .flatMap((s) => s.inProgress.map((item) => ({ coach: s.coach, item, progress: item.progress! })))
    .sort((a, b) => daysInProgress(b.progress) - daysInProgress(a.progress) || a.coach.name.localeCompare(b.coach.name))
  if (rows.length === 0) return null

  return (
    <section aria-labelledby="in-progress-heading" className="flex flex-col gap-3">
      <h2 id="in-progress-heading" className="flex items-center gap-2 text-lg font-semibold text-navy">
        <Hourglass className="size-5 text-violet-700" aria-hidden="true" />
        In progress <span className="font-normal text-muted-foreground">({rows.length})</span>
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
        {rows.map(({ coach, item, progress }) => {
          const days = daysInProgress(progress)
          return (
            <li key={`${coach.id}-${item.requirement.id}`} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <Link href={`/coaches/${coach.id}`} className="font-medium text-brand hover:underline">{coach.name}</Link>
                <span className="text-muted-foreground"> · {coach.team}</span>
                <p className="text-sm">{item.requirement.name}</p>
                {progress.note && <p className="text-sm text-muted-foreground">{progress.note}</p>}
              </div>
              <dl className="flex shrink-0 flex-wrap gap-x-6 gap-y-1 text-sm">
                <div>
                  <dt className="text-muted-foreground">Started</dt>
                  <dd className="font-medium">{formatDate(progress.startedOn)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Waiting</dt>
                  <dd className={days >= 30 ? 'font-medium text-amber-900' : 'font-medium'}>{days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Follow-up</dt>
                  <dd className="font-medium">
                    {progress.followUpOn ? formatDate(progress.followUpOn) : '—'}
                    {followUpOverdue(progress) && <span className="text-red-800"> (overdue)</span>}
                  </dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
