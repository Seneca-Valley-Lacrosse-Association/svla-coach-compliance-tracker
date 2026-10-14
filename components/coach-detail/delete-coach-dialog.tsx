'use client'

import { useState } from 'react'
import { Archive, Download, FileSpreadsheet, RotateCcw, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/app-store'
import type { Coach } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

// Archive is the normal way to retire a coach. Permanent delete is a second, deliberate step with a backup prompt.
export function RemoveCoachDialog({ coach }: { coach: Coach }) {
  const { archiveCoach, restoreCoach, deleteCoach, isDemo } = useApp()
  const router = useRouter()
  const archived = !!coach.archivedAt
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'choose' | 'delete'>('choose')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function reset(next: boolean) { setOpen(next); setStep('choose'); setTyped(''); setError('') }
  async function run(action: () => Promise<void>, after: () => void, fallback: string) {
    if (busy) return
    setBusy(true); setError('')
    try { await action(); setOpen(false); after() }
    catch (e) { setError(e instanceof Error ? e.message : fallback) }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger disabled={isDemo} render={<Button variant="outline" className="h-10 px-4" disabled={isDemo} />}>
        <Archive data-icon="inline-start" aria-hidden="true" />
        {archived ? 'Restore or delete' : 'Archive or delete'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === 'choose' ? (
          <>
            <DialogHeader>
              <DialogTitle>{archived ? `${coach.name} is archived` : `Remove ${coach.name}?`}</DialogTitle>
              <DialogDescription>
                {archived
                  ? 'Archived coaches are hidden from the roster and the dashboard, and cannot use their login. All submissions and documents are kept.'
                  : 'Archiving hides this coach from the roster and the dashboard and turns off their login. All submissions and documents are kept, and you can restore the record at any time.'}
              </DialogDescription>
            </DialogHeader>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-col gap-2">
              {archived
                ? <Button type="button" onClick={() => run(() => restoreCoach(coach.id), () => {}, 'Could not restore this coach.')} disabled={busy}><RotateCcw data-icon="inline-start" aria-hidden="true" />{busy ? 'Restoring…' : 'Restore coach (recommended)'}</Button>
                : <Button type="button" onClick={() => run(() => archiveCoach(coach.id), () => router.push('/coaches'), 'Could not archive this coach.')} disabled={busy}><Archive data-icon="inline-start" aria-hidden="true" />{busy ? 'Archiving…' : 'Archive coach (recommended)'}</Button>}
              <Button type="button" variant="outline" className="text-destructive" onClick={() => setStep('delete')}><Trash2 data-icon="inline-start" aria-hidden="true" />Permanently delete…</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Permanently delete {coach.name}?</DialogTitle>
              <DialogDescription>Warning: this deletes the coach record, every submission, and all uploaded files. It cannot be undone. Did you want to back them up first?</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm">
              <Button type="button" variant="outline" render={<a href={`/api/coaches/${coach.id}/backup`} download />}><Download data-icon="inline-start" aria-hidden="true" />Back up this coach’s files (ZIP)</Button>
              <Button type="button" variant="outline" render={<a href="/api/export" download />}><FileSpreadsheet data-icon="inline-start" aria-hidden="true" />Download full export (Excel)</Button>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-name">Type the coach’s full name to confirm</Label>
              <Input id="confirm-name" value={typed} onChange={e => setTyped(e.target.value)} placeholder={coach.name} autoComplete="off" />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('choose')}>Back</Button>
              <Button type="button" variant="destructive" disabled={busy || typed.trim().toLowerCase() !== coach.name.trim().toLowerCase()} onClick={() => run(() => deleteCoach(coach.id), () => router.push('/coaches'), 'Could not delete this coach.')}>{busy ? 'Deleting…' : 'Delete permanently'}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
