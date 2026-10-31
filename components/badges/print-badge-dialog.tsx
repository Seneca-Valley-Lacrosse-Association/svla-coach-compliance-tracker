'use client'

import { useEffect, useState } from 'react'
import { IdCard, Printer, RefreshCw } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { badgeValidThrough, type CoachSummary } from '@/lib/compliance'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FoldBadge } from './badge'
import { PrintSheet } from './print-portal'

/** Preview + print one coach's badge. Board members also get "Issue a new QR code" for a lost badge. */
export function PrintBadgeDialog({ summary, label = 'Print badge' }: { summary: CoachSummary; label?: string }) {
  const { isDemo, viewMode, reissueBadge } = useApp()
  const [open, setOpen] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [origin, setOrigin] = useState('')
  const [confirmReissue, setConfirmReissue] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])

  const { coach } = summary
  if (isDemo || !coach.verifyToken) return null
  const through = badgeValidThrough(summary)
  const cleared = through !== null

  function print() {
    setPrinting(true)
    // Let the print sheet mount before the browser captures the page.
    setTimeout(() => window.print(), 100)
  }
  async function reissue() {
    setBusy(true); setError('')
    try { await reissueBadge(coach.id); setConfirmReissue(false) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not issue a new QR code.') }
    finally { setBusy(false) }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); setConfirmReissue(false); setError('') }}>
        <DialogTrigger render={<Button variant="outline" className="h-10 px-4" />}>
          <IdCard data-icon="inline-start" aria-hidden="true" />
          {label}
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewMode === 'board' ? `Badge for ${coach.name}` : 'Your SVLA coach badge'}</DialogTitle>
            <DialogDescription>
              {cleared
                ? 'Print on letter paper, cut along the outside, and fold on the dashed line. Both sides are the same, so it slides into a badge holder.'
                : 'A badge can be printed once at least one program is cleared. Finish the steps for a program on the checklist first.'}
            </DialogDescription>
          </DialogHeader>
          {cleared && <div className="flex justify-center overflow-x-auto py-2"><FoldBadge summary={summary} origin={origin} /></div>}
          {cleared && <p className="text-sm text-muted-foreground">Anyone who scans the QR code sees live status from SVLA records, so an older printed badge always shows what is true today.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={print} disabled={!cleared} className="h-10 px-4"><Printer data-icon="inline-start" aria-hidden="true" />Print</Button>
            {viewMode === 'board' && !confirmReissue && (
              <Button variant="outline" onClick={() => setConfirmReissue(true)} className="h-10 px-4"><RefreshCw data-icon="inline-start" aria-hidden="true" />Issue a new QR code</Button>
            )}
          </div>
          {viewMode === 'board' && confirmReissue && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p>This stops the coach&apos;s current printed badge from verifying. Do this if a badge was lost. Print a new one afterward.</p>
              <div className="flex gap-2">
                <Button onClick={reissue} disabled={busy} className="h-9 px-3">{busy ? 'Working…' : 'Yes, issue a new code'}</Button>
                <Button variant="outline" onClick={() => setConfirmReissue(false)} className="h-9 px-3">Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {printing && <PrintSheet summaries={[summary]} onDone={() => setPrinting(false)} />}
    </>
  )
}
