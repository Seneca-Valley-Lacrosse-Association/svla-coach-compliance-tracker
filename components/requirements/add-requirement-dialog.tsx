'use client'

import { useId, useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { PAY_STATUSES, ROLES, type PayStatus, type RequirementType, type Role, type Validity } from '@/lib/types'
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
import { Textarea } from '@/components/ui/textarea'

const selectClass =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-brand'

type ValidityKind = Validity['kind']

export function AddRequirementDialog() {
  const { addRequirement, isDemo } = useApp()
  const [busy, setBusy] = useState(false)
  const id = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<RequirementType>('File')
  const [roles, setRoles] = useState<Role[]>([...ROLES])
  const [pay, setPay] = useState<PayStatus[]>([...PAY_STATUSES])
  const [validityKind, setValidityKind] = useState<ValidityKind>('years')
  const [years, setYears] = useState(1)
  const [required, setRequired] = useState(true)
  const [help, setHelp] = useState('')
  const [helpUrl, setHelpUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setType('File')
    setRoles([...ROLES])
    setPay([...PAY_STATUSES])
    setValidityKind('years')
    setYears(1)
    setRequired(true)
    setHelp('')
    setHelpUrl('')
    setError(null)
  }

  function toggle<T>(list: T[], value: T) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!name.trim()) return setError('Give the requirement a name.')
    if (roles.length === 0 || pay.length === 0) return setError('Pick at least one role and one pay status.')
    if (validityKind === 'years' && (!Number.isInteger(years) || years < 1 || years > 10))
      return setError('Years must be a whole number from 1 to 10.')
    if (helpUrl && (!helpUrl.startsWith('https://') || !URL.canParse(helpUrl))) return setError('Use a valid https:// help link.')
    if ((type === 'Membership') !== (validityKind === 'membership')) return setError('Membership requirements must use membership-term validity.')

    const validity: Validity =
      validityKind === 'years' ? { kind: 'years', years } : ({ kind: validityKind } as Validity)

    setBusy(true)
    try {
      await addRequirement({
        name: name.trim(), type, appliesToRoles: roles, appliesToPay: pay,
        validity, required, active: true,
        help: help.trim() || 'Ask the board for instructions on completing this requirement.',
        helpUrl: helpUrl.trim(), helpLinkLabel: helpUrl ? 'More information' : '',
      })
      reset()
      setOpen(false)
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save requirement.') }
    finally { setBusy(false) }
  }

  return (
    <>
      <Button className="h-10 px-4" disabled={isDemo} onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Add requirement
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto text-base sm:max-w-lg">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <DialogHeader>
              <DialogTitle className="text-lg text-navy">Add requirement</DialogTitle>
              <DialogDescription className="text-base">
                New requirements appear on every matching coach&apos;s checklist right away.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-name`}>Name</Label>
              <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} className="h-10 text-base" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-type`}>Type</Label>
                <select id={`${id}-type`} value={type} onChange={(e) => setType(e.target.value as RequirementType)} className={selectClass}>
                  {(['File', 'Training', 'Membership', 'Signature'] as const).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-validity`}>Valid for</Label>
                <select
                  id={`${id}-validity`}
                  value={validityKind}
                  onChange={(e) => setValidityKind(e.target.value as ValidityKind)}
                  className={selectClass}
                >
                  <option value="years">Number of years</option>
                  <option value="school-year">School year (ends June 30)</option>
                  <option value="membership">Membership term</option>
                  <option value="one-time">One-time</option>
                </select>
              </div>
              {validityKind === 'years' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-years`}>Years</Label>
                  <Input
                    id={`${id}-years`}
                    type="number"
                    min={1}
                    max={10}
                    value={years}
                    onChange={(e) => setYears(Number(e.target.value))}
                    className="h-10 text-base"
                  />
                </div>
              )}
            </div>

            <fieldset>
              <legend className="mb-2 font-medium">Applies to roles</legend>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2">
                    <input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles(toggle(roles, r))} className="size-4 accent-brand" />
                    {r}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 font-medium">Applies to pay status</legend>
              <div className="flex gap-6">
                {PAY_STATUSES.map((p) => (
                  <label key={p} className="flex items-center gap-2">
                    <input type="checkbox" checked={pay.includes(p)} onChange={() => setPay(toggle(pay, p))} className="size-4 accent-brand" />
                    {p}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="size-4 accent-brand" />
              Required to be cleared to coach
            </label>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-help`}>How to get this (shown to coaches)</Label>
              <Textarea id={`${id}-help`} value={help} onChange={(e) => setHelp(e.target.value)} rows={3} className="text-base" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-url`}>Help link</Label>
              <Input
                id={`${id}-url`}
                type="url"
                value={helpUrl}
                onChange={(e) => setHelpUrl(e.target.value)}
                placeholder="https://"
                className="h-10 text-base"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}

            <DialogFooter className="-mx-4 -mb-4 border-t bg-muted/50 p-4">
              <Button type="button" variant="outline" className="h-10 px-4" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || isDemo} className="h-10 px-4">
                Add requirement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
