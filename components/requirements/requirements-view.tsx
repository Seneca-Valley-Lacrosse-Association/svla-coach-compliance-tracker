'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-store'
import { ResourceEditor } from './resource-editor'
import { validityLabel } from '@/lib/compliance'
import { reasonFor } from '@/lib/requirement-reasons'
import { LEVEL_LABELS, ROLES, type Requirement } from '@/lib/types'
import { PageHeader } from '@/components/page-header'
import { AddRequirementDialog } from './add-requirement-dialog'
import { cn } from '@/lib/utils'

function appliesLabel(req: Requirement) {
  const roles = req.appliesToRoles.length === ROLES.length ? 'All roles' : req.appliesToRoles.join(', ')
  const pay = req.appliesToPay.length === 2 ? '' : ` · ${req.appliesToPay[0]} only`
  return roles + pay
}

function SwitchToggle({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => Promise<void> }) {
  const { isDemo } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="flex flex-col gap-2"><button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy || isDemo}
      onClick={async () => { setBusy(true); setError(''); try { await onToggle() } catch (error) { setError(error instanceof Error ? error.message : 'Could not save.') } finally { setBusy(false) } }}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        checked ? 'bg-brand' : 'bg-slate-300',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5.5' : 'translate-x-0.5',
        )}
      />
    </button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>
  )
}

function ActiveToggle({ req }: { req: Requirement }) {
  const { setRequirementActive } = useApp()
  return <SwitchToggle checked={req.active} label={`${req.name} active`} onToggle={() => setRequirementActive(req.id, !req.active)} />
}

function ReviewToggle({ req }: { req: Requirement }) {
  const { setRequirementReview } = useApp()
  const needsReview = req.requiresReview !== false
  return <SwitchToggle checked={needsReview} label={`${req.name} needs board review`} onToggle={() => setRequirementReview(req.id, !needsReview)} />
}

export function RequirementsView() {
  const { requirements } = useApp()
  const sorted = [...requirements].sort((a, b) => a.order - b.order)

  return (
    <>
      <PageHeader
        title="Requirements"
        description="The clearances, trainings, and forms coaches must complete. Turning a requirement off removes it from every checklist. Turning Board review off approves new uploads automatically instead of sending them to the Review Queue."
        actions={<AddRequirementDialog />}
      />

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <table className="w-full min-w-[1200px] text-left">
          <thead className="border-b bg-muted/60 text-sm text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Requirement</th>
              <th scope="col" className="px-4 py-3 font-medium">Why, and where it comes from</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Program</th>
              <th scope="col" className="px-4 py-3 font-medium">Roles and pay</th>
              <th scope="col" className="px-4 py-3 font-medium">Valid for</th>
              <th scope="col" className="px-4 py-3 font-medium">Required</th>
              <th scope="col" className="px-4 py-3 font-medium">Active</th>
              <th scope="col" className="px-4 py-3 font-medium">Board review</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((r) => (
              <tr key={r.id} className={cn(!r.active && 'text-muted-foreground')}>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{r.name}</p>
                  <ResourceEditor requirement={r} />
                  {r.tracksObtainedAs && (
                    <p className="text-sm text-muted-foreground">Tracks volunteer vs. employment</p>
                  )}
                  {r.allowsVolunteerAffidavit && (
                    <p className="text-sm text-muted-foreground">Affidavit allowed for eligible volunteers</p>
                  )}
                </td>
                <td className="max-w-sm px-4 py-3 text-sm">
                  {(() => {
                    const reason = reasonFor(r)
                    if (!reason) return <span className="text-muted-foreground">Not written yet. Use Edit instructions / why.</span>
                    return (
                      <>
                        {reason.source && <p className="font-medium text-foreground">{reason.source}</p>}
                        <p className="mt-1 leading-relaxed">{reason.why}</p>
                      </>
                    )
                  })()}
                </td>
                <td className="px-4 py-3">{r.type}</td>
                <td className="px-4 py-3">
                  {LEVEL_LABELS[reasonFor(r)?.level ?? r.level ?? 'both']}
                </td>
                <td className="px-4 py-3">{appliesLabel(r)}</td>
                <td className="px-4 py-3">{validityLabel(r.validity)}</td>
                <td className="px-4 py-3">{r.required ? 'Yes' : 'Optional'}</td>
                <td className="px-4 py-3">
                  <ActiveToggle req={r} />
                </td>
                <td className="px-4 py-3">
                  <ReviewToggle req={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
