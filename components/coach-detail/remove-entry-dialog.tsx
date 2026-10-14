'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import type { Submission } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

// Removes one requirement's entry: the uploaded file, the dates, and any review history for that requirement.
// The requirement then shows as not started. Other requirements are not touched.
export function RemoveEntryDialog({ submission, requirementName, mode }: { submission: Submission; requirementName: string; mode: 'board' | 'coach' }) {
  const { removeSubmission, isDemo } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (busy) return
    setBusy(true); setError('')
    try { await removeSubmission(submission.id); setOpen(false) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove this entry.') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={next => { setOpen(next); setError('') }}>
      <DialogTrigger disabled={isDemo} render={<Button variant="outline" size="sm" className="text-destructive" disabled={isDemo} />}>
        <Trash2 data-icon="inline-start" aria-hidden="true" />
        Remove
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {requirementName}?</DialogTitle>
          <DialogDescription>
            This deletes the uploaded document and the dates entered for this requirement only. {mode === 'coach' ? 'It will show as not started again, and you can upload a new one at any time.' : 'It will show as not started again for this coach.'} Your other requirements are not affected.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={busy}>{busy ? 'Removing…' : 'Remove'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
