'use client'

import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Hourglass, Inbox } from 'lucide-react'
import type { CoachSummary } from '@/lib/compliance'
import type { Program, ViewScope } from '@/lib/types'
import { cn } from '@/lib/utils'

export type TileFilter =
  | 'all'
  | 'cleared-youth'
  | 'cleared-high-school'
  | 'incomplete-youth'
  | 'incomplete-high-school'
  | 'cleared-off-season'
  | 'incomplete-off-season'
  | 'expiring'
  | 'expired'
  | 'pending'
  | 'in-progress'

/** Cleared / incomplete are counted per program, and only for coaches assigned to that program. */
const programState = (s: CoachSummary, program: Program) => s.programs.find((p) => p.program === program)
const clearedIn = (program: Program) => (s: CoachSummary) => programState(s, program)?.cleared === true
const incompleteIn = (program: Program) => (s: CoachSummary) => {
  const p = programState(s, program)
  return !!p && p.assigned && !p.cleared
}

export const tileFilters: Record<Exclude<TileFilter, 'all'>, (s: CoachSummary) => boolean> = {
  'cleared-youth': clearedIn('youth'),
  'cleared-high-school': clearedIn('high-school'),
  'incomplete-youth': incompleteIn('youth'),
  'incomplete-high-school': incompleteIn('high-school'),
  // Every coach is eligible for camps and off-season, so there is no "not assigned".
  'cleared-off-season': (s) => s.offSeason.cleared,
  'incomplete-off-season': (s) => !s.offSeason.cleared,
  expiring: (s) => s.hasExpiring,
  expired: (s) => s.hasExpired,
  pending: (s) => s.hasPending,
  'in-progress': (s) => s.hasInProgress,
}

type Tile = { key: Exclude<TileFilter, 'all'>; label: string; icon: typeof CheckCircle2; accent: string; program?: Program | 'off-season' }

const tiles: Tile[] = [
  { key: 'cleared-youth', label: 'Cleared to Coach: Youth Spring', program: 'youth', icon: CheckCircle2, accent: 'text-emerald-700 bg-emerald-50' },
  { key: 'cleared-high-school', label: 'Cleared to Coach: High School Spring', program: 'high-school', icon: CheckCircle2, accent: 'text-emerald-700 bg-emerald-50' },
  { key: 'cleared-off-season', label: 'Cleared: Camps & Off-Season', program: 'off-season', icon: CheckCircle2, accent: 'text-emerald-700 bg-emerald-50' },
  { key: 'incomplete-youth', label: 'Incomplete: Youth Spring', program: 'youth', icon: CircleDashed, accent: 'text-slate-700 bg-slate-100' },
  { key: 'incomplete-high-school', label: 'Incomplete: High School Spring', program: 'high-school', icon: CircleDashed, accent: 'text-slate-700 bg-slate-100' },
  { key: 'incomplete-off-season', label: 'Incomplete: Camps & Off-Season', program: 'off-season', icon: CircleDashed, accent: 'text-slate-700 bg-slate-100' },
  { key: 'expiring', label: 'Expiring in 60 Days', icon: Clock, accent: 'text-amber-800 bg-amber-50' },
  { key: 'expired', label: 'Expired', icon: AlertTriangle, accent: 'text-red-700 bg-red-50' },
  { key: 'pending', label: 'Awaiting Review', icon: Inbox, accent: 'text-brand bg-sky-50' },
  { key: 'in-progress', label: 'In Progress', icon: Hourglass, accent: 'text-violet-800 bg-violet-50' },
]

export const tileLabels: Record<Exclude<TileFilter, 'all'>, string> = Object.fromEntries(
  tiles.map((t) => [t.key, t.label]),
) as Record<Exclude<TileFilter, 'all'>, string>

export function SummaryTiles({
  summaries,
  active,
  onChange,
  program = 'all',
}: {
  summaries: CoachSummary[]
  active: TileFilter
  onChange: (f: TileFilter) => void
  /** When the dashboard is filtered to one program (or camps and off-season), only its cleared/incomplete tiles show. */
  program?: ViewScope
}) {
  const shown = tiles.filter((t) => !t.program || program === 'all' || t.program === program)
  return (
    <div className={cn('grid grid-cols-2 gap-3', shown.length > 6 ? 'sm:grid-cols-3 xl:grid-cols-5' : 'sm:grid-cols-3 xl:grid-cols-6')}>
      {shown.map(({ key, label, icon: Icon, accent }) => {
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
