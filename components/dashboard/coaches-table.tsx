'use client'

import Link from '@/components/app-link'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import type { CoachSummary } from '@/lib/compliance'
import { ComplianceStatusPill, PayBadge } from '@/components/status-pill'
import { RequirementProgress } from '@/components/requirement-progress'

export function CoachesTable({ summaries }: { summaries: CoachSummary[] }) {
  const router = useRouter()
  const pathname = usePathname()

  if (summaries.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
        No coaches match this filter.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <table className="hidden w-full text-left md:table">
        <thead className="border-b bg-muted/60 text-sm text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Name</th>
            <th scope="col" className="px-4 py-3 font-medium">Team</th>
            <th scope="col" className="px-4 py-3 font-medium">Role</th>
            <th scope="col" className="px-4 py-3 font-medium">Pay Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Compliance</th>
            <th scope="col" className="px-4 py-3 font-medium">Progress</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {summaries.map((s) => (
            <tr
              key={s.coach.id}
              onClick={() => router.push(`${pathname.startsWith('/demo') ? '/demo' : ''}/coaches/${s.coach.id}`)}
              className="cursor-pointer transition-colors hover:bg-secondary/60"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/coaches/${s.coach.id}`}
                  className="font-medium text-brand hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {s.coach.name}
                </Link>
              </td>
              <td className="px-4 py-3">{s.coach.team}</td>
              <td className="px-4 py-3">{s.coach.role}</td>
              <td className="px-4 py-3">
                <PayBadge pay={s.coach.pay} />
              </td>
              <td className="px-4 py-3">
                <ComplianceStatusPill status={s.status} />
              </td>
              <td className="px-4 py-3">
                <RequirementProgress done={s.satisfiedCount} total={s.total} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y md:hidden">
        {summaries.map((s) => (
          <li key={s.coach.id}>
            <Link
              href={`/coaches/${s.coach.id}`}
              className="flex items-center gap-3 p-4 hover:bg-secondary/60"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-brand">{s.coach.name}</span>
                  <ComplianceStatusPill status={s.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {s.coach.team} · {s.coach.role} · {s.coach.pay}
                </p>
                <RequirementProgress done={s.satisfiedCount} total={s.total} />
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
