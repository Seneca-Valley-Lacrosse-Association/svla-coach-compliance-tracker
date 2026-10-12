import { cn } from '@/lib/utils'

export function RequirementProgress({
  done,
  total,
  className,
  showLabel = true,
}: {
  done: number
  total: number
  className?: string
  showLabel?: boolean
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  const complete = done === total && total > 0
  return (
    <div className={cn('flex min-w-36 flex-col gap-1', className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${done} of ${total} requirements complete`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-all', complete ? 'bg-emerald-600' : 'bg-brand')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm text-muted-foreground">
          {done} of {total} requirements
        </span>
      )}
    </div>
  )
}
