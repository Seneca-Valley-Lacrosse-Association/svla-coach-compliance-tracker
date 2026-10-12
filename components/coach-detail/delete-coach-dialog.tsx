'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/app-store'
import type { Coach } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export function DeleteCoachDialog({ coach }: { coach: Coach }) {
  const { deleteCoach, isDemo } = useApp()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (busy) return
    setBusy(true); setError('')
    try { await deleteCoach(coach.id); setOpen(false); router.push('/coaches') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete this coach.') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={next => { setOpen(next); setError('') }}>
      <DialogTrigger disabled={isDemo} render={<Button variant="outline" className="h-10 px-4 text-destructive" disabled={isDemo} />}>
        <Trash2 data-icon="inline-start" aria-hidden="true" />
        Delete coach
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {coach.name}?</DialogTitle>
          <DialogDescription>This permanently removes {coach.name} from the roster, along with every submission and uploaded document on their record. It cannot be undone. Export the data from Reports first if you need a copy. Their sign-in account is not deleted; if they sign in again they will be asked to complete a new profile.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={busy}>{busy ? 'Deleting…' : 'Delete permanently'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
