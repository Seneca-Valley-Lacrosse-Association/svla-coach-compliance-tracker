'use client'

import Link from '@/components/app-link'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { PayBadge } from '@/components/status-pill'
import { ProgramProgress } from '@/components/program-progress'
import { PortalAccess } from '@/components/coaches/login-status'
import { ChecklistRow } from './checklist-row'
import { ClearedBadge } from './cleared-badge'
import { EditCoachDialog } from './edit-coach-dialog'
import { RemoveCoachDialog } from './delete-coach-dialog'
import { PrintBadgeDialog } from '@/components/badges/print-badge-dialog'

export function CoachDetail({ id }: { id: string }) {
  const { getSummary, viewMode } = useApp()
  const summary = getSummary(id)

  if (!summary) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <p className="font-medium">Coach not found.</p>
        <Link href="/coaches" className="mt-2 inline-block text-brand underline">
          Back to coaches
        </Link>
      </div>
    )
  }

  const { coach, items } = summary

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-brand hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      <section
        aria-labelledby="coach-name"
        className="flex flex-col gap-6 rounded-xl border bg-card p-5 shadow-xs lg:flex-row lg:items-start lg:justify-between"
      >
        <div className="flex flex-col gap-3">
          <h1 id="coach-name" className="text-2xl font-semibold text-navy lg:text-3xl">
            {coach.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-secondary px-2 py-0.5 text-sm font-medium text-navy">{coach.team}</span>
            <span>{coach.role}</span>
            <PayBadge pay={coach.pay} />
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
            <a href={`tel:${coach.phone.replace(/\D/g, '')}`} className="inline-flex items-center gap-2 text-brand hover:underline">
              <Phone className="size-4" aria-hidden="true" />
              {coach.phone}
            </a>
            <a href={`mailto:${coach.email}`} className="inline-flex items-center gap-2 text-brand hover:underline">
              <Mail className="size-4" aria-hidden="true" />
              {coach.email}
            </a>
          </div>
          <ProgramProgress summary={summary} className="max-w-sm" />
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <ClearedBadge summary={summary} />
          {viewMode === 'board' && (
            <>
              <EditCoachDialog key={`${coach.id}-${coach.team}-${coach.role}-${coach.pay}-${coach.name}`} coach={coach} />
              {!coach.archivedAt && <PrintBadgeDialog summary={summary} />}
              <RemoveCoachDialog coach={coach} />
            </>
          )}
        </div>
      </section>

      {coach.archivedAt && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">This coach record is archived ({coach.archivedAt.slice(0, 10)}). It is hidden from the roster and dashboard, and the coach cannot use their login. Use “Restore or delete” to change that.</p>}

      {viewMode === 'board' && !coach.archivedAt && <PortalAccess key={coach.id} coach={coach} />}

      <section aria-labelledby="checklist-heading" className="flex flex-col gap-3">
        <h2 id="checklist-heading" className="text-lg font-semibold text-navy">
          Requirements checklist
        </h2>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {items.map((item) => (
            <ChecklistRow key={item.requirement.id} item={item} coach={coach} mode="board" />
          ))}
        </ul>
      </section>
    </div>
  )
}
