'use client'

import { useId, useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { useApp } from '@/lib/app-store'
import { PAY_STATUSES, ROLES, TEAMS, TEAM_PROGRAMS, type Coach } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CoachProgramsField } from '@/components/coach-programs-field'

const selectClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-brand'

export function EditCoachDialog({ coach }: { coach: Coach }) {
  const { editCoach, isDemo } = useApp()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [nameError, setNameError] = useState('')
  const [draft, setDraft] = useState({ name: coach.name, phone: coach.phone, team: coach.team, role: coach.role, pay: coach.pay, paResident10Years: coach.paResident10Years, alsoCoachesYouth: !!coach.alsoCoachesYouth })

  function changeOpen(next: boolean) {
    setOpen(next)
    if (next) setDraft({ name: coach.name, phone: coach.phone, team: coach.team, role: coach.role, pay: coach.pay, paResident10Years: coach.paResident10Years, alsoCoachesYouth: !!coach.alsoCoachesYouth })
    setSaveError(''); setNameError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const name = draft.name.trim()
    if (!name) return setNameError('Enter the coach’s name.')
    setBusy(true); setSaveError('')
    try { await editCoach(coach.id, { ...draft, name, phone: draft.phone.trim() }); changeOpen(false) }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save changes.') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger disabled={isDemo} render={<Button variant="outline" className="h-10 px-4" disabled={isDemo} />}>
        <Pencil data-icon="inline-start" aria-hidden="true" />
        Edit coach
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Edit {coach.name}</DialogTitle>
            <DialogDescription>Changing the team, program, role, or pay status updates which requirements apply to this coach. Email ({coach.email}) cannot be changed here because it links the coach to their account.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!nameError}>
              <FieldLabel htmlFor={`${id}-name`}>Full name</FieldLabel>
              <Input id={`${id}-name`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={100} required aria-invalid={!!nameError} />
              {nameError && <FieldError>{nameError}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-phone`}>Phone (optional)</FieldLabel>
              <Input id={`${id}-phone`} type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} maxLength={40} />
            </Field>
            <FieldGroup className="sm:flex-row">
              <Field>
                <FieldLabel htmlFor={`${id}-team`}>Team</FieldLabel>
                <select id={`${id}-team`} className={selectClass} value={draft.team} onChange={(e) => { const team = e.target.value as Coach['team']; setDraft({ ...draft, team, alsoCoachesYouth: TEAM_PROGRAMS[team].includes('youth') ? false : draft.alsoCoachesYouth }) }}>
                  {TEAMS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-role`}>Role</FieldLabel>
                <select id={`${id}-role`} className={selectClass} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Coach['role'] })}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </FieldGroup>
            <CoachProgramsField team={draft.team} alsoCoachesYouth={draft.alsoCoachesYouth} onChange={(alsoCoachesYouth) => setDraft({ ...draft, alsoCoachesYouth })} />
            <Field>
              <FieldLabel htmlFor={`${id}-pay`}>Pay status</FieldLabel>
              <select id={`${id}-pay`} className={selectClass} value={draft.pay} onChange={(e) => { const pay = e.target.value as Coach['pay']; setDraft({ ...draft, pay, paResident10Years: pay === 'Paid' ? false : draft.paResident10Years }) }}>
                {PAY_STATUSES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            {draft.pay !== 'Paid' && (
            <Field>
              <FieldLabel htmlFor={`${id}-resident`}>PA resident for 10 consecutive years?</FieldLabel>
              <select id={`${id}-resident`} className={selectClass} value={draft.paResident10Years ? 'yes' : 'no'} onChange={(e) => setDraft({ ...draft, paResident10Years: e.target.value === 'yes' })}>
                <option value="no">No / not confirmed</option>
                <option value="yes">Yes</option>
              </select>
              <FieldDescription>Applies to volunteers only. An eligible volunteer may use the disclosure affidavit instead of fingerprints.</FieldDescription>
            </Field>
            )}
          </FieldGroup>
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
