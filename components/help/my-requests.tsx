'use client'

import { useTickets } from '@/lib/use-tickets'
import { topicLabel } from '@/lib/tickets'
import { cn } from '@/lib/utils'

const tone = {
  Open: 'bg-slate-100 text-slate-700 ring-slate-200',
  'In Progress': 'bg-sky-50 text-brand ring-sky-200',
  Resolved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
} as const

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'America/New_York' })

/** A coach's own help requests. Shows nothing until they have sent one. */
export function MyRequests() {
  const { data } = useTickets()
  const tickets = data?.mine ?? []
  if (tickets.length === 0) return null
  return (
    <section aria-labelledby="my-requests-heading" className="flex flex-col gap-3">
      <h2 id="my-requests-heading" className="text-lg font-semibold text-navy">Your help requests</h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
        {tickets.map((t) => (
          <li key={t.id} className="flex flex-col gap-1 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-navy">{t.ticket_code}</span>
              <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset', tone[t.display_status])}>{t.display_status}</span>
              <span className="text-sm text-muted-foreground">{topicLabel(t.topic)} · sent {when(t.created_at)}</span>
            </div>
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{t.description}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
