'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import type { Requirement, Submission } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

// Board correction of a submission's dates (for example when a coach typed the wrong completion date).
// The expiration is recalculated from the requirement's rules, and the change is logged.
export function EditDatesDialog({ submission, requirement }: { submission: Submission; requirement: Requirement }) {
  const { editSubmissionDates, isDemo } = useApp()
  const membership = requirement.validity.kind === 'membership'
  const [open, setOpen] = useState(false)
  const [completed, setCompleted] = useState(submission.completedOn)
  const [expiry, setExpiry] = useState((submission as { membershipExpiry?: string }).membershipExpiry ?? submission.expiresOn ?? '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (busy) return
    setBusy(true); setError('')
    try { await editSubmissionDates(submission.id, completed, note.trim() || undefined, membership ? expiry : undefined); setOpen(false) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save the dates.') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={next => { setOpen(next); setError('') }}>
      <DialogTrigger disabled={isDemo} render={<Button variant="outline" size="sm" disabled={isDemo} />}>
        <Pencil data-icon="inline-start" aria-hidden="true" />
        Edit dates
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Correct dates: {requirement.name}</DialogTitle>
          <DialogDescription>Use this when a date was entered incorrectly. The expiration date is recalculated from the requirement’s rules. The review decision and uploaded file are not changed, and this correction is recorded in the history.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-completed">Completed on</Label>
            <Input id="edit-completed" type="date" value={completed} onChange={e => setCompleted(e.target.value)} />
          </div>
          {membership && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-expiry">Membership expires on</Label>
              <Input id="edit-expiry" type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-note">Reason (optional)</Label>
            <Input id="edit-note" value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="For example: coach typed the wrong year" />
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={busy || !completed || (membership && !expiry)}>{busy ? 'Saving…' : 'Save dates'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
