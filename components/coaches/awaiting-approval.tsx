'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-store'
import { PAY_STATUSES, type Coach } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { DeleteCoachDialog } from '@/components/coach-detail/delete-coach-dialog'

const selectClass = 'h-10 rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-brand'

// New coach profiles wait here (shown at the top of the Review Queue) until the board confirms paid/volunteer status and approves them.
export function AwaitingApproval() {
  const { awaitingCoaches, reviewCoach, isDemo } = useApp()
  // Nothing is preselected: the board must choose Paid or Volunteer for each person before approving.
  const [pay, setPay] = useState<Record<string, Coach['pay'] | ''>>({})
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  if (isDemo || awaitingCoaches.length === 0) return null
  const pending = awaitingCoaches.filter(c => c.status === 'pending')
  const declined = awaitingCoaches.filter(c => c.status === 'declined')

  async function review(coach: Coach, decision: 'approved' | 'declined') {
    if (busy) return
    const chosen = pay[coach.id]
    if (decision === 'approved' && !chosen) { setNotice(''); setError(`Choose Paid or Volunteer for ${coach.name} before approving.`); return }
    setBusy(coach.id); setError(''); setNotice('')
    try {
      const result = await reviewCoach(coach.id, decision, chosen || coach.pay)
      if (decision === 'approved') setNotice(result.emailSent ? `${coach.name} approved. We emailed them that they can log in.` : `${coach.name} approved, but the email could not be sent (email is not set up yet). Please tell them they can log in now.`)
      else setNotice(`${coach.name} declined. Use Delete to remove them, or Approve if you change your mind.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this decision.') }
    finally { setBusy('') }
  }

  const row = (coach: Coach, isDeclined: boolean) => (
    <li key={coach.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="font-medium">{coach.name} {isDeclined && <span className="ml-1 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Declined</span>}</p>
        <p className="text-sm text-muted-foreground">{coach.email}{coach.phone && ` · ${coach.phone}`}</p>
        <p className="text-sm text-muted-foreground">{coach.team} · {coach.role} · PA resident 10 years: {coach.paResident10Years ? 'Yes' : 'No'}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`pay-${coach.id}`}>Pay status for {coach.name}</label>
        <select id={`pay-${coach.id}`} className={selectClass} value={pay[coach.id] ?? ''} onChange={e => { setError(''); setPay({ ...pay, [coach.id]: e.target.value as Coach['pay'] }) }}>
          <option value="" disabled>Select pay status…</option>
          {PAY_STATUSES.map(p => <option key={p}>{p}</option>)}
        </select>
        <Button type="button" className="h-10 px-4" disabled={busy === coach.id || !pay[coach.id]} onClick={() => void review(coach, 'approved')}>Approve</Button>
        {isDeclined ? <DeleteCoachDialog coach={coach} /> : <Button type="button" variant="outline" className="h-10 px-4 text-destructive" disabled={busy === coach.id} onClick={() => void review(coach, 'declined')}>Decline</Button>}
      </div>
    </li>
  )

  return (
    <section aria-labelledby="awaiting-approval" className="mb-6 rounded-xl border border-sky-300 bg-sky-50 p-5">
      <h2 id="awaiting-approval" className="text-lg font-semibold text-navy">Awaiting approval ({pending.length})</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Confirm each coach&rsquo;s details and choose Paid or Volunteer. Paid coaches must provide fingerprints. Approving sends them an email that they can log in.</p>
      {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <ul className="divide-y divide-sky-200">{pending.map(c => row(c, false))}</ul>
      {declined.length > 0 && <><h3 className="mt-4 text-sm font-semibold text-navy">Declined ({declined.length})</h3><ul className="divide-y divide-sky-200">{declined.map(c => row(c, true))}</ul></>}
    </section>
  )
}
