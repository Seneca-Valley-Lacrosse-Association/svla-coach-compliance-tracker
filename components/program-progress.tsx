import type { CoachSummary, ProgramSummary } from '@/lib/compliance'
import { PROGRAM_LABELS, type Program } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Requirements done per program, one thin bar per program the person is assigned to.
 * A person on a Youth/HS team gets two bars, so partial progress on each side is visible.
 */
export function ProgramProgress({
  summary,
  programs,
  showVerdict = false,
  className,
}: {
  summary: CoachSummary
  /** Limit to these programs (for example the dashboard program filter). Defaults to every assigned program. */
  programs?: readonly Program[]
  /** Add a YES / NO cleared tag after each bar. */
  showVerdict?: boolean
  className?: string
}) {
  const rows = summary.programs.filter((p) => p.assigned && (!programs || programs.includes(p.program)))
  if (rows.length === 0) {
    return <p className={cn('text-sm text-muted-foreground', className)}>Not assigned to a program</p>
  }
  return (
    <div className={cn('flex min-w-44 flex-col gap-1.5', className)}>
      {rows.map((p) => (
        <ProgramRow key={p.program} p={p} showVerdict={showVerdict} />
      ))}
    </div>
  )
}

function ProgramRow({ p, showVerdict }: { p: ProgramSummary; showVerdict: boolean }) {
  const label = PROGRAM_LABELS[p.program]
  const pct = p.total === 0 ? 0 : Math.round((p.satisfiedCount / p.total) * 100)
  return (
    <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={p.total}
        aria-valuenow={p.satisfiedCount}
        aria-label={`${label}: ${p.satisfiedCount} of ${p.total} requirements complete${p.cleared ? ', cleared' : ', not cleared'}`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-all', p.cleared ? 'bg-emerald-600' : 'bg-brand')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="flex items-center gap-1.5">
        <span className="tabular-nums text-muted-foreground">
          {p.satisfiedCount}/{p.total}
        </span>
        {showVerdict && (
          <span
            className={cn(
              'rounded-full border px-1.5 text-xs font-semibold',
              p.cleared ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-red-600 bg-red-50 text-red-800',
            )}
          >
            {p.cleared ? 'YES' : 'NO'}
          </span>
        )}
      </span>
    </div>
  )
}
