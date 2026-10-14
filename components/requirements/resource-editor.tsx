'use client'

import { useId, useState, type FormEvent } from 'react'
import { useApp } from '@/lib/app-store'
import { LEVELS, LEVEL_LABELS, PAY_STATUSES, ROLES, TEAMS, type Team, type Level, type PayStatus, type Requirement, type Role } from '@/lib/types'
import { reasonFor } from '@/lib/requirement-reasons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function ResourceEditor({ requirement }: { requirement: Requirement }) {
  const { updateResource, isDemo } = useApp()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(requirement.help)
  const [helpUrl, setHelpUrl] = useState(requirement.helpUrl)
  const [helpLinkLabel, setHelpLinkLabel] = useState(requirement.helpLinkLabel)
  const current = reasonFor(requirement)
  const [level, setLevel] = useState<Level>(current?.level ?? 'both')
  const [why, setWhy] = useState(current?.why ?? '')
  const [source, setSource] = useState(current?.source ?? '')
  const [sourceUrl, setSourceUrl] = useState(current?.sourceUrl ?? '')
  const [roles, setRoles] = useState<Role[]>(requirement.appliesToRoles)
  const [pay, setPay] = useState<PayStatus[]>(requirement.appliesToPay)
  const [teams, setTeams] = useState<Team[]>(requirement.appliesToTeams?.length ? requirement.appliesToTeams : [...TEAMS])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (roles.length === 0 || pay.length === 0 || teams.length === 0) return setError('Pick at least one role, one pay status and one team.')
    setBusy(true); setError('')
    try { await updateResource(requirement.id, { help, helpUrl, helpLinkLabel, level, why, source, sourceUrl, appliesToRoles: roles, appliesToPay: pay, appliesToTeams: teams.length === TEAMS.length ? [] : teams }); setOpen(false) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save resource.') }
    finally { setBusy(false) }
  }
  return <>
    <Button variant="link" size="sm" disabled={isDemo} onClick={() => setOpen(true)}>Edit requirement</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader><DialogTitle>Edit resource</DialogTitle><DialogDescription>{requirement.name}. Use the current approved document or provider link.</DialogDescription></DialogHeader>
          <FieldGroup>
            <Field><FieldLabel htmlFor={`${id}-help`}>Instructions</FieldLabel><Textarea id={`${id}-help`} value={help} onChange={e => setHelp(e.target.value)} required maxLength={3000} /></Field>
            <Field><FieldLabel htmlFor={`${id}-url`}>HTTPS document or help URL</FieldLabel><Input id={`${id}-url`} type="url" value={helpUrl} onChange={e => setHelpUrl(e.target.value)} placeholder="https://" /></Field>
            <Field><FieldLabel htmlFor={`${id}-label`}>Link label</FieldLabel><Input id={`${id}-label`} value={helpLinkLabel} onChange={e => setHelpLinkLabel(e.target.value)} maxLength={150} /></Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Roles it applies to</legend>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {ROLES.map(r => <label key={r} className="flex items-center gap-2"><input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles(roles.includes(r) ? roles.filter(x => x !== r) : [...roles, r])} className="size-4 accent-brand" />{r}</label>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Pay status it applies to</legend>
              <div className="flex gap-6 text-sm">
                {PAY_STATUSES.map(p => <label key={p} className="flex items-center gap-2"><input type="checkbox" checked={pay.includes(p)} onChange={() => setPay(pay.includes(p) ? pay.filter(x => x !== p) : [...pay, p])} className="size-4 accent-brand" />{p}</label>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Teams it applies to</legend>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {TEAMS.map(t => <label key={t} className="flex items-center gap-2"><input type="checkbox" checked={teams.includes(t)} onChange={() => setTeams(teams.includes(t) ? teams.filter(x => x !== t) : [...teams, t])} className="size-4 accent-brand" />{t}</label>)}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">All teams checked means every team.</p>
            </fieldset>
            <Field>
              <FieldLabel htmlFor={`${id}-level`}>Program (youth, high school or both)</FieldLabel>
              <select id={`${id}-level`} value={level} onChange={e => setLevel(e.target.value as Level)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
              </select>
            </Field>
            <Field><FieldLabel htmlFor={`${id}-why`}>Why we require this</FieldLabel><Textarea id={`${id}-why`} value={why} onChange={e => setWhy(e.target.value)} maxLength={1500} /></Field>
            <Field><FieldLabel htmlFor={`${id}-source`}>Where it comes from</FieldLabel><Input id={`${id}-source`} value={source} onChange={e => setSource(e.target.value)} maxLength={300} placeholder="For example: PIAA, PA law, SVLA policy" /></Field>
            <Field><FieldLabel htmlFor={`${id}-source-url`}>Source link (optional)</FieldLabel><Input id={`${id}-source-url`} type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://" /></Field>
          </FieldGroup>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save resource'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>
}
