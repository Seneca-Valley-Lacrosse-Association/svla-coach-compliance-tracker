'use client'

import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Hourglass, Inbox } from 'lucide-react'
import type { CoachSummary } from '@/lib/compliance'
import { cn } from '@/lib/utils'

export type TileFilter = 'all' | 'cleared' | 'incomplete' | 'expiring' | 'expired' | 'pending' | 'in-progress'

export const tileFilters: Record<Exclude<TileFilter, 'all'>, (s: CoachSummary) => boolean> = {
  cleared: (s) => s.cleared,
  incomplete: (s) => !s.cleared,
  expiring: (s) => s.hasExpiring,
  expired: (s) => s.hasExpired,
  pending: (s) => s.hasPending,
  'in-progress': (s) => s.hasInProgress,
}

const tiles = [
  { key: 'cleared', label: 'Cleared to Coach', icon: CheckCircle2, accent: 'text-emerald-700 bg-emerald-50' },
  { key: 'incomplete', label: 'Incomplete', icon: CircleDashed, accent: 'text-slate-700 bg-slate-100' },
  { key: 'expiring', label: 'Expiring in 60 Days', icon: Clock, accent: 'text-amber-800 bg-amber-50' },
  { key: 'expired', label: 'Expired', icon: AlertTriangle, accent: 'text-red-700 bg-red-50' },
  { key: 'pending', label: 'Awaiting Review', icon: Inbox, accent: 'text-brand bg-sky-50' },
  { key: 'in-progress', label: 'In Progress', icon: Hourglass, accent: 'text-violet-800 bg-violet-50' },
] as const

export function SummaryTiles({
  summaries,
  active,
  onChange,
}: {
  summaries: CoachSummary[]
  active: TileFilter
  onChange: (f: TileFilter) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map(({ key, label, icon: Icon, accent }) => {
        const count = summaries.filter(tileFilters[key]).length
        const selected = active === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? 'all' : key)}
            className={cn(
              'flex flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition-all hover:border-brand/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              selected && 'border-brand ring-2 ring-brand/30',
            )}
          >
            <span className={cn('flex size-9 items-center justify-center rounded-lg', accent)}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="text-3xl font-semibold tabular-nums text-navy">{count}</span>
            <span className="font-medium text-foreground">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
