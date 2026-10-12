'use client'

import { useId, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function ReviewActions({
  submissionId,
  coachName,
  requirementName,
  warning,
}: {
  submissionId: string
  coachName: string
  requirementName: string
  warning?: string | null
}) {
  const { reviewSubmission, isDemo } = useApp()
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  async function decide(decision: 'approved' | 'rejected') {
    if (busy || isDemo) return
    setBusy(true)
    setSaveError('')
    try { await reviewSubmission(submissionId, decision, decision === 'rejected' ? comment.trim() : undefined); setRejectOpen(false) }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Unable to save review.') }
    finally { setBusy(false) }
  }
  const [rejectOpen, setRejectOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState(false)
  const id = useId()

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        className="h-9 bg-emerald-700 px-3 text-sm text-white hover:bg-emerald-800"
        disabled={busy || isDemo}
        onClick={() => void decide('approved')}
        aria-label={`Approve ${requirementName} for ${coachName}`}
        title={warning ?? undefined}
      >
        <Check aria-hidden="true" />
        Approve
      </Button>
      <Button
        variant="outline"
        className="h-9 border-red-300 px-3 text-sm text-red-800 hover:bg-red-50 hover:text-red-900"
        disabled={busy || isDemo}
        onClick={() => setRejectOpen(true)}
        aria-label={`Reject ${requirementName} for ${coachName}`}
      >
        <X aria-hidden="true" />
        Reject
      </Button>

      {saveError && !rejectOpen && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="text-base sm:max-w-md">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!comment.trim()) return setError(true)
              void decide('rejected')
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-lg text-navy">Reject submission</DialogTitle>
              <DialogDescription className="text-base">
                {requirementName} for {coachName}. The coach will see your comment.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-comment`}>What needs to be fixed?</Label>
              <Textarea
                id={`${id}-comment`}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value)
                  setError(false)
                }}
                rows={4}
                aria-invalid={error}
                placeholder="e.g. The document is blurry. Please upload a clearer copy."
                className="text-base"
              />
              {error && (
                <p role="alert" className="text-sm text-red-800">
                  Add a comment so the coach knows what to fix.
                </p>
              )}
            </div>
            {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
            <DialogFooter className="-mx-4 -mb-4 border-t bg-muted/50 p-4">
              <Button type="button" variant="outline" className="h-10 px-4" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || isDemo} className="h-10 bg-red-700 px-4 text-white hover:bg-red-800">
                Reject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
