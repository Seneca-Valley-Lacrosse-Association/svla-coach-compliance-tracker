import { CheckCircle2, XCircle } from 'lucide-react'
import type { CoachSummary } from '@/lib/compliance'
import { itemStatusMap } from '@/components/status-pill'
import { cn } from '@/lib/utils'

export function ClearedBadge({ summary }: { summary: CoachSummary }) {
  const { cleared, missing } = summary
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-3 rounded-xl border-2 p-4 lg:max-w-sm',
        cleared ? 'border-emerald-600 bg-emerald-50' : 'border-red-600 bg-red-50',
      )}
    >
      <div className="flex items-center gap-3">
        {cleared ? (
          <CheckCircle2 className="size-10 text-emerald-700" aria-hidden="true" />
        ) : (
          <XCircle className="size-10 text-red-700" aria-hidden="true" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">Cleared to Coach</p>
          <p className={cn('text-3xl font-bold', cleared ? 'text-emerald-800' : 'text-red-800')}>
            {cleared ? 'YES' : 'NO'}
          </p>
        </div>
      </div>
      {cleared && summary.hasExpiring && (
        <p className="text-sm text-amber-900">Cleared, but at least one item expires within 60 days.</p>
      )}
      {!cleared && (
        <div className="text-sm">
          <p className="font-medium text-red-900">Missing or not yet approved:</p>
          <ul className="mt-1 list-disc pl-5 text-red-900">
            {missing.map((i) => (
              <li key={i.requirement.id}>
                {i.requirement.name}{' '}
                <span className="text-red-800/90">({itemStatusMap[i.status].label.toLowerCase()})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
