'use client'

import Link from '@/components/app-link'
import { useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react'
import type { CoachSummary } from '@/lib/compliance'
import { useApp } from '@/lib/app-store'
import { loginStateOf } from '@/lib/types'
import { ComplianceStatusPill, PayBadge } from '@/components/status-pill'
import { RequirementProgress } from '@/components/requirement-progress'
import { LoginCell } from '@/components/coaches/login-status'

type SortKey = 'name' | 'team' | 'role' | 'pay' | 'login' | 'status' | 'progress'
type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null

// Worst first when ascending, so the people who need attention rise to the top.
const STATUS_RANK: Record<string, number> = { expired: 0, incomplete: 1, expiring: 2, cleared: 3 }
const LOGIN_RANK = { none: 0, invited: 1, active: 2 }
const TEAM_ORDER = ['8U', '10U', '12U', '14U', 'HS-JV', 'HS-Varsity', 'Board', 'Volunteer']

function SortHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: SortKey; sort: SortState; onSort: (k: SortKey) => void }) {
  const active = sort?.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3 font-medium">
      <button type="button" onClick={() => onSort(sortKey)} className="-mx-1 inline-flex items-center gap-1.5 rounded px-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand">
        {label}
        <Icon className={active ? 'size-4 text-foreground' : 'size-4 opacity-50'} aria-hidden="true" />
      </button>
    </th>
  )
}

export function CoachesTable({ summaries, showLogin = false }: { summaries: CoachSummary[]; showLogin?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const { loginByEmail } = useApp()
  const [sort, setSort] = useState<SortState>(null)

  // Click cycles ascending, descending, then back to the original order.
  function onSort(key: SortKey) {
    setSort((cur) => (cur?.key !== key ? { key, dir: 'asc' } : cur.dir === 'asc' ? { key, dir: 'desc' } : null))
  }

  const rows = useMemo(() => {
    if (!sort) return summaries
    const loginOf = (s: CoachSummary) => LOGIN_RANK[loginStateOf(loginByEmail?.[s.coach.email.toLowerCase()])]
    const value = (s: CoachSummary): string | number => {
      switch (sort.key) {
        case 'name': return s.coach.name.toLowerCase()
        case 'team': { const i = TEAM_ORDER.indexOf(s.coach.team); return i === -1 ? TEAM_ORDER.length : i }
        case 'role': return String(s.coach.role).toLowerCase()
        case 'pay': return String(s.coach.pay).toLowerCase()
        case 'login': return loginOf(s)
        case 'status': return STATUS_RANK[s.status] ?? 99
        case 'progress': return s.total ? s.satisfiedCount / s.total : 0
      }
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...summaries].sort((a, b) => {
      const va = value(a), vb = value(b)
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return c !== 0 ? c * dir : a.coach.name.localeCompare(b.coach.name)
    })
  }, [summaries, sort, loginByEmail])

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
            <SortHeader label="Name" sortKey="name" sort={sort} onSort={onSort} />
            <SortHeader label="Team" sortKey="team" sort={sort} onSort={onSort} />
            <SortHeader label="Role" sortKey="role" sort={sort} onSort={onSort} />
            <SortHeader label="Pay Status" sortKey="pay" sort={sort} onSort={onSort} />
            {showLogin && <SortHeader label="Login" sortKey="login" sort={sort} onSort={onSort} />}
            <SortHeader label="Compliance" sortKey="status" sort={sort} onSort={onSort} />
            <SortHeader label="Progress" sortKey="progress" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((s) => (
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
              {showLogin && <td className="px-4 py-3"><LoginCell coach={s.coach} /></td>}
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
                  {showLogin && <LoginCell coach={s.coach} />}
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
