'use client'

import Link from '@/components/app-link'
import { Download } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { appliesTo, daysBetween, formatDate, TODAY } from '@/lib/compliance'
import { TEAMS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { RequirementProgress } from '@/components/requirement-progress'

function csvEscape(value: string | number) {
  const raw = String(value)
  const s = /^[\s]*[=+@-]|^[\t\r\n]/.test(raw) ? `'${raw}` : raw
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function ReportsView() {
  const { summaries, requirements, isDemo } = useApp()

  const upcoming = summaries
    .flatMap((s) =>
      s.items
        .filter((i) => i.approved?.expiresOn && i.satisfied)
        .map((i) => ({ coach: s.coach, req: i.requirement, expiresOn: i.approved!.expiresOn! })),
    )
    .map((x) => ({ ...x, days: daysBetween(TODAY, x.expiresOn) }))
    .filter((x) => x.days >= 0 && x.days <= 90)
    .sort((a, b) => a.days - b.days)

  const completion = requirements
    .filter((r) => r.active && r.required)
    .sort((a, b) => a.order - b.order)
    .map((r) => {
      const applicable = summaries.filter((s) => appliesTo(r, s.coach))
      const done = applicable.filter((s) => s.items.find((i) => i.requirement.id === r.id)?.satisfied).length
      return { req: r, done, total: applicable.length }
    })

  function exportCsv() {
    const header = ['Name', 'Team', 'Role', 'Pay Status', 'Compliance', 'Cleared', 'Completed', 'Required', 'Missing']
    const rows = summaries.map((s) => [
      isDemo ? `[DEMO] ${s.coach.name}` : s.coach.name,
      s.coach.team,
      s.coach.role,
      s.coach.pay,
      s.status,
      s.cleared ? 'Yes' : 'No',
      s.satisfiedCount,
      s.total,
      s.missing.map((m) => m.requirement.name).join('; '),
    ])
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `svla-${isDemo ? 'DEMO-' : ''}coach-compliance-${TODAY}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Season-wide compliance at a glance."
        actions={
          <Button variant="outline" className="h-10 bg-card px-4" onClick={exportCsv}>
            <Download aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="by-team" className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 id="by-team" className="mb-4 text-lg font-semibold text-navy">Cleared by team</h2>
          <ul className="flex flex-col gap-4">
            {TEAMS.map((t) => {
              const staff = summaries.filter((s) => s.coach.team === t)
              const cleared = staff.filter((s) => s.cleared).length
              return (
                <li key={t} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3">
                  <span className="font-medium">{t}</span>
                  <RequirementProgress done={cleared} total={staff.length} showLabel={false} />
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {cleared}/{staff.length}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="by-req" className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 id="by-req" className="mb-4 text-lg font-semibold text-navy">Completion by requirement</h2>
          <ul className="flex flex-col gap-4">
            {completion.map(({ req, done, total }) => (
              <li key={req.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{req.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {done}/{total}
                  </span>
                </div>
                <RequirementProgress done={done} total={total} showLabel={false} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="upcoming" className="rounded-xl border bg-card p-5 shadow-xs xl:col-span-2">
          <h2 id="upcoming" className="mb-4 text-lg font-semibold text-navy">Expiring in the next 90 days</h2>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground">Nothing expires in the next 90 days.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((x) => (
                <li key={`${x.coach.id}-${x.req.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <Link href={`/coaches/${x.coach.id}`} className="font-medium text-brand hover:underline">
                    {x.coach.name}
                  </Link>
                  <span className="text-muted-foreground">{x.req.name}</span>
                  <span className="ml-auto text-sm">
                    {formatDate(x.expiresOn)}{' '}
                    <span className={x.days <= 60 ? 'font-medium text-amber-900' : 'text-muted-foreground'}>
                      (in {x.days} days)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
