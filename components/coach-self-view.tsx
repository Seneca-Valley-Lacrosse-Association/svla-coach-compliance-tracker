'use client'

import { Check } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { cn } from '@/lib/utils'
import { RequirementProgress } from '@/components/requirement-progress'
import { PayBadge } from '@/components/status-pill'
import { ChecklistRow } from '@/components/coach-detail/checklist-row'
import { ClearedBadge } from '@/components/coach-detail/cleared-badge'
import { MyRequests } from '@/components/help/my-requests'

export function CoachSelfView() {
  const { getSummary, currentCoachId } = useApp()
  const summary = getSummary(currentCoachId)
  if (!summary) return <section className="mx-auto flex max-w-xl flex-col gap-3 rounded-xl border bg-card p-6 text-card-foreground"><h1 className="text-2xl font-semibold">Awaiting roster access</h1><p className="leading-relaxed text-muted-foreground">Your account is signed in, but this email is not yet linked to a coach or approved board member. Ask the SVLA administrator to add this exact email to the roster or board access list, then refresh.</p><a href="/demo" className="text-primary underline underline-offset-4">Explore the five-coach board demo</a></section>

  const { coach, items, satisfiedCount, total } = summary
  const firstName = coach.name.split(' ')[0]
  const remaining = total - satisfiedCount

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-xs">
        <div>
          <h1 className="text-2xl font-semibold text-navy text-balance lg:text-3xl">Hi {firstName}, here&apos;s your checklist</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>
              {coach.team} · {coach.role}
            </span>
            <PayBadge pay={coach.pay} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-lg font-medium">
            {remaining === 0
              ? "You're all set. Thank you!"
              : `${satisfiedCount} of ${total} done. ${remaining} ${remaining === 1 ? 'step' : 'steps'} left.`}
          </p>
          <RequirementProgress done={satisfiedCount} total={total} showLabel={false} />
        </div>
        <ClearedBadge summary={summary} />
      </section>

      <section aria-labelledby="steps-heading" className="flex flex-col gap-3">
        <h2 id="steps-heading" className="text-lg font-semibold text-navy">
          Your steps
        </h2>
        <ol className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {items.map((item, index) => (
            <ChecklistRow
              key={item.requirement.id}
              item={item}
              coach={coach}
              mode="coach"
              stepLabel={
                <span
                  aria-label={item.satisfied ? `Step ${index + 1}, done` : `Step ${index + 1}`}
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full font-semibold',
                    item.satisfied ? 'bg-emerald-600 text-white' : 'bg-secondary text-navy ring-1 ring-brand/30',
                  )}
                >
                  {item.satisfied ? <Check className="size-5" aria-hidden="true" /> : index + 1}
                </span>
              }
            />
          ))}
        </ol>
      </section>

      <MyRequests />
    </div>
  )
}
