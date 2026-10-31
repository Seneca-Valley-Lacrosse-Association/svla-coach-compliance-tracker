import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import type { CoachSummary, OffSeasonSummary, ProgramSummary } from '@/lib/compliance'
import { itemStatusMap } from '@/components/status-pill'
import { OFF_SEASON_LABEL, PROGRAM_LABELS, SPRING_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * One box per program. Always a definite YES or NO, never blank or "n/a":
 * - assigned and every requirement met: green YES
 * - assigned with items missing: red NO plus the missing list
 * - not assigned: NO in a neutral outline, labelled "not assigned to this program"
 */
function ProgramBox({ summary }: { summary: ProgramSummary }) {
  const { program, assigned, cleared, missing, meetsRequirements } = summary
  const label = PROGRAM_LABELS[program]
  const title = SPRING_LABELS[program]
  const tone = cleared
    ? { box: 'border-emerald-600 bg-emerald-50', icon: 'text-emerald-700', word: 'text-emerald-800', list: 'text-red-900' }
    : assigned
      ? { box: 'border-red-600 bg-red-50', icon: 'text-red-700', word: 'text-red-800', list: 'text-red-900' }
      : { box: 'border-slate-400 bg-background', icon: 'text-slate-500', word: 'text-slate-700', list: 'text-slate-700' }
  const Icon = cleared ? CheckCircle2 : assigned ? XCircle : MinusCircle

  return (
    <section aria-label={`Cleared to coach ${label}`} className={cn('flex flex-col gap-3 rounded-xl border-2 p-4', tone.box)}>
      <div className="flex items-center gap-3">
        <Icon className={cn('size-10 shrink-0', tone.icon)} aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">Cleared to Coach: {title}</p>
          <p className={cn('text-3xl font-bold', tone.word)}>{cleared ? 'YES' : 'NO'}</p>
        </div>
      </div>
      {cleared && summary.hasExpiring && (
        <p className="text-sm text-amber-900">Cleared, but at least one item expires within 60 days.</p>
      )}
      {!cleared && !assigned && (
        <div className="text-sm text-slate-700">
          <p className="font-medium">Not cleared for {label}: not assigned to this program.</p>
          {meetsRequirements ? (
            <p className="mt-1">This person meets every {label} requirement. The board can assign them to {label} so they can coach there.</p>
          ) : missing.length > 0 ? (
            <>
              <p className="mt-1">Still needed for {label}:</p>
              <ul className="mt-1 list-disc pl-5">
                {missing.map((i) => (
                  <li key={i.requirement.id}>
                    {i.requirement.name} <span className="opacity-80">({itemStatusMap[i.status].label.toLowerCase()})</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      )}
      {!cleared && assigned && (
        <div className="text-sm">
          <p className={cn('font-medium', tone.list)}>Missing or not yet approved:</p>
          {missing.length > 0 ? (
            <ul className={cn('mt-1 list-disc pl-5', tone.list)}>
              {missing.map((i) => (
                <li key={i.requirement.id}>
                  {i.requirement.name}{' '}
                  <span className="text-red-800/90">({itemStatusMap[i.status].label.toLowerCase()})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn('mt-1', tone.list)}>No {label} requirements are set up yet.</p>
          )}
        </div>
      )}
    </section>
  )
}

/** Camps, clinics and off-season tournaments. Every coach is eligible, so it is a plain YES or NO. */
function OffSeasonBox({ summary }: { summary: OffSeasonSummary }) {
  const { cleared, missing } = summary
  const tone = cleared
    ? { box: 'border-emerald-600 bg-emerald-50', icon: 'text-emerald-700', word: 'text-emerald-800' }
    : { box: 'border-red-600 bg-red-50', icon: 'text-red-700', word: 'text-red-800' }
  const Icon = cleared ? CheckCircle2 : XCircle
  return (
    <section aria-label={`Cleared for ${OFF_SEASON_LABEL}`} className={cn('flex flex-col gap-3 rounded-xl border-2 p-4', tone.box)}>
      <div className="flex items-center gap-3">
        <Icon className={cn('size-10 shrink-0', tone.icon)} aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">Cleared for: {OFF_SEASON_LABEL}</p>
          <p className={cn('text-3xl font-bold', tone.word)}>{cleared ? 'YES' : 'NO'}</p>
        </div>
      </div>
      {cleared && summary.hasExpiring && (
        <p className="text-sm text-amber-900">Cleared, but at least one item expires within 60 days.</p>
      )}
      {!cleared && (
        <div className="text-sm text-red-900">
          <p className="font-medium">Still needed:</p>
          {missing.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {missing.map((i) => (
                <li key={i.requirement.id}>
                  {i.requirement.name} <span className="text-red-800/90">({itemStatusMap[i.status].label.toLowerCase()})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">No off-season requirements are set up yet.</p>
          )}
        </div>
      )}
    </section>
  )
}

export function ClearedBadge({ summary }: { summary: CoachSummary }) {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[54rem] lg:grid-cols-3">
      {summary.programs.map((p) => (
        <ProgramBox key={p.program} summary={p} />
      ))}
      <OffSeasonBox summary={summary.offSeason} />
    </div>
  )
}
