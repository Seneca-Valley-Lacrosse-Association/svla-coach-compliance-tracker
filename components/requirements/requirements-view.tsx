'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-store'
import { ResourceEditor } from './resource-editor'
import { validityLabel } from '@/lib/compliance'
import { ROLES, type Requirement } from '@/lib/types'
import { PageHeader } from '@/components/page-header'
import { AddRequirementDialog } from './add-requirement-dialog'
import { cn } from '@/lib/utils'

function appliesLabel(req: Requirement) {
  const roles = req.appliesToRoles.length === ROLES.length ? 'All roles' : req.appliesToRoles.join(', ')
  const pay = req.appliesToPay.length === 2 ? '' : ` · ${req.appliesToPay[0]} only`
  return roles + pay
}

function ActiveToggle({ req }: { req: Requirement }) {
  const { setRequirementActive, isDemo } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="flex flex-col gap-2"><button
      type="button"
      role="switch"
      aria-checked={req.active}
      aria-label={`${req.name} active`}
      disabled={busy || isDemo}
      onClick={async () => { setBusy(true); setError(''); try { await setRequirementActive(req.id, !req.active) } catch (error) { setError(error instanceof Error ? error.message : 'Could not save.') } finally { setBusy(false) } }}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        req.active ? 'bg-brand' : 'bg-slate-300',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow transition-transform',
          req.active ? 'translate-x-5.5' : 'translate-x-0.5',
        )}
      />
    </button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>
  )
}

export function RequirementsView() {
  const { requirements } = useApp()
  const sorted = [...requirements].sort((a, b) => a.order - b.order)

  return (
    <>
      <PageHeader
        title="Requirements"
        description="The clearances, trainings, and forms coaches must complete. Turning a requirement off removes it from every checklist."
        actions={<AddRequirementDialog />}
      />

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <table className="w-full min-w-[820px] text-left">
          <thead className="border-b bg-muted/60 text-sm text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Requirement</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Applies to</th>
              <th scope="col" className="px-4 py-3 font-medium">Valid for</th>
              <th scope="col" className="px-4 py-3 font-medium">Required</th>
              <th scope="col" className="px-4 py-3 font-medium">Active</th>
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
                <td className="px-4 py-3">{r.type}</td>
                <td className="px-4 py-3">{appliesLabel(r)}</td>
                <td className="px-4 py-3">{validityLabel(r.validity)}</td>
                <td className="px-4 py-3">{r.required ? 'Yes' : 'Optional'}</td>
                <td className="px-4 py-3">
                  <ActiveToggle req={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
