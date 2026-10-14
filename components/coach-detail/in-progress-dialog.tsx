'use client'

import { useState } from 'react'
import { Hourglass } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { TODAY } from '@/lib/compliance'
import type { Coach, Progress, Requirement } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

// Lets a coach (or a board member) record that a requirement has been started, for example a clearance that has
// been applied for and is waiting on the agency. It is a visibility marker only: it never counts as cleared and
// it does not go to the review queue. Uploading the real document replaces it.
export function InProgressButton({ coach, requirement, progress }: { coach: Coach; requirement: Requirement; progress: Progress | null }) {
  const { markInProgress, clearInProgress, isDemo } = useApp()
  const [open, setOpen] = useState(false)
  const [startedOn, setStartedOn] = useState(progress?.startedOn ?? TODAY)
  const [followUpOn, setFollowUpOn] = useState(progress?.followUpOn ?? '')
  const [note, setNote] = useState(progress?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function reset(next: boolean) {
    setOpen(next)
    setError('')
    if (next) { setStartedOn(progress?.startedOn ?? TODAY); setFollowUpOn(progress?.followUpOn ?? ''); setNote(progress?.note ?? '') }
  }

  async function save() {
    if (busy) return
    setError('')
    if (!startedOn) return setError('Enter the date you started.')
    if (startedOn > TODAY) return setError('The start date cannot be in the future.')
    if (followUpOn && followUpOn < startedOn) return setError('The follow-up date cannot be before the start date.')
    setBusy(true)
    try {
      await markInProgress({ coachId: coach.id, requirementId: requirement.id, startedOn, followUpOn: followUpOn || undefined, note: note.trim() || undefined })
      setOpen(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.') }
    finally { setBusy(false) }
  }

  async function clear() {
    if (busy) return
    setBusy(true); setError('')
    try { await clearInProgress(coach.id, requirement.id); setOpen(false) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not clear this.') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger disabled={isDemo} render={<Button variant="outline" className="h-9 px-3 text-sm" disabled={isDemo} title={isDemo ? 'Read-only demonstration' : undefined} />}>
        <Hourglass data-icon="inline-start" aria-hidden="true" />
        {progress ? 'Update progress' : 'Mark as started'}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg text-navy">{requirement.name}</DialogTitle>
          <DialogDescription className="text-base">
            Use this when you have applied or begun but do not have the document yet. It lets the board see you are working on it. It does not count as complete until you upload the document and the board approves it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="progress-started">Date you started or applied</Label>
          <Input id="progress-started" type="date" value={startedOn} max={TODAY} onChange={e => setStartedOn(e.target.value)} className="h-10 text-base" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="progress-follow">Follow-up date <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="progress-follow" type="date" value={followUpOn} min={startedOn || undefined} onChange={e => setFollowUpOn(e.target.value)} className="h-10 text-base" />
          <p className="text-sm text-muted-foreground">When you expect to have it, or when you plan to check back.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="progress-note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea id="progress-note" value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={300} placeholder="e.g. Applied online, waiting on the certificate." className="text-base" />
          <p className="text-sm text-muted-foreground">Please do not enter clearance numbers or other personal identifiers here.</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <DialogFooter className="-mx-4 -mb-4 border-t bg-muted/50 p-4">
          {progress && <Button type="button" variant="outline" className="mr-auto h-10 px-4" onClick={clear} disabled={busy}>Clear</Button>}
          <Button type="button" variant="outline" className="h-10 px-4" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" className="h-10 px-4" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
