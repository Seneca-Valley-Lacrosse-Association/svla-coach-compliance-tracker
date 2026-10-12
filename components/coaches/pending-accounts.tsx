'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-store'
import { formatDate } from '@/lib/compliance'
import { Button } from '@/components/ui/button'
import { AddCoachDialog } from './add-coach-dialog'

// People who created and confirmed an account but are not on the roster yet. The board decides who belongs.
export function PendingAccounts({ onAdded }: { onAdded: (name: string) => void }) {
  const { pendingAccounts, isDemo, removeAccount } = useApp()
  const [open, setOpen] = useState(true)
  const [confirming, setConfirming] = useState('')
  const [error, setError] = useState('')
  async function remove(email: string) {
    setError('')
    try { await removeAccount(email); setConfirming('') } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove this account.') }
  }
  if (isDemo || pendingAccounts.length === 0) return null
  return (
    <section aria-labelledby="pending-accounts" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
        <h2 id="pending-accounts" className="text-lg font-semibold text-navy">Signed up, not on the roster ({pendingAccounts.length})</h2>
        <span className="text-sm text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <>
          <p className="mt-1 mb-3 text-sm leading-relaxed text-muted-foreground">These people confirmed an account but see nothing until you add them to the roster with the same email. Remove the account of anyone who should not have access.</p>
          {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
          <ul className="divide-y divide-amber-200">
            {pendingAccounts.map((a) => (
              <li key={a.email} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span><span className="font-medium">{a.email}</span><span className="ml-2 text-sm text-muted-foreground">signed up {formatDate(a.created_at)}</span></span>
                <span className="flex flex-wrap items-center gap-2">
                  <AddCoachDialog onAdded={onAdded} initialEmail={a.email} label="Add to roster" variant="outline" />
                  {confirming === a.email ? (
                    <>
                      <Button type="button" variant="destructive" className="h-10 px-4" onClick={() => void remove(a.email)}>Confirm remove</Button>
                      <Button type="button" variant="outline" className="h-10 px-4" onClick={() => setConfirming('')}>Cancel</Button>
                    </>
                  ) : <Button type="button" variant="outline" className="h-10 px-4 text-destructive" onClick={() => setConfirming(a.email)}>Remove account</Button>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
