'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-store'
import { formatDate } from '@/lib/compliance'
import { AddCoachDialog } from './add-coach-dialog'

// People who created and confirmed an account but are not on the roster yet. The board decides who belongs.
export function PendingAccounts({ onAdded }: { onAdded: (name: string) => void }) {
  const { pendingAccounts, isDemo } = useApp()
  const [open, setOpen] = useState(true)
  if (isDemo || pendingAccounts.length === 0) return null
  return (
    <section aria-labelledby="pending-accounts" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
        <h2 id="pending-accounts" className="text-lg font-semibold text-navy">Signed up, not on the roster ({pendingAccounts.length})</h2>
        <span className="text-sm text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <>
          <p className="mt-1 mb-3 text-sm leading-relaxed text-muted-foreground">These people confirmed an account but see nothing until you add them to the roster with the same email. Ignore anyone who should not have access.</p>
          <ul className="divide-y divide-amber-200">
            {pendingAccounts.map((a) => (
              <li key={a.email} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span><span className="font-medium">{a.email}</span><span className="ml-2 text-sm text-muted-foreground">signed up {formatDate(a.created_at)}</span></span>
                <AddCoachDialog onAdded={onAdded} initialEmail={a.email} label="Add to roster" variant="outline" />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
