'use client'

import { useId, useState } from 'react'
import { AlertTriangle, Upload } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { acceptedFbiChecks, canUseAffidavit, coachPrograms, fbiNeeds, isFbiRequirement, TODAY } from '@/lib/compliance'
import { FBI_CHECK_LABELS, FBI_CHECKS, PROGRAM_LABELS, type Coach, type FbiCheck, type ObtainedAs, type Requirement } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function actionLabel(req: Requirement) {
  if (req.type === 'Signature') return 'Sign'
  if (req.type === 'Membership') return 'Enter membership'
  return 'Upload'
}

function RadioOption({
  name,
  value,
  checked,
  disabled,
  onChange,
  label,
  hint,
}: {
  name: string
  value: string
  checked: boolean
  disabled?: boolean
  onChange: (v: string) => void
  label: string
  hint?: string | null
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-brand has-checked:bg-secondary ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 size-4 accent-brand"
      />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

export function UploadButton({
  coach,
  requirement,
  variant = 'default',
}: {
  coach: Coach
  requirement: Requirement
  variant?: 'default' | 'outline'
}) {
  const [open, setOpen] = useState(false)
  const { isDemo } = useApp()
  return (
    <>
      <Button variant={variant} disabled={isDemo} title={isDemo ? 'Read-only demonstration' : undefined} className="h-9 px-3 text-sm" onClick={() => setOpen(true)}>
        <Upload aria-hidden="true" />
        {actionLabel(requirement)}
      </Button>
      {open && (
        <UploadDialog coach={coach} requirement={requirement} open={open} onOpenChange={setOpen} />
      )}
    </>
  )
}

function UploadDialog({
  coach,
  requirement: req,
  open,
  onOpenChange,
}: {
  coach: Coach
  requirement: Requirement
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { submitUpload } = useApp()
  const id = useId()
  const affidavit = canUseAffidavit(coach)
  const isFbi = isFbiRequirement(req)
  const programs = coachPrograms(coach)
  const needs = isFbi ? fbiNeeds(coach) : []
  /** Programs where an FBI document type counts for this coach. Empty means it would not count anywhere. */
  const countsFor = (check: FbiCheck) => programs.filter((p) => acceptedFbiChecks(coach, p).includes(check))

  const [file, setFile] = useState<File | undefined>()
  const [busy, setBusy] = useState(false)
  const [completedOn, setCompletedOn] = useState(req.type === 'Signature' ? TODAY : '')
  const [obtainedAs, setObtainedAs] = useState<ObtainedAs>(coach.pay === 'Paid' ? 'Employment' : 'Volunteer')
  const firstNeeded = isFbi ? acceptedFbiChecks(coach, programs[0] ?? 'youth').find((c) => c !== 'affidavit') ?? 'dhs-volunteer' : 'dhs-volunteer'
  const [fbiCheck, setFbiCheck] = useState<FbiCheck>(firstNeeded)
  const [membershipNumber, setMembershipNumber] = useState('')
  const [membershipExpiry, setMembershipExpiry] = useState('')
  const [signedName, setSignedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSignature = req.type === 'Signature'
  const isMembership = req.type === 'Membership'
  const needsFile = !isSignature && !isMembership && !req.dateOnlyAllowed

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (isSignature && !req.helpUrl) return setError('The board must add the document link before you can sign.')
    if (!completedOn) return setError('Enter the completion date.')
    if (completedOn > TODAY) return setError('The completion date cannot be in the future.')
    if (needsFile && !file) return setError('Choose a file to upload.')
    if (isMembership && (!membershipNumber.trim() || !membershipExpiry))
      return setError('Enter your membership number and expiration date.')
    if (isMembership && membershipExpiry <= TODAY) return setError('That membership has already expired.')
    if (isSignature && (!agreed || signedName.trim().toLowerCase() !== coach.name.toLowerCase()))
      return setError(`Check the box and type your full name exactly: ${coach.name}`)
    if (isFbi && fbiCheck === 'affidavit' && !affidavit.allowed)
      return setError(affidavit.reason)
    if (isFbi && countsFor(fbiCheck).length === 0)
      return setError('That check does not count for your role. Choose the check that matches your fingerprint results.')

    setBusy(true)
    try {
      await submitUpload({
        coachId: coach.id, requirementId: req.id, completedOn, file,
        // For the FBI check the document type decides everything; volunteer vs employment follows from it.
        obtainedAs: isFbi ? (fbiCheck === 'dhs-volunteer' || fbiCheck === 'affidavit' ? 'Volunteer' : 'Employment') : req.tracksObtainedAs ? obtainedAs : undefined,
        fbiMethod: isFbi ? (fbiCheck === 'affidavit' ? 'affidavit' : 'fingerprint') : undefined,
        fbiCheck: isFbi ? fbiCheck : undefined,
        membershipNumber: isMembership ? membershipNumber.trim() : undefined,
        membershipExpiry: isMembership ? membershipExpiry : undefined,
        signedName: isSignature ? signedName.trim() : undefined,
        agreed: isSignature ? agreed : undefined,
      })
      onOpenChange(false)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save submission.') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto text-base sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle className="text-lg text-navy">{req.name}</DialogTitle>
            <DialogDescription className="text-base">
              {isSignature
                ? 'Read the handbook, then sign below.'
                : 'Submissions go to the board for review before they count.'}
            </DialogDescription>
          </DialogHeader>

          {isFbi && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-medium">Which check are you uploading?</legend>
              <div className="mb-1 rounded-lg bg-secondary/60 p-3 text-sm">
                <p className="font-medium text-navy">What you need ({coach.pay.toLowerCase()} coach)</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {needs.map((n) => (
                    <li key={n.program}><span className="font-medium">{PROGRAM_LABELS[n.program]}:</span> {n.text}</li>
                  ))}
                </ul>
                {needs.length > 1 && coach.pay === 'Paid' && (
                  <p className="mt-2 text-muted-foreground">You coach both programs, so upload each check separately.</p>
                )}
              </div>
              {FBI_CHECKS.map((check) => {
                const where = countsFor(check)
                const disabled = check === 'affidavit' ? !affidavit.allowed : where.length === 0
                const hint = check === 'affidavit' && !affidavit.allowed
                  ? affidavit.reason
                  : where.length === 0
                    ? 'Does not count for your role.'
                    : `Counts for: ${where.map((p) => PROGRAM_LABELS[p]).join(' and ')}`
                return (
                  <RadioOption
                    key={check}
                    name={`${id}-check`}
                    value={check}
                    checked={fbiCheck === check}
                    disabled={disabled}
                    onChange={(v) => setFbiCheck(v as FbiCheck)}
                    label={FBI_CHECK_LABELS[check]}
                    hint={hint}
                  />
                )
              })}
            </fieldset>
          )}

          {req.tracksObtainedAs && !isFbi && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-medium">Obtained as</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['Volunteer', 'Employment'] as const).map((v) => (
                  <RadioOption
                    key={v}
                    name={`${id}-obtained`}
                    value={v}
                    checked={obtainedAs === v}
                    onChange={(val) => setObtainedAs(val as ObtainedAs)}
                    label={v}
                  />
                ))}
              </div>
              {coach.pay === 'Paid' && obtainedAs === 'Volunteer' ? (
                <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Clearances obtained as a volunteer do not transfer to paid roles. This will not count for{' '}
                  {coach.name}.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Clearances obtained as a volunteer do not transfer to paid roles.
                </p>
              )}
            </fieldset>
          )}

          {isMembership && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor={`${id}-number`}>Membership number</Label>
                <Input
                  id={`${id}-number`}
                  value={membershipNumber}
                  onChange={(e) => setMembershipNumber(e.target.value)}
                  placeholder="e.g. US-123456"
                  className="h-10 text-base"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor={`${id}-expiry`}>Membership expiration date</Label>
                <Input
                  id={`${id}-expiry`}
                  type="date"
                  value={membershipExpiry}
                  min={TODAY}
                  onChange={(e) => setMembershipExpiry(e.target.value)}
                  className="h-10 text-base"
                />
              </div>
            </div>
          )}

          {isSignature ? (
            <div className="flex flex-col gap-4">
              {req.helpUrl ? <a href={req.helpUrl} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-4">Open the {req.helpLinkLabel}</a> : <p role="status" className="text-sm text-destructive">The board must add the document link in Requirements before you can sign.</p>}
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 size-4 accent-brand"
                />
                <span>I have read the SVLA Coach Handbook and agree to follow it.</span>
              </label>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-sign`}>Type your full name to sign</Label>
                <Input
                  id={`${id}-sign`}
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  placeholder={coach.name}
                  autoComplete="name"
                  className="h-10 text-base"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-date`}>
                {isMembership ? 'Date joined or renewed' : 'Date completed or issued'}
              </Label>
              <Input
                id={`${id}-date`}
                type="date"
                value={completedOn}
                max={TODAY}
                onChange={(e) => setCompletedOn(e.target.value)}
                className="h-10 text-base"
              />
            </div>
          )}

          {!isSignature && !isMembership && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-file`}>
                {isFbi && fbiCheck === 'affidavit'
                  ? 'Signed Volunteer Disclosure Statement'
                  : 'Certificate or document'}
                {req.dateOnlyAllowed && <span className="font-normal text-muted-foreground"> (optional)</span>}
              </Label>
              <input
                id={`${id}-file`}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0])}
                className="rounded-lg border border-input p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:font-medium file:text-navy"
              />
              <p className="text-sm text-muted-foreground">
                PDF, JPG, or PNG up to 10 MB. Stored privately; only you and approved board members can access it.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <DialogFooter className="-mx-4 -mb-4 border-t bg-muted/50 p-4">
            <Button type="button" variant="outline" className="h-10 px-4" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-10 px-4" disabled={busy || (isSignature && !req.helpUrl)}>
              {busy ? 'Saving…' : 'Submit for review'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
